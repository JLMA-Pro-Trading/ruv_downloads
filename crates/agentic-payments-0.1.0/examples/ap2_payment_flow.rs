//! Complete AP2 Payment Flow Example
//!
//! This example demonstrates a full payment flow using the Agent Payments Protocol (AP2):
//! 1. User authorizes an agent to shop (Intent Mandate)
//! 2. Agent creates a shopping cart (Cart Mandate)
//! 3. Agent initiates payment (Payment Mandate)
//! 4. Multi-agent consensus verification

use agentic_payments::ap2::*;
use ed25519_dalek::SigningKey;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🚀 AP2 Payment Flow Example\n");

    // Step 1: Initialize AP2 Protocol
    println!("📋 Step 1: Initializing AP2 Protocol...");
    let mut protocol = Ap2Protocol::new();
    println!("   ✓ Protocol initialized\n");

    // Step 2: Create User Identity
    println!("👤 Step 2: Creating User Identity...");
    let user_signing_key = SigningKey::generate(&mut rand::rngs::OsRng);
    let user_identity = protocol.register_agent(
        "alice",
        user_signing_key.verifying_key().to_bytes().to_vec(),
    )?;
    println!("   ✓ User DID: {}\n", user_identity.did);

    // Step 3: Create Merchant Identity
    println!("🏪 Step 3: Creating Merchant Identity...");
    let merchant_signing_key = SigningKey::generate(&mut rand::rngs::OsRng);
    let merchant_identity = protocol.register_agent(
        "merchant-store",
        merchant_signing_key.verifying_key().to_bytes().to_vec(),
    )?;
    println!("   ✓ Merchant DID: {}\n", merchant_identity.did);

    // Step 4: Create Intent Mandate
    println!("📝 Step 4: Creating Intent Mandate (User Authorization)...");
    let intent_mandate = protocol.create_intent_mandate(
        &user_identity,
        &merchant_identity.did,
        "Purchase electronics and books from merchant store",
        user_signing_key.as_bytes(),
    )?;
    println!("   ✓ Intent Mandate Created");
    println!("   ✓ Signature Verified: {}\n", intent_mandate.verify(protocol.did_resolver())?);

    // Step 5: Create Shopping Cart
    println!("🛒 Step 5: Creating Shopping Cart...");
    let items = vec![
        CartItem::new(
            "laptop-001".to_string(),
            "Professional Laptop".to_string(),
            1,
            89999, // $899.99
        )
        .with_description("High-performance laptop for developers".to_string()),
        CartItem::new(
            "book-001".to_string(),
            "Rust Programming Book".to_string(),
            2,
            3999, // $39.99 each
        )
        .with_description("Learn Rust programming".to_string()),
        CartItem::new(
            "mouse-001".to_string(),
            "Wireless Mouse".to_string(),
            1,
            2999, // $29.99
        ),
    ];

    println!("   Items in cart:");
    for item in &items {
        println!(
            "     - {} x{} @ ${:.2}",
            item.name,
            item.quantity,
            item.unit_price as f64 / 100.0
        );
    }

    let subtotal: u64 = items.iter().map(|i| i.total_price).sum();
    let tax = (subtotal as f64 * 0.08) as u64; // 8% tax
    let shipping = 999; // $9.99 shipping
    let total = subtotal + tax + shipping;

    println!("   Subtotal: ${:.2}", subtotal as f64 / 100.0);
    println!("   Tax (8%): ${:.2}", tax as f64 / 100.0);
    println!("   Shipping: ${:.2}", shipping as f64 / 100.0);
    println!("   Total: ${:.2}\n", total as f64 / 100.0);

    // Step 6: Create Cart Mandate
    println!("📦 Step 6: Creating Cart Mandate...");
    let cart_mandate = protocol.create_cart_mandate(
        &user_identity,
        items,
        total,
        "USD",
        user_signing_key.as_bytes(),
    )?;
    println!("   ✓ Cart Mandate Created");
    println!("   ✓ Signature Verified: {}\n", cart_mandate.verify(protocol.did_resolver())?);

    // Step 7: Create Payment Mandate
    println!("💳 Step 7: Creating Payment Mandate...");
    let payment_mandate = protocol.create_payment_mandate(
        &user_identity,
        &merchant_identity.did,
        total,
        "USD",
        "credit_card",
        user_signing_key.as_bytes(),
    )?;
    println!("   ✓ Payment Mandate Created");
    println!("   ✓ Signature Verified: {}\n", payment_mandate.verify(protocol.did_resolver())?);

    // Step 8: Create Complete Authorization
    println!("🔐 Step 8: Creating Complete Payment Authorization...");
    let authorization = PaymentAuthorization::new(
        intent_mandate,
        cart_mandate,
        payment_mandate,
    );
    println!("   ✓ Authorization Chain Created");
    println!("   ✓ Chain Verified: {}", authorization.verify_chain(protocol.did_resolver())?);
    println!("   ✓ Authorization Valid: {}\n", authorization.is_valid());

    // Step 9: Multi-Agent Consensus Verification
    println!("🤝 Step 9: Setting up Multi-Agent Consensus Verification...");

    // First, register all verifier DIDs
    let mut verifier_keys = Vec::new();
    let mut verifier_dids = Vec::new();

    for i in 0..5 {
        let verifier_key = SigningKey::generate(&mut rand::rngs::OsRng);
        let verifier_did = format!("did:ap2:verifier-{:03}", i);

        // Register verifier identity through protocol
        protocol.register_agent(
            &format!("verifier-{}", i),
            verifier_key.verifying_key().to_bytes().to_vec(),
        )?;

        verifier_keys.push(verifier_key);
        verifier_dids.push(verifier_did);
    }

    // Now create verifier nodes
    let verifier_nodes: Vec<VerifierNode> = verifier_dids.iter().enumerate()
        .map(|(i, verifier_did)| {
            VerifierNode::new(
                format!("verifier-{}", i),
                verifier_did.clone(),
                format!("https://verifier-{}.example.com", i),
            )
            .with_weight(1.0)
            .with_reputation(0.9 + (i as f64 * 0.02))
        })
        .collect();

    println!("   ✓ {} verifier nodes created", verifier_nodes.len());
    for (i, node) in verifier_nodes.iter().enumerate() {
        println!(
            "     Verifier {}: {} (reputation: {:.2})",
            i + 1,
            node.id,
            node.reputation
        );
    }
    println!();

    // Step 10: Perform Consensus Verification
    println!("✅ Step 10: Performing Consensus Verification...");
    let result = protocol
        .verify_payment_authorization(&authorization, verifier_nodes)
        .await?;

    println!("   📊 Consensus Results:");
    println!("     Verified: {}", result.verified);
    println!("     Consensus Achieved: {}", result.consensus_achieved);
    println!("     Total Verifiers: {}", result.verifier_count);
    println!("     Approvals: {}", result.approval_count);
    println!("     Rejections: {}", result.rejection_count);
    println!("     Threshold: {:.0}%", result.threshold_percentage * 100.0);
    println!("     Approval Rate: {:.1}%", (result.approval_count as f64 / result.verifier_count as f64) * 100.0);

    if result.verified {
        println!("\n🎉 Payment Authorization Verified Successfully!");
        println!("   The payment can now be processed through the payment network.");
    } else {
        println!("\n❌ Payment Authorization Failed!");
        println!("   Consensus was not achieved. Payment cannot proceed.");
    }

    println!("\n✨ AP2 Payment Flow Complete!");
    Ok(())
}
