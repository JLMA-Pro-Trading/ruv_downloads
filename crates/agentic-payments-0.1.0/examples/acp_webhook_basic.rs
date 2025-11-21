//! Basic ACP webhook delivery example
//!
//! Demonstrates the webhook delivery system with HMAC signature verification.
//!
//! Run with:
//! ```bash
//! cargo run --example acp_webhook_basic --features acp
//! ```

use agentic_payments::acp::{DeliveryResult, WebhookDelivery, WebhookEvent};
use serde_json::json;

#[cfg(feature = "acp")]
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 ACP Webhook Delivery Example\n");

    // Initialize webhook delivery system with HMAC secret
    let webhook_secret = b"my_secure_webhook_secret_key_12345";
    let delivery = WebhookDelivery::new(webhook_secret.to_vec())
        .with_max_retries(3); // Configure retry attempts

    println!("✅ Webhook delivery system initialized");
    println!("   HMAC Secret: {} bytes", webhook_secret.len());
    println!("   Max Retries: 3\n");

    // Create a webhook event for order creation
    let event = WebhookEvent {
        event_type: "order.created".to_string(),
        checkout_session_id: "cs_test_1234567890".to_string(),
        data: json!({
            "order_id": "ord_9876543210",
            "amount": 1999,
            "currency": "USD",
            "status": "created",
            "items": [
                {
                    "id": "item_1",
                    "name": "Widget",
                    "quantity": 2,
                    "price": 999
                }
            ]
        }),
        timestamp: chrono::Utc::now().timestamp(),
    };

    println!("📦 Created webhook event:");
    println!("   Event Type: {}", event.event_type);
    println!("   Session ID: {}", event.checkout_session_id);
    println!(
        "   Payload Size: {} bytes\n",
        serde_json::to_string(&event)?.len()
    );

    // Attempt to deliver webhook to test endpoint
    let endpoint = "https://httpbin.org/post";
    println!("🌐 Delivering webhook to: {}", endpoint);
    println!("   (This is a test endpoint that always returns 200 OK)\n");

    match delivery.deliver(endpoint, event).await? {
        DeliveryResult::Success { status_code } => {
            println!("✅ Webhook delivered successfully!");
            println!("   HTTP Status: {}", status_code);
            println!("   Retry logic: Not needed (succeeded on first attempt)");
        }
        DeliveryResult::Failed(error) => {
            println!("❌ Webhook delivery failed after all retries");
            println!("   Error: {}", error);
            println!("   Next step: Event would be sent to Dead Letter Queue");
        }
    }

    println!("\n📊 Implementation Status:");
    println!("   ✅ HMAC-SHA256 signature generation");
    println!("   ✅ Exponential backoff retry (10ms → 8s)");
    println!("   ✅ Async HTTP delivery with reqwest");
    println!("   ✅ Configurable retry attempts");
    println!("   ✅ Comprehensive error handling");

    Ok(())
}

#[cfg(not(feature = "acp"))]
fn main() {
    eprintln!("❌ This example requires the 'acp' feature.");
    eprintln!("   Run with: cargo run --example acp_webhook_basic --features acp");
    std::process::exit(1);
}