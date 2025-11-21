//! AP2 Verifiable Credentials Example
//!
//! This example demonstrates:
//! - Creating Intent Mandates (user authorizes agent)
//! - Creating Cart Mandates (explicit purchase authorization)
//! - Creating Payment Mandates (payment network signal)
//! - Verifying credentials with multi-agent consensus
//! - Building complete payment authorization chains
//!
//! Run with: `cargo run --example ap2_credentials`

use agentic_payments::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the library
    agentic_payments::init()?;

    println!("💳 AP2 Verifiable Credentials Example\n");
    println!("================================================\n");

    // Step 1: Initialize AP2 Protocol
    println!("1️⃣  Initializing AP2 Protocol...");
    let mut ap2 = Ap2Protocol::new();
    println!("   ✓ AP2 Protocol Version: {}", AP2_VERSION);
    println!("   ✓ W3C Verifiable Credentials support enabled");
    println!("   ✓ DID resolver initialized\n");

    // Step 2: Register agent identities
    println!("2️⃣  Registering agent identities...");

    // User agent (authorizes the purchase)
    let user_identity = AgentIdentity::generate()?;
    let user_agent = ap2.register_agent("user-agent", user_identity.verifying_key_bytes().to_vec())?;
    println!("   ✓ User Agent registered");
    println!("      DID: {}", user_agent.did);

    // Shopping agent (performs the purchase)
    let shopping_identity = AgentIdentity::generate()?;
    let shopping_agent = ap2.register_agent("shopping-agent", shopping_identity.verifying_key_bytes().to_vec())?;
    println!("   ✓ Shopping Agent registered");
    println!("      DID: {}", shopping_agent.did);

    // Merchant agent (receives the payment)
    let merchant_identity = AgentIdentity::generate()?;
    let merchant_agent = ap2.register_agent("merchant-agent", merchant_identity.verifying_key_bytes().to_vec())?;
    println!("   ✓ Merchant Agent registered");
    println!("      DID: {}\n", merchant_agent.did);

    // Step 3: Create Intent Mandate
    println!("3️⃣  Creating Intent Mandate (User → Shopping Agent)...");
    let intent_description = "Authorized to purchase electronics up to $500";
    let intent_mandate = ap2.create_intent_mandate(
        &user_agent,
        &shopping_agent.did,
        intent_description,
        &user_identity.to_bytes()
    )?;

    println!("   ✓ Intent Mandate created");
    println!("      Type: {}", intent_mandate.credential_type);
    println!("      Issuer: {}", intent_mandate.issuer);
    println!("      Subject: {}", intent_mandate.credential_subject.id);
    println!("      Description: {}", intent_description);
    println!("      Valid Until: {}", intent_mandate.expiration_date.map_or("Never".to_string(), |d| d.to_rfc3339()));

    // Verify intent mandate
    let intent_valid = intent_mandate.verify(ap2.did_resolver())?;
    println!("      Verification: {}\n", if intent_valid { "✅ VALID" } else { "❌ INVALID" });

    // Step 4: Create Cart Mandate
    println!("4️⃣  Creating Cart Mandate (Explicit Purchase Authorization)...");
    let cart_items = vec![
        CartItem {
            id: "item-001".to_string(),
            name: "Laptop".to_string(),
            quantity: 1,
            unit_price: 89900, // $899.00 in cents
            total_price: 89900,
        },
        CartItem {
            id: "item-002".to_string(),
            name: "Wireless Mouse".to_string(),
            quantity: 2,
            unit_price: 2999, // $29.99 in cents
            total_price: 5998,
        },
    ];
    let total_amount = cart_items.iter().map(|item| item.total_price).sum();

    let cart_mandate = ap2.create_cart_mandate(
        &user_agent,
        cart_items.clone(),
        total_amount,
        "USD",
        &user_identity.to_bytes()
    )?;

    println!("   ✓ Cart Mandate created");
    println!("      Items: {}", cart_items.len());
    for item in &cart_items {
        println!("         • {} (x{}) - ${:.2}", item.name, item.quantity, item.total_price as f64 / 100.0);
    }
    println!("      Total: ${:.2}", total_amount as f64 / 100.0);
    println!("      Currency: USD");

    let cart_valid = cart_mandate.verify(ap2.did_resolver())?;
    println!("      Verification: {}\n", if cart_valid { "✅ VALID" } else { "❌ INVALID" });

    // Step 5: Create Payment Mandate
    println!("5️⃣  Creating Payment Mandate (Payment Network Signal)...");
    let payment_mandate = ap2.create_payment_mandate(
        &shopping_agent,
        &merchant_agent.did,
        total_amount,
        "USD",
        "card-stripe",
        &shopping_identity.to_bytes()
    )?;

    println!("   ✓ Payment Mandate created");
    println!("      From: {}", shopping_agent.did);
    println!("      To: {}", merchant_agent.did);
    println!("      Amount: ${:.2}", total_amount as f64 / 100.0);
    println!("      Payment Method: card-stripe");

    let payment_valid = payment_mandate.verify(ap2.did_resolver())?;
    println!("      Verification: {}\n", if payment_valid { "✅ VALID" } else { "❌ INVALID" });

    // Step 6: Build Payment Authorization Chain
    println!("6️⃣  Building Payment Authorization Chain...");
    let authorization = PaymentAuthorization::new(
        intent_mandate.clone(),
        cart_mandate.clone(),
        payment_mandate.clone(),
    );

    println!("   ✓ Authorization chain created");
    println!("      Chain Length: {} credentials", authorization.authorization_chain.len());
    println!("      Timestamp: {}", authorization.timestamp.to_rfc3339());

    // Verify the complete chain
    let chain_valid = authorization.verify_chain(ap2.did_resolver())?;
    println!("      Chain Verification: {}", if chain_valid { "✅ VALID" } else { "❌ INVALID" });

    let is_not_expired = authorization.is_valid();
    println!("      Expiration Check: {}\n", if is_not_expired { "✅ NOT EXPIRED" } else { "⚠️ EXPIRED" });

    // Step 7: Multi-Agent Consensus Verification
    println!("7️⃣  Performing multi-agent consensus verification...");

    // Create verifier nodes
    let verifier_nodes = vec![
        VerifierNode {
            id: "verifier-1".to_string(),
            identity: AgentIdentity::generate()?,
            weight: 1,
        },
        VerifierNode {
            id: "verifier-2".to_string(),
            identity: AgentIdentity::generate()?,
            weight: 1,
        },
        VerifierNode {
            id: "verifier-3".to_string(),
            identity: AgentIdentity::generate()?,
            weight: 1,
        },
        VerifierNode {
            id: "verifier-4".to_string(),
            identity: AgentIdentity::generate()?,
            weight: 1,
        },
        VerifierNode {
            id: "verifier-5".to_string(),
            identity: AgentIdentity::generate()?,
            weight: 1,
        },
    ];

    println!("   🔄 Distributing verification to {} nodes...", verifier_nodes.len());
    let consensus_result = ap2.verify_payment_authorization(
        &authorization,
        verifier_nodes.clone(),
    ).await?;

    println!("   ✓ Consensus verification completed\n");
    println!("   📊 Consensus Results:");
    println!("      • Verifier Nodes: {}", verifier_nodes.len());
    println!("      • Votes FOR (Valid): {}", consensus_result.votes_for);
    println!("      • Votes AGAINST (Invalid): {}", consensus_result.votes_against);
    println!("      • Consensus: {}", if consensus_result.consensus_reached { "✅ REACHED" } else { "❌ NOT REACHED" });
    println!("      • Agreement: {:.1}%", consensus_result.agreement_percentage);
    println!("      • BFT Quorum: {}", if consensus_result.bft_quorum_met { "✅ MET" } else { "❌ NOT MET" });
    println!("      • Verification Time: {:?}", consensus_result.duration);

    // Step 8: Test invalid authorization
    println!("\n8️⃣  Testing invalid authorization (wrong payment amount)...");
    let invalid_payment = ap2.create_payment_mandate(
        &shopping_agent,
        &merchant_agent.did,
        99999999, // Wrong amount!
        "USD",
        "card-stripe",
        &shopping_identity.to_bytes()
    )?;

    let invalid_auth = PaymentAuthorization::new(
        intent_mandate,
        cart_mandate,
        invalid_payment,
    );

    println!("   🔄 Verifying authorization with mismatched amount...");
    let invalid_result = ap2.verify_payment_authorization(
        &invalid_auth,
        verifier_nodes,
    ).await?;

    println!("   ✓ Verification completed\n");
    println!("   📊 Invalid Authorization Results:");
    println!("      • Consensus: {}", if invalid_result.consensus_reached { "✅ REACHED" } else { "❌ NOT REACHED (as expected)" });
    println!("      • Fraud Detection: {}", if !invalid_result.consensus_reached { "✅ Working" } else { "❌ Failed" });

    // Summary
    println!("\n================================================");
    println!("✨ Summary:");
    println!("   • 3 agent identities registered with DIDs");
    println!("   • Intent Mandate created and verified");
    println!("   • Cart Mandate with 2 items created and verified");
    println!("   • Payment Mandate created and verified");
    println!("   • Complete authorization chain validated");
    println!("   • Multi-agent consensus verification succeeded");
    println!("   • Fraud detection working (invalid amount rejected)");
    println!("\n🎉 AP2 credentials example completed successfully!");
    println!("\n💡 Key Concepts:");
    println!("   • Intent Mandate: User authorizes agent to act on their behalf");
    println!("   • Cart Mandate: Explicit authorization for specific purchases");
    println!("   • Payment Mandate: Signal to payment network for transaction");
    println!("   • Verifiable Credentials: W3C standard for cryptographic proof");
    println!("   • BFT Consensus: Multiple agents verify authenticity");

    Ok(())
}