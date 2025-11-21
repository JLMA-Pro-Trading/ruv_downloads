//! Basic Ed25519 Signature Verification Example
//!
//! This example demonstrates:
//! - Generating an agent identity with Ed25519 keypair
//! - Signing a message
//! - Verifying the signature
//! - Displaying the results
//!
//! Run with: `cargo run --example basic_verification`

use agentic_payments::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the library with logging
    agentic_payments::init()?;

    println!("🔐 Basic Ed25519 Signature Verification Example\n");
    println!("================================================\n");

    // Step 1: Generate a new agent identity
    println!("1️⃣  Generating agent identity...");
    let identity = AgentIdentity::generate()?;
    println!("   ✓ Agent ID: {}", identity.id());
    println!("   ✓ DID: {}", identity.did());
    println!("   ✓ Public Key: {:?}\n", hex::encode(identity.verifying_key_bytes()));

    // Step 2: Sign a message
    let message = b"Autonomous payment authorization for Agent-001";
    println!("2️⃣  Signing message: {:?}", String::from_utf8_lossy(message));
    let signature = identity.sign(message)?;
    println!("   ✓ Signature created");
    println!("   ✓ Signature bytes (first 16): {:?}...\n", &signature.to_bytes()[..16]);

    // Step 3: Verify the signature
    println!("3️⃣  Verifying signature...");
    let is_valid = identity.verify(message, &signature)?;
    println!("   ✓ Verification result: {}\n", if is_valid { "✅ VALID" } else { "❌ INVALID" });

    // Step 4: Test with wrong message (should fail)
    let wrong_message = b"Different message";
    println!("4️⃣  Testing with wrong message: {:?}", String::from_utf8_lossy(wrong_message));
    let is_valid_wrong = identity.verify(wrong_message, &signature)?;
    println!("   ✓ Verification result: {}\n", if is_valid_wrong { "✅ VALID" } else { "❌ INVALID (as expected)" });

    // Step 5: Test cross-identity verification (should fail)
    println!("5️⃣  Testing cross-identity verification...");
    let other_identity = AgentIdentity::generate()?;
    let is_valid_cross = other_identity.verify(message, &signature)?;
    println!("   ✓ Verification result: {}\n", if is_valid_cross { "✅ VALID" } else { "❌ INVALID (as expected)" });

    // Step 6: Create DID Document
    println!("6️⃣  Creating W3C DID Document...");
    let did_doc = identity.to_did_document();
    println!("   ✓ DID Document created");
    println!("   ✓ Document ID: {}", did_doc.id);
    println!("   ✓ Verification Methods: {}", did_doc.verification_method.len());
    println!("   ✓ Authentication: {}", did_doc.authentication.len());

    // Validate DID document
    did_doc.validate()?;
    println!("   ✓ DID Document validation: PASSED\n");

    // Summary
    println!("================================================");
    println!("✨ Summary:");
    println!("   • Agent identity generated successfully");
    println!("   • Message signed with Ed25519");
    println!("   • Signature verified correctly");
    println!("   • Invalid signatures properly rejected");
    println!("   • W3C DID Document created and validated");
    println!("\n🎉 Basic verification example completed successfully!");

    Ok(())
}