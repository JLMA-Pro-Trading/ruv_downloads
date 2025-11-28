# NHITS Implementation - Neural Hierarchical Interpolation for Time Series

## Overview

Complete implementation of NHITS (Neural Hierarchical Interpolation for Time Series) model with both GPU-accelerated (Candle) and CPU-only (ndarray) backends.

## Features Implemented

### ✅ Core Architecture
- **Hierarchical Stack Design**: Multiple stacks with frequency downsampling
- **Backcast/Forecast Decomposition**: Residual connections for interpretability
- **MLP Blocks**: Configurable multi-layer perceptron with dropout
- **Proper Linear Interpolation**: High-quality upsampling from downsampled forecasts
- **Nearest Neighbor Interpolation**: Fast alternative interpolation method

### ✅ Pooling Operations
- **MaxPool**: Maximum pooling for downsampling
- **AvgPool**: Average pooling for smooth downsampling

### ✅ Training Support
- **MAE Loss**: Mean Absolute Error for robust training
- **MSE Loss**: Mean Squared Error for standard regression
- **Quantile Loss**: Probabilistic forecasting with multiple quantiles
- **Multi-Quantile Loss**: Combined loss across all quantiles
- **Smooth L1 Loss (Huber)**: Robust to outliers
- **Gradient Clipping**: Prevent exploding gradients

### ✅ CPU-Only Implementation
- **Pure ndarray Backend**: Works without GPU dependencies
- **Xavier Weight Initialization**: Proper parameter initialization
- **Linear Interpolation**: CPU-optimized interpolation
- **Feature-Gated**: Automatically used when candle feature is disabled

### ✅ Model Management
- **Weight Saving/Loading**: Model persistence
- **Configuration Serialization**: JSON serialization of all hyperparameters
- **Parameter Counting**: Track model complexity

## Architecture Details

### Stack Configuration

Each NHITS stack operates at a different temporal resolution:

```rust
NHITSConfig {
    n_stacks: 3,                              // Number of hierarchical stacks
    n_blocks: vec![1, 1, 1],                 // Blocks per stack
    n_freq_downsample: vec![4, 2, 1],       // Downsampling factors
    mlp_units: vec![
        vec![512, 512],                       // Stack 1 MLP architecture
        vec![512, 512],                       // Stack 2 MLP architecture
        vec![512, 512],                       // Stack 3 MLP architecture
    ],
    interpolation_mode: InterpolationMode::Linear,
    pooling_mode: PoolingMode::AvgPool,
}
```

### Interpolation Methods

#### Linear Interpolation
High-quality upsampling using weighted averages:
```rust
value = batch[idx_low] * (1.0 - weight) + batch[idx_high] * weight
```

#### Nearest Neighbor
Fast upsampling using nearest values:
```rust
value = batch[src_idx.round()]
```

### Forward Pass

1. **Input Projection**: Linear transformation to hidden size
2. **Stack Processing** (for each stack):
   - Process through MLP blocks with residual connections
   - Generate backcast (for residual subtraction)
   - Generate downsampled forecast
   - Interpolate forecast to full horizon
   - Subtract backcast from residual
3. **Forecast Aggregation**: Sum all stack forecasts

## Usage Examples

### Basic Forecasting

```rust
use nt_neural::{NHITSModel, NHITSConfig};
use candle_core::{Device, Tensor};

// Create model
let mut config = NHITSConfig::default();
config.base.input_size = 168;  // 1 week of hourly data
config.base.horizon = 24;       // 24-hour forecast

let model = NHITSModel::new(config)?;

// Prepare input (batch_size=4, seq_len=168)
let input = Tensor::randn(0.0, 1.0, (4, 168), &Device::Cpu)?;

// Generate forecast
let forecast = model.forward(&input)?;
// forecast shape: (4, 24)
```

### Probabilistic Forecasting

```rust
// Configure quantiles
let mut config = NHITSConfig::default();
config.quantiles = vec![0.1, 0.25, 0.5, 0.75, 0.9];

let model = NHITSModel::new(config)?;

// Generate quantile forecasts
let quantile_forecasts = model.predict_quantiles(&input)?;

for (q, forecast) in quantile_forecasts {
    println!("Quantile {}: {:?}", q, forecast);
}
```

### Training with Custom Loss

```rust
use nt_neural::models::nhits::loss;

// Forward pass
let predictions = model.forward(&input)?;

// Calculate loss
let mae = loss::mae_loss(&predictions, &targets)?;
let mse = loss::mse_loss(&predictions, &targets)?;
let q_loss = loss::quantile_loss(&predictions, &targets, 0.5)?;

// For multi-quantile training
let quantile_preds = vec![/* quantile predictions */];
let quantiles = vec![0.1, 0.5, 0.9];
let multi_q_loss = loss::multi_quantile_loss(&quantile_preds, &targets, &quantiles)?;
```

### CPU-Only Usage (No Candle)

```rust
use nt_neural::{NHITSConfig, models::nhits::NHITSModelCpu};
use ndarray::Array2;

// Create CPU model
let config = NHITSConfig::default();
let model = NHITSModelCpu::new(config)?;

// Prepare input
let input = Array2::from_shape_fn((4, 168), |(_, _)| rand::random::<f32>());

// Generate forecast
let forecast = model.forward(input.view())?;
// forecast shape: (4, 24)
```

## Configuration Options

### Model Configuration

```rust
pub struct NHITSConfig {
    // Base configuration
    pub base: ModelConfig,

    // Architecture
    pub n_stacks: usize,                    // Number of stacks (typically 3-4)
    pub n_blocks: Vec<usize>,               // Blocks per stack
    pub n_freq_downsample: Vec<usize>,      // Downsampling factors
    pub mlp_units: Vec<Vec<usize>>,         // MLP architecture per stack

    // Processing
    pub interpolation_mode: InterpolationMode,  // Linear or Nearest
    pub pooling_mode: PoolingMode,              // MaxPool or AvgPool

    // Probabilistic forecasting
    pub quantiles: Vec<f64>,                    // Quantile levels
}
```

### Base Configuration

```rust
pub struct ModelConfig {
    pub input_size: usize,      // Input sequence length
    pub horizon: usize,         // Forecast horizon
    pub hidden_size: usize,     // Hidden layer size
    pub num_features: usize,    // Number of input features
    pub dropout: f64,           // Dropout rate
}
```

## Loss Functions

### Mean Absolute Error (MAE)
```rust
loss::mae_loss(&predictions, &targets)?
```
- Robust to outliers
- Treats all errors equally
- Good for interpretability

### Mean Squared Error (MSE)
```rust
loss::mse_loss(&predictions, &targets)?
```
- Penalizes large errors more
- Standard for regression
- Differentiable everywhere

### Quantile Loss
```rust
loss::quantile_loss(&predictions, &targets, 0.5)?  // Median
```
- Asymmetric loss function
- Different penalties for over/under-prediction
- Essential for probabilistic forecasting

### Smooth L1 (Huber Loss)
```rust
loss::smooth_l1_loss(&predictions, &targets, 1.0)?
```
- Robust to outliers like MAE
- Smooth like MSE for small errors
- Best of both worlds

## Gradient Management

### Gradient Clipping
```rust
use nt_neural::models::nhits::gradients;

let clipped = gradients::clip_gradients(&gradients, 5.0)?;
```
- Prevents exploding gradients
- Essential for training stability
- Recommended max_norm: 1.0-10.0

### Gradient Computation
```rust
let grad = gradients::compute_gradients(&model, &predictions, &targets)?;
```
- Basic gradient calculation
- Uses MSE loss by default
- Normalized by number of elements

## Performance Characteristics

### GPU Mode (Candle)
- ✅ CUDA acceleration support
- ✅ Metal acceleration support
- ✅ Batch processing
- ✅ Mixed precision training
- ✅ Gradient accumulation

### CPU Mode (ndarray)
- ✅ No external dependencies
- ✅ Pure Rust implementation
- ✅ Portable across platforms
- ⚠️ Slower than GPU mode
- ⚠️ Limited to inference

## Model Architecture Summary

```
Input (batch, input_size)
    ↓
Input Projection (hidden_size)
    ↓
┌─────────────────────────────┐
│  Stack 1 (freq_downsample=4) │
│  - MLP Blocks                │
│  - Backcast (residual)       │
│  - Forecast (interpolated)   │
└─────────────────────────────┘
    ↓ (subtract backcast)
┌─────────────────────────────┐
│  Stack 2 (freq_downsample=2) │
│  - MLP Blocks                │
│  - Backcast (residual)       │
│  - Forecast (interpolated)   │
└─────────────────────────────┘
    ↓ (subtract backcast)
┌─────────────────────────────┐
│  Stack 3 (freq_downsample=1) │
│  - MLP Blocks                │
│  - Backcast (residual)       │
│  - Forecast (interpolated)   │
└─────────────────────────────┘
    ↓ (sum all forecasts)
Output (batch, horizon)
```

## Testing

Comprehensive test suite covering:
- ✅ Model creation and configuration
- ✅ Forward pass with various batch sizes
- ✅ Interpolation methods (Linear, Nearest)
- ✅ Pooling modes (MaxPool, AvgPool)
- ✅ Quantile forecasting
- ✅ All loss functions
- ✅ Gradient clipping
- ✅ CPU-only implementation
- ✅ Serialization/deserialization

Run tests:
```bash
# With candle feature (GPU support)
cargo test --features candle nhits

# CPU-only mode
cargo test --no-default-features nhits
```

## File Organization

```
/workspaces/neural-trader/neural-trader-rust/crates/neural/
├── src/
│   ├── models/
│   │   ├── nhits.rs              # Main implementation
│   │   ├── layers.rs             # MLP blocks and layers
│   │   └── mod.rs                # Model exports
│   ├── error.rs                  # Error types
│   └── lib.rs                    # Crate root
└── tests/
    └── nhits_tests.rs            # Integration tests
```

## Future Enhancements

### Potential Improvements
- [ ] Attention mechanism for long-range dependencies
- [ ] Multi-variate support
- [ ] Automatic hyperparameter tuning
- [ ] Model ensembling
- [ ] ONNX export support
- [ ] Distributed training support
- [ ] Real-time inference optimization

### Advanced Features
- [ ] Uncertainty quantification
- [ ] Conformal prediction intervals
- [ ] Seasonal decomposition
- [ ] Exogenous variables support
- [ ] Transfer learning capabilities

## References

- Original Paper: "NHITS: Neural Hierarchical Interpolation for Time Series Forecasting"
- Candle Framework: https://github.com/huggingface/candle
- ndarray: https://docs.rs/ndarray/

## License

Part of the Neural Trader project - see project LICENSE for details.
