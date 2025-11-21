# ACP Webhook System Implementation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Models](#data-models)
4. [HMAC Signature System](#hmac-signature-system)
5. [Async Delivery Pipeline](#async-delivery-pipeline)
6. [Retry Strategy](#retry-strategy)
7. [Dead Letter Queue](#dead-letter-queue)
8. [AP2 Consensus Integration](#ap2-consensus-integration)
9. [WASM Compatibility](#wasm-compatibility)
10. [Code Examples](#code-examples)
11. [Testing Strategy](#testing-strategy)

## Overview

The ACP Webhook System enables merchants to send order lifecycle events to OpenAI/ChatGPT, keeping the AI assistant synchronized with real-time fulfillment data. The system is designed for:

- **Security**: HMAC-SHA256 signature verification using Ed25519 infrastructure
- **Reliability**: Async delivery with exponential backoff retry
- **Observability**: Event tracking and dead letter queue for failed deliveries
- **Consensus**: Integration with AP2's Byzantine Fault Tolerant consensus for critical events
- **Portability**: Full WASM compatibility for browser and edge deployments

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ACP Webhook System                               │
└─────────────────────────────────────────────────────────────────────────┘

  Merchant Order Events
         │
         ▼
┌──────────────────────┐
│  Webhook Receiver    │◄──── HMAC Signature Verification
│  (HTTP Endpoint)     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Event Validator     │◄──── Schema Validation (OpenAPI)
│  (JSON Schema)       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Event Queue         │◄──── Async Channel (tokio::mpsc)
│  (In-Memory/Durable) │
└──────────┬───────────┘
           │
           ├─────────────────────────────────────────┐
           │                                         │
           ▼                                         ▼
┌──────────────────────┐                  ┌──────────────────────┐
│  Delivery Worker     │                  │  AP2 Consensus       │
│  (Async Tasks)       │                  │  (BFT Integration)   │
└──────────┬───────────┘                  └──────────────────────┘
           │                                         │
           │  ┌─────── Retry Logic ─────┐           │
           │  │  Attempt 1: Immediate    │           │
           │  │  Attempt 2: 2s delay     │           │
           │  │  Attempt 3: 4s delay     │           │
           │  │  Attempt 4: 8s delay     │           │
           │  │  Attempt 5: 16s delay    │           │
           │  └──────────────────────────┘           │
           │                                         │
           ├──────────┬──────────────────────────────┘
           │          │
           ▼          ▼
┌──────────────────────┐              ┌──────────────────────┐
│  Webhook Delivery    │   Failed     │  Dead Letter Queue   │
│  (HTTP POST)         ├─────────────►│  (Persistent Store)  │
└──────────────────────┘              └──────────────────────┘
           │
           ▼
    OpenAI Endpoint
 (ChatGPT Order Sync)
```

### Component Responsibilities

1. **Webhook Receiver**: HTTP endpoint accepting order events with HMAC verification
2. **Event Validator**: JSON schema validation against OpenAPI spec
3. **Event Queue**: Async channel for decoupling ingestion from delivery
4. **Delivery Worker**: Async task pool handling webhook delivery with retry
5. **AP2 Consensus**: BFT consensus for critical state transitions (order confirmation, cancellation)
6. **Dead Letter Queue**: Persistent storage for permanently failed deliveries

## Data Models

### Core Structs

```rust
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Webhook event types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    OrderCreate,
    OrderUpdate,
}

/// Order lifecycle statuses
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Created,
    ManualReview,
    Confirmed,
    Canceled,
    Shipped,
    Fulfilled,
}

/// Refund types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RefundType {
    StoreCredit,
    OriginalPayment,
}

/// Refund details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Refund {
    #[serde(rename = "type")]
    pub refund_type: RefundType,
    /// Amount in cents
    pub amount: i64,
}

/// Order data payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDataOrder {
    #[serde(rename = "type")]
    pub data_type: String, // Always "order"
    pub checkout_session_id: String,
    pub permalink_url: String,
    pub status: OrderStatus,
    pub refunds: Vec<Refund>,
}

/// Top-level webhook event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    #[serde(rename = "type")]
    pub event_type: EventType,
    pub data: EventDataOrder,
}

/// Webhook delivery metadata
#[derive(Debug, Clone)]
pub struct WebhookDelivery {
    pub event: WebhookEvent,
    pub target_url: String,
    pub merchant_id: String,
    pub hmac_secret: Vec<u8>,
    pub timestamp: DateTime<Utc>,
    pub request_id: String,
    pub attempt_count: u32,
}

/// Webhook delivery result
#[derive(Debug, Clone)]
pub struct DeliveryResult {
    pub success: bool,
    pub status_code: Option<u16>,
    pub response_body: Option<String>,
    pub error: Option<String>,
    pub attempt_count: u32,
    pub final_attempt: bool,
}
```

## HMAC Signature System

### Signature Generation

The merchant signs webhook payloads using HMAC-SHA256:

```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;
use hex;

type HmacSha256 = Hmac<Sha256>;

/// Generate HMAC signature for webhook payload
pub fn generate_hmac_signature(
    payload: &[u8],
    secret: &[u8],
) -> Result<String, String> {
    let mut mac = HmacSha256::new_from_slice(secret)
        .map_err(|e| format!("Invalid HMAC key: {}", e))?;

    mac.update(payload);
    let result = mac.finalize();
    let signature = hex::encode(result.into_bytes());

    Ok(signature)
}

/// Verify HMAC signature from header
pub fn verify_hmac_signature(
    payload: &[u8],
    secret: &[u8],
    signature_header: &str,
) -> Result<bool, String> {
    let mut mac = HmacSha256::new_from_slice(secret)
        .map_err(|e| format!("Invalid HMAC key: {}", e))?;

    mac.update(payload);

    // Parse hex signature from header
    let expected_signature = hex::decode(signature_header)
        .map_err(|e| format!("Invalid hex signature: {}", e))?;

    // Constant-time comparison
    mac.verify_slice(&expected_signature)
        .map(|_| true)
        .map_err(|_| "Signature mismatch".to_string())
}
```

### Integration with Ed25519 Infrastructure

The existing Ed25519 key infrastructure can be used for HMAC key derivation:

```rust
use ed25519_dalek::SecretKey;
use hkdf::Hkdf;
use sha2::Sha256;

/// Derive HMAC secret from Ed25519 private key
pub fn derive_hmac_secret(
    ed25519_secret: &SecretKey,
    merchant_id: &str,
    salt: &[u8],
) -> Result<Vec<u8>, String> {
    let hkdf = Hkdf::<Sha256>::new(Some(salt), ed25519_secret.as_bytes());
    let mut hmac_secret = vec![0u8; 32]; // 256-bit key

    let info = format!("acp-webhook-{}", merchant_id);
    hkdf.expand(info.as_bytes(), &mut hmac_secret)
        .map_err(|e| format!("HKDF expansion failed: {}", e))?;

    Ok(hmac_secret)
}
```

### HTTP Header Format

```
Merchant-Signature: <merchant_name>-<hex_encoded_hmac_sha256>
Request-Id: <uuid_v4>
Timestamp: <iso8601_datetime>
Content-Type: application/json
```

Example:
```
Merchant-Signature: acme_corp-a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
Request-Id: 550e8400-e29b-41d4-a716-446655440000
Timestamp: 2025-09-29T10:30:00Z
Content-Type: application/json
```

## Async Delivery Pipeline

### Event Queue Design

```rust
use tokio::sync::mpsc;
use std::sync::Arc;

/// Webhook delivery configuration
#[derive(Debug, Clone)]
pub struct WebhookConfig {
    pub max_retry_attempts: u32,
    pub initial_retry_delay_ms: u64,
    pub max_retry_delay_ms: u64,
    pub worker_pool_size: usize,
    pub queue_capacity: usize,
    pub enable_ap2_consensus: bool,
}

impl Default for WebhookConfig {
    fn default() -> Self {
        Self {
            max_retry_attempts: 5,
            initial_retry_delay_ms: 1000,
            max_retry_delay_ms: 60000,
            worker_pool_size: 10,
            queue_capacity: 1000,
            enable_ap2_consensus: true,
        }
    }
}

/// Webhook delivery system
pub struct WebhookDeliverySystem {
    config: Arc<WebhookConfig>,
    event_tx: mpsc::Sender<WebhookDelivery>,
    workers: Vec<tokio::task::JoinHandle<()>>,
}

impl WebhookDeliverySystem {
    /// Create new webhook delivery system
    pub fn new(config: WebhookConfig) -> Self {
        let (event_tx, event_rx) = mpsc::channel(config.queue_capacity);
        let config = Arc::new(config);
        let workers = Vec::new();

        Self {
            config,
            event_tx,
            workers,
        }
    }

    /// Start worker pool
    pub async fn start(&mut self) -> Result<(), String> {
        let event_rx = Arc::new(tokio::sync::Mutex::new(self.event_rx.clone()));

        for worker_id in 0..self.config.worker_pool_size {
            let config = self.config.clone();
            let event_rx = event_rx.clone();

            let worker = tokio::spawn(async move {
                Self::worker_loop(worker_id, config, event_rx).await;
            });

            self.workers.push(worker);
        }

        Ok(())
    }

    /// Enqueue webhook for delivery
    pub async fn enqueue(&self, delivery: WebhookDelivery) -> Result<(), String> {
        self.event_tx
            .send(delivery)
            .await
            .map_err(|e| format!("Failed to enqueue webhook: {}", e))
    }

    /// Worker loop processing webhooks
    async fn worker_loop(
        worker_id: usize,
        config: Arc<WebhookConfig>,
        event_rx: Arc<tokio::sync::Mutex<mpsc::Receiver<WebhookDelivery>>>,
    ) {
        loop {
            let delivery = {
                let mut rx = event_rx.lock().await;
                rx.recv().await
            };

            match delivery {
                Some(mut delivery) => {
                    log::info!(
                        "Worker {}: Processing webhook for merchant {}",
                        worker_id,
                        delivery.merchant_id
                    );

                    let result = Self::deliver_with_retry(&mut delivery, &config).await;

                    if !result.success {
                        log::error!(
                            "Worker {}: Failed to deliver webhook after {} attempts: {:?}",
                            worker_id,
                            result.attempt_count,
                            result.error
                        );

                        // Send to dead letter queue
                        Self::send_to_dlq(delivery, result).await;
                    }
                }
                None => {
                    log::info!("Worker {}: Channel closed, shutting down", worker_id);
                    break;
                }
            }
        }
    }
}
```

## Retry Strategy

### Exponential Backoff Implementation

```rust
use tokio::time::{sleep, Duration};

impl WebhookDeliverySystem {
    /// Deliver webhook with exponential backoff retry
    async fn deliver_with_retry(
        delivery: &mut WebhookDelivery,
        config: &WebhookConfig,
    ) -> DeliveryResult {
        let mut last_error = None;

        for attempt in 1..=config.max_retry_attempts {
            delivery.attempt_count = attempt;

            match Self::deliver_webhook(delivery).await {
                Ok(response) => {
                    if response.status_code >= 200 && response.status_code < 300 {
                        log::info!(
                            "Webhook delivered successfully on attempt {} to {}",
                            attempt,
                            delivery.target_url
                        );
                        return DeliveryResult {
                            success: true,
                            status_code: Some(response.status_code),
                            response_body: response.body,
                            error: None,
                            attempt_count: attempt,
                            final_attempt: false,
                        };
                    } else {
                        last_error = Some(format!(
                            "HTTP {}: {}",
                            response.status_code,
                            response.body.unwrap_or_default()
                        ));
                    }
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                }
            }

            // Don't retry on final attempt
            if attempt < config.max_retry_attempts {
                let delay = Self::calculate_backoff_delay(
                    attempt,
                    config.initial_retry_delay_ms,
                    config.max_retry_delay_ms,
                );

                log::warn!(
                    "Webhook delivery attempt {} failed, retrying in {}ms",
                    attempt,
                    delay.as_millis()
                );

                sleep(delay).await;
            }
        }

        DeliveryResult {
            success: false,
            status_code: None,
            response_body: None,
            error: last_error,
            attempt_count: config.max_retry_attempts,
            final_attempt: true,
        }
    }

    /// Calculate exponential backoff delay with jitter
    fn calculate_backoff_delay(
        attempt: u32,
        initial_delay_ms: u64,
        max_delay_ms: u64,
    ) -> Duration {
        // Exponential: delay = initial * 2^(attempt - 1)
        let exponential_delay = initial_delay_ms * 2u64.pow(attempt - 1);

        // Cap at max delay
        let capped_delay = exponential_delay.min(max_delay_ms);

        // Add jitter (±10%) to prevent thundering herd
        let jitter_range = (capped_delay as f64 * 0.1) as u64;
        let jitter = rand::random::<u64>() % jitter_range;
        let final_delay = capped_delay + jitter - (jitter_range / 2);

        Duration::from_millis(final_delay)
    }
}
```

### Retry Schedule Example

| Attempt | Delay (Base) | Delay (With Jitter) |
|---------|--------------|---------------------|
| 1       | 0ms          | 0ms                 |
| 2       | 1000ms       | 900-1100ms          |
| 3       | 2000ms       | 1800-2200ms         |
| 4       | 4000ms       | 3600-4400ms         |
| 5       | 8000ms       | 7200-8800ms         |

## Dead Letter Queue

### DLQ Storage Interface

```rust
use async_trait::async_trait;

/// Dead letter queue entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlqEntry {
    pub id: String,
    pub delivery: WebhookDelivery,
    pub result: DeliveryResult,
    pub timestamp: DateTime<Utc>,
    pub retry_after: Option<DateTime<Utc>>,
}

/// Dead letter queue trait
#[async_trait]
pub trait DeadLetterQueue: Send + Sync {
    /// Store failed delivery
    async fn store(&self, entry: DlqEntry) -> Result<(), String>;

    /// Retrieve entry by ID
    async fn get(&self, id: &str) -> Result<Option<DlqEntry>, String>;

    /// List all entries
    async fn list(&self, limit: usize, offset: usize) -> Result<Vec<DlqEntry>, String>;

    /// Retry entry
    async fn retry(&self, id: &str) -> Result<(), String>;

    /// Delete entry
    async fn delete(&self, id: &str) -> Result<(), String>;
}

/// In-memory DLQ implementation (for development)
pub struct InMemoryDlq {
    entries: Arc<tokio::sync::RwLock<HashMap<String, DlqEntry>>>,
}

#[async_trait]
impl DeadLetterQueue for InMemoryDlq {
    async fn store(&self, entry: DlqEntry) -> Result<(), String> {
        let mut entries = self.entries.write().await;
        entries.insert(entry.id.clone(), entry);
        Ok(())
    }

    async fn get(&self, id: &str) -> Result<Option<DlqEntry>, String> {
        let entries = self.entries.read().await;
        Ok(entries.get(id).cloned())
    }

    async fn list(&self, limit: usize, offset: usize) -> Result<Vec<DlqEntry>, String> {
        let entries = self.entries.read().await;
        let mut sorted: Vec<_> = entries.values().cloned().collect();
        sorted.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(sorted.into_iter().skip(offset).take(limit).collect())
    }

    async fn retry(&self, id: &str) -> Result<(), String> {
        let entry = {
            let entries = self.entries.read().await;
            entries.get(id).cloned()
        };

        if let Some(mut entry) = entry {
            // Reset attempt count and re-enqueue
            entry.delivery.attempt_count = 0;
            // TODO: Re-enqueue via webhook system
            Ok(())
        } else {
            Err(format!("DLQ entry not found: {}", id))
        }
    }

    async fn delete(&self, id: &str) -> Result<(), String> {
        let mut entries = self.entries.write().await;
        entries.remove(id);
        Ok(())
    }
}
```

### DLQ Integration

```rust
impl WebhookDeliverySystem {
    /// Send failed delivery to dead letter queue
    async fn send_to_dlq(delivery: WebhookDelivery, result: DeliveryResult) {
        let entry = DlqEntry {
            id: delivery.request_id.clone(),
            delivery,
            result,
            timestamp: Utc::now(),
            retry_after: Some(Utc::now() + chrono::Duration::hours(1)),
        };

        // Store in DLQ
        if let Some(dlq) = &self.dlq {
            if let Err(e) = dlq.store(entry).await {
                log::error!("Failed to store in DLQ: {}", e);
            }
        }
    }
}
```

## AP2 Consensus Integration

### Critical Event Detection

```rust
impl OrderStatus {
    /// Check if status transition requires consensus
    pub fn requires_consensus(&self) -> bool {
        matches!(
            self,
            OrderStatus::Confirmed | OrderStatus::Canceled | OrderStatus::Fulfilled
        )
    }
}

/// AP2 consensus integration
pub struct AP2ConsensusIntegration {
    client: Arc<dyn ConsensusClient>,
}

#[async_trait]
pub trait ConsensusClient: Send + Sync {
    /// Submit event for consensus
    async fn submit_for_consensus(
        &self,
        event: &WebhookEvent,
    ) -> Result<ConsensusResult, String>;
}

#[derive(Debug, Clone)]
pub struct ConsensusResult {
    pub approved: bool,
    pub quorum_size: usize,
    pub approvals: usize,
    pub rejections: usize,
    pub timestamp: DateTime<Utc>,
}

impl WebhookDeliverySystem {
    /// Process webhook with optional consensus
    async fn process_webhook(
        &self,
        delivery: &WebhookDelivery,
    ) -> Result<(), String> {
        // Check if event requires consensus
        if self.config.enable_ap2_consensus
            && delivery.event.data.status.requires_consensus()
        {
            log::info!(
                "Event requires consensus: {:?} -> {:?}",
                delivery.event.event_type,
                delivery.event.data.status
            );

            // Submit to AP2 consensus
            let result = self.ap2_client
                .submit_for_consensus(&delivery.event)
                .await?;

            if !result.approved {
                return Err(format!(
                    "Consensus rejected: {}/{} approvals",
                    result.approvals,
                    result.quorum_size
                ));
            }

            log::info!(
                "Consensus approved: {}/{} approvals",
                result.approvals,
                result.quorum_size
            );
        }

        // Proceed with delivery
        self.enqueue(delivery.clone()).await
    }
}
```

### Consensus Flow Diagram

```
Critical Order Event (confirmed, canceled, fulfilled)
         │
         ▼
┌──────────────────────┐
│  AP2 Consensus       │
│  Submit for Voting   │
└──────────┬───────────┘
           │
           ├────► Node 1: Vote (approved)
           ├────► Node 2: Vote (approved)
           ├────► Node 3: Vote (approved)
           ├────► Node 4: Vote (approved)
           └────► Node 5: Vote (rejected)
           │
           ▼
    Quorum Reached (4/5)
           │
           ▼
    ┌──────────────┐
    │  Consensus   │    YES ──────► Proceed with Webhook Delivery
    │  Approved?   │
    └──────────────┘    NO  ──────► Reject & Log Error
```

## WASM Compatibility

### Feature Flags

```toml
# Cargo.toml
[features]
default = ["native"]
native = ["tokio/full", "reqwest/default"]
wasm = ["tokio/sync", "reqwest/wasm", "getrandom/js"]

[dependencies]
tokio = { version = "1.36", default-features = false }
reqwest = { version = "0.12", default-features = false }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
hmac = "0.12"
sha2 = "0.10"
hex = "0.4"
chrono = { version = "0.4", features = ["serde"] }
async-trait = "0.1"
log = "0.4"

# WASM-specific
[target.'cfg(target_arch = "wasm32")'.dependencies]
getrandom = { version = "0.2", features = ["js"] }
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
```

### WASM Delivery Implementation

```rust
#[cfg(target_arch = "wasm32")]
mod wasm_delivery {
    use super::*;
    use wasm_bindgen::prelude::*;
    use wasm_bindgen_futures::JsFuture;
    use web_sys::{Request, RequestInit, Response};

    /// WASM-compatible webhook delivery
    pub async fn deliver_webhook_wasm(
        delivery: &WebhookDelivery,
    ) -> Result<HttpResponse, String> {
        // Serialize event
        let body = serde_json::to_string(&delivery.event)
            .map_err(|e| format!("Serialization error: {}", e))?;

        // Generate signature
        let signature = generate_hmac_signature(
            body.as_bytes(),
            &delivery.hmac_secret,
        )?;

        // Build request
        let mut opts = RequestInit::new();
        opts.method("POST");
        opts.body(Some(&JsValue::from_str(&body)));

        let request = Request::new_with_str_and_init(&delivery.target_url, &opts)
            .map_err(|e| format!("Request creation failed: {:?}", e))?;

        // Set headers
        let headers = request.headers();
        headers.set("Content-Type", "application/json")
            .map_err(|e| format!("Header error: {:?}", e))?;
        headers.set("Merchant-Signature", &signature)
            .map_err(|e| format!("Header error: {:?}", e))?;
        headers.set("Request-Id", &delivery.request_id)
            .map_err(|e| format!("Header error: {:?}", e))?;

        // Send request
        let window = web_sys::window().unwrap();
        let resp_value = JsFuture::from(window.fetch_with_request(&request))
            .await
            .map_err(|e| format!("Fetch failed: {:?}", e))?;

        let resp: Response = resp_value.dyn_into()
            .map_err(|e| format!("Response type error: {:?}", e))?;

        let status = resp.status();
        let body_promise = resp.text()
            .map_err(|e| format!("Body read error: {:?}", e))?;
        let body_value = JsFuture::from(body_promise)
            .await
            .map_err(|e| format!("Body future error: {:?}", e))?;
        let body_text = body_value.as_string();

        Ok(HttpResponse {
            status_code: status,
            body: body_text,
        })
    }
}

#[cfg(not(target_arch = "wasm32"))]
mod native_delivery {
    use super::*;
    use reqwest::Client;

    /// Native webhook delivery using reqwest
    pub async fn deliver_webhook_native(
        delivery: &WebhookDelivery,
    ) -> Result<HttpResponse, String> {
        let client = Client::new();

        // Serialize event
        let body = serde_json::to_string(&delivery.event)
            .map_err(|e| format!("Serialization error: {}", e))?;

        // Generate signature
        let signature = generate_hmac_signature(
            body.as_bytes(),
            &delivery.hmac_secret,
        )?;

        // Send request
        let response = client
            .post(&delivery.target_url)
            .header("Content-Type", "application/json")
            .header("Merchant-Signature", signature)
            .header("Request-Id", &delivery.request_id)
            .header("Timestamp", delivery.timestamp.to_rfc3339())
            .body(body)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status_code = response.status().as_u16();
        let body_text = response.text().await.ok();

        Ok(HttpResponse {
            status_code,
            body: body_text,
        })
    }
}

/// HTTP response
pub struct HttpResponse {
    pub status_code: u16,
    pub body: Option<String>,
}

/// Cross-platform webhook delivery
pub async fn deliver_webhook(
    delivery: &WebhookDelivery,
) -> Result<HttpResponse, String> {
    #[cfg(target_arch = "wasm32")]
    return wasm_delivery::deliver_webhook_wasm(delivery).await;

    #[cfg(not(target_arch = "wasm32"))]
    return native_delivery::deliver_webhook_native(delivery).await;
}
```

## Code Examples

### Complete End-to-End Example

```rust
use agentic_payments::webhook::{
    WebhookDeliverySystem, WebhookConfig, WebhookDelivery,
    WebhookEvent, EventType, EventDataOrder, OrderStatus,
};
use chrono::Utc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    env_logger::init();

    // Create webhook system
    let config = WebhookConfig {
        max_retry_attempts: 5,
        initial_retry_delay_ms: 1000,
        max_retry_delay_ms: 60000,
        worker_pool_size: 10,
        queue_capacity: 1000,
        enable_ap2_consensus: true,
    };

    let mut system = WebhookDeliverySystem::new(config);
    system.start().await?;

    // Create webhook event
    let event = WebhookEvent {
        event_type: EventType::OrderCreate,
        data: EventDataOrder {
            data_type: "order".to_string(),
            checkout_session_id: "checkout_session_123".to_string(),
            permalink_url: "https://example.com/orders/123".to_string(),
            status: OrderStatus::Created,
            refunds: vec![],
        },
    };

    // Prepare delivery
    let delivery = WebhookDelivery {
        event,
        target_url: "https://openai.example.com/agentic_checkout/webhooks/order_events".to_string(),
        merchant_id: "acme_corp".to_string(),
        hmac_secret: b"merchant_secret_key".to_vec(),
        timestamp: Utc::now(),
        request_id: uuid::Uuid::new_v4().to_string(),
        attempt_count: 0,
    };

    // Enqueue for delivery
    system.enqueue(delivery).await?;

    // Keep system running
    tokio::signal::ctrl_c().await?;

    Ok(())
}
```

### Signature Verification Example

```rust
use agentic_payments::webhook::{verify_hmac_signature, WebhookEvent};
use axum::{
    http::StatusCode,
    extract::{State, Json},
    response::IntoResponse,
    http::HeaderMap,
};

/// Webhook receiver endpoint
pub async fn receive_webhook(
    State(secret): State<Vec<u8>>,
    headers: HeaderMap,
    body: String,
) -> impl IntoResponse {
    // Extract signature header
    let signature = match headers.get("Merchant-Signature") {
        Some(sig) => sig.to_str().unwrap_or(""),
        None => return (StatusCode::UNAUTHORIZED, "Missing signature").into_response(),
    };

    // Verify signature
    match verify_hmac_signature(body.as_bytes(), &secret, signature) {
        Ok(true) => {
            // Parse event
            match serde_json::from_str::<WebhookEvent>(&body) {
                Ok(event) => {
                    log::info!("Received webhook: {:?}", event);
                    (StatusCode::OK, Json(serde_json::json!({
                        "received": true,
                        "request_id": headers.get("Request-Id")
                            .and_then(|v| v.to_str().ok())
                    }))).into_response()
                }
                Err(e) => {
                    log::error!("Invalid webhook payload: {}", e);
                    (StatusCode::BAD_REQUEST, "Invalid payload").into_response()
                }
            }
        }
        Ok(false) | Err(_) => {
            log::warn!("Invalid webhook signature");
            (StatusCode::UNAUTHORIZED, "Invalid signature").into_response()
        }
    }
}
```

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hmac_signature_generation() {
        let payload = b"test payload";
        let secret = b"test secret";

        let signature = generate_hmac_signature(payload, secret).unwrap();
        assert!(!signature.is_empty());
        assert_eq!(signature.len(), 64); // SHA256 hex = 64 chars
    }

    #[test]
    fn test_hmac_signature_verification() {
        let payload = b"test payload";
        let secret = b"test secret";

        let signature = generate_hmac_signature(payload, secret).unwrap();
        let valid = verify_hmac_signature(payload, secret, &signature).unwrap();
        assert!(valid);

        // Test invalid signature
        let invalid = verify_hmac_signature(payload, secret, "invalid").is_err();
        assert!(invalid);
    }

    #[test]
    fn test_exponential_backoff() {
        let config = WebhookConfig::default();

        let delay1 = WebhookDeliverySystem::calculate_backoff_delay(1, 1000, 60000);
        assert!(delay1.as_millis() < 1100); // First attempt: ~1000ms

        let delay2 = WebhookDeliverySystem::calculate_backoff_delay(2, 1000, 60000);
        assert!(delay2.as_millis() > 1800 && delay2.as_millis() < 2200); // ~2000ms

        let delay3 = WebhookDeliverySystem::calculate_backoff_delay(3, 1000, 60000);
        assert!(delay3.as_millis() > 3600 && delay3.as_millis() < 4400); // ~4000ms
    }

    #[test]
    fn test_order_status_consensus_requirement() {
        assert!(OrderStatus::Confirmed.requires_consensus());
        assert!(OrderStatus::Canceled.requires_consensus());
        assert!(OrderStatus::Fulfilled.requires_consensus());

        assert!(!OrderStatus::Created.requires_consensus());
        assert!(!OrderStatus::Shipped.requires_consensus());
    }

    #[tokio::test]
    async fn test_webhook_serialization() {
        let event = WebhookEvent {
            event_type: EventType::OrderCreate,
            data: EventDataOrder {
                data_type: "order".to_string(),
                checkout_session_id: "test_123".to_string(),
                permalink_url: "https://example.com/orders/123".to_string(),
                status: OrderStatus::Created,
                refunds: vec![],
            },
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("order_create"));
        assert!(json.contains("test_123"));

        let deserialized: WebhookEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.event_type, EventType::OrderCreate);
    }
}
```

### Integration Tests

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;
    use wiremock::{MockServer, Mock, ResponseTemplate};
    use wiremock::matchers::{method, path, header};

    #[tokio::test]
    async fn test_webhook_delivery_success() {
        // Start mock server
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/agentic_checkout/webhooks/order_events"))
            .and(header("Content-Type", "application/json"))
            .respond_with(ResponseTemplate::new(200).set_body_json(
                serde_json::json!({"received": true})
            ))
            .expect(1)
            .mount(&mock_server)
            .await;

        // Create delivery system
        let config = WebhookConfig::default();
        let mut system = WebhookDeliverySystem::new(config);
        system.start().await.unwrap();

        // Create event
        let event = WebhookEvent {
            event_type: EventType::OrderCreate,
            data: EventDataOrder {
                data_type: "order".to_string(),
                checkout_session_id: "test_123".to_string(),
                permalink_url: "https://example.com/orders/123".to_string(),
                status: OrderStatus::Created,
                refunds: vec![],
            },
        };

        // Enqueue delivery
        let delivery = WebhookDelivery {
            event,
            target_url: format!("{}/agentic_checkout/webhooks/order_events", mock_server.uri()),
            merchant_id: "test_merchant".to_string(),
            hmac_secret: b"test_secret".to_vec(),
            timestamp: Utc::now(),
            request_id: "test_request_id".to_string(),
            attempt_count: 0,
        };

        system.enqueue(delivery).await.unwrap();

        // Wait for delivery
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Verify mock was called
        mock_server.verify().await;
    }

    #[tokio::test]
    async fn test_webhook_retry_on_failure() {
        let mock_server = MockServer::start().await;

        // First attempt fails, second succeeds
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(500))
            .up_to_n_times(1)
            .mount(&mock_server)
            .await;

        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(200).set_body_json(
                serde_json::json!({"received": true})
            ))
            .expect(1)
            .mount(&mock_server)
            .await;

        // Create delivery system with faster retry
        let config = WebhookConfig {
            max_retry_attempts: 3,
            initial_retry_delay_ms: 100,
            ..Default::default()
        };
        let mut system = WebhookDeliverySystem::new(config);
        system.start().await.unwrap();

        // Create and enqueue delivery
        let event = create_test_event();
        let delivery = create_test_delivery(event, &mock_server.uri());

        system.enqueue(delivery).await.unwrap();

        // Wait for retry
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

        mock_server.verify().await;
    }
}
```

### End-to-End Tests

```rust
#[cfg(test)]
mod e2e_tests {
    use super::*;

    #[tokio::test]
    async fn test_full_webhook_flow_with_consensus() {
        // Initialize system with AP2 consensus
        let config = WebhookConfig {
            enable_ap2_consensus: true,
            ..Default::default()
        };

        let mut system = WebhookDeliverySystem::new(config);
        system.start().await.unwrap();

        // Create critical event requiring consensus
        let event = WebhookEvent {
            event_type: EventType::OrderUpdate,
            data: EventDataOrder {
                data_type: "order".to_string(),
                checkout_session_id: "critical_order_456".to_string(),
                permalink_url: "https://example.com/orders/456".to_string(),
                status: OrderStatus::Confirmed, // Requires consensus
                refunds: vec![],
            },
        };

        // Process webhook
        let delivery = create_test_delivery(event, "https://openai.example.com");
        let result = system.process_webhook(&delivery).await;

        assert!(result.is_ok());

        // Verify consensus was invoked
        // (In real implementation, check consensus logs/metrics)
    }

    #[tokio::test]
    async fn test_dlq_integration() {
        let config = WebhookConfig {
            max_retry_attempts: 2,
            initial_retry_delay_ms: 100,
            ..Default::default()
        };

        let mut system = WebhookDeliverySystem::new(config);
        let dlq = Arc::new(InMemoryDlq::new());
        system.set_dlq(dlq.clone());
        system.start().await.unwrap();

        // Create mock server that always fails
        let mock_server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&mock_server)
            .await;

        // Enqueue delivery
        let event = create_test_event();
        let delivery = create_test_delivery(event, &mock_server.uri());
        let request_id = delivery.request_id.clone();

        system.enqueue(delivery).await.unwrap();

        // Wait for retries to exhaust
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

        // Check DLQ
        let dlq_entry = dlq.get(&request_id).await.unwrap();
        assert!(dlq_entry.is_some());
        assert!(!dlq_entry.unwrap().result.success);
    }
}
```

### WASM Tests

```rust
#[cfg(all(test, target_arch = "wasm32"))]
mod wasm_tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    async fn test_hmac_signature_wasm() {
        let payload = b"test payload";
        let secret = b"test secret";

        let signature = generate_hmac_signature(payload, secret).unwrap();
        assert!(!signature.is_empty());
    }

    #[wasm_bindgen_test]
    async fn test_webhook_delivery_wasm() {
        // Note: Requires CORS-enabled test server
        let event = create_test_event();
        let delivery = create_test_delivery(event, "https://httpbin.org/post");

        let result = deliver_webhook(&delivery).await;
        assert!(result.is_ok());
    }
}
```

## Performance Benchmarks

### Expected Throughput

| Metric                    | Target        | Notes                              |
|---------------------------|---------------|------------------------------------|
| Webhook ingestion rate    | 10,000/sec    | Async channel with 1000 capacity   |
| Delivery worker pool      | 10-100 workers| Configurable based on load         |
| HMAC verification latency | <1ms          | Constant-time algorithm            |
| Average delivery latency  | <500ms        | Excluding retry delays             |
| DLQ write latency         | <10ms         | In-memory: <1ms, Persistent: <10ms |
| Consensus latency         | 100-500ms     | BFT consensus for critical events  |

### Benchmark Tests

```rust
#[cfg(test)]
mod benchmarks {
    use super::*;
    use std::time::Instant;

    #[tokio::test]
    async fn bench_hmac_signature() {
        let payload = b"test payload for benchmarking";
        let secret = b"test secret";

        let iterations = 10000;
        let start = Instant::now();

        for _ in 0..iterations {
            let _ = generate_hmac_signature(payload, secret).unwrap();
        }

        let duration = start.elapsed();
        let per_op = duration / iterations;

        println!("HMAC signature generation: {:?} per op", per_op);
        assert!(per_op.as_micros() < 100); // <100μs per signature
    }

    #[tokio::test]
    async fn bench_webhook_throughput() {
        let config = WebhookConfig {
            worker_pool_size: 50,
            queue_capacity: 10000,
            ..Default::default()
        };

        let mut system = WebhookDeliverySystem::new(config);
        system.start().await.unwrap();

        let count = 1000;
        let start = Instant::now();

        for i in 0..count {
            let event = create_test_event();
            let delivery = create_test_delivery(event, "https://example.com");
            system.enqueue(delivery).await.unwrap();
        }

        let duration = start.elapsed();
        let throughput = count as f64 / duration.as_secs_f64();

        println!("Webhook enqueue throughput: {:.0} ops/sec", throughput);
        assert!(throughput > 5000.0); // >5000 enqueues/sec
    }
}
```

## Security Considerations

### HMAC Key Management

1. **Key Rotation**: Implement periodic key rotation (30-90 days)
2. **Key Derivation**: Use HKDF to derive webhook keys from master Ed25519 keys
3. **Key Storage**: Store keys securely (environment variables, secret managers)
4. **Constant-Time Comparison**: Always use constant-time HMAC verification

### Request Validation

1. **Timestamp Validation**: Reject requests older than 5 minutes
2. **Request ID Deduplication**: Track request IDs to prevent replay attacks
3. **Content-Type Enforcement**: Only accept `application/json`
4. **Payload Size Limits**: Limit payload to 1MB to prevent DoS

### Rate Limiting

```rust
use std::time::{Duration, Instant};
use std::collections::HashMap;

pub struct RateLimiter {
    limits: HashMap<String, RateLimit>,
    window: Duration,
    max_requests: usize,
}

struct RateLimit {
    count: usize,
    window_start: Instant,
}

impl RateLimiter {
    pub fn check_rate_limit(&mut self, merchant_id: &str) -> bool {
        let now = Instant::now();
        let limit = self.limits.entry(merchant_id.to_string())
            .or_insert(RateLimit {
                count: 0,
                window_start: now,
            });

        // Reset window if expired
        if now.duration_since(limit.window_start) > self.window {
            limit.count = 0;
            limit.window_start = now;
        }

        // Check limit
        if limit.count >= self.max_requests {
            return false; // Rate limited
        }

        limit.count += 1;
        true
    }
}
```

## Operational Monitoring

### Metrics to Track

1. **Delivery Success Rate**: Percentage of successful deliveries
2. **Average Retry Count**: Mean attempts before success
3. **DLQ Size**: Number of failed deliveries in queue
4. **Consensus Approval Rate**: Percentage of consensus approvals
5. **Latency Percentiles**: P50, P95, P99 delivery latency
6. **Worker Utilization**: Active workers / total workers

### Logging

```rust
use tracing::{info, warn, error, instrument};

#[instrument(skip(delivery))]
async fn deliver_webhook_instrumented(
    delivery: &WebhookDelivery,
) -> Result<HttpResponse, String> {
    info!(
        merchant_id = %delivery.merchant_id,
        request_id = %delivery.request_id,
        attempt = delivery.attempt_count,
        "Starting webhook delivery"
    );

    match deliver_webhook(delivery).await {
        Ok(response) if response.status_code >= 200 && response.status_code < 300 => {
            info!(
                merchant_id = %delivery.merchant_id,
                status_code = response.status_code,
                "Webhook delivered successfully"
            );
            Ok(response)
        }
        Ok(response) => {
            warn!(
                merchant_id = %delivery.merchant_id,
                status_code = response.status_code,
                "Webhook delivery failed with HTTP error"
            );
            Err(format!("HTTP {}", response.status_code))
        }
        Err(e) => {
            error!(
                merchant_id = %delivery.merchant_id,
                error = %e,
                "Webhook delivery failed with network error"
            );
            Err(e)
        }
    }
}
```

## References

- [ACP OpenAPI Specification](./openapi.agentic_checkout_webhook.yaml)
- [HMAC RFC 2104](https://datatracker.ietf.org/doc/html/rfc2104)
- [Ed25519 Signatures](https://ed25519.cr.yp.to/)
- [Byzantine Fault Tolerance](https://en.wikipedia.org/wiki/Byzantine_fault)
- [Exponential Backoff Algorithm](https://en.wikipedia.org/wiki/Exponential_backoff)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-09-29
**Author**: Backend API Developer Agent
**Status**: Draft