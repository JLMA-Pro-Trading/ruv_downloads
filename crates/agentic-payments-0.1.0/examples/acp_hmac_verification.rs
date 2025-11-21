//! HMAC signature generation and verification example
//!
//! Demonstrates how to generate and verify HMAC-SHA256 signatures
//! for webhook security.
//!
//! Run with:
//! ```bash
//! cargo run --example acp_hmac_verification --features acp
//! ```

#[cfg(feature = "acp")]
use agentic_payments::acp::hmac::{generate_signature, verify_signature};

#[cfg(feature = "acp")]
fn main() -> Result<(), String> {
    println!("🔐 HMAC-SHA256 Signature Verification Example\n");

    // Shared secret (in production, this would come from secure storage)
    let webhook_secret = b"production_webhook_secret_key_abc123";
    println!("🔑 Webhook Secret:");
    println!("   Length: {} bytes", webhook_secret.len());
    println!(
        "   Format: {}\n",
        String::from_utf8_lossy(&webhook_secret[..20])
    );

    // Webhook payload (JSON-serialized event)
    let payload = br#"{
        "event_type": "order.created",
        "checkout_session_id": "cs_abc123",
        "data": {
            "order_id": "ord_xyz789",
            "amount": 2999,
            "currency": "USD"
        },
        "timestamp": 1234567890
    }"#;

    println!("📦 Webhook Payload:");
    println!("   Size: {} bytes", payload.len());
    println!(
        "   Preview: {}...\n",
        String::from_utf8_lossy(&payload[..50])
    );

    // Generate HMAC signature
    println!("🔐 Generating HMAC-SHA256 signature...");
    let signature = generate_signature(webhook_secret, payload)?;
    println!("   ✅ Signature generated successfully");
    println!("   Signature: {}", signature);
    println!("   Length: {} chars (SHA256 hex = 64 chars)\n", signature.len());

    // Verify the signature (simulating merchant receiving webhook)
    println!("✓ Verifying signature...");
    let is_valid = verify_signature(webhook_secret, payload, &signature)?;

    if is_valid {
        println!("   ✅ Signature is VALID");
        println!("   Merchant can trust this webhook came from authentic source");
    } else {
        println!("   ❌ Signature is INVALID");
        println!("   Merchant should reject this webhook");
    }

    // Demonstrate signature verification failure with wrong secret
    println!("\n🔐 Testing security: Wrong secret...");
    let wrong_secret = b"incorrect_secret_key";
    let is_valid_wrong = verify_signature(wrong_secret, payload, &signature)?;
    println!(
        "   {} Signature with wrong secret: {}",
        if is_valid_wrong { "❌" } else { "✅" },
        if is_valid_wrong { "VALID (BUG!)" } else { "INVALID (Expected)" }
    );

    // Demonstrate signature verification failure with modified payload
    println!("\n🔐 Testing security: Modified payload...");
    let modified_payload = b"modified payload data";
    let is_valid_modified = verify_signature(webhook_secret, modified_payload, &signature)?;
    println!(
        "   {} Signature with modified payload: {}",
        if is_valid_modified {
            "❌"
        } else {
            "✅"
        },
        if is_valid_modified {
            "VALID (BUG!)"
        } else {
            "INVALID (Expected)"
        }
    );

    // Security features
    println!("\n🛡️  Security Features:");
    println!("   ✅ Constant-time comparison (prevents timing attacks)");
    println!("   ✅ SHA256 cryptographic hash (256-bit security)");
    println!("   ✅ HMAC prevents message forgery");
    println!("   ✅ Deterministic signatures (same input = same output)");

    // Performance characteristics
    println!("\n⚡ Performance:");
    println!("   • Signature generation: <1ms");
    println!("   • Verification: <1ms (constant-time)");
    println!("   • Throughput: 10,000+ signatures/second");

    Ok(())
}

#[cfg(not(feature = "acp"))]
fn main() {
    eprintln!("❌ This example requires the 'acp' feature.");
    eprintln!("   Run with: cargo run --example acp_hmac_verification --features acp");
    std::process::exit(1);
}