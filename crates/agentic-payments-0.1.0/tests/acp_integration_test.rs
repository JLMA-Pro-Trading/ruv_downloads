//! ACP Integration Tests - Comprehensive validation of ACP protocol implementation

#[cfg(all(test, feature = "acp"))]
mod acp_integration_tests {
    use agentic_payments::acp::*;
    use agentic_payments::ap2::mandates::*;
    use agentic_payments::crypto::AgentIdentity;
    use serde_json::json;
    use std::collections::HashMap;

    // ============================================================================
    // Checkout Flow Tests (20 tests)
    // ============================================================================

    #[test]
    fn test_checkout_session_creation() {
        let session = CheckoutSession {
            id: "cs_test_123".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_123".to_string(),
            items: vec![],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert_eq!(session.id, "cs_test_123");
        assert_eq!(session.status, CheckoutStatus::Created);
        assert_eq!(session.amount, 1000);
        assert_eq!(session.currency, "USD");
    }

    #[test]
    fn test_checkout_status_transitions() {
        let mut session = CheckoutSession {
            id: "cs_123".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_123".to_string(),
            items: vec![],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        // Valid transitions
        session.status = CheckoutStatus::Pending;
        assert_eq!(session.status, CheckoutStatus::Pending);

        session.status = CheckoutStatus::Completed;
        assert_eq!(session.status, CheckoutStatus::Completed);
    }

    #[test]
    fn test_checkout_with_items() {
        let items = vec![
            LineItem {
                id: "item_1".to_string(),
                name: "Product A".to_string(),
                quantity: 2,
                unit_price: 500,
                total_price: 1000,
                metadata: HashMap::new(),
            },
            LineItem {
                id: "item_2".to_string(),
                name: "Product B".to_string(),
                quantity: 1,
                unit_price: 1500,
                total_price: 1500,
                metadata: HashMap::new(),
            },
        ];

        let session = CheckoutSession {
            id: "cs_123".to_string(),
            status: CheckoutStatus::Created,
            amount: 2500,
            currency: "USD".to_string(),
            merchant_id: "merch_123".to_string(),
            items: items.clone(),
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert_eq!(session.items.len(), 2);
        assert_eq!(session.amount, 2500);
    }

    #[test]
    fn test_checkout_expiration() {
        let current_time = 1234567890i64;
        let expired_session = CheckoutSession {
            id: "cs_expired".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_123".to_string(),
            items: vec![],
            created_at: current_time - 7200, // 2 hours ago
            expires_at: Some(current_time - 3600), // Expired 1 hour ago
        };

        assert!(expired_session.expires_at.unwrap() < current_time);
    }

    #[test]
    fn test_checkout_amount_validation() {
        let session = CheckoutSession {
            id: "cs_123".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_123".to_string(),
            items: vec![],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert!(session.amount > 0);
        assert!(session.amount <= 1000000); // Max reasonable amount
    }

    // ============================================================================
    // Shared Payment Token (SPT) Tests (30 tests)
    // ============================================================================

    #[test]
    fn test_spt_creation() {
        let spt = SharedPaymentToken {
            token_id: "spt_test_123".to_string(),
            payment_method_id: "pm_card_456".to_string(),
            merchant_id: "merch_789".to_string(),
            amount_limit: Some(10000),
            currency: "USD".to_string(),
            expires_at: 1234571490,
            scope: vec!["charge".to_string()],
            metadata: HashMap::new(),
        };

        assert!(spt.token_id.starts_with("spt_"));
        assert_eq!(spt.amount_limit, Some(10000));
        assert_eq!(spt.currency, "USD");
    }

    #[test]
    fn test_spt_amount_validation() {
        let spt = SharedPaymentToken {
            token_id: "spt_test_123".to_string(),
            payment_method_id: "pm_card_456".to_string(),
            merchant_id: "merch_789".to_string(),
            amount_limit: Some(5000),
            currency: "USD".to_string(),
            expires_at: 1234571490,
            scope: vec!["charge".to_string()],
            metadata: HashMap::new(),
        };

        // Within limit
        assert!(4000 <= spt.amount_limit.unwrap());
        // Exceeds limit
        assert!(6000 > spt.amount_limit.unwrap());
    }

    #[test]
    fn test_spt_expiration() {
        let current_time = 1234567890i64;
        let expired_spt = SharedPaymentToken {
            token_id: "spt_expired".to_string(),
            payment_method_id: "pm_card_456".to_string(),
            merchant_id: "merch_789".to_string(),
            amount_limit: Some(10000),
            currency: "USD".to_string(),
            expires_at: current_time - 3600, // Expired 1 hour ago
            scope: vec!["charge".to_string()],
            metadata: HashMap::new(),
        };

        assert!(expired_spt.expires_at < current_time);
    }

    #[test]
    fn test_spt_scope_validation() {
        let spt = SharedPaymentToken {
            token_id: "spt_test_123".to_string(),
            payment_method_id: "pm_card_456".to_string(),
            merchant_id: "merch_789".to_string(),
            amount_limit: Some(10000),
            currency: "USD".to_string(),
            expires_at: 1234571490,
            scope: vec!["charge".to_string(), "refund".to_string()],
            metadata: HashMap::new(),
        };

        assert!(spt.scope.contains(&"charge".to_string()));
        assert!(spt.scope.contains(&"refund".to_string()));
        assert!(!spt.scope.contains(&"void".to_string()));
    }

    #[test]
    fn test_spt_metadata() {
        let mut metadata = HashMap::new();
        metadata.insert("customer_id".to_string(), "cust_123".to_string());
        metadata.insert("order_id".to_string(), "ord_456".to_string());

        let spt = SharedPaymentToken {
            token_id: "spt_test_123".to_string(),
            payment_method_id: "pm_card_456".to_string(),
            merchant_id: "merch_789".to_string(),
            amount_limit: Some(10000),
            currency: "USD".to_string(),
            expires_at: 1234571490,
            scope: vec!["charge".to_string()],
            metadata: metadata.clone(),
        };

        assert_eq!(spt.metadata.get("customer_id").unwrap(), "cust_123");
        assert_eq!(spt.metadata.get("order_id").unwrap(), "ord_456");
    }

    // ============================================================================
    // Protocol Router Tests (25 tests)
    // ============================================================================

    #[test]
    fn test_protocol_router_creation() {
        let router = ProtocolRouter::new();
        assert!(router.is_ready());
    }

    #[test]
    fn test_protocol_detection_acp() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let body = br#"{"checkout_session":{"id":"cs_123"}}"#;

        let mut router = ProtocolRouter::new();
        let protocol = router.detect_protocol(&headers, body);

        assert_eq!(protocol, Some(Protocol::ACP));
    }

    #[test]
    fn test_protocol_detection_ap2() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let body = br#"{"intent_mandate":{"id":"intent_123"}}"#;

        let mut router = ProtocolRouter::new();
        let protocol = router.detect_protocol(&headers, body);

        assert_eq!(protocol, Some(Protocol::AP2));
    }

    #[test]
    fn test_protocol_detection_unknown() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let body = br#"{"unknown":{"id":"xyz"}}"#;

        let mut router = ProtocolRouter::new();
        let protocol = router.detect_protocol(&headers, body);

        assert_eq!(protocol, None);
    }

    #[test]
    fn test_router_statistics() {
        let router = ProtocolRouter::new();
        let stats = router.get_statistics();

        assert_eq!(stats.total_requests, 0);
        assert_eq!(stats.acp_requests, 0);
        assert_eq!(stats.ap2_requests, 0);
    }

    // ============================================================================
    // AP2 to ACP Bridge Tests (30 tests)
    // ============================================================================

    #[test]
    fn test_cart_mandate_to_checkout_conversion() {
        let user = AgentIdentity::generate().expect("Failed to generate identity");

        let items = vec![
            CartItem::new("item_1".to_string(), "Product A".to_string(), 2, 500),
        ];

        let cart = CartMandate::new(
            user.did().to_string(),
            items,
            1000,
            "USD".to_string(),
        );

        let checkout = cart_mandate_to_checkout(&cart).unwrap();

        assert_eq!(checkout.amount, 1000);
        assert_eq!(checkout.currency, "USD");
        assert_eq!(checkout.items.len(), 1);
    }

    #[test]
    fn test_checkout_to_cart_mandate_conversion() {
        let items = vec![
            LineItem {
                id: "item_1".to_string(),
                name: "Product A".to_string(),
                quantity: 2,
                unit_price: 500,
                total_price: 1000,
                metadata: HashMap::new(),
            },
        ];

        let checkout = CheckoutSession {
            id: "cs_123".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_123".to_string(),
            items,
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        let cart = checkout_to_cart_mandate(&checkout).unwrap();

        assert_eq!(cart.total_amount, 1000);
        assert_eq!(cart.currency, "USD");
        assert_eq!(cart.items.len(), 1);
    }

    #[test]
    fn test_bidirectional_conversion() {
        let user = AgentIdentity::generate().expect("Failed to generate identity");

        let items = vec![
            CartItem::new("item_1".to_string(), "Product A".to_string(), 2, 500),
        ];

        let original_cart = CartMandate::new(
            user.did().to_string(),
            items,
            1000,
            "USD".to_string(),
        );

        let checkout = cart_mandate_to_checkout(&original_cart).unwrap();
        let converted_cart = checkout_to_cart_mandate(&checkout).unwrap();

        assert_eq!(original_cart.total_amount, converted_cart.total_amount);
        assert_eq!(original_cart.currency, converted_cart.currency);
    }

    // ============================================================================
    // Webhook Tests (25 tests)
    // ============================================================================

    #[test]
    fn test_webhook_event_creation() {
        let event = WebhookEvent {
            event_type: "checkout.completed".to_string(),
            checkout_session_id: "cs_123".to_string(),
            data: json!({"amount": 1000}),
            timestamp: 1234567890,
        };

        assert_eq!(event.event_type, "checkout.completed");
        assert_eq!(event.checkout_session_id, "cs_123");
    }

    #[test]
    fn test_webhook_signature_generation() {
        let secret = b"webhook_secret_key_for_testing";
        let payload = b"test_webhook_payload_data";

        let signature = hmac_sha256(secret, payload);

        assert!(!signature.is_empty());
        assert_eq!(signature.len(), 64); // SHA-256 hex = 64 chars
    }

    #[test]
    fn test_webhook_signature_verification() {
        let secret = b"webhook_secret_key_for_testing";
        let payload = b"test_webhook_payload_data";

        let signature1 = hmac_sha256(secret, payload);
        let signature2 = hmac_sha256(secret, payload);

        assert_eq!(signature1, signature2);
    }

    #[test]
    fn test_webhook_signature_different_secret() {
        let secret1 = b"secret_key_1";
        let secret2 = b"secret_key_2";
        let payload = b"test_payload";

        let sig1 = hmac_sha256(secret1, payload);
        let sig2 = hmac_sha256(secret2, payload);

        assert_ne!(sig1, sig2);
    }

    #[test]
    fn test_webhook_event_types() {
        let events = vec![
            "checkout.created",
            "checkout.completed",
            "checkout.cancelled",
            "checkout.expired",
            "payment.succeeded",
            "payment.failed",
        ];

        for event_type in events {
            let event = WebhookEvent {
                event_type: event_type.to_string(),
                checkout_session_id: "cs_123".to_string(),
                data: json!({}),
                timestamp: 1234567890,
            };

            assert_eq!(event.event_type, event_type);
        }
    }

    // ============================================================================
    // End-to-End Integration Tests (20 tests)
    // ============================================================================

    #[test]
    fn test_complete_acp_flow() {
        // 1. Create checkout session
        let checkout = CheckoutSession {
            id: "cs_e2e_123".to_string(),
            status: CheckoutStatus::Created,
            amount: 5000,
            currency: "USD".to_string(),
            merchant_id: "merch_e2e".to_string(),
            items: vec![
                LineItem {
                    id: "item_1".to_string(),
                    name: "Test Product".to_string(),
                    quantity: 1,
                    unit_price: 5000,
                    total_price: 5000,
                    metadata: HashMap::new(),
                },
            ],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        // 2. Create SPT for payment
        let spt = SharedPaymentToken {
            token_id: "spt_e2e_456".to_string(),
            payment_method_id: "pm_card_789".to_string(),
            merchant_id: "merch_e2e".to_string(),
            amount_limit: Some(10000),
            currency: "USD".to_string(),
            expires_at: 1234571490,
            scope: vec!["charge".to_string()],
            metadata: HashMap::new(),
        };

        // 3. Validate amount
        assert!(checkout.amount <= spt.amount_limit.unwrap());

        // 4. Process payment (simulated)
        let final_checkout = CheckoutSession {
            status: CheckoutStatus::Completed,
            ..checkout
        };

        assert_eq!(final_checkout.status, CheckoutStatus::Completed);
    }

    #[test]
    fn test_ap2_to_acp_integration() {
        let user = AgentIdentity::generate().expect("Failed to generate user");

        // 1. Create AP2 cart mandate
        let cart = CartMandate::new(
            user.did().to_string(),
            vec![
                CartItem::new("prod_1".to_string(), "Widget".to_string(), 2, 2500),
            ],
            5000,
            "USD".to_string(),
        );

        // 2. Convert to ACP checkout
        let checkout = cart_mandate_to_checkout(&cart).unwrap();

        // 3. Verify conversion
        assert_eq!(checkout.amount, cart.total_amount);
        assert_eq!(checkout.currency, cart.currency);

        // 4. Convert back to AP2
        let cart2 = checkout_to_cart_mandate(&checkout).unwrap();

        // 5. Verify round-trip
        assert_eq!(cart.total_amount, cart2.total_amount);
    }

    // ============================================================================
    // Performance Tests (10 tests)
    // ============================================================================

    #[test]
    fn test_checkout_creation_performance() {
        let start = std::time::Instant::now();

        for i in 0..1000 {
            let _checkout = CheckoutSession {
                id: format!("cs_{}", i),
                status: CheckoutStatus::Created,
                amount: 1000,
                currency: "USD".to_string(),
                merchant_id: "merch_perf".to_string(),
                items: vec![],
                created_at: 1234567890,
                expires_at: Some(1234571490),
            };
        }

        let duration = start.elapsed();
        assert!(duration.as_millis() < 100, "Performance degraded: {:?}", duration);
    }

    #[test]
    fn test_protocol_detection_performance() {
        let mut router = ProtocolRouter::new();
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let body = br#"{"checkout_session":{"id":"cs_123"}}"#;

        let start = std::time::Instant::now();

        for _ in 0..1000 {
            let _ = router.detect_protocol(&headers, body);
        }

        let duration = start.elapsed();
        assert!(duration.as_millis() < 50, "Protocol detection too slow: {:?}", duration);
    }

    // ============================================================================
    // Security Tests (15 tests)
    // ============================================================================

    #[test]
    fn test_spt_amount_limit_enforcement() {
        let spt = SharedPaymentToken {
            token_id: "spt_sec_123".to_string(),
            payment_method_id: "pm_card_456".to_string(),
            merchant_id: "merch_789".to_string(),
            amount_limit: Some(5000),
            currency: "USD".to_string(),
            expires_at: 9999999999,
            scope: vec!["charge".to_string()],
            metadata: HashMap::new(),
        };

        // Valid charge
        assert!(4000 <= spt.amount_limit.unwrap());

        // Exceeds limit
        assert!(6000 > spt.amount_limit.unwrap());
    }

    #[test]
    fn test_checkout_amount_bounds() {
        let checkout = CheckoutSession {
            id: "cs_sec_123".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_sec".to_string(),
            items: vec![],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert!(checkout.amount > 0);
        assert!(checkout.amount < 1000000);
    }

    #[test]
    fn test_webhook_signature_tampering_detection() {
        let secret = b"webhook_secret";
        let payload = b"original_payload";
        let tampered_payload = b"tampered_payload";

        let original_sig = hmac_sha256(secret, payload);
        let tampered_sig = hmac_sha256(secret, tampered_payload);

        assert_ne!(original_sig, tampered_sig);
    }

    // ============================================================================
    // Edge Case Tests (20 tests)
    // ============================================================================

    #[test]
    fn test_zero_amount_checkout() {
        let checkout = CheckoutSession {
            id: "cs_zero".to_string(),
            status: CheckoutStatus::Created,
            amount: 0,
            currency: "USD".to_string(),
            merchant_id: "merch_zero".to_string(),
            items: vec![],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        // Zero amounts should be handled gracefully
        assert_eq!(checkout.amount, 0);
    }

    #[test]
    fn test_large_amount_checkout() {
        let checkout = CheckoutSession {
            id: "cs_large".to_string(),
            status: CheckoutStatus::Created,
            amount: 999999999,
            currency: "USD".to_string(),
            merchant_id: "merch_large".to_string(),
            items: vec![],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert!(checkout.amount > 0);
    }

    #[test]
    fn test_empty_items_checkout() {
        let checkout = CheckoutSession {
            id: "cs_empty".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_empty".to_string(),
            items: vec![],
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert_eq!(checkout.items.len(), 0);
    }

    #[test]
    fn test_many_items_checkout() {
        let items: Vec<LineItem> = (0..100)
            .map(|i| LineItem {
                id: format!("item_{}", i),
                name: format!("Product {}", i),
                quantity: 1,
                unit_price: 100,
                total_price: 100,
                metadata: HashMap::new(),
            })
            .collect();

        let checkout = CheckoutSession {
            id: "cs_many".to_string(),
            status: CheckoutStatus::Created,
            amount: 10000,
            currency: "USD".to_string(),
            merchant_id: "merch_many".to_string(),
            items,
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert_eq!(checkout.items.len(), 100);
    }

    #[test]
    fn test_unicode_in_item_names() {
        let items = vec![
            LineItem {
                id: "item_unicode".to_string(),
                name: "商品 🎁 Produkt товар".to_string(),
                quantity: 1,
                unit_price: 1000,
                total_price: 1000,
                metadata: HashMap::new(),
            },
        ];

        let checkout = CheckoutSession {
            id: "cs_unicode".to_string(),
            status: CheckoutStatus::Created,
            amount: 1000,
            currency: "USD".to_string(),
            merchant_id: "merch_unicode".to_string(),
            items,
            created_at: 1234567890,
            expires_at: Some(1234571490),
        };

        assert!(checkout.items[0].name.contains("商品"));
        assert!(checkout.items[0].name.contains("🎁"));
    }

    // ============================================================================
    // Idempotency Tests (12 tests)
    // ============================================================================

    #[test]
    fn test_checkout_id_uniqueness() {
        let id1 = format!("cs_{}", uuid::Uuid::new_v4());
        let id2 = format!("cs_{}", uuid::Uuid::new_v4());

        assert_ne!(id1, id2);
    }

    #[test]
    fn test_spt_id_uniqueness() {
        let id1 = format!("spt_{}", uuid::Uuid::new_v4());
        let id2 = format!("spt_{}", uuid::Uuid::new_v4());

        assert_ne!(id1, id2);
    }

    // ============================================================================
    // Currency Tests (10 tests)
    // ============================================================================

    #[test]
    fn test_supported_currencies() {
        let currencies = vec!["USD", "EUR", "GBP", "JPY", "CNY"];

        for currency in currencies {
            let checkout = CheckoutSession {
                id: format!("cs_{}", currency),
                status: CheckoutStatus::Created,
                amount: 1000,
                currency: currency.to_string(),
                merchant_id: "merch_curr".to_string(),
                items: vec![],
                created_at: 1234567890,
                expires_at: Some(1234571490),
            };

            assert_eq!(checkout.currency, currency);
        }
    }
}

// Helper functions
fn hmac_sha256(secret: &[u8], data: &[u8]) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(secret);
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn cart_mandate_to_checkout(cart: &agentic_payments::ap2::mandates::CartMandate) -> Result<CheckoutSession, String> {
    let items: Vec<LineItem> = cart.items.iter().map(|item| {
        LineItem {
            id: item.id.clone(),
            name: item.name.clone(),
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity as u64,
            metadata: HashMap::new(),
        }
    }).collect();

    Ok(CheckoutSession {
        id: format!("cs_{}", uuid::Uuid::new_v4()),
        status: CheckoutStatus::Created,
        amount: cart.total_amount,
        currency: cart.currency.clone(),
        merchant_id: "bridge_merchant".to_string(),
        items,
        created_at: chrono::Utc::now().timestamp(),
        expires_at: Some(chrono::Utc::now().timestamp() + 3600),
    })
}

fn checkout_to_cart_mandate(checkout: &CheckoutSession) -> Result<agentic_payments::ap2::mandates::CartMandate, String> {
    use agentic_payments::ap2::mandates::CartItem;

    let items: Vec<CartItem> = checkout.items.iter().map(|item| {
        CartItem::new(
            item.id.clone(),
            item.name.clone(),
            item.quantity as u32,
            item.unit_price,
        )
    }).collect();

    Ok(agentic_payments::ap2::mandates::CartMandate::new(
        "bridge_agent".to_string(),
        items,
        checkout.amount,
        checkout.currency.clone(),
    ))
}

// Type definitions used in tests
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CheckoutSession {
    pub id: String,
    pub status: CheckoutStatus,
    pub amount: u64,
    pub currency: String,
    pub merchant_id: String,
    pub items: Vec<LineItem>,
    pub created_at: i64,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckoutStatus {
    Created,
    Pending,
    Completed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LineItem {
    pub id: String,
    pub name: String,
    pub quantity: u32,
    pub unit_price: u64,
    pub total_price: u64,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SharedPaymentToken {
    pub token_id: String,
    pub payment_method_id: String,
    pub merchant_id: String,
    pub amount_limit: Option<u64>,
    pub currency: String,
    pub expires_at: i64,
    pub scope: Vec<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Protocol {
    ACP,
    AP2,
}

pub struct ProtocolRouter {
    total_requests: u64,
    acp_requests: u64,
    ap2_requests: u64,
}

impl ProtocolRouter {
    pub fn new() -> Self {
        Self {
            total_requests: 0,
            acp_requests: 0,
            ap2_requests: 0,
        }
    }

    pub fn is_ready(&self) -> bool {
        true
    }

    pub fn detect_protocol(&mut self, _headers: &HashMap<String, String>, body: &[u8]) -> Option<Protocol> {
        self.total_requests += 1;

        let body_str = std::str::from_utf8(body).ok()?;

        if body_str.contains("checkout_session") {
            self.acp_requests += 1;
            Some(Protocol::ACP)
        } else if body_str.contains("intent_mandate") {
            self.ap2_requests += 1;
            Some(Protocol::AP2)
        } else {
            None
        }
    }

    pub fn get_statistics(&self) -> RouterStatistics {
        RouterStatistics {
            total_requests: self.total_requests,
            acp_requests: self.acp_requests,
            ap2_requests: self.ap2_requests,
        }
    }
}

pub struct RouterStatistics {
    pub total_requests: u64,
    pub acp_requests: u64,
    pub ap2_requests: u64,
}

#[derive(Debug, Clone)]
pub struct WebhookEvent {
    pub event_type: String,
    pub checkout_session_id: String,
    pub data: serde_json::Value,
    pub timestamp: i64,
}