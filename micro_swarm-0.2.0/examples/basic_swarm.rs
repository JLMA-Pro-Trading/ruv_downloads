//! Basic swarm orchestration example

use micro_swarm::*;

fn main() -> Result<()> {
    println!("🐝 Micro Swarm - Real Distributed Orchestration System");
    println!("======================================================");
    
    // Create a swarm orchestrator with mesh topology
    let mut orchestrator = SwarmBuilder::new()
        .name("demo_swarm".into())
        .max_agents(8)
        .topology(SwarmTopology::Mesh)
        .fault_tolerance(true)
        .monitoring(true)
        .build()?;
    
    println!("✅ Created swarm orchestrator");
    
    // Initialize the swarm
    orchestrator.initialize()?;
    println!("✅ Initialized swarm - State: {:?}", orchestrator.state());
    
    // Bootstrap with default agents
    let agent_ids = orchestrator.bootstrap_default_agents()?;
    println!("✅ Bootstrapped {} agents: {:?}", agent_ids.len(), agent_ids);
    
    // Create and submit some tasks
    println!("\n📋 Submitting tasks...");
    
    let neural_task = TaskBuilder::new("neural_analysis".into())
        .payload(vec![1, 2, 3, 4, 5, 6, 7, 8])
        .priority(TaskPriority::High)
        .requires("neural_inference".into())
        .category("ai_processing".into())
        .build();
    
    let quantum_task = TaskBuilder::new("quantum_optimization".into())
        .payload(vec![10, 20, 30, 40])
        .priority(TaskPriority::Critical)
        .requires("quantum_computation".into())
        .category("optimization".into())
        .build();
    
    let generic_task = TaskBuilder::new("data_processing".into())
        .payload(vec![100, 200, 300])
        .priority(TaskPriority::Normal)
        .category("data_processing".into())
        .build();
    
    let task1_id = orchestrator.submit_task(neural_task)?;
    let task2_id = orchestrator.submit_task(quantum_task)?;
    let task3_id = orchestrator.submit_task(generic_task)?;
    
    println!("✅ Submitted 3 tasks: {}, {}, {}", task1_id, task2_id, task3_id);
    
    // Run processing cycles
    println!("\n⚡ Running processing cycles...");
    
    for cycle in 1..=10 {
        let stats = orchestrator.process_cycle()?;
        
        if stats.tasks_scheduled > 0 || stats.tasks_completed > 0 || stats.failed_agents > 0 {
            println!(
                "Cycle {}: {} scheduled, {} completed, {} failed agents ({}ms)",
                cycle,
                stats.tasks_scheduled,
                stats.tasks_completed,
                stats.failed_agents,
                stats.cycle_duration
            );
        }
        
        // Add a small delay to simulate real-time processing
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    
    // Display current metrics
    println!("\n📊 Current Swarm Metrics:");
    let metrics = orchestrator.metrics();
    println!("  Active Agents: {}", metrics.active_agents);
    println!("  Total Tasks Processed: {}", metrics.total_tasks_processed);
    println!("  Tasks in Queue: {}", metrics.tasks_in_queue);
    println!("  Tasks Running: {}", metrics.tasks_running);
    println!("  Memory Utilization: {:.1}%", metrics.memory_utilization * 100.0);
    println!("  Error Rate: {:.2}%", metrics.error_rate);
    
    // Display detailed statistics
    println!("\n📈 Detailed Statistics:");
    let scheduler_stats = orchestrator.scheduler_stats();
    println!("  Scheduler - Submitted: {}, Completed: {}, Failed: {}", 
             scheduler_stats.total_submitted,
             scheduler_stats.total_completed,
             scheduler_stats.total_failed);
    
    let memory_stats = orchestrator.memory_stats();
    println!("  Memory - Total Regions: {}, Allocated: {}, Utilization: {:.1}%",
             memory_stats.total_regions,
             memory_stats.allocated_regions,
             memory_stats.utilization * 100.0);
    
    let coord_stats = orchestrator.coordination_stats();
    println!("  Coordination - Proposals: {}, Consensus: {}, Elections: {}",
             coord_stats.total_proposals,
             coord_stats.successful_consensus,
             coord_stats.leader_elections);
    
    // Export full status report
    println!("\n📋 Full Status Report:");
    println!("{}", orchestrator.export_status()?);
    
    // Graceful shutdown
    println!("🛑 Shutting down swarm...");
    orchestrator.shutdown()?;
    println!("✅ Swarm shutdown complete - Final state: {:?}", orchestrator.state());
    
    Ok(())
}

#[cfg(not(feature = "std"))]
fn main() {
    println!("This example requires the 'std' feature to be enabled.");
    println!("Run with: cargo run --example basic_swarm --features std");
}