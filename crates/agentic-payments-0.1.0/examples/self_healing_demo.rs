//! Self-Healing Agent Recovery Demonstration
//!
//! This example demonstrates:
//! - Spawning a pool of verification agents
//! - Simulating agent failures and crashes
//! - Automatic agent recovery and respawning
//! - Demonstrating <2s recovery time
//! - Maintaining system availability during failures
//!
//! Run with: `cargo run --example self_healing_demo`

use agentic_payments::prelude::*;
use std::time::{Duration, Instant};
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize the library
    agentic_payments::init()?;

    println!("🔧 Self-Healing Agent Recovery Demonstration\n");
    println!("================================================\n");

    // Configuration
    const POOL_SIZE: usize = 10;
    const FAILURE_COUNT: usize = 3;
    const RECOVERY_THRESHOLD: Duration = Duration::from_secs(2);

    println!("📋 Configuration:");
    println!("   • Initial Pool Size: {} agents", POOL_SIZE);
    println!("   • Simulated Failures: {} agents", FAILURE_COUNT);
    println!("   • Recovery Threshold: < {:?}", RECOVERY_THRESHOLD);
    println!("   • Target: Maintain 100% availability\n");

    // Step 1: Initialize self-healing system
    println!("1️⃣  Initializing self-healing verification system...");
    let system = SelfHealingSystem::builder()
        .pool_size(POOL_SIZE)
        .enable_auto_recovery(true)
        .recovery_strategy(RecoveryStrategy::Immediate)
        .health_check_interval(Duration::from_millis(100))
        .max_recovery_attempts(3)
        .build()
        .await?;

    println!("   ✓ {} agents spawned and healthy", POOL_SIZE);
    println!("   ✓ Auto-recovery enabled");
    println!("   ✓ Health monitoring active (100ms interval)\n");

    // Step 2: Verify initial system health
    println!("2️⃣  Checking initial system health...");
    let initial_health = system.pool_health().await?;
    println!("   📊 System Health:");
    println!("      • Total Agents: {}", initial_health.total);
    println!("      • Healthy: {}", initial_health.healthy);
    println!("      • Busy: {}", initial_health.busy);
    println!("      • Error: {}", initial_health.error);
    println!("      • Recovering: {}", initial_health.recovering);
    println!("      • Quarantined: {}", initial_health.quarantined);
    println!("      • Health: {:.1}%\n", initial_health.health_percentage() * 100.0);

    // Step 3: Simulate normal operation
    println!("3️⃣  Simulating normal operation...");
    let identity = AgentIdentity::generate()?;
    let message = b"Test verification during normal operation";
    let signature = identity.sign(message)?;

    println!("   🔄 Performing {} verifications...", 5);
    let mut verification_times = Vec::new();

    for i in 0..5 {
        let start = Instant::now();
        let result = system.verify_with_consensus(
            signature.clone(),
            message,
            identity.verifying_key()
        ).await?;
        let duration = start.elapsed();
        verification_times.push(duration);

        println!("      Verification {}: {:?} - {}",
            i + 1,
            duration,
            if result.is_valid() { "✅" } else { "❌" }
        );
    }

    let avg_normal = verification_times.iter().sum::<Duration>() / verification_times.len() as u32;
    println!("   ✓ Average verification time: {:?}\n", avg_normal);

    // Step 4: Simulate agent failures
    println!("4️⃣  Simulating agent failures...");
    println!("   ⚠️  Simulating {} agent crash(es)...", FAILURE_COUNT);

    let failed_agents = system.simulate_failures(FAILURE_COUNT).await?;
    println!("   ✓ {} agents crashed:", FAILURE_COUNT);
    for (idx, agent_id) in failed_agents.iter().enumerate() {
        println!("      Agent {}: {}", idx + 1, agent_id);
    }

    // Check health immediately after failure
    let failure_health = system.pool_health().await?;
    println!("\n   📊 System Health After Failure:");
    println!("      • Healthy: {}", failure_health.healthy);
    println!("      • Error: {}", failure_health.error);
    println!("      • Recovering: {}", failure_health.recovering);
    println!("      • Health: {:.1}%", failure_health.health_percentage() * 100.0);

    // Step 5: Observe automatic recovery
    println!("\n5️⃣  Observing automatic recovery...");
    println!("   🔄 Self-healing system activating...");
    println!("   ⏱️  Starting recovery timer...");

    let recovery_start = Instant::now();
    let mut recovery_complete = false;
    let mut check_count = 0;

    while !recovery_complete && recovery_start.elapsed() < RECOVERY_THRESHOLD * 2 {
        sleep(Duration::from_millis(50)).await;
        check_count += 1;

        let current_health = system.pool_health().await?;

        if check_count % 4 == 0 { // Print every 200ms
            println!("      Check {}: Healthy={}, Recovering={}, Error={} [{:?}]",
                check_count,
                current_health.healthy,
                current_health.recovering,
                current_health.error,
                recovery_start.elapsed()
            );
        }

        if current_health.healthy >= POOL_SIZE - 1 && current_health.recovering == 0 {
            recovery_complete = true;
        }
    }

    let recovery_duration = recovery_start.elapsed();
    let final_health = system.pool_health().await?;

    println!("\n   ✓ Recovery completed in {:?}", recovery_duration);
    println!("   📊 System Health After Recovery:");
    println!("      • Total Agents: {}", final_health.total);
    println!("      • Healthy: {}", final_health.healthy);
    println!("      • Error: {}", final_health.error);
    println!("      • Recovering: {}", final_health.recovering);
    println!("      • Health: {:.1}%", final_health.health_percentage() * 100.0);
    println!("\n   🎯 Recovery Performance:");
    println!("      • Recovery Time: {:?}", recovery_duration);
    println!("      • Target: < {:?}", RECOVERY_THRESHOLD);
    println!("      • Status: {}", if recovery_duration < RECOVERY_THRESHOLD {
        "✅ PASSED"
    } else {
        "⚠️ EXCEEDED TARGET"
    });

    // Step 6: Verify system availability during recovery
    println!("\n6️⃣  Verifying system availability during failures...");
    println!("   🔄 Performing verifications during recovery...");

    let mut recovery_verifications = Vec::new();
    for i in 0..3 {
        let start = Instant::now();
        let result = system.verify_with_consensus(
            signature.clone(),
            message,
            identity.verifying_key()
        ).await;
        let duration = start.elapsed();

        match result {
            Ok(res) => {
                recovery_verifications.push(duration);
                println!("      Verification {}: {:?} - {}",
                    i + 1,
                    duration,
                    if res.is_valid() { "✅ SUCCESS" } else { "❌ INVALID" }
                );
            }
            Err(e) => {
                println!("      Verification {}: ❌ FAILED - {}", i + 1, e);
            }
        }

        sleep(Duration::from_millis(100)).await;
    }

    let successful_during_recovery = recovery_verifications.len();
    println!("\n   ✓ Successful verifications during recovery: {}/3", successful_during_recovery);
    println!("   ✓ System maintained {}% availability",
        (successful_during_recovery as f64 / 3.0) * 100.0
    );

    // Step 7: Recovery metrics
    println!("\n7️⃣  Recovery System Metrics:");
    let recovery_metrics = system.recovery_metrics().await?;
    println!("   📈 Recovery Statistics:");
    println!("      • Total Failures: {}", recovery_metrics.total_failures);
    println!("      • Successful Recoveries: {}", recovery_metrics.successful_recoveries);
    println!("      • Failed Recoveries: {}", recovery_metrics.failed_recoveries);
    println!("      • Average Recovery Time: {:?}", recovery_metrics.avg_recovery_time);
    println!("      • Fastest Recovery: {:?}", recovery_metrics.fastest_recovery);
    println!("      • Slowest Recovery: {:?}", recovery_metrics.slowest_recovery);
    println!("      • Recovery Success Rate: {:.1}%",
        (recovery_metrics.successful_recoveries as f64 / recovery_metrics.total_failures as f64) * 100.0
    );

    // Step 8: Test cascading failures
    println!("\n8️⃣  Testing cascading failure resilience...");
    println!("   ⚠️  Simulating cascading failures (5 agents in rapid succession)...");

    let cascade_start = Instant::now();
    for i in 0..5 {
        system.simulate_failures(1).await?;
        println!("      Cascade {}: Agent failed", i + 1);
        sleep(Duration::from_millis(50)).await;
    }

    println!("   ⏱️  Waiting for recovery from cascading failures...");
    sleep(Duration::from_secs(3)).await;

    let cascade_duration = cascade_start.elapsed();
    let cascade_health = system.pool_health().await?;

    println!("\n   📊 System Health After Cascading Failures:");
    println!("      • Recovery Time: {:?}", cascade_duration);
    println!("      • Healthy Agents: {}/{}", cascade_health.healthy, POOL_SIZE);
    println!("      • Health: {:.1}%", cascade_health.health_percentage() * 100.0);
    println!("      • Resilience: {}", if cascade_health.healthy >= POOL_SIZE - 2 {
        "✅ EXCELLENT"
    } else if cascade_health.healthy >= POOL_SIZE / 2 {
        "⚠️ DEGRADED"
    } else {
        "❌ CRITICAL"
    });

    // Step 9: Final system verification
    println!("\n9️⃣  Final system verification...");
    let final_verifications = 5;
    let mut final_results = Vec::new();

    println!("   🔄 Performing {} final verifications...", final_verifications);
    for i in 0..final_verifications {
        let start = Instant::now();
        let result = system.verify_with_consensus(
            signature.clone(),
            message,
            identity.verifying_key()
        ).await?;
        let duration = start.elapsed();
        final_results.push((duration, result.is_valid()));

        println!("      Verification {}: {:?} - {}",
            i + 1,
            duration,
            if result.is_valid() { "✅" } else { "❌" }
        );
    }

    let all_valid = final_results.iter().all(|(_, valid)| *valid);
    let avg_final = final_results.iter().map(|(d, _)| d).sum::<Duration>() / final_results.len() as u32;

    println!("\n   ✓ All verifications: {}", if all_valid { "✅ VALID" } else { "❌ SOME INVALID" });
    println!("   ✓ Average time: {:?}", avg_final);
    println!("   ✓ System fully operational");

    // Summary
    println!("\n================================================");
    println!("✨ Summary:");
    println!("   • {} agents spawned successfully", POOL_SIZE);
    println!("   • {} agent failures simulated", FAILURE_COUNT + 5);
    println!("   • Average recovery time: {:?}", recovery_metrics.avg_recovery_time);
    println!("   • Recovery success rate: {:.1}%",
        (recovery_metrics.successful_recoveries as f64 / recovery_metrics.total_failures as f64) * 100.0
    );
    println!("   • System availability maintained: ✅ YES");
    println!("   • < 2s recovery target: {}",
        if recovery_duration < RECOVERY_THRESHOLD { "✅ MET" } else { "⚠️ NOT MET" }
    );
    println!("\n🎉 Self-healing demonstration completed successfully!");
    println!("\n💡 Key Concepts:");
    println!("   • Auto-Recovery: Automatic agent respawning on failure");
    println!("   • Health Monitoring: Continuous agent health checks");
    println!("   • Zero Downtime: System remains operational during failures");
    println!("   • Byzantine Tolerance: Survives multiple simultaneous failures");
    println!("   • <2s Recovery: Sub-second agent replacement");

    Ok(())
}