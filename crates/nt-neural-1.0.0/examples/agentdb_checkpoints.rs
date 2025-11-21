//! Example demonstrating checkpoint management with AgentDB
//!
//! This example shows:
//! - Saving training checkpoints
//! - Resuming training from checkpoints
//! - Managing checkpoint history
//! - Best checkpoint selection
//!
//! Run with: cargo run --example agentdb_checkpoints

use nt_neural::storage::{AgentDbStorage, AgentDbConfig, ModelMetadata, ModelCheckpoint};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    println!("⚡ AgentDB Checkpoint Management Example\n");

    // Initialize storage
    let config = AgentDbConfig {
        db_path: "./data/models/checkpoint-example.db".into(),
        dimension: 768,
        preset: "small".to_string(),
        in_memory: false,
    };

    println!("📦 Initializing AgentDB...");
    let storage = AgentDbStorage::with_config(config).await?;
    println!("✅ Ready\n");

    // Step 1: Save initial model
    println!("📝 Step 1: Creating initial model");
    let model_bytes = vec![0u8; 1024];
    let metadata = ModelMetadata {
        name: "training-example-model".to_string(),
        model_type: "NHITS".to_string(),
        version: "1.0.0".to_string(),
        description: Some("Example model for checkpoint demonstration".to_string()),
        ..Default::default()
    };

    let model_id = storage.save_model(&model_bytes, metadata).await?;
    println!("✅ Model created: {}\n", model_id);

    // Step 2: Simulate training with multiple checkpoints
    println!("📝 Step 2: Simulating training with checkpoints");
    let training_epochs = vec![
        (10, 1000, 0.456, 0.478),   // epoch, step, train_loss, val_loss
        (20, 2000, 0.234, 0.267),
        (30, 3000, 0.156, 0.189),   // Best checkpoint
        (40, 4000, 0.123, 0.167),
        (50, 5000, 0.098, 0.178),   // Overfitting starts
    ];

    let mut checkpoint_ids = Vec::new();

    for (epoch, step, train_loss, val_loss) in &training_epochs {
        let checkpoint = ModelCheckpoint {
            checkpoint_id: uuid::Uuid::new_v4().to_string(),
            model_id: model_id.clone(),
            epoch: *epoch,
            step: *step,
            loss: *train_loss,
            val_loss: Some(*val_loss),
            optimizer_state: Some(serde_json::json!({
                "learning_rate": 0.001,
                "momentum": 0.9,
                "weight_decay": 0.0001,
            })),
            created_at: chrono::Utc::now(),
        };

        // Simulate checkpoint state
        let checkpoint_bytes = format!("checkpoint-epoch-{}", epoch).into_bytes();

        let checkpoint_id = storage
            .save_checkpoint(&model_id, checkpoint.clone(), &checkpoint_bytes)
            .await?;

        checkpoint_ids.push((checkpoint_id, *epoch, *val_loss));

        println!(
            "  ✓ Epoch {}: train_loss={:.4}, val_loss={:.4}",
            epoch, train_loss, val_loss
        );
    }
    println!();

    // Step 3: Find best checkpoint
    println!("📝 Step 3: Finding best checkpoint");
    let best_checkpoint = checkpoint_ids
        .iter()
        .min_by(|(_, _, loss_a), (_, _, loss_b)| {
            loss_a.partial_cmp(loss_b).unwrap()
        })
        .unwrap();

    println!("  🏆 Best checkpoint: Epoch {}", best_checkpoint.1);
    println!("     Validation loss: {:.4}", best_checkpoint.2);
    println!("     Checkpoint ID: {}\n", best_checkpoint.0);

    // Step 4: Load best checkpoint
    println!("📝 Step 4: Loading best checkpoint");
    let (loaded_checkpoint, loaded_state) = storage
        .load_checkpoint(&best_checkpoint.0)
        .await?;

    println!("  ✓ Loaded checkpoint:");
    println!("     Epoch: {}", loaded_checkpoint.epoch);
    println!("     Step: {}", loaded_checkpoint.step);
    println!("     Loss: {:.4}", loaded_checkpoint.loss);
    println!("     Val Loss: {:.4}", loaded_checkpoint.val_loss.unwrap_or(0.0));
    println!("     State size: {} bytes", loaded_state.len());

    if let Some(optimizer_state) = loaded_checkpoint.optimizer_state {
        println!("     Optimizer: {}", serde_json::to_string_pretty(&optimizer_state)?);
    }
    println!();

    // Step 5: Resume training simulation
    println!("📝 Step 5: Simulating training resume from checkpoint");
    println!("  (In practice, you would restore the model and optimizer state)");
    println!("  Starting from epoch {} with val_loss {:.4}",
             loaded_checkpoint.epoch,
             loaded_checkpoint.val_loss.unwrap_or(0.0));

    // Continue training for a few more epochs
    let resume_epochs = vec![
        (loaded_checkpoint.epoch + 10, 0.145),
        (loaded_checkpoint.epoch + 20, 0.132),
        (loaded_checkpoint.epoch + 30, 0.128),
    ];

    for (epoch, val_loss) in &resume_epochs {
        println!("  ✓ Resumed Epoch {}: val_loss={:.4}", epoch, val_loss);
    }
    println!();

    // Step 6: Checkpoint cleanup (remove old checkpoints)
    println!("📝 Step 6: Checkpoint management");
    println!("  Total checkpoints saved: {}", checkpoint_ids.len());
    println!("  In production, you would:");
    println!("  - Keep only the N best checkpoints");
    println!("  - Remove checkpoints older than X days");
    println!("  - Archive checkpoints to cold storage");
    println!();

    println!("✅ Checkpoint management example completed!");

    Ok(())
}
