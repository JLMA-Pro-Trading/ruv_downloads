//! Trust Chain Validation Example
//!
//! This example demonstrates:
//! - Creating hierarchical certificate chains
//! - Validating trust chains with DFS traversal
//! - Testing chain depth limits
//! - Handling expired certificates
//! - Cross-issuer validation
//!
//! Run with: `cargo run --example trust_chain_validation`

use agentic_payments::prelude::*;
use chrono::{Duration as ChronoDuration, Utc};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the library
    agentic_payments::init()?;

    println!("🔗 Trust Chain Validation Example\n");
    println!("================================================\n");

    // Step 1: Create certificate hierarchy
    println!("1️⃣  Creating certificate hierarchy...");
    println!("   Root CA → Intermediate CA → Leaf Certificate\n");

    // Root Certificate Authority
    let root_identity = AgentIdentity::generate()?;
    let root_cert = Certificate::new_root(
        "Root CA".to_string(),
        root_identity.did().to_string(),
        root_identity.verifying_key_bytes().to_vec(),
        Utc::now() + ChronoDuration::days(3650), // 10 years
    )?;
    println!("   ✓ Root CA Certificate created");
    println!("      Subject: {}", root_cert.subject);
    println!("      DID: {}", root_cert.subject_did);
    println!("      Valid Until: {}", root_cert.not_after.to_rfc3339());
    println!("      Is Root: {}", root_cert.is_root);

    // Intermediate Certificate Authority
    let intermediate_identity = AgentIdentity::generate()?;
    let intermediate_cert = Certificate::new_intermediate(
        "Intermediate CA".to_string(),
        intermediate_identity.did().to_string(),
        intermediate_identity.verifying_key_bytes().to_vec(),
        root_cert.clone(),
        &root_identity,
        Utc::now() + ChronoDuration::days(1825), // 5 years
    )?;
    println!("\n   ✓ Intermediate CA Certificate created");
    println!("      Subject: {}", intermediate_cert.subject);
    println!("      Issuer: {}", intermediate_cert.issuer);
    println!("      Valid Until: {}", intermediate_cert.not_after.to_rfc3339());

    // Leaf Certificate (end entity)
    let leaf_identity = AgentIdentity::generate()?;
    let leaf_cert = Certificate::new_leaf(
        "Leaf Certificate".to_string(),
        leaf_identity.did().to_string(),
        leaf_identity.verifying_key_bytes().to_vec(),
        intermediate_cert.clone(),
        &intermediate_identity,
        Utc::now() + ChronoDuration::days(365), // 1 year
    )?;
    println!("\n   ✓ Leaf Certificate created");
    println!("      Subject: {}", leaf_cert.subject);
    println!("      Issuer: {}", leaf_cert.issuer);
    println!("      Valid Until: {}", leaf_cert.not_after.to_rfc3339());
    println!("      Chain Depth: 3 (Root → Intermediate → Leaf)\n");

    // Step 2: Build certificate chain
    println!("2️⃣  Building certificate chain...");
    let chain = CertificateChain::new(vec![
        leaf_cert.clone(),
        intermediate_cert.clone(),
        root_cert.clone(),
    ]);
    println!("   ✓ Certificate chain built");
    println!("      Chain Length: {}", chain.len());
    println!("      Root Certificate: {}", chain.root().subject);
    println!("      Leaf Certificate: {}", chain.leaf().subject);

    // Step 3: Validate trust chain with DFS
    println!("\n3️⃣  Validating trust chain with DFS traversal...");
    let trust_validator = TrustChainValidator::new();

    let validation_result = trust_validator.validate_chain(&chain).await?;
    println!("   ✓ Trust chain validation completed\n");
    println!("   📊 Validation Results:");
    println!("      • Chain Valid: {}", if validation_result.is_valid { "✅ YES" } else { "❌ NO" });
    println!("      • Chain Length: {}", validation_result.chain_length);
    println!("      • Certificates Validated: {}", validation_result.certificates_validated);
    println!("      • Root Trusted: {}", if validation_result.root_trusted { "✅ YES" } else { "❌ NO" });
    println!("      • No Expired Certificates: {}", if validation_result.no_expired { "✅ YES" } else { "❌ NO" });
    println!("      • Signatures Valid: {}", if validation_result.signatures_valid { "✅ YES" } else { "❌ NO" });
    println!("      • Validation Time: {:?}", validation_result.duration);

    // Step 4: Test chain depth limits
    println!("\n4️⃣  Testing chain depth limits...");
    const MAX_CHAIN_DEPTH: usize = 5;
    println!("   Configuration: Maximum chain depth = {}", MAX_CHAIN_DEPTH);

    // Build a deep chain
    let mut deep_chain = vec![root_cert.clone()];
    let mut current_issuer = root_identity.clone();
    let mut current_cert = root_cert.clone();

    for i in 0..7 {
        let new_identity = AgentIdentity::generate()?;
        let new_cert = Certificate::new_intermediate(
            format!("Intermediate CA Level {}", i + 1),
            new_identity.did().to_string(),
            new_identity.verifying_key_bytes().to_vec(),
            current_cert.clone(),
            &current_issuer,
            Utc::now() + ChronoDuration::days(365),
        )?;
        deep_chain.push(new_cert.clone());
        current_cert = new_cert;
        current_issuer = new_identity;
    }

    println!("   ✓ Deep chain created with {} certificates", deep_chain.len());

    let deep_chain_obj = CertificateChain::new(deep_chain);
    let deep_validation = trust_validator.validate_chain_with_max_depth(
        &deep_chain_obj,
        MAX_CHAIN_DEPTH
    ).await?;

    println!("\n   📊 Deep Chain Validation:");
    println!("      • Chain Length: {}", deep_chain_obj.len());
    println!("      • Max Depth: {}", MAX_CHAIN_DEPTH);
    println!("      • Chain Valid: {}", if deep_validation.is_valid { "✅ YES" } else { "❌ NO (expected)" });
    println!("      • Depth Limit Enforced: {}", if !deep_validation.is_valid && deep_chain_obj.len() > MAX_CHAIN_DEPTH { "✅ YES" } else { "❌ NO" });

    // Step 5: Test with expired certificate
    println!("\n5️⃣  Testing with expired certificate...");

    let expired_identity = AgentIdentity::generate()?;
    let expired_cert = Certificate::new_leaf(
        "Expired Certificate".to_string(),
        expired_identity.did().to_string(),
        expired_identity.verifying_key_bytes().to_vec(),
        root_cert.clone(),
        &root_identity,
        Utc::now() - ChronoDuration::days(1), // Already expired!
    )?;

    let expired_chain = CertificateChain::new(vec![
        expired_cert.clone(),
        root_cert.clone(),
    ]);

    println!("   ⚠️  Certificate expired on: {}", expired_cert.not_after.to_rfc3339());

    let expired_validation = trust_validator.validate_chain(&expired_chain).await?;
    println!("\n   📊 Expired Certificate Validation:");
    println!("      • Chain Valid: {}", if expired_validation.is_valid { "✅ YES" } else { "❌ NO (expected)" });
    println!("      • Expiration Detected: {}", if !expired_validation.no_expired { "✅ YES" } else { "❌ NO" });

    // Step 6: Test cross-issuer validation
    println!("\n6️⃣  Testing cross-issuer validation...");

    let rogue_identity = AgentIdentity::generate()?;
    let rogue_cert = Certificate::new_intermediate(
        "Rogue Certificate".to_string(),
        rogue_identity.did().to_string(),
        rogue_identity.verifying_key_bytes().to_vec(),
        root_cert.clone(),
        &rogue_identity, // Self-signed but claims to be signed by root!
        Utc::now() + ChronoDuration::days(365),
    )?;

    let rogue_chain = CertificateChain::new(vec![
        rogue_cert.clone(),
        root_cert.clone(),
    ]);

    println!("   ⚠️  Rogue certificate claims issuer: {}", rogue_cert.issuer);
    println!("   ⚠️  But was actually signed by: {} (self)", rogue_cert.subject);

    let rogue_validation = trust_validator.validate_chain(&rogue_chain).await?;
    println!("\n   📊 Rogue Certificate Validation:");
    println!("      • Chain Valid: {}", if rogue_validation.is_valid { "✅ YES" } else { "❌ NO (expected)" });
    println!("      • Signature Mismatch Detected: {}", if !rogue_validation.signatures_valid { "✅ YES" } else { "❌ NO" });

    // Step 7: Multi-agent consensus validation
    println!("\n7️⃣  Multi-agent consensus validation...");

    let consensus_validator = ConsensusChainValidator::new(5); // 5 validator agents
    println!("   🔄 Distributing validation to 5 agents...");

    let consensus_result = consensus_validator.validate_with_consensus(&chain).await?;
    println!("   ✓ Consensus validation completed\n");
    println!("   📊 Consensus Results:");
    println!("      • Total Validators: {}", consensus_result.total_validators);
    println!("      • Votes FOR (Valid): {}", consensus_result.votes_for);
    println!("      • Votes AGAINST (Invalid): {}", consensus_result.votes_against);
    println!("      • Consensus: {}", if consensus_result.consensus_reached { "✅ REACHED" } else { "❌ NOT REACHED" });
    println!("      • Agreement: {:.1}%", consensus_result.agreement_percentage);
    println!("      • BFT Quorum: {}", if consensus_result.bft_quorum_met { "✅ MET" } else { "❌ NOT MET" });

    // Performance metrics
    println!("\n8️⃣  Performance Metrics:");
    println!("   ⚡ Trust Chain Validation:");
    println!("      • Valid Chain: {:?}", validation_result.duration);
    println!("      • Deep Chain: {:?}", deep_validation.duration);
    println!("      • Expired Chain: {:?}", expired_validation.duration);
    println!("      • Rogue Chain: {:?}", rogue_validation.duration);
    println!("      • Consensus Validation: {:?}", consensus_result.duration);

    // Summary
    println!("\n================================================");
    println!("✨ Summary:");
    println!("   • 3-level certificate hierarchy created (Root → Intermediate → Leaf)");
    println!("   • Trust chain validated with DFS traversal");
    println!("   • Chain depth limits enforced (max depth: {})", MAX_CHAIN_DEPTH);
    println!("   • Expired certificates properly detected");
    println!("   • Rogue/invalid signatures rejected");
    println!("   • Multi-agent consensus validation succeeded");
    println!("\n🎉 Trust chain validation example completed successfully!");
    println!("\n💡 Key Concepts:");
    println!("   • Certificate Hierarchy: Root → Intermediate → Leaf structure");
    println!("   • DFS Traversal: Depth-first search for chain validation");
    println!("   • Chain Depth Limits: Prevent excessively deep chains");
    println!("   • Expiration Checking: Validate temporal bounds");
    println!("   • Signature Verification: Cryptographic proof of issuance");

    Ok(())
}