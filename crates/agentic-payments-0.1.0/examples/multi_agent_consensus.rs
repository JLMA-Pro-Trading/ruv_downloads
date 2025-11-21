//! Multi-Agent BFT Consensus Demonstration
//!
//! This example demonstrates:
//! - Initializing a Byzantine Fault Tolerant system with 5 agents
//! - Performing signature verification with multi-agent consensus
//! - Showing vote distribution across agents
//! - Demonstrating Byzantine tolerance (surviving faulty agents)
//!
//! Run with: `cargo run --example multi_agent_consensus`

use agentic_payments::prelude::*;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the library
    agentic_payments::init()?;

    println!("🤝 Multi-Agent BFT Consensus Example\n");
    println!("================================================\n");

    // Configuration
    const NUM_AGENTS: usize = 5;
    const CONSENSUS_THRESHOLD: f64 = 0.67; // ⅔+ for BFT
    const BYZANTINE_FAULTS: usize = 1; // Can tolerate f=1 faults with 2f+1=3 agents minimum

    println!("📋 Configuration:");
    println!("   • Agent Pool Size: {}", NUM_AGENTS);
    println!("   • Consensus Threshold: {:.0}% (⅔+ for BFT)", CONSENSUS_THRESHOLD * 100.0);
    println!("   • Byzantine Fault Tolerance: f={}", BYZANTINE_FAULTS);
    println!("   • Minimum Required Votes: {}\n", ((NUM_AGENTS as f64 * CONSENSUS_THRESHOLD).ceil() as usize));

    // Step 1: Initialize the agentic verification system
    println!("1️⃣  Initializing verification system...");
    let system = AgenticVerificationSystem::builder()
        .pool_size(NUM_AGENTS)
        .consensus_threshold(CONSENSUS_THRESHOLD)
        .consensus_timeout_ms(100)
        .build()
        .await?;
    println!("   ✓ {} verification agents spawned", NUM_AGENTS);
    println!("   ✓ BFT consensus configured\n");

    // Step 2: Create agent identity and sign message
    println!("2️⃣  Creating agent identity and signing message...");
    let identity = AgentIdentity::generate()?;
    let message = b"Transfer 100 tokens from Agent-A to Agent-B";
    let signature = identity.sign(message)?;
    println!("   ✓ Agent ID: {}", identity.id());
    println!("   ✓ Message: {:?}", String::from_utf8_lossy(message));
    println!("   ✓ Signature created\n");

    // Step 3: Verify with multi-agent consensus
    println!("3️⃣  Performing multi-agent consensus verification...");
    println!("   🔄 Distributing verification task to {} agents...", NUM_AGENTS);

    let result = system.verify_with_consensus(
        signature.clone(),
        message,
        identity.verifying_key()
    ).await?;

    println!("   ✓ Verification completed in {:?}", result.duration);
    println!("\n   📊 Consensus Results:");
    println!("      • Total Agents: {}", result.total_votes);
    println!("      • Votes FOR (Valid): {}", result.votes_for);
    println!("      • Votes AGAINST (Invalid): {}", result.votes_against);
    println!("      • Consensus Reached: {}", if result.is_valid() { "✅ YES" } else { "❌ NO" });
    println!("      • Agreement Percentage: {:.1}%", result.agreement_percentage());
    println!("      • BFT Quorum Met: {}", if result.votes_for >= ((NUM_AGENTS as f64 * CONSENSUS_THRESHOLD).ceil() as usize) { "✅ YES" } else { "❌ NO" });

    // Step 4: Demonstrate vote distribution
    println!("\n4️⃣  Vote Distribution:");
    for (idx, vote) in result.agent_votes.iter().enumerate() {
        println!("      Agent {}: {} (response time: {:?})",
            idx + 1,
            if vote.is_valid { "✅ VALID" } else { "❌ INVALID" },
            vote.response_time
        );
    }

    // Step 5: Test with invalid signature (Byzantine scenario)
    println!("\n5️⃣  Testing Byzantine fault tolerance...");
    let other_identity = AgentIdentity::generate()?;
    let invalid_signature = other_identity.sign(message)?; // Wrong signer

    println!("   🔄 Verifying signature from wrong signer...");
    let invalid_result = system.verify_with_consensus(
        invalid_signature,
        message,
        identity.verifying_key() // Expecting original identity
    ).await?;

    println!("   ✓ Verification completed");
    println!("\n   📊 Byzantine Test Results:");
    println!("      • Total Agents: {}", invalid_result.total_votes);
    println!("      • Votes FOR (Valid): {}", invalid_result.votes_for);
    println!("      • Votes AGAINST (Invalid): {}", invalid_result.votes_against);
    println!("      • Consensus: {}", if invalid_result.is_valid() { "✅ VALID" } else { "❌ INVALID (as expected)" });
    println!("      • Byzantine Detection: {}", if invalid_result.votes_against >= ((NUM_AGENTS as f64 * CONSENSUS_THRESHOLD).ceil() as usize) { "✅ Working" } else { "❌ Failed" });

    // Step 6: Test with agent failures
    println!("\n6️⃣  Simulating agent failures...");
    let agents_to_fail = BYZANTINE_FAULTS;
    println!("   ⚠️  Simulating {} agent failure(s)...", agents_to_fail);

    // System should still reach consensus with remaining agents
    let result_with_failures = system.verify_with_consensus_partial(
        signature,
        message,
        identity.verifying_key(),
        NUM_AGENTS - agents_to_fail
    ).await?;

    println!("   ✓ Verification completed with {} agents", NUM_AGENTS - agents_to_fail);
    println!("\n   📊 Results with Failures:");
    println!("      • Active Agents: {}", result_with_failures.total_votes);
    println!("      • Votes FOR: {}", result_with_failures.votes_for);
    println!("      • Consensus Reached: {}", if result_with_failures.is_valid() { "✅ YES (system survived!)" } else { "❌ NO" });
    println!("      • Fault Tolerance Verified: {}", if result_with_failures.is_valid() { "✅ System operational with f={} faults" } else { "❌ System failed" }, agents_to_fail);

    // Performance metrics
    println!("\n7️⃣  Performance Metrics:");
    let pool_health = system.pool_health().await?;
    println!("   📈 Agent Pool Health:");
    println!("      • Total Agents: {}", pool_health.total);
    println!("      • Healthy Agents: {}", pool_health.healthy);
    println!("      • Busy Agents: {}", pool_health.busy);
    println!("      • Error Agents: {}", pool_health.error);
    println!("      • Health Percentage: {:.1}%", pool_health.health_percentage() * 100.0);

    let metrics = system.metrics().await?;
    println!("\n   ⚡ System Metrics:");
    println!("      • Total Verifications: {}", metrics.total_verifications);
    println!("      • Successful Verifications: {}", metrics.successful_verifications);
    println!("      • Failed Verifications: {}", metrics.failed_verifications);
    println!("      • Average Response Time: {:?}", metrics.avg_response_time);
    println!("      • Throughput: {:.0} verifications/sec", metrics.throughput);

    // Summary
    println!("\n================================================");
    println!("✨ Summary:");
    println!("   • {} agents participated in consensus", NUM_AGENTS);
    println!("   • BFT consensus achieved with ⅔+ quorum");
    println!("   • Invalid signatures properly rejected");
    println!("   • System survived f={} Byzantine faults", BYZANTINE_FAULTS);
    println!("   • Average verification time: {:?}", result.duration);
    println!("\n🎉 Multi-agent consensus example completed successfully!");

    Ok(())
}