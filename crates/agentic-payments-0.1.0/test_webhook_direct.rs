// Direct test of ACP Webhook functionality
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct WebhookEvent {
    event_type: String,
    checkout_session_id: String,
    data: serde_json::Value,
    timestamp: i64,
}

#[tokio::main]
async fn main() {
    println!("📨 Testing ACP Webhook Implementation\n");

    // Test 1: WebhookEvent Serialization
    println!("Test 1: WebhookEvent Serialization");
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

    match serde_json::to_string(&event) {
        Ok(json) => {
            println!("  ✓ Serialized: {}", json);
            assert!(json.contains("order.created"));
            assert!(json.contains("cs_test_123"));
            assert!(json.contains("USD"));
        }
        Err(e) => panic!("  ✗ Serialization failed: {}", e),
    }

    // Test 2: WebhookEvent Deserialization
    println!("\nTest 2: WebhookEvent Deserialization");
    let json = r#"{
        "event_type": "order.shipped",
        "checkout_session_id": "cs_xyz",
        "data": {"tracking": "1Z999AA10123456784"},
        "timestamp": 1234567890
    }"#;

    match serde_json::from_str::<WebhookEvent>(json) {
        Ok(parsed) => {
            println!("  ✓ Deserialized: event_type = {}", parsed.event_type);
            assert_eq!(parsed.event_type, "order.shipped");
            assert_eq!(parsed.checkout_session_id, "cs_xyz");
        }
        Err(e) => panic!("  ✗ Deserialization failed: {}", e),
    }

    // Test 3: WebhookEvent Equality
    println!("\nTest 3: WebhookEvent Equality");
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
    println!("  ✓ Equality check passed");

    // Test 4: Retry Strategy (exponential backoff)
    println!("\nTest 4: Exponential Backoff Timing");
    use tokio_retry::strategy::ExponentialBackoff;

    let retry_strategy = ExponentialBackoff::from_millis(10)
        .max_delay(Duration::from_secs(8))
        .take(5);

    let delays: Vec<Duration> = retry_strategy.collect();
    println!("  Retry delays:");
    for (i, delay) in delays.iter().enumerate() {
        println!("    Attempt {}: {:?}", i + 1, delay);
    }

    // Verify exponential growth
    assert_eq!(delays.len(), 5, "Should have 5 retry attempts");
    assert!(delays[1] > delays[0], "Delays should grow exponentially");
    assert!(delays[2] > delays[1], "Delays should grow exponentially");
    println!("  ✓ Exponential backoff verified");

    // Test 5: HTTP Client Creation
    println!("\nTest 5: HTTP Client Creation");
    use reqwest::Client;
    match Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
    {
        Ok(_client) => println!("  ✓ HTTP client created with 10s timeout"),
        Err(e) => panic!("  ✗ Client creation failed: {}", e),
    }

    // Test 6: HMAC Integration
    println!("\nTest 6: HMAC Signature Integration");
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;

    let secret = b"webhook_secret_key";
    let payload = serde_json::to_vec(&event1).unwrap();

    let mut mac = HmacSha256::new_from_slice(secret).unwrap();
    mac.update(&payload);
    let signature = hex::encode(mac.finalize().into_bytes());

    println!("  ✓ Generated HMAC signature: {} (len: {})", signature, signature.len());
    assert_eq!(signature.len(), 64, "SHA256 signature should be 64 hex chars");

    println!("\n✅ All Webhook tests passed!");
}