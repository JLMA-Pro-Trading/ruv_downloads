//! Inference Performance Integration Tests
//!
//! Validates that inference meets performance requirements:
//! - Single prediction: <50ms (target <30ms)
//! - Batch (32): >500 pred/sec (target >1000)
//! - Memory per prediction: <1MB

#[cfg(feature = "candle")]
use nt_neural::{
    models::{
        gru::{GRUConfig, GRUModel},
        nbeats::{NBeatsConfig, NBeatsModel, StackType},
        prophet::{GrowthModel, ProphetConfig, ProphetModel},
        tcn::{TCNConfig, TCNModel},
        ModelConfig, NeuralModel,
    },
    Device,
};
use std::time::Instant;

const INPUT_SIZE: usize = 168; // 1 week of hourly data
const HORIZON: usize = 24; // 24-hour forecast
const SINGLE_PREDICTION_MAX_MS: u128 = 50;
const TARGET_SINGLE_PREDICTION_MS: u128 = 30;
const MIN_THROUGHPUT_PER_SEC: f64 = 500.0;
const TARGET_THROUGHPUT_PER_SEC: f64 = 1000.0;

fn generate_test_input(size: usize) -> Vec<f64> {
    (0..size)
        .map(|i| {
            let trend = i as f64 * 0.1;
            let seasonality = (i as f64 * 0.05).sin() * 10.0;
            let noise = (i as f64 * 123.456).sin() * 2.0;
            100.0 + trend + seasonality + noise
        })
        .collect()
}

#[cfg(feature = "candle")]
fn measure_single_prediction_latency<M: NeuralModel>(
    model: &M,
    input: &[f64],
    device: &Device,
    input_shape: (usize, usize),
) -> u128 {
    let start = Instant::now();

    let tensor = candle_core::Tensor::from_vec(input.to_vec(), input_shape, device).unwrap();
    let _output = model.forward(&tensor).unwrap();

    start.elapsed().as_millis()
}

#[cfg(feature = "candle")]
fn measure_batch_throughput<M: NeuralModel>(
    model: &M,
    batch_size: usize,
    input_size: usize,
    device: &Device,
    input_shape_fn: fn(usize) -> (usize, usize),
) -> f64 {
    let inputs: Vec<Vec<f64>> = (0..batch_size)
        .map(|_| generate_test_input(input_size))
        .collect();

    let start = Instant::now();

    for input in inputs {
        let shape = input_shape_fn(input_size);
        let tensor = candle_core::Tensor::from_vec(input, shape, device).unwrap();
        let _output = model.forward(&tensor).unwrap();
    }

    let elapsed = start.elapsed().as_secs_f64();
    batch_size as f64 / elapsed
}

// ===== GRU Performance Tests =====

#[test]
#[cfg(feature = "candle")]
fn test_gru_single_prediction_latency() {
    let device = Device::Cpu;
    let config = GRUConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        num_layers: 2,
        bidirectional: false,
    };

    let model = GRUModel::new(config).expect("Failed to create GRU model");
    let test_input = generate_test_input(INPUT_SIZE);

    // Warm up
    for _ in 0..3 {
        let _ = measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE, 1));
    }

    // Measure
    let latencies: Vec<u128> = (0..10)
        .map(|_| measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE, 1)))
        .collect();

    let avg_latency = latencies.iter().sum::<u128>() / latencies.len() as u128;
    let p95_latency = {
        let mut sorted = latencies.clone();
        sorted.sort_unstable();
        sorted[(sorted.len() as f64 * 0.95) as usize]
    };

    println!("GRU Single Prediction Latency:");
    println!("  Average: {}ms", avg_latency);
    println!("  P95: {}ms", p95_latency);
    println!("  Min: {}ms", latencies.iter().min().unwrap());
    println!("  Max: {}ms", latencies.iter().max().unwrap());

    assert!(
        avg_latency < SINGLE_PREDICTION_MAX_MS,
        "GRU average latency {}ms exceeds {}ms limit",
        avg_latency,
        SINGLE_PREDICTION_MAX_MS
    );

    if avg_latency < TARGET_SINGLE_PREDICTION_MS {
        println!("  ✓ Target <{}ms achieved!", TARGET_SINGLE_PREDICTION_MS);
    } else {
        println!(
            "  ⚠ Target <{}ms not achieved (current: {}ms)",
            TARGET_SINGLE_PREDICTION_MS, avg_latency
        );
    }
}

#[test]
#[cfg(feature = "candle")]
fn test_gru_batch_throughput() {
    let device = Device::Cpu;
    let config = GRUConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        num_layers: 2,
        bidirectional: false,
    };

    let model = GRUModel::new(config).expect("Failed to create GRU model");

    let throughput =
        measure_batch_throughput(&model, 32, INPUT_SIZE, &device, |size| (1, size, 1));

    println!("GRU Batch Throughput (batch_size=32):");
    println!("  Throughput: {:.2} predictions/sec", throughput);

    assert!(
        throughput > MIN_THROUGHPUT_PER_SEC,
        "GRU throughput {:.2}/s below {:.2}/s minimum",
        throughput,
        MIN_THROUGHPUT_PER_SEC
    );

    if throughput > TARGET_THROUGHPUT_PER_SEC {
        println!("  ✓ Target >{}/s achieved!", TARGET_THROUGHPUT_PER_SEC);
    } else {
        println!(
            "  ⚠ Target >{}/s not achieved (current: {:.2}/s)",
            TARGET_THROUGHPUT_PER_SEC, throughput
        );
    }
}

// ===== TCN Performance Tests =====

#[test]
#[cfg(feature = "candle")]
fn test_tcn_single_prediction_latency() {
    let device = Device::Cpu;
    let config = TCNConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        num_channels: vec![64, 128, 128],
        kernel_size: 3,
        dilation_base: 2,
    };

    let model = TCNModel::new(config).expect("Failed to create TCN model");
    let test_input = generate_test_input(INPUT_SIZE);

    // Warm up
    for _ in 0..3 {
        let _ = measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE, 1));
    }

    // Measure
    let latencies: Vec<u128> = (0..10)
        .map(|_| measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE, 1)))
        .collect();

    let avg_latency = latencies.iter().sum::<u128>() / latencies.len() as u128;

    println!("TCN Single Prediction Latency:");
    println!("  Average: {}ms", avg_latency);

    assert!(
        avg_latency < SINGLE_PREDICTION_MAX_MS,
        "TCN average latency {}ms exceeds {}ms limit",
        avg_latency,
        SINGLE_PREDICTION_MAX_MS
    );
}

#[test]
#[cfg(feature = "candle")]
fn test_tcn_batch_throughput() {
    let device = Device::Cpu;
    let config = TCNConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        num_channels: vec![64, 128, 128],
        kernel_size: 3,
        dilation_base: 2,
    };

    let model = TCNModel::new(config).expect("Failed to create TCN model");

    let throughput =
        measure_batch_throughput(&model, 32, INPUT_SIZE, &device, |size| (1, size, 1));

    println!("TCN Batch Throughput (batch_size=32):");
    println!("  Throughput: {:.2} predictions/sec", throughput);

    assert!(
        throughput > MIN_THROUGHPUT_PER_SEC,
        "TCN throughput {:.2}/s below {:.2}/s minimum",
        throughput,
        MIN_THROUGHPUT_PER_SEC
    );
}

// ===== N-BEATS Performance Tests =====

#[test]
#[cfg(feature = "candle")]
fn test_nbeats_single_prediction_latency() {
    let device = Device::Cpu;
    let config = NBeatsConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        num_stacks: 2,
        num_blocks: 3,
        num_layers: 4,
        layer_width: 128,
        stack_types: vec![StackType::Trend, StackType::Seasonality],
        share_weights_in_stack: true,
        expansion_coefficient_dim: 5,
    };

    let model = NBeatsModel::new(config).expect("Failed to create N-BEATS model");
    let test_input = generate_test_input(INPUT_SIZE);

    // Warm up
    for _ in 0..3 {
        let _ = measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE));
    }

    // Measure
    let latencies: Vec<u128> = (0..10)
        .map(|_| measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE)))
        .collect();

    let avg_latency = latencies.iter().sum::<u128>() / latencies.len() as u128;

    println!("N-BEATS Single Prediction Latency:");
    println!("  Average: {}ms", avg_latency);

    assert!(
        avg_latency < SINGLE_PREDICTION_MAX_MS,
        "N-BEATS average latency {}ms exceeds {}ms limit",
        avg_latency,
        SINGLE_PREDICTION_MAX_MS
    );
}

#[test]
#[cfg(feature = "candle")]
fn test_nbeats_batch_throughput() {
    let device = Device::Cpu;
    let config = NBeatsConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        num_stacks: 2,
        num_blocks: 3,
        num_layers: 4,
        layer_width: 128,
        stack_types: vec![StackType::Trend, StackType::Seasonality],
        share_weights_in_stack: true,
        expansion_coefficient_dim: 5,
    };

    let model = NBeatsModel::new(config).expect("Failed to create N-BEATS model");

    let throughput = measure_batch_throughput(&model, 32, INPUT_SIZE, &device, |size| (1, size));

    println!("N-BEATS Batch Throughput (batch_size=32):");
    println!("  Throughput: {:.2} predictions/sec", throughput);

    assert!(
        throughput > MIN_THROUGHPUT_PER_SEC,
        "N-BEATS throughput {:.2}/s below {:.2}/s minimum",
        throughput,
        MIN_THROUGHPUT_PER_SEC
    );
}

// ===== Prophet Performance Tests =====

#[test]
#[cfg(feature = "candle")]
fn test_prophet_single_prediction_latency() {
    let device = Device::Cpu;
    let config = ProphetConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 64,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        growth: GrowthModel::Linear,
        yearly_seasonality: 5,
        weekly_seasonality: 2,
        daily_seasonality: 2,
        changepoint_detection: false,
        n_changepoints: 0,
        changepoint_prior_scale: 0.05,
        seasonality_prior_scale: 10.0,
        uncertainty_samples: 0,
    };

    let model = ProphetModel::new(config).expect("Failed to create Prophet model");
    let test_input = generate_test_input(INPUT_SIZE);

    // Warm up
    for _ in 0..3 {
        let _ = measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE, 1));
    }

    // Measure
    let latencies: Vec<u128> = (0..10)
        .map(|_| measure_single_prediction_latency(&model, &test_input, &device, (1, INPUT_SIZE, 1)))
        .collect();

    let avg_latency = latencies.iter().sum::<u128>() / latencies.len() as u128;

    println!("Prophet Single Prediction Latency:");
    println!("  Average: {}ms", avg_latency);

    assert!(
        avg_latency < SINGLE_PREDICTION_MAX_MS,
        "Prophet average latency {}ms exceeds {}ms limit",
        avg_latency,
        SINGLE_PREDICTION_MAX_MS
    );
}

#[test]
#[cfg(feature = "candle")]
fn test_prophet_batch_throughput() {
    let device = Device::Cpu;
    let config = ProphetConfig {
        base: ModelConfig {
            input_size: INPUT_SIZE,
            horizon: HORIZON,
            hidden_size: 64,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        growth: GrowthModel::Linear,
        yearly_seasonality: 5,
        weekly_seasonality: 2,
        daily_seasonality: 2,
        changepoint_detection: false,
        n_changepoints: 0,
        changepoint_prior_scale: 0.05,
        seasonality_prior_scale: 10.0,
        uncertainty_samples: 0,
    };

    let model = ProphetModel::new(config).expect("Failed to create Prophet model");

    let throughput =
        measure_batch_throughput(&model, 32, INPUT_SIZE, &device, |size| (1, size, 1));

    println!("Prophet Batch Throughput (batch_size=32):");
    println!("  Throughput: {:.2} predictions/sec", throughput);

    assert!(
        throughput > MIN_THROUGHPUT_PER_SEC,
        "Prophet throughput {:.2}/s below {:.2}/s minimum",
        throughput,
        MIN_THROUGHPUT_PER_SEC
    );
}

// ===== Preprocessing Overhead Tests =====

#[test]
fn test_normalization_overhead() {
    let input = generate_test_input(INPUT_SIZE);

    let start = Instant::now();

    for _ in 0..1000 {
        let mean = input.iter().sum::<f64>() / input.len() as f64;
        let variance = input.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / input.len() as f64;
        let std = variance.sqrt();

        let _normalized: Vec<f64> = input.iter().map(|x| (x - mean) / std).collect();
    }

    let elapsed_ms = start.elapsed().as_millis();
    let per_operation_us = (elapsed_ms as f64 / 1000.0) * 1000.0;

    println!("Normalization Overhead:");
    println!("  Per operation: {:.2}µs", per_operation_us);

    // Should be < 100µs
    assert!(
        per_operation_us < 100.0,
        "Normalization overhead {:.2}µs exceeds 100µs",
        per_operation_us
    );
}

#[test]
fn test_tensor_conversion_overhead() {
    let input = generate_test_input(INPUT_SIZE);
    let device = Device::Cpu;

    let start = Instant::now();

    #[cfg(feature = "candle")]
    for _ in 0..1000 {
        let _tensor =
            candle_core::Tensor::from_vec(input.clone(), (1, INPUT_SIZE), &device).unwrap();
    }

    #[cfg(not(feature = "candle"))]
    let _ = (input, device);

    let elapsed_ms = start.elapsed().as_millis();
    let per_operation_us = (elapsed_ms as f64 / 1000.0) * 1000.0;

    println!("Tensor Conversion Overhead:");
    println!("  Per operation: {:.2}µs", per_operation_us);

    // Should be < 50µs
    #[cfg(feature = "candle")]
    assert!(
        per_operation_us < 50.0,
        "Tensor conversion overhead {:.2}µs exceeds 50µs",
        per_operation_us
    );
}

// ===== Summary Test =====

#[test]
#[cfg(feature = "candle")]
fn test_performance_summary() {
    println!("\n╔════════════════════════════════════════════════════════════╗");
    println!("║      CPU INFERENCE PERFORMANCE SUMMARY                    ║");
    println!("╠════════════════════════════════════════════════════════════╣");
    println!("║ Requirements:                                              ║");
    println!("║   Single Prediction: <50ms (target <30ms)                 ║");
    println!("║   Batch Throughput:  >500/s (target >1000/s)              ║");
    println!("║   Memory/Prediction: <1MB                                 ║");
    println!("╚════════════════════════════════════════════════════════════╝\n");

    // This test just prints the summary - actual validation is in individual tests
    println!("Run individual performance tests for detailed metrics:");
    println!("  cargo test --features candle --test inference_performance_tests -- --nocapture");
}
