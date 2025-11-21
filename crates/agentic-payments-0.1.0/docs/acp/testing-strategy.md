# ACP Integration Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for the Agentic Commerce Protocol (ACP) integration in the agentic-payments crate. The strategy covers unit tests, integration tests, conformance tests, performance benchmarks, and security testing.

## Testing Principles

1. **Test-Driven Development (TDD)**: Write tests before implementation
2. **High Coverage**: Target >90% code coverage for new ACP code
3. **Fast Feedback**: Unit tests run in <5 seconds
4. **Isolation**: Tests don't depend on external services
5. **Reproducibility**: Deterministic test results
6. **Backward Compatibility**: All existing AP2 tests must pass

## Test Pyramid

```
         ┌──────────┐
         │   E2E    │  5% - Conformance, OpenAI tests
         └──────────┘
       ┌──────────────┐
       │ Integration  │  25% - Multi-component tests
       └──────────────┘
     ┌──────────────────┐
     │   Unit Tests     │  70% - Individual components
     └──────────────────┘
```

## Test Categories

### 1. Unit Tests (70% of tests)

#### Objectives
- Test individual functions and types
- Fast execution (<1ms per test)
- No external dependencies
- High code coverage

#### Coverage by Module

**ACP Checkout Module** (`src/acp/checkout.rs`):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checkout_creation() {
        let request = CheckoutRequest {
            idempotency_key: "test_123".to_string(),
            items: vec![
                OrderItem {
                    product_id: "prod_123".to_string(),
                    quantity: 2,
                    price: 1999,
                }
            ],
            shipping_address: None,
            metadata: HashMap::new(),
        };

        let checkout = CheckoutResponse::from_request(request, "checkout_456");

        assert_eq!(checkout.checkout_id, "checkout_456");
        assert_eq!(checkout.state, CheckoutState::Pending);
        assert_eq!(checkout.total_amount, 3998);
    }

    #[test]
    fn test_checkout_state_transitions() {
        let mut checkout = create_test_checkout();

        // Valid transitions
        assert!(checkout.transition_to(CheckoutState::Processing).is_ok());
        assert!(checkout.transition_to(CheckoutState::Completed).is_ok());

        // Invalid transitions
        checkout.state = CheckoutState::Completed;
        assert!(checkout.transition_to(CheckoutState::Pending).is_err());
    }

    #[test]
    fn test_checkout_expiration() {
        let mut checkout = create_test_checkout();
        checkout.expires_at = Utc::now().timestamp() - 3600; // Expired 1 hour ago

        assert!(checkout.is_expired());
        assert_eq!(checkout.state, CheckoutState::Expired);
    }

    #[test]
    fn test_idempotency_key_validation() {
        // Valid keys
        assert!(validate_idempotency_key("valid_key_123").is_ok());
        assert!(validate_idempotency_key("another-valid-key").is_ok());

        // Invalid keys
        assert!(validate_idempotency_key("").is_err());
        assert!(validate_idempotency_key("a").is_err()); // Too short
        assert!(validate_idempotency_key(&"x".repeat(300)).is_err()); // Too long
    }
}
```

**Shared Payment Token Module** (`src/acp/spt.rs`):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spt_generation() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let config = SptConfig {
            merchant_id: "merchant_123".to_string(),
            amount_limit: Some(10000),
            currency: "USD".to_string(),
            ttl_seconds: 3600,
            scope: vec![TokenScope::Charge],
            metadata: HashMap::new(),
        };

        let spt = SharedPaymentToken::generate(
            "pm_test_card".to_string(),
            "merchant_123".to_string(),
            config,
            &signing_key,
        ).unwrap();

        assert!(spt.token_id.starts_with("spt_"));
        assert_eq!(spt.merchant_id, "merchant_123");
        assert_eq!(spt.amount_limit, Some(10000));
        assert!(!spt.signature.is_empty());
    }

    #[test]
    fn test_spt_validation() {
        let spt = create_test_spt(Some(5000), 3600);

        // Valid charge
        assert!(spt.validate(4000).is_ok());

        // Exceeds limit
        assert!(spt.validate(6000).is_err());
    }

    #[test]
    fn test_spt_expiration() {
        let spt = create_test_spt(Some(10000), -3600); // Expired 1 hour ago

        assert!(spt.validate(5000).is_err());
        assert!(matches!(spt.validate(5000).unwrap_err(), Error::TokenExpired));
    }

    #[test]
    fn test_spt_signature_verification() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let mut spt = create_signed_spt(&signing_key);

        // Valid signature
        assert!(spt.verify_signature().is_ok());

        // Tampered data
        spt.amount_limit = Some(999999);
        assert!(spt.verify_signature().is_err());
    }

    #[test]
    fn test_spt_scope_validation() {
        let spt = SharedPaymentToken {
            scope: vec![TokenScope::Charge],
            ..create_test_spt(None, 3600)
        };

        assert!(spt.has_scope(&TokenScope::Charge));
        assert!(!spt.has_scope(&TokenScope::Refund));
    }
}
```

**Protocol Router Module** (`src/protocol/router.rs`):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_detection_ap2() {
        let request = PaymentRequest {
            intent_mandate: Some(create_test_mandate()),
            shared_payment_token: None,
            ..Default::default()
        };

        let router = ProtocolRouter::new();
        let detected = router.detect_protocol(&request).unwrap();

        assert_eq!(detected, Protocol::AP2);
    }

    #[test]
    fn test_protocol_detection_acp() {
        let request = PaymentRequest {
            shared_payment_token: Some(create_test_spt()),
            intent_mandate: None,
            ..Default::default()
        };

        let router = ProtocolRouter::new();
        let detected = router.detect_protocol(&request).unwrap();

        assert_eq!(detected, Protocol::ACP);
    }

    #[test]
    fn test_protocol_routing() {
        let router = ProtocolRouter::builder()
            .with_ap2_handler(MockAp2Handler::new())
            .with_acp_handler(MockAcpHandler::new())
            .build();

        let ap2_request = create_ap2_request();
        let result = router.route_payment(ap2_request).await.unwrap();
        assert!(matches!(result.protocol_used, Protocol::AP2));

        let acp_request = create_acp_request();
        let result = router.route_payment(acp_request).await.unwrap();
        assert!(matches!(result.protocol_used, Protocol::ACP));
    }

    #[test]
    fn test_unknown_protocol_error() {
        let request = PaymentRequest::default(); // No protocol indicators
        let router = ProtocolRouter::new();

        let result = router.detect_protocol(&request);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::UnknownProtocol));
    }
}
```

**Merchant Management** (`src/acp/merchant.rs`):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_key_generation() {
        let api_key = ApiKey::generate("Production Key", vec![Permission::CreateCheckout]);

        assert!(api_key.key_id.starts_with("ak_"));
        assert!(!api_key.key_hash.is_empty());
        assert_eq!(api_key.name, "Production Key");
        assert!(api_key.permissions.contains(&Permission::CreateCheckout));
    }

    #[test]
    fn test_api_key_hashing() {
        let plaintext_key = "sk_test_1234567890";
        let hash1 = ApiKey::hash_key(plaintext_key).unwrap();
        let hash2 = ApiKey::hash_key(plaintext_key).unwrap();

        // Different hashes (salt)
        assert_ne!(hash1, hash2);

        // Both verify correctly
        assert!(ApiKey::verify_key(plaintext_key, &hash1).unwrap());
        assert!(ApiKey::verify_key(plaintext_key, &hash2).unwrap());
    }

    #[test]
    fn test_merchant_creation() {
        let merchant = Merchant::new(
            "Test Merchant",
            "test@example.com",
            "stripe",
        );

        assert!(merchant.merchant_id.starts_with("mer_"));
        assert_eq!(merchant.name, "Test Merchant");
        assert_eq!(merchant.email, "test@example.com");
        assert_eq!(merchant.psp_provider, "stripe");
    }

    #[test]
    fn test_merchant_permission_check() {
        let merchant = create_test_merchant();

        assert!(merchant.has_permission(Permission::CreateCheckout));
        assert!(!merchant.has_permission(Permission::RefundOrder));
    }
}
```

#### Test Utilities

**Mock Objects** (`tests/common/mod.rs`):
```rust
pub mod mocks {
    use super::*;

    pub struct MockAp2Handler;

    #[async_trait]
    impl PaymentProtocolHandler for MockAp2Handler {
        async fn authorize_payment(
            &self,
            request: PaymentRequest,
        ) -> Result<Authorization> {
            Ok(Authorization {
                authorized: true,
                protocol_used: Protocol::AP2,
                ..Default::default()
            })
        }

        // ... other methods
    }

    pub struct MockPsp;

    #[async_trait]
    impl PaymentServiceProvider for MockPsp {
        async fn create_spt(
            &self,
            payment_method: &str,
            config: SptConfig,
        ) -> Result<SharedPaymentToken> {
            Ok(create_test_spt())
        }

        // ... other methods
    }

    pub struct MockDatabase {
        checkouts: Arc<Mutex<HashMap<String, CheckoutResponse>>>,
        orders: Arc<Mutex<HashMap<String, Order>>>,
    }

    impl MockDatabase {
        pub fn new() -> Self {
            Self {
                checkouts: Arc::new(Mutex::new(HashMap::new())),
                orders: Arc::new(Mutex::new(HashMap::new())),
            }
        }

        pub async fn insert_checkout(&self, checkout: CheckoutResponse) {
            self.checkouts.lock().unwrap().insert(
                checkout.checkout_id.clone(),
                checkout,
            );
        }

        pub async fn get_checkout(&self, id: &str) -> Option<CheckoutResponse> {
            self.checkouts.lock().unwrap().get(id).cloned()
        }
    }
}

pub mod fixtures {
    pub fn create_test_checkout() -> CheckoutResponse {
        CheckoutResponse {
            checkout_id: "checkout_test_123".to_string(),
            state: CheckoutState::Pending,
            items: vec![
                OrderItem {
                    product_id: "prod_123".to_string(),
                    quantity: 1,
                    price: 1999,
                }
            ],
            total_amount: 1999,
            currency: "USD".to_string(),
            expires_at: Utc::now().timestamp() + 3600,
            payment_methods: vec!["card".to_string()],
        }
    }

    pub fn create_test_spt() -> SharedPaymentToken {
        SharedPaymentToken {
            token_id: "spt_test_123".to_string(),
            payment_method: "pm_test_card".to_string(),
            merchant_id: "merchant_123".to_string(),
            amount_limit: Some(10000),
            currency: "USD".to_string(),
            expires_at: Utc::now().timestamp() + 3600,
            scope: vec![TokenScope::Charge],
            metadata: HashMap::new(),
            signature: "test_signature".to_string(),
        }
    }

    // ... more fixtures
}
```

---

### 2. Integration Tests (25% of tests)

#### Objectives
- Test interaction between multiple components
- Verify end-to-end workflows
- Database integration testing
- HTTP API testing

#### Test Scenarios

**Complete Checkout Flow** (`tests/integration/checkout_flow.rs`):
```rust
#[tokio::test]
async fn test_complete_checkout_flow() {
    // Setup
    let app = setup_test_app().await;
    let merchant = create_test_merchant(&app).await;
    let client = TestClient::new(app.address());

    // 1. Create checkout
    let create_request = json!({
        "idempotency_key": "test_123",
        "items": [{
            "product_id": "prod_123",
            "quantity": 2,
            "price": 1999
        }]
    });

    let response = client
        .post("/v1/checkout")
        .header("Authorization", &merchant.api_key)
        .json(&create_request)
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 201);

    let checkout: CheckoutResponse = response.json().await.unwrap();
    assert_eq!(checkout.state, CheckoutState::Pending);
    assert_eq!(checkout.total_amount, 3998);

    // 2. Retrieve checkout
    let get_response = client
        .get(&format!("/v1/checkout/{}", checkout.checkout_id))
        .header("Authorization", &merchant.api_key)
        .send()
        .await
        .unwrap();

    assert_eq!(get_response.status(), 200);

    // 3. Complete checkout with SPT
    let spt = create_test_spt_for_merchant(&merchant);
    let complete_request = json!({
        "shared_payment_token": spt.token_id
    });

    let complete_response = client
        .post(&format!("/v1/checkout/{}/complete", checkout.checkout_id))
        .header("Authorization", &merchant.api_key)
        .json(&complete_request)
        .send()
        .await
        .unwrap();

    assert_eq!(complete_response.status(), 200);

    let completed: CheckoutResponse = complete_response.json().await.unwrap();
    assert_eq!(completed.state, CheckoutState::Completed);

    // 4. Verify order created
    let orders = get_merchant_orders(&app, &merchant).await;
    assert_eq!(orders.len(), 1);
    assert_eq!(orders[0].checkout_id, checkout.checkout_id);
}

#[tokio::test]
async fn test_idempotency_handling() {
    let app = setup_test_app().await;
    let merchant = create_test_merchant(&app).await;
    let client = TestClient::new(app.address());

    let request = json!({
        "idempotency_key": "duplicate_test",
        "items": [{"product_id": "prod_123", "quantity": 1, "price": 1999}]
    });

    // First request - creates checkout
    let response1 = client
        .post("/v1/checkout")
        .header("Authorization", &merchant.api_key)
        .json(&request)
        .send()
        .await
        .unwrap();

    assert_eq!(response1.status(), 201);
    let checkout1: CheckoutResponse = response1.json().await.unwrap();

    // Second request - returns same checkout
    let response2 = client
        .post("/v1/checkout")
        .header("Authorization", &merchant.api_key)
        .json(&request)
        .send()
        .await
        .unwrap();

    assert_eq!(response2.status(), 201);
    let checkout2: CheckoutResponse = response2.json().await.unwrap();

    assert_eq!(checkout1.checkout_id, checkout2.checkout_id);
}
```

**Multi-Protocol Integration** (`tests/integration/protocol_interop.rs`):
```rust
#[tokio::test]
async fn test_ap2_and_acp_coexistence() {
    let system = UnifiedPaymentSystem::builder()
        .with_ap2_handler(create_ap2_handler())
        .with_acp_handler(create_acp_handler())
        .build();

    // AP2 payment
    let ap2_request = create_ap2_payment_request();
    let ap2_result = system.process_payment(ap2_request).await.unwrap();
    assert_eq!(ap2_result.protocol_used, Protocol::AP2);

    // ACP payment
    let acp_request = create_acp_payment_request();
    let acp_result = system.process_payment(acp_request).await.unwrap();
    assert_eq!(acp_result.protocol_used, Protocol::ACP);

    // Verify both protocols work independently
    assert!(ap2_result.authorized);
    assert!(acp_result.authorized);
}

#[tokio::test]
async fn test_credential_translation_ap2_to_acp() {
    let translator = ProtocolTranslator::new();

    // Create AP2 authorization
    let ap2_auth = create_ap2_authorization();

    // Translate to ACP checkout
    let acp_checkout = translator
        .translate_ap2_to_acp(ap2_auth)
        .await
        .unwrap();

    // Verify translation
    assert_eq!(acp_checkout.total_amount, ap2_auth.total_amount());
    assert_eq!(acp_checkout.currency, ap2_auth.currency);
    assert_eq!(acp_checkout.items.len(), ap2_auth.cart_mandate.items.len());
}
```

**Webhook Delivery** (`tests/integration/webhooks.rs`):
```rust
#[tokio::test]
async fn test_webhook_delivery_success() {
    // Setup mock webhook receiver
    let mock_server = MockServer::start().await;
    let webhook_url = mock_server.uri();

    Mock::given(method("POST"))
        .and(path("/webhooks"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    // Create checkout completion event
    let event = WebhookEvent {
        event_id: "evt_123".to_string(),
        event_type: WebhookEventType::OrderCompleted,
        payload: json!({"order_id": "order_123"}),
        merchant_id: "merchant_123".to_string(),
        created_at: Utc::now(),
    };

    // Deliver webhook
    let worker = WebhookDeliveryWorker::new(webhook_url);
    let result = worker.deliver_webhook(event).await;

    assert!(result.is_ok());
    mock_server.verify().await;
}

#[tokio::test]
async fn test_webhook_retry_on_failure() {
    let mock_server = MockServer::start().await;

    // First attempt fails
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(503))
        .expect(1)
        .mount(&mock_server)
        .await;

    // Second attempt succeeds
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    let event = create_test_webhook_event();
    let worker = WebhookDeliveryWorker::new(mock_server.uri());

    let result = worker.process_with_retry(event).await;

    assert!(result.is_ok());
    mock_server.verify().await;
}
```

---

### 3. Conformance Tests (5% of tests)

#### Objectives
- Verify OpenAI ACP specification compliance
- Validate OpenAPI schema conformance
- Test against official conformance suite

**OpenAPI Schema Validation** (`tests/conformance/openapi.rs`):
```rust
#[tokio::test]
async fn test_openapi_schema_validation() {
    let app = setup_test_app().await;
    let client = TestClient::new(app.address());

    // Fetch OpenAPI spec
    let spec_response = client
        .get("/swagger/openapi.json")
        .send()
        .await
        .unwrap();

    assert_eq!(spec_response.status(), 200);

    let spec: serde_json::Value = spec_response.json().await.unwrap();

    // Validate spec structure
    assert_eq!(spec["openapi"], "3.0.0");
    assert!(spec["paths"].is_object());
    assert!(spec["components"]["schemas"].is_object());

    // Validate required endpoints exist
    assert!(spec["paths"]["/v1/checkout"].is_object());
    assert!(spec["paths"]["/v1/checkout/{id}"].is_object());
}

#[tokio::test]
async fn test_request_response_schema_compliance() {
    use openapiv3::OpenAPI;

    // Load OpenAPI spec
    let spec = load_openapi_spec();

    // Test each endpoint
    for (path, path_item) in spec.paths.iter() {
        if let Some(operation) = &path_item.post {
            // Validate request schema
            let request_body = operation.request_body.as_ref().unwrap();
            validate_request_schema(request_body);

            // Validate response schemas
            for (_status, response) in operation.responses.responses.iter() {
                validate_response_schema(response);
            }
        }
    }
}
```

**ACP Specification Compliance** (`tests/conformance/acp_spec.rs`):
```rust
#[tokio::test]
async fn test_checkout_state_machine_compliance() {
    // ACP spec requires specific state transitions
    let valid_transitions = vec![
        (CheckoutState::Pending, CheckoutState::Processing),
        (CheckoutState::Processing, CheckoutState::Completed),
        (CheckoutState::Pending, CheckoutState::Cancelled),
        (CheckoutState::Pending, CheckoutState::Expired),
    ];

    for (from, to) in valid_transitions {
        let mut checkout = create_checkout_in_state(from);
        assert!(checkout.transition_to(to).is_ok());
    }

    // Invalid transitions should fail
    let invalid_transitions = vec![
        (CheckoutState::Completed, CheckoutState::Pending),
        (CheckoutState::Cancelled, CheckoutState::Processing),
    ];

    for (from, to) in invalid_transitions {
        let mut checkout = create_checkout_in_state(from);
        assert!(checkout.transition_to(to).is_err());
    }
}

#[tokio::test]
async fn test_spt_format_compliance() {
    let spt = create_test_spt();

    // Verify SPT structure matches ACP spec
    assert!(spt.token_id.starts_with("spt_"));
    assert!(!spt.payment_method.is_empty());
    assert!(!spt.merchant_id.is_empty());
    assert!(!spt.currency.is_empty());
    assert!(spt.expires_at > Utc::now().timestamp());
    assert!(!spt.scope.is_empty());
    assert!(!spt.signature.is_empty());
}
```

---

### 4. Performance Tests

#### Objectives
- Verify latency targets (<50ms)
- Validate throughput (>5,000 ops/sec)
- Measure protocol routing overhead
- Benchmark WASM performance

**Latency Benchmarks** (`benches/checkout_latency.rs`):
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn checkout_creation_benchmark(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let app = runtime.block_on(setup_test_app());

    c.bench_function("checkout_creation", |b| {
        b.to_async(&runtime).iter(|| async {
            let request = create_test_checkout_request();
            let result = app.create_checkout(black_box(request)).await;
            black_box(result)
        })
    });
}

fn spt_validation_benchmark(c: &mut Criterion) {
    let spt = create_test_spt();

    c.bench_function("spt_validation", |b| {
        b.iter(|| {
            black_box(spt.validate(5000))
        })
    });
}

fn protocol_routing_benchmark(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let router = create_protocol_router();

    c.bench_function("protocol_routing", |b| {
        b.to_async(&runtime).iter(|| async {
            let request = create_mixed_protocol_request();
            black_box(router.route_payment(request).await)
        })
    });
}

criterion_group!(
    benches,
    checkout_creation_benchmark,
    spt_validation_benchmark,
    protocol_routing_benchmark
);
criterion_main!(benches);
```

**Throughput Tests** (`tests/performance/throughput.rs`):
```rust
#[tokio::test]
async fn test_checkout_throughput() {
    let app = setup_test_app().await;
    let concurrent_requests = 1000;
    let duration = Duration::from_secs(10);

    let start = Instant::now();
    let mut handles = vec![];

    for _ in 0..concurrent_requests {
        let app_clone = app.clone();
        let handle = tokio::spawn(async move {
            let request = create_test_checkout_request();
            app_clone.create_checkout(request).await
        });
        handles.push(handle);
    }

    let results = futures::future::join_all(handles).await;
    let elapsed = start.elapsed();

    let successful = results.iter().filter(|r| r.is_ok()).count();
    let throughput = successful as f64 / elapsed.as_secs_f64();

    println!("Throughput: {:.2} checkouts/second", throughput);
    assert!(throughput > 5000.0, "Throughput below target: {}", throughput);
}
```

---

### 5. Security Tests

#### Objectives
- Validate authentication and authorization
- Test rate limiting
- Verify SPT security properties
- Check for common vulnerabilities

**Authentication Tests** (`tests/security/auth.rs`):
```rust
#[tokio::test]
async fn test_unauthenticated_request_blocked() {
    let app = setup_test_app().await;
    let client = TestClient::new(app.address());

    let response = client
        .post("/v1/checkout")
        .json(&create_test_checkout_request())
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn test_invalid_api_key_rejected() {
    let app = setup_test_app().await;
    let client = TestClient::new(app.address());

    let response = client
        .post("/v1/checkout")
        .header("Authorization", "Bearer invalid_key")
        .json(&create_test_checkout_request())
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn test_rate_limiting() {
    let app = setup_test_app().await;
    let client = TestClient::new(app.address());
    let api_key = create_test_api_key();

    // Exceed rate limit (e.g., 100 requests/minute)
    for _ in 0..105 {
        let response = client
            .post("/v1/checkout")
            .header("Authorization", &api_key)
            .json(&create_test_checkout_request())
            .send()
            .await
            .unwrap();

        if response.status() == 429 {
            // Rate limit hit
            return;
        }
    }

    panic!("Rate limiting not enforced");
}
```

**SPT Security Tests** (`tests/security/spt.rs`):
```rust
#[test]
fn test_spt_signature_tampering_detected() {
    let mut spt = create_signed_spt();

    // Tamper with amount
    spt.amount_limit = Some(999999);

    // Signature should be invalid
    assert!(spt.verify_signature().is_err());
}

#[test]
fn test_expired_spt_rejected() {
    let mut spt = create_test_spt();
    spt.expires_at = Utc::now().timestamp() - 3600;

    assert!(spt.validate(5000).is_err());
}

#[test]
fn test_spt_scope_enforcement() {
    let spt = SharedPaymentToken {
        scope: vec![TokenScope::Charge],
        ..create_test_spt()
    };

    // Charge allowed
    assert!(spt.can_perform(&TokenScope::Charge));

    // Refund not allowed
    assert!(!spt.can_perform(&TokenScope::Refund));
}
```

---

## Test Execution Strategy

### Local Development
```bash
# Run all tests
cargo test --all-features

# Run specific test category
cargo test --test integration
cargo test --test conformance

# Run with coverage
cargo tarpaulin --out Html --all-features

# Run benchmarks
cargo bench
```

### Continuous Integration (CI)
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable

      - name: Run unit tests
        run: cargo test --lib --all-features

      - name: Run integration tests
        run: cargo test --test integration --all-features

      - name: Run conformance tests
        run: cargo test --test conformance --all-features

      - name: Check code coverage
        run: |
          cargo install tarpaulin
          cargo tarpaulin --out Xml --all-features
          bash <(curl -s https://codecov.io/bash)

  benchmarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run benchmarks
        run: cargo bench --all-features

  wasm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test WASM build
        run: |
          cargo install wasm-pack
          wasm-pack test --headless --chrome --features wasm-acp
```

---

## Success Criteria

### Coverage Targets
- ✅ Unit tests: >90% line coverage
- ✅ Integration tests: All critical paths covered
- ✅ Conformance tests: 100% OpenAI spec compliance
- ✅ Performance: <50ms p99 latency, >5,000 ops/sec throughput
- ✅ Security: No critical vulnerabilities

### Quality Gates
- ✅ All tests pass before merge
- ✅ No test flakiness (100% deterministic)
- ✅ Backward compatibility: All AP2 tests pass
- ✅ Documentation: Every public API has tests

---

**Document Version**: 1.0
**Last Updated**: 2025-09-29
**Status**: Active - Implementation in Progress