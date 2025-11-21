//! Complete system demonstration

use agentic_payments::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    println!("🚀 Agentic Verification System Demo\n");

    // Build the system
    println!("📦 Building system with 5 agents...");
    let system = AgenticVerificationSystem::builder()
        .pool_size(5)
        .consensus_threshold(0.67)
        .consensus_timeout_ms(100)
        .build()
        .await?;

    println!("✅ System initialized with ID: {}", system.id());
    println!("   Pool size: {}", system.pool_size().await);
    println!();

    // Generate agent identity
    println!("🔑 Generating agent identity...");
    let identity = AgentIdentity::generate()?;
    println!("✅ Agent ID: {}", identity.id());
    println!();

    // Sign a message
    let message = b"Payment authorization for $100.00";
    println!("📝 Signing message: {:?}", std::str::from_utf8(message).unwrap());
    let signature = identity.sign(message)?;
    println!("✅ Signature created");
    println!();

    // Verify with consensus
    println!("🔍 Verifying signature with multi-agent consensus...");
    let result = system
        .verify_with_consensus(signature, message, identity.verifying_key())
        .await?;

    println!("✅ Consensus Result:");
    println!("   Valid: {}", result.is_valid());
    println!("   Votes for: {}/{}", result.votes_for, result.total_votes);
    println!("   Consensus: {:.1}%", result.percentage() * 100.0);
    println!("   Threshold: {:.1}%", result.threshold * 100.0);
    println!();

    // Health check
    println!("🏥 Performing health check...");
    system.health_check().await?;
    println!("✅ System health: {:?}", system.health_status().await);
    println!();

    // Get metrics
    println!("📊 System Metrics:");
    let metrics = system.metrics().await;
    println!("   Total verifications: {}", metrics.total_verifications);
    println!("   Successful: {}", metrics.successful_verifications);
    println!("   Failed: {}", metrics.failed_verifications);
    println!("   Success rate: {:.1}%", metrics.success_rate() * 100.0);
    println!("   Avg time: {}μs", metrics.avg_verification_time_us);
    println!("   Throughput: {:.2} verifications/sec", metrics.throughput());
    println!();

    // Scale the pool
    println!("⚡ Scaling pool to 10 agents...");
    system.scale_pool(10).await?;
    println!("✅ Pool scaled to: {}", system.pool_size().await);
    println!();

    // Perform multiple verifications
    println!("🔄 Running 10 concurrent verifications...");
    let mut handles = vec![];

    for i in 0..10 {
        let system_clone = system.clone();
        let identity_clone = identity.clone();

        let handle = tokio::spawn(async move {
            let msg = format!("Transaction #{}", i);
            let sig = identity_clone.sign(msg.as_bytes()).unwrap();
            system_clone
                .verify_with_consensus(sig, msg.as_bytes(), identity_clone.verifying_key())
                .await
        });

        handles.push(handle);
    }

    let mut successes = 0;
    for handle in handles {
        if let Ok(Ok(result)) = handle.await {
            if result.is_valid() {
                successes += 1;
            }
        }
    }

    println!("✅ Completed: {}/10 verifications successful", successes);
    println!();

    // Final metrics
    println!("📊 Final Metrics:");
    let final_metrics = system.metrics().await;
    println!("   Total verifications: {}", final_metrics.total_verifications);
    println!("   Success rate: {:.1}%", final_metrics.success_rate() * 100.0);
    println!("   Throughput: {:.2} verifications/sec", final_metrics.throughput());
    println!();

    // Shutdown
    println!("🛑 Shutting down system...");
    system.shutdown().await?;
    println!("✅ System shutdown complete");

    Ok(())
}