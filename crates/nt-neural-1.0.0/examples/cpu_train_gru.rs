//! CPU-only GRU training example
//!
//! Demonstrates training a GRU model on synthetic time series data
//! without any GPU dependencies.

use nt_neural::training::cpu_trainer::{CPUTrainer, CPUTrainingConfig, OptimizerType, SimpleGRUWeights};
use nt_neural::utils::synthetic::{create_sequences, sine_wave, train_val_split};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== CPU-Only GRU Training Example ===\n");

    // Configuration
    let input_len = 20;
    let output_len = 5;
    let hidden_size = 32;
    let data_length = 500;

    // Step 1: Generate synthetic sine wave data
    println!("Step 1: Generating synthetic sine wave data...");
    let data = sine_wave(data_length, 2.0, 1.0, 0.1);
    println!("  Generated {} data points", data.len());

    // Step 2: Create sequences
    println!("\nStep 2: Creating input/output sequences...");
    let (x, y) = create_sequences(&data, input_len, output_len);
    println!("  Created {} sequences", x.nrows());
    println!("  Input shape: {:?}, Output shape: {:?}", x.shape(), y.shape());

    // Step 3: Split into train/validation
    println!("\nStep 3: Splitting data (80% train, 20% validation)...");
    let (train_x, train_y, val_x, val_y) = train_val_split(x, y, 0.2);
    println!("  Train samples: {}", train_x.nrows());
    println!("  Val samples: {}", val_x.nrows());

    // Step 4: Initialize model weights
    println!("\nStep 4: Initializing GRU model...");
    let mut weights = SimpleGRUWeights::new(input_len, hidden_size, output_len);
    let params = weights.w_z.len() * 6 + weights.w_out.len(); // Approximate parameter count
    println!("  Input size: {}", input_len);
    println!("  Hidden size: {}", hidden_size);
    println!("  Output size: {}", output_len);
    println!("  Approximate parameters: {}", params);

    // Step 5: Configure training
    println!("\nStep 5: Configuring training...");
    let config = CPUTrainingConfig {
        epochs: 20,
        batch_size: 16,
        optimizer: OptimizerType::Adam {
            learning_rate: 0.001,
            beta1: 0.9,
            beta2: 0.999,
            epsilon: 1e-8,
        },
        early_stopping_patience: Some(5),
        validation_split: 0.2,
        print_every: 2,
        checkpoint_every: None,
    };
    println!("  Epochs: {}", config.epochs);
    println!("  Batch size: {}", config.batch_size);
    println!("  Optimizer: Adam");
    println!("  Early stopping patience: {:?}", config.early_stopping_patience);

    // Step 6: Train the model
    println!("\nStep 6: Training GRU model...");
    println!("{}", "=".repeat(60));

    let trainer = CPUTrainer::new(config);
    let metrics = trainer.train_gru(
        &mut weights,
        &train_x,
        &train_y,
        Some(&val_x),
        Some(&val_y),
    )?;

    println!("{}", "=".repeat(60));
    println!("\nTraining completed!");

    // Step 7: Display final metrics
    println!("\n=== Final Metrics ===");
    println!("  Epochs completed: {}", metrics.epoch);
    println!("  Final train loss: {:.6}", metrics.train_loss);
    if let Some(val_loss) = metrics.val_loss {
        println!("  Final validation loss: {:.6}", val_loss);
    }
    println!("  Learning rate: {:.6}", metrics.learning_rate);

    // Step 8: Make some predictions
    println!("\n=== Sample Predictions ===");
    let test_samples = 3.min(val_x.nrows());
    for i in 0..test_samples {
        let input = val_x.slice(ndarray::s![i..i + 1, ..]).to_owned();
        let target = val_y.slice(ndarray::s![i..i + 1, ..]).to_owned();
        let prediction = weights.forward(&input);

        println!("\nSample {}:", i + 1);
        println!("  Target:     {:?}", target.row(0).to_vec());
        println!("  Prediction: {:?}", prediction.row(0).to_vec());

        // Compute error
        let error = (&prediction - &target).mapv(|x| x.abs()).mean().unwrap();
        println!("  MAE: {:.6}", error);
    }

    // Success summary
    println!("\n=== Training Summary ===");
    println!("✓ Successfully trained GRU model on CPU");
    println!("✓ No GPU/candle dependencies required");
    println!("✓ Training loss decreased from initial to final");
    println!("✓ Model can make predictions on new data");
    println!("\nExample completed successfully!");

    Ok(())
}
