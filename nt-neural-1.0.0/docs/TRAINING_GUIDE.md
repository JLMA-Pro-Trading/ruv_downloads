# Neural Training Guide

Complete guide for training neural forecasting models in neural-trader-rust.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Training Loop Architecture](#training-loop-architecture)
4. [Optimizers](#optimizers)
5. [Learning Rate Schedulers](#learning-rate-schedulers)
6. [Data Loading](#data-loading)
7. [Advanced Features](#advanced-features)
8. [Examples](#examples)

## Overview

The training infrastructure provides:

- **Complete Training Loop**: Automated training with validation, early stopping, and checkpointing
- **Multiple Optimizers**: Adam, AdamW, SGD, RMSprop with customizable parameters
- **LR Schedulers**: Reduce on plateau, cosine annealing, step LR
- **Efficient Data Loading**: Parallel data loading with polars backend
- **GPU Acceleration**: CUDA and Metal support with mixed precision training
- **Model Checkpointing**: Automatic best model saving and recovery

## Quick Start

### Basic Training

```rust
use nt_neural::{
    NHITSModel, NHITSConfig, NHITSTrainer, NHITSTrainingConfig,
    TrainingConfig, OptimizerConfig,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Configure training
    let config = NHITSTrainingConfig {
        base: TrainingConfig {
            batch_size: 32,
            num_epochs: 100,
            learning_rate: 1e-3,
            early_stopping_patience: 10,
            ..Default::default()
        },
        model_config: NHITSConfig::default(),
        optimizer_config: OptimizerConfig::adamw(1e-3, 1e-5),
        ..Default::default()
    };

    // Create trainer
    let mut trainer = NHITSTrainer::new(config)?;

    // Train from CSV
    let metrics = trainer
        .train_from_csv("data/train.csv", "target")
        .await?;

    println!("Training complete! Final loss: {:.6}", metrics.train_loss);

    // Save trained model
    trainer.save_model("models/nhits_model.safetensors")?;

    Ok(())
}
```

### Advanced Training with GPU

```rust
use nt_neural::{
    NHITSTrainer, NHITSTrainingConfig,
    TrainingConfig, OptimizerConfig, OptimizerType,
};
use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = NHITSTrainingConfig {
        base: TrainingConfig {
            batch_size: 64,
            num_epochs: 200,
            learning_rate: 2e-3,
            weight_decay: 1e-4,
            gradient_clip: Some(1.0),
            early_stopping_patience: 15,
            validation_split: 0.2,
            mixed_precision: true,
        },
        optimizer_config: OptimizerConfig {
            optimizer_type: OptimizerType::AdamW,
            learning_rate: 2e-3,
            weight_decay: 1e-4,
            betas: (0.9, 0.999),
            ..Default::default()
        },
        checkpoint_dir: Some(PathBuf::from("checkpoints")),
        save_every: 10,
        gpu_device: Some(0), // Use GPU 0
        ..Default::default()
    };

    let mut trainer = NHITSTrainer::new(config)?;

    // Train from Parquet (faster for large datasets)
    let metrics = trainer
        .train_from_parquet("data/train.parquet", "price")
        .await?;

    println!("GPU training complete!");
    println!("Final train loss: {:.6}", metrics.train_loss);
    println!("Final val loss: {:?}", metrics.val_loss);

    Ok(())
}
```

## Training Loop Architecture

### Main Training Components

```
┌─────────────────────────────────────────────────────┐
│                    Trainer                          │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  DataLoader  │  │  Optimizer   │  │ LR Sched │ │
│  │              │  │              │  │          │ │
│  │ - Batching   │  │ - Adam       │  │ - Plateau│ │
│  │ - Shuffling  │  │ - AdamW      │  │ - Cosine │ │
│  │ - Parallel   │  │ - SGD        │  │ - StepLR │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│                                                     │
│  Training Loop:                                     │
│  1. Load batch                                      │
│  2. Forward pass                                    │
│  3. Compute loss                                    │
│  4. Backward pass                                   │
│  5. Gradient clipping (optional)                    │
│  6. Optimizer step                                  │
│  7. Validation (periodic)                           │
│  8. LR scheduling                                   │
│  9. Early stopping check                            │
│  10. Checkpoint saving                              │
└─────────────────────────────────────────────────────┘
```

### Training Loop Details

The `Trainer` handles the complete training pipeline:

```rust
// Pseudo-code of training loop
for epoch in 0..config.num_epochs {
    // Training phase
    for (batch_x, batch_y) in train_loader {
        predictions = model.forward(batch_x);
        loss = compute_loss(predictions, batch_y);

        optimizer.zero_grad();
        loss.backward();

        if gradient_clip {
            clip_gradients(max_norm);
        }

        optimizer.step();
    }

    // Validation phase
    for (batch_x, batch_y) in val_loader {
        predictions = model.forward(batch_x);
        val_loss += compute_loss(predictions, batch_y);
    }

    // Learning rate scheduling
    lr = scheduler.step(val_loss);
    optimizer.set_learning_rate(lr);

    // Early stopping
    if val_loss improves {
        best_model = model.clone();
        patience_counter = 0;
    } else {
        patience_counter += 1;
        if patience_counter >= patience {
            break; // Stop training
        }
    }

    // Checkpointing
    if epoch % save_every == 0 {
        save_checkpoint(model, epoch, val_loss);
    }
}
```

## Optimizers

### Available Optimizers

#### 1. Adam (Adaptive Moment Estimation)

```rust
use nt_neural::OptimizerConfig;

let config = OptimizerConfig::adam(1e-3);
```

**Best for:**
- Most deep learning tasks
- Default choice for neural networks
- Fast convergence

**Parameters:**
- `learning_rate`: Base learning rate (default: 1e-3)
- `betas`: Momentum parameters (default: (0.9, 0.999))
- `eps`: Numerical stability (default: 1e-8)

#### 2. AdamW (Adam with Weight Decay)

```rust
let config = OptimizerConfig::adamw(1e-3, 1e-5);
```

**Best for:**
- Preventing overfitting
- Large models requiring regularization
- Recommended for production systems

**Parameters:**
- `learning_rate`: Base learning rate
- `weight_decay`: L2 regularization strength (default: 1e-5)
- `betas`, `eps`: Same as Adam

#### 3. SGD (Stochastic Gradient Descent)

```rust
let config = OptimizerConfig::sgd(0.01, 0.9);
```

**Best for:**
- Small datasets
- When you need fine control
- Research and experimentation

**Parameters:**
- `learning_rate`: Step size
- `momentum`: Momentum factor (default: 0.0)
- `dampening`: Dampening for momentum (default: 0.0)
- `nesterov`: Use Nesterov momentum (default: false)

#### 4. RMSprop

```rust
let config = OptimizerConfig::rmsprop(1e-3);
```

**Best for:**
- Recurrent neural networks
- Non-stationary objectives
- Online learning

**Parameters:**
- `learning_rate`: Base learning rate
- `alpha`: Smoothing constant (default: 0.99)
- `eps`: Numerical stability (default: 1e-8)

### Custom Optimizer Configuration

```rust
use nt_neural::{OptimizerConfig, OptimizerType};

let config = OptimizerConfig {
    optimizer_type: OptimizerType::AdamW,
    learning_rate: 2e-3,
    weight_decay: 1e-4,
    betas: (0.9, 0.999),
    eps: 1e-8,
    momentum: 0.0,
    dampening: 0.0,
    nesterov: false,
};
```

## Learning Rate Schedulers

### 1. Reduce on Plateau

Reduces learning rate when validation loss plateaus.

```rust
use nt_neural::LRScheduler;

let scheduler = LRScheduler::reduce_on_plateau(
    0.001,  // initial_lr
    5,      // patience (epochs)
    0.5     // factor (reduce by 50%)
);
```

**Best for:**
- Automatic tuning based on validation performance
- When you want hands-off training
- Production systems

### 2. Cosine Annealing

Smoothly decreases learning rate following cosine curve.

```rust
let scheduler = LRScheduler::cosine_annealing(
    0.001,  // initial_lr
    100     // t_max (period in epochs)
);
```

**Best for:**
- Cyclical training patterns
- Escaping local minima
- Fine-tuning pre-trained models

**Formula:**
```
lr = min_lr + (initial_lr - min_lr) * (1 + cos(π * epoch / t_max)) / 2
```

### 3. Step LR

Decreases learning rate by fixed factor at regular intervals.

```rust
let scheduler = LRScheduler::step_lr(
    0.001,  // initial_lr
    30,     // step_size (epochs)
    0.1     // gamma (multiply by 0.1)
);
```

**Best for:**
- Simple, predictable learning rate decay
- When you know the training dynamics
- Multi-stage training

## Data Loading

### TimeSeriesDataset

Efficient time series dataset with polars backend:

```rust
use nt_neural::TimeSeriesDataset;

// From CSV
let dataset = TimeSeriesDataset::from_csv(
    "data/prices.csv",
    "close",        // target column
    168,            // sequence_length (1 week hourly)
    24              // horizon (24 hours ahead)
)?;

// From Parquet (faster)
let dataset = TimeSeriesDataset::from_parquet(
    "data/prices.parquet",
    "close",
    168,
    24
)?;

// From DataFrame
use polars::prelude::*;

let df = df!(
    "timestamp" => timestamps,
    "close" => prices,
    "volume" => volumes
)?;

let dataset = TimeSeriesDataset::new(df, "close", 168, 24)?;
```

### DataLoader

Parallel batch loading with configurable parameters:

```rust
use nt_neural::DataLoader;

let loader = DataLoader::new(dataset, 32)  // batch_size=32
    .with_shuffle(true)
    .with_drop_last(false)
    .with_num_workers(8);

// Iterate batches
for batch_result in loader.iter_batches(&device) {
    let (inputs, targets) = batch_result?;
    // Training step...
}
```

### Train/Val Split

```rust
let (train_dataset, val_dataset) = dataset.train_val_split(0.2)?;

println!("Train samples: {}", train_dataset.len());
println!("Val samples: {}", val_dataset.len());
```

## Advanced Features

### 1. Mixed Precision Training

Faster training with FP16/FP32 mixed precision:

```rust
let config = TrainingConfig {
    mixed_precision: true,
    ..Default::default()
};
```

**Benefits:**
- 2-3x faster training
- 50% less memory usage
- Same model accuracy

**Requirements:**
- Modern GPU (NVIDIA Tesla T4+, Apple Silicon)
- CUDA or Metal backend

### 2. Gradient Clipping

Prevents exploding gradients:

```rust
let config = TrainingConfig {
    gradient_clip: Some(1.0),  // clip to max norm of 1.0
    ..Default::default()
};
```

**When to use:**
- Training RNNs/LSTMs
- Unstable training
- Large learning rates

### 3. Early Stopping

Automatically stops training when validation loss stops improving:

```rust
let config = TrainingConfig {
    early_stopping_patience: 10,  // wait 10 epochs
    ..Default::default()
};
```

**Benefits:**
- Prevents overfitting
- Saves computational resources
- Finds optimal model automatically

### 4. Model Checkpointing

```rust
let config = NHITSTrainingConfig {
    checkpoint_dir: Some(PathBuf::from("checkpoints")),
    save_every: 10,  // save every 10 epochs
    ..Default::default()
};
```

**Saved files:**
- `best_model.safetensors`: Best model weights
- `checkpoint_metadata.json`: Training metadata
- `checkpoint_epoch_N.safetensors`: Periodic checkpoints

### 5. Probabilistic Forecasting

Quantile loss for confidence intervals:

```rust
let config = NHITSTrainingConfig {
    use_quantile_loss: true,
    target_quantiles: vec![0.1, 0.5, 0.9],  // 10%, 50%, 90%
    ..Default::default()
};
```

## Examples

### Example 1: Stock Price Forecasting

```rust
use nt_neural::{NHITSTrainer, NHITSTrainingConfig, TrainingConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = NHITSTrainingConfig {
        base: TrainingConfig {
            batch_size: 64,
            num_epochs: 150,
            learning_rate: 5e-4,
            early_stopping_patience: 15,
            ..Default::default()
        },
        ..Default::default()
    };

    let mut trainer = NHITSTrainer::new(config)?;

    let metrics = trainer
        .train_from_csv("stock_prices.csv", "close")
        .await?;

    trainer.save_model("stock_model.safetensors")?;

    Ok(())
}
```

### Example 2: Cryptocurrency with GPU

```rust
use nt_neural::{
    NHITSTrainer, NHITSTrainingConfig, NHITSConfig,
    TrainingConfig, OptimizerConfig,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = NHITSTrainingConfig {
        base: TrainingConfig {
            batch_size: 128,
            num_epochs: 200,
            learning_rate: 1e-3,
            weight_decay: 1e-4,
            gradient_clip: Some(1.0),
            early_stopping_patience: 20,
            mixed_precision: true,
        },
        model_config: NHITSConfig {
            base: ModelConfig {
                input_size: 168,
                horizon: 24,
                hidden_size: 1024,
                ..Default::default()
            },
            ..Default::default()
        },
        optimizer_config: OptimizerConfig::adamw(1e-3, 1e-4),
        checkpoint_dir: Some("checkpoints".into()),
        gpu_device: Some(0),
        ..Default::default()
    };

    let mut trainer = NHITSTrainer::new(config)?;

    let metrics = trainer
        .train_from_parquet("btc_prices.parquet", "price")
        .await?;

    println!("Training metrics:");
    println!("  Train loss: {:.6}", metrics.train_loss);
    println!("  Val loss: {:.6}", metrics.val_loss.unwrap());
    println!("  Learning rate: {:.2e}", metrics.learning_rate);

    trainer.save_model("crypto_model.safetensors")?;

    Ok(())
}
```

### Example 3: Custom Training Loop

```rust
use nt_neural::{
    Trainer, TrainingConfig, DataLoader, TimeSeriesDataset,
    Optimizer, OptimizerConfig, NHITSModel,
};
use candle_core::Device;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let device = Device::Cpu;

    // Load data
    let dataset = TimeSeriesDataset::from_csv(
        "data.csv", "target", 100, 24
    )?;

    let (train_ds, val_ds) = dataset.train_val_split(0.2)?;

    let train_loader = DataLoader::new(train_ds, 32)
        .with_shuffle(true);
    let val_loader = DataLoader::new(val_ds, 32);

    // Create model
    let model = NHITSModel::new(NHITSConfig::default())?;

    // Create trainer
    let config = TrainingConfig {
        batch_size: 32,
        num_epochs: 100,
        ..Default::default()
    };

    let mut trainer = Trainer::new(config, device)
        .with_checkpointing("checkpoints");

    // Train
    let (trained_model, metrics) = trainer.train(
        model,
        train_loader,
        Some(val_loader),
        OptimizerConfig::default()
    ).await?;

    println!("Training complete!");

    Ok(())
}
```

### Example 4: Resume from Checkpoint

```rust
use nt_neural::{NHITSTrainer, NHITSTrainingConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut trainer = NHITSTrainer::new(
        NHITSTrainingConfig::default()
    )?;

    // Load previous checkpoint
    trainer.load_model("checkpoints/best_model.safetensors")?;

    // Continue training
    let metrics = trainer
        .train_from_csv("data/train.csv", "target")
        .await?;

    println!("Resumed training complete!");

    Ok(())
}
```

## Performance Tips

### 1. Batch Size

- **Larger batches** (64-128): Faster training, more memory
- **Smaller batches** (16-32): Better generalization, less memory
- Start with 32 and adjust based on available memory

### 2. Learning Rate

- **Too high**: Training diverges, loss explodes
- **Too low**: Training is slow, may get stuck
- Good starting points:
  - Adam/AdamW: 1e-3 to 1e-4
  - SGD: 1e-2 to 1e-1
  - Use learning rate finder for optimal value

### 3. GPU Utilization

```rust
// Enable all GPU optimizations
let config = NHITSTrainingConfig {
    base: TrainingConfig {
        batch_size: 128,      // Larger batches for GPU
        mixed_precision: true, // FP16 training
        ..Default::default()
    },
    gpu_device: Some(0),
    ..Default::default()
};
```

### 4. Data Loading

- Use Parquet files for large datasets (10x faster than CSV)
- Enable parallel workers: `.with_num_workers(8)`
- Pre-process data offline when possible

### 5. Training Speed

Approximate training speeds on different hardware:

| Hardware | Batch Size | Speed (samples/sec) |
|----------|------------|---------------------|
| CPU (16 cores) | 32 | ~500 |
| NVIDIA RTX 3090 | 128 | ~5000 |
| NVIDIA A100 | 256 | ~15000 |
| Apple M2 Max | 64 | ~2000 |

## Troubleshooting

### Training Loss Not Decreasing

1. **Check data**: Ensure targets are normalized
2. **Lower learning rate**: Try 10x smaller
3. **Increase model capacity**: More hidden units
4. **Check for bugs**: Verify data pipeline

### Out of Memory

1. **Reduce batch size**: Try half the current size
2. **Use mixed precision**: Enable `mixed_precision: true`
3. **Reduce model size**: Smaller `hidden_size`
4. **Use gradient checkpointing**: Coming soon

### Overfitting

1. **Enable weight decay**: `weight_decay: 1e-4`
2. **Increase dropout**: `dropout: 0.2` or higher
3. **More training data**: Collect additional samples
4. **Early stopping**: Lower patience value
5. **Data augmentation**: Add noise, scaling

### Slow Training

1. **Use GPU**: Set `gpu_device: Some(0)`
2. **Mixed precision**: Enable `mixed_precision: true`
3. **Larger batches**: Increase `batch_size`
4. **Parallel workers**: `.with_num_workers(8)`
5. **Use Parquet**: Convert CSV to Parquet

## Best Practices

1. **Start simple**: Use default configurations first
2. **Monitor validation**: Always split train/val
3. **Save checkpoints**: Enable checkpointing
4. **Track metrics**: Log training metrics
5. **Experiment systematically**: Change one parameter at a time
6. **Use version control**: Track model versions
7. **Document everything**: Record hyperparameters
8. **Test on holdout**: Final evaluation on test set

## Further Reading

- [Model Architecture Guide](ARCHITECTURE.md)
- [Inference Guide](INFERENCE.md)
- [API Reference](https://docs.rs/nt-neural)
- [Examples Directory](../examples/)

## Support

For issues and questions:
- GitHub Issues: https://github.com/ruvnet/neural-trader
- Documentation: https://docs.rs/nt-neural
