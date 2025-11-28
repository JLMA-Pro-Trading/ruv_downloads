//! CPU Profiling Harness for Neural Crate
//!
//! This benchmark profiles realistic workloads to identify optimization opportunities:
//! - Load 10,000 data points
//! - Preprocess with all transformations
//! - Generate 50 features
//! - Train model for 100 iterations
//! - Run 1000 inferences

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use nt_neural::{
    models::{
        nhits::{NHITSModel, NHITSConfig},
        lstm_attention::{LSTMAttentionModel, LSTMAttentionConfig},
        transformer::{TransformerModel, TransformerConfig},
        ModelConfig,
    },
    training::{DataLoader, TimeSeriesDataset, TrainerConfig},
    utils::{normalize, EvaluationMetrics},
    inference::{Predictor, BatchPredictor},
};
use polars::prelude::*;
use candle_nn::VarMap;
use candle_core::{Device, DType, Tensor};
use std::time::Instant;

// Create realistic time series data
fn create_realistic_data(n: usize) -> DataFrame {
    let mut values = Vec::with_capacity(n);
    let mut timestamps = Vec::with_capacity(n);

    // Generate data with trends, seasonality, and noise
    for i in 0..n {
        let trend = i as f64 * 0.1;
        let seasonality = (i as f64 * 2.0 * std::f64::consts::PI / 24.0).sin() * 10.0;
        let noise = rand::random::<f64>() * 5.0;
        values.push(100.0 + trend + seasonality + noise);
        timestamps.push(format!("2024-01-01 {:02}:00:00", i % 24));
    }

    df!(
        "timestamp" => timestamps,
        "value" => values,
        "volume" => values.iter().map(|v| v * 1000.0).collect::<Vec<_>>(),
        "high" => values.iter().map(|v| v * 1.05).collect::<Vec<_>>(),
        "low" => values.iter().map(|v| v * 0.95).collect::<Vec<_>>()
    )
    .unwrap()
}

// Profile data loading hot path
fn profile_data_loading(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_data_loading");
    group.sample_size(20);

    let df = create_realistic_data(10000);
    let device = Device::Cpu;

    group.bench_function("load_10k_points", |b| {
        b.iter(|| {
            let dataset = TimeSeriesDataset::new(df.clone(), "value", 168, 24).unwrap();
            let mut loader = DataLoader::new(dataset, 32);
            let mut batches = Vec::new();

            while let Some(batch) = loader.next_batch(&device).unwrap() {
                batches.push(batch);
            }

            black_box(batches.len())
        });
    });

    group.finish();
}

// Profile preprocessing pipeline
fn profile_preprocessing(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_preprocessing");
    group.sample_size(50);

    for size in [1000, 5000, 10000, 50000] {
        let data: Vec<f64> = (0..size).map(|i| {
            let x = i as f64;
            100.0 + x * 0.1 + (x * 0.01).sin() * 10.0 + rand::random::<f64>() * 5.0
        }).collect();

        group.throughput(Throughput::Elements(size as u64));

        // Test normalization (hot path)
        group.bench_with_input(BenchmarkId::new("normalize", size), &size, |b, _| {
            b.iter(|| {
                let (normalized, params) = normalize(&data);
                black_box((normalized, params))
            });
        });

        // Test moving average calculation
        group.bench_with_input(BenchmarkId::new("moving_avg", size), &size, |b, _| {
            b.iter(|| {
                let window_size = 20;
                let moving_avg: Vec<f64> = data
                    .windows(window_size)
                    .map(|w| w.iter().sum::<f64>() / window_size as f64)
                    .collect();
                black_box(moving_avg)
            });
        });

        // Test feature generation
        group.bench_with_input(BenchmarkId::new("features_50", size), &size, |b, _| {
            b.iter(|| {
                let mut features = Vec::new();

                // Generate 50 features
                for window in [5, 10, 20, 50, 100] {
                    for i in window..data.len() {
                        let slice = &data[i-window..i];
                        features.push(slice.iter().sum::<f64>() / window as f64); // mean
                        features.push(slice.iter().cloned().fold(f64::MIN, f64::max)); // max
                        features.push(slice.iter().cloned().fold(f64::MAX, f64::min)); // min
                        let mean = slice.iter().sum::<f64>() / window as f64;
                        features.push((slice.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / window as f64).sqrt()); // std
                    }
                }

                black_box(features.len())
            });
        });
    }

    group.finish();
}

// Profile model forward pass (critical hot path)
fn profile_model_forward(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_model_forward");
    group.sample_size(100);

    let device = Device::Cpu;

    // NHITS model
    let nhits_config = NHITSConfig {
        base: ModelConfig {
            input_size: 168,
            horizon: 24,
            hidden_size: 256,
            num_features: 1,
            dropout: 0.0,
            device: None,
        },
        num_stacks: 3,
        num_blocks: vec![1, 1, 1],
        num_layers: vec![2, 2, 2],
        layer_size: 256,
        pooling_kernel_sizes: Some(vec![vec![2, 2], vec![4, 4], vec![8, 8]]),
        ..Default::default()
    };

    let varmap = VarMap::new();
    let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
    let nhits_model = NHITSModel::new(nhits_config, vb.pp("nhits")).unwrap();

    for batch_size in [1, 8, 16, 32, 64] {
        let input = Tensor::randn(0.0f32, 1.0, (batch_size, 168), &device).unwrap();

        group.throughput(Throughput::Elements(batch_size as u64));
        group.bench_with_input(
            BenchmarkId::new("nhits_forward", batch_size),
            &batch_size,
            |b, _| {
                b.iter(|| {
                    let output = nhits_model.forward(&input).unwrap();
                    black_box(output)
                });
            },
        );
    }

    // LSTM-Attention model
    let lstm_config = LSTMAttentionConfig {
        base: ModelConfig {
            input_size: 168,
            horizon: 24,
            hidden_size: 256,
            num_features: 1,
            dropout: 0.0,
            device: None,
        },
        num_layers: 2,
        attention_heads: 8,
        ..Default::default()
    };

    let lstm_model = LSTMAttentionModel::new(lstm_config, vb.pp("lstm")).unwrap();

    for batch_size in [1, 8, 16, 32] {
        let input = Tensor::randn(0.0f32, 1.0, (batch_size, 168, 1), &device).unwrap();

        group.throughput(Throughput::Elements(batch_size as u64));
        group.bench_with_input(
            BenchmarkId::new("lstm_forward", batch_size),
            &batch_size,
            |b, _| {
                b.iter(|| {
                    let output = lstm_model.forward(&input).unwrap();
                    black_box(output)
                });
            },
        );
    }

    group.finish();
}

// Profile inference workload (1000 predictions)
fn profile_inference_batch(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_inference");
    group.sample_size(10);

    let device = Device::Cpu;
    let config = NHITSConfig {
        base: ModelConfig {
            input_size: 168,
            horizon: 24,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: None,
        },
        ..Default::default()
    };

    let varmap = VarMap::new();
    let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
    let model = NHITSModel::new(config, vb).unwrap();

    group.bench_function("inference_1000_predictions", |b| {
        b.iter(|| {
            let mut total_predictions = 0;

            for _ in 0..1000 {
                let input = Tensor::randn(0.0f32, 1.0, (1, 168), &device).unwrap();
                let output = model.forward(&input).unwrap();
                total_predictions += output.dims()[1];
            }

            black_box(total_predictions)
        });
    });

    // Batch inference comparison
    for batch_size in [1, 10, 50, 100] {
        let num_batches = 1000 / batch_size;

        group.bench_with_input(
            BenchmarkId::new("batched_inference", batch_size),
            &batch_size,
            |b, &bs| {
                b.iter(|| {
                    let mut total = 0;

                    for _ in 0..num_batches {
                        let input = Tensor::randn(0.0f32, 1.0, (bs, 168), &device).unwrap();
                        let output = model.forward(&input).unwrap();
                        total += output.dims()[0];
                    }

                    black_box(total)
                });
            },
        );
    }

    group.finish();
}

// Profile training iteration
fn profile_training_step(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_training");
    group.sample_size(10);

    let device = Device::Cpu;
    let df = create_realistic_data(5000);
    let dataset = TimeSeriesDataset::new(df, "value", 168, 24).unwrap();
    let mut loader = DataLoader::new(dataset, 32);

    let config = NHITSConfig {
        base: ModelConfig {
            input_size: 168,
            horizon: 24,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.1,
            device: None,
        },
        ..Default::default()
    };

    group.bench_function("single_training_step", |b| {
        b.iter(|| {
            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = NHITSModel::new(config.clone(), vb).unwrap();

            if let Some((x, y)) = loader.next_batch(&device).unwrap() {
                let output = model.forward(&x).unwrap();
                let loss = output.sub(&y).unwrap().sqr().unwrap().mean_all().unwrap();
                black_box(loss)
            } else {
                panic!("No batch available")
            }
        });
    });

    group.finish();
}

// Profile memory-intensive operations
fn profile_memory_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_memory");
    group.sample_size(20);

    let device = Device::Cpu;

    for size in [1000, 5000, 10000] {
        // Large tensor allocations
        group.bench_with_input(
            BenchmarkId::new("tensor_allocation", size),
            &size,
            |b, &s| {
                b.iter(|| {
                    let t = Tensor::zeros((s, 256), DType::F32, &device).unwrap();
                    black_box(t)
                });
            },
        );

        // Tensor operations
        let t1 = Tensor::randn(0.0f32, 1.0, (size, 256), &device).unwrap();
        let t2 = Tensor::randn(0.0f32, 1.0, (size, 256), &device).unwrap();

        group.bench_with_input(
            BenchmarkId::new("tensor_add", size),
            &size,
            |b, _| {
                b.iter(|| {
                    let result = t1.add(&t2).unwrap();
                    black_box(result)
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("tensor_matmul", size),
            &size,
            |b, _| {
                b.iter(|| {
                    let result = t1.matmul(&t2.t().unwrap()).unwrap();
                    black_box(result)
                });
            },
        );
    }

    group.finish();
}

// Profile cache-sensitive operations
fn profile_cache_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_cache");
    group.sample_size(50);

    // Sequential access (cache-friendly)
    for size in [1000, 10000, 100000] {
        let data: Vec<f64> = (0..size).map(|i| i as f64).collect();

        group.bench_with_input(
            BenchmarkId::new("sequential_sum", size),
            &size,
            |b, _| {
                b.iter(|| {
                    let sum: f64 = data.iter().sum();
                    black_box(sum)
                });
            },
        );

        // Strided access (cache-unfriendly)
        group.bench_with_input(
            BenchmarkId::new("strided_sum", size),
            &size,
            |b, _| {
                b.iter(|| {
                    let sum: f64 = data.iter().step_by(16).sum();
                    black_box(sum)
                });
            },
        );
    }

    group.finish();
}

// Realistic end-to-end workflow
fn profile_realistic_workflow(c: &mut Criterion) {
    let mut group = c.benchmark_group("hotpath_e2e_workflow");
    group.sample_size(5);

    group.bench_function("complete_workflow", |b| {
        b.iter(|| {
            // 1. Load data (10,000 points)
            let df = create_realistic_data(10000);

            // 2. Preprocess
            let values: Vec<f64> = df.column("value")
                .unwrap()
                .f64()
                .unwrap()
                .into_iter()
                .filter_map(|v| v)
                .collect();
            let (normalized, _params) = normalize(&values);

            // 3. Create dataset
            let dataset = TimeSeriesDataset::new(df, "value", 168, 24).unwrap();
            let mut loader = DataLoader::new(dataset, 32);

            // 4. Create model
            let device = Device::Cpu;
            let config = NHITSConfig {
                base: ModelConfig {
                    input_size: 168,
                    horizon: 24,
                    hidden_size: 128,
                    num_features: 1,
                    dropout: 0.1,
                    device: None,
                },
                ..Default::default()
            };

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = NHITSModel::new(config, vb).unwrap();

            // 5. Training iterations (10 epochs)
            let mut total_loss = 0.0;
            for _ in 0..10 {
                if let Some((x, y)) = loader.next_batch(&device).unwrap() {
                    let output = model.forward(&x).unwrap();
                    let loss = output.sub(&y).unwrap().sqr().unwrap().mean_all().unwrap();
                    total_loss += loss.to_scalar::<f32>().unwrap() as f64;
                }
            }

            // 6. Inference (100 predictions)
            for _ in 0..100 {
                let input = Tensor::randn(0.0f32, 1.0, (1, 168), &device).unwrap();
                let _output = model.forward(&input).unwrap();
            }

            black_box((normalized.len(), total_loss))
        });
    });

    group.finish();
}

criterion_group!(
    cpu_profiling,
    profile_data_loading,
    profile_preprocessing,
    profile_model_forward,
    profile_inference_batch,
    profile_training_step,
    profile_memory_operations,
    profile_cache_operations,
    profile_realistic_workflow
);

criterion_main!(cpu_profiling);
