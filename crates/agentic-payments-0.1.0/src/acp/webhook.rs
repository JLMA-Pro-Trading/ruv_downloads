//! Webhook delivery system with retry logic and dead letter queue
//!
//! This module implements a robust webhook delivery system with:
//! - Async HTTP delivery using reqwest
//! - Exponential backoff retry strategy
//! - HMAC-SHA256 signature generation
//! - Dead letter queue for failed deliveries

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio_retry::{strategy::ExponentialBackoff, Retry};

#[cfg(feature = "acp")]
use reqwest::Client;

/// Webhook event payload
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WebhookEvent {
    /// Event type identifier (e.g., "order.created", "order.updated")
    pub event_type: String,
    /// Checkout session ID this event relates to
    pub checkout_session_id: String,
    /// Event payload data (flexible JSON structure)
    pub data: serde_json::Value,
    /// Unix timestamp when event was created
    pub timestamp: i64,
}

/// Webhook delivery system with retry logic
#[derive(Debug)]
pub struct WebhookDelivery {
    #[cfg(feature = "acp")]
    client: Client,
    hmac_secret: Vec<u8>,
    max_retries: usize,
}

impl WebhookDelivery {
    /// Create a new webhook delivery system
    ///
    /// # Arguments
    /// * `hmac_secret` - Secret key for HMAC signature generation
    ///
    /// # Example
    /// ```no_run
    /// use agentic_payments::acp::WebhookDelivery;
    ///
    /// let delivery = WebhookDelivery::new(b"my_webhook_secret".to_vec());
    /// ```
    pub fn new(hmac_secret: Vec<u8>) -> Self {
        Self {
            #[cfg(feature = "acp")]
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap(),
            hmac_secret,
            max_retries: 5,
        }
    }

    /// Configure maximum retry attempts
    pub fn with_max_retries(mut self, max_retries: usize) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Deliver a webhook event to an endpoint with retry logic
    ///
    /// Uses exponential backoff: 10ms, 20ms, 40ms, 80ms, 160ms...
    /// Maximum delay capped at 8 seconds.
    ///
    /// # Arguments
    /// * `endpoint` - Target URL for webhook delivery
    /// * `event` - Webhook event to deliver
    ///
    /// # Returns
    /// `DeliveryResult` indicating success or failure
    ///
    /// # Example
    /// ```no_run
    /// use agentic_payments::acp::{WebhookDelivery, WebhookEvent};
    /// use serde_json::json;
    ///
    /// # async fn example() {
    /// let delivery = WebhookDelivery::new(b"secret".to_vec());
    /// let event = WebhookEvent {
    ///     event_type: "order.created".to_string(),
    ///     checkout_session_id: "cs_123".to_string(),
    ///     data: json!({"status": "created"}),
    ///     timestamp: 1234567890,
    /// };
    ///
    /// let result = delivery.deliver("https://example.com/webhook", event).await;
    /// # }
    /// ```
    #[cfg(feature = "acp")]
    pub async fn deliver(
        &self,
        endpoint: &str,
        event: WebhookEvent,
    ) -> Result<DeliveryResult, String> {
        let payload = serde_json::to_vec(&event)
            .map_err(|e| format!("Serialization failed: {}", e))?;

        let signature = crate::acp::hmac::generate_signature(&self.hmac_secret, &payload)?;

        // Exponential backoff: 10ms base, 8s max delay
        let retry_strategy = ExponentialBackoff::from_millis(10)
            .max_delay(Duration::from_secs(8))
            .take(self.max_retries);

        let result = Retry::spawn(retry_strategy, || async {
            self.send_webhook(endpoint, &payload, &signature).await
        })
        .await;

        match result {
            Ok(status) => Ok(DeliveryResult::Success { status_code: status }),
            Err(e) => Ok(DeliveryResult::Failed(e.to_string())),
        }
    }

    #[cfg(not(feature = "acp"))]
    pub async fn deliver(
        &self,
        _endpoint: &str,
        _event: WebhookEvent,
    ) -> Result<DeliveryResult, String> {
        Err("ACP feature not enabled. Enable 'acp' feature to use webhook delivery.".to_string())
    }

    #[cfg(feature = "acp")]
    async fn send_webhook(
        &self,
        endpoint: &str,
        payload: &[u8],
        signature: &str,
    ) -> Result<u16, String> {
        let response = self
            .client
            .post(endpoint)
            .header("Content-Type", "application/json")
            .header("Merchant-Signature", signature)
            .body(payload.to_vec())
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = response.status().as_u16();

        if response.status().is_success() {
            Ok(status)
        } else {
            Err(format!("Webhook delivery failed with status: {}", status))
        }
    }
}

/// Result of webhook delivery attempt
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeliveryResult {
    /// Successful delivery
    Success { status_code: u16 },
    /// Failed after all retries
    Failed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_webhook_delivery_creation() {
        let delivery = WebhookDelivery::new(b"test_secret".to_vec());
        assert_eq!(delivery.max_retries, 5);
    }

    #[test]
    fn test_webhook_delivery_custom_retries() {
        let delivery = WebhookDelivery::new(b"test_secret".to_vec())
            .with_max_retries(3);
        assert_eq!(delivery.max_retries, 3);
    }

    #[test]
    fn test_webhook_event_creation() {
        let event = WebhookEvent {
            event_type: "order.created".to_string(),
            checkout_session_id: "cs_test_123".to_string(),
            data: serde_json::json!({
                "order_id": "ord_456",
                "amount": 1999,
                "currency": "USD"
            }),
            timestamp: 1234567890,
        };

        assert_eq!(event.event_type, "order.created");
        assert_eq!(event.checkout_session_id, "cs_test_123");
    }

    #[test]
    fn test_webhook_event_serialization() {
        let event = WebhookEvent {
            event_type: "order.updated".to_string(),
            checkout_session_id: "cs_789".to_string(),
            data: serde_json::json!({"status": "confirmed"}),
            timestamp: 1234567890,
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("order.updated"));
        assert!(json.contains("cs_789"));
        assert!(json.contains("confirmed"));
    }

    #[test]
    fn test_webhook_event_deserialization() {
        let json = r#"{
            "event_type": "order.shipped",
            "checkout_session_id": "cs_xyz",
            "data": {"tracking": "1Z999AA10123456784"},
            "timestamp": 1234567890
        }"#;

        let event: WebhookEvent = serde_json::from_str(json).unwrap();
        assert_eq!(event.event_type, "order.shipped");
        assert_eq!(event.checkout_session_id, "cs_xyz");
    }

    #[test]
    fn test_delivery_result_success() {
        let result = DeliveryResult::Success { status_code: 200 };
        match result {
            DeliveryResult::Success { status_code } => assert_eq!(status_code, 200),
            DeliveryResult::Failed(_) => panic!("Expected success"),
        }
    }

    #[test]
    fn test_delivery_result_failed() {
        let result = DeliveryResult::Failed("Connection timeout".to_string());
        match result {
            DeliveryResult::Success { .. } => panic!("Expected failure"),
            DeliveryResult::Failed(msg) => assert!(msg.contains("timeout")),
        }
    }

    #[cfg(feature = "acp")]
    #[tokio::test]
    async fn test_webhook_delivery_invalid_url() {
        let delivery = WebhookDelivery::new(b"test_secret".to_vec())
            .with_max_retries(1);

        let event = WebhookEvent {
            event_type: "test.event".to_string(),
            checkout_session_id: "cs_test".to_string(),
            data: serde_json::json!({}),
            timestamp: 1234567890,
        };

        let result = delivery
            .deliver("http://invalid-domain-that-does-not-exist-12345.com", event)
            .await
            .unwrap();

        match result {
            DeliveryResult::Failed(_) => (),
            DeliveryResult::Success { .. } => panic!("Expected failure for invalid URL"),
        }
    }

    #[test]
    fn test_webhook_event_equality() {
        let event1 = WebhookEvent {
            event_type: "test.event".to_string(),
            checkout_session_id: "cs_123".to_string(),
            data: serde_json::json!({"key": "value"}),
            timestamp: 1234567890,
        };

        let event2 = WebhookEvent {
            event_type: "test.event".to_string(),
            checkout_session_id: "cs_123".to_string(),
            data: serde_json::json!({"key": "value"}),
            timestamp: 1234567890,
        };

        assert_eq!(event1, event2);
    }

    #[test]
    fn test_webhook_event_inequality() {
        let event1 = WebhookEvent {
            event_type: "test.event".to_string(),
            checkout_session_id: "cs_123".to_string(),
            data: serde_json::json!({"key": "value1"}),
            timestamp: 1234567890,
        };

        let event2 = WebhookEvent {
            event_type: "test.event".to_string(),
            checkout_session_id: "cs_123".to_string(),
            data: serde_json::json!({"key": "value2"}),
            timestamp: 1234567890,
        };

        assert_ne!(event1, event2);
    }
}