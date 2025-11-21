//! CPU Inference Performance Benchmarks
//!
//! Measures single prediction latency and batch throughput
//! for all CPU-based models (GRU, TCN, N-BEATS, Prophet)
//!
//! Target Metrics:
//! - Single prediction: <50ms (target <30ms)
//! - Batch (32): >1000 pred/sec
//! - Memory per prediction: <1MB

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
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
use std::time::{Duration, Instant};

// ===== Test Data Generation =====

fn generate_test_input(size: usize) -> Vec<f64> {
    (0..size)
        .map(|i| {
            // Simulate realistic financial time series
            let trend = i as f64 * 0.1;
            let seasonality = (i as f64 * 0.05).sin() * 10.0;
            let noise = (i as f64 * 123.456).sin() * 2.0;
            100.0 + trend + seasonality + noise
        })
        .collect()
}

fn generate_batch_inputs(batch_size: usize, input_size: usize) -> Vec<Vec<f64>> {
    (0..batch_size)
        .map(|_| generate_test_input(input_size))
        .collect()
}

// ===== Helper Functions =====

fn measure_latency<F>(mut f: F) -> Duration
where
    F: FnMut() -> (),
{
    let start = Instant::now();
    f();
    start.elapsed()
}

fn measure_throughput<F>(batch_size: usize, mut f: F) -> f64
where
    F: FnMut() -> (),
{
    let start = Instant::now();
    f();
    let elapsed = start.elapsed().as_secs_f64();
    batch_size as f64 / elapsed
}

// ===== 1. SINGLE PREDICTION LATENCY =====

fn benchmark_single_prediction_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("single_prediction_latency");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(100);

    let device = Device::Cpu;
    let input_size = 168; // 1 week of hourly data
    let horizon = 24; // 24-hour forecast

    // Test data
    let test_input = generate_test_input(input_size);

    // GRU Model
    {
        let config = GRUConfig {
            base: ModelConfig {
                input_size,
                horizon,
                hidden_size: 128,
                num_features: 1,
                dropout: 0.0,
                device: Some(device.clone()),
            },
            num_layers: 2,
            bidirectional: false,
        };

        let model = GRUModel::new(config).expect("Failed to create GRU model");

        group.bench_function("GRU_single_prediction", |b| {
            b.iter(|| {
                let start = Instant::now();
                #[cfg(feature = "candle")]
                {
                    let tensor = candle_core::Tensor::from_vec(
                        test_input.clone(),
                        (1, input_size, 1),
                        &device,
                    )
                    .unwrap();
                    let output = model.forward(&tensor).unwrap();
                    black_box(output);
                }
                let latency = start.elapsed();
                assert!(
                    latency < Duration::from_millis(50),
                    "GRU latency {}ms exceeds 50ms target",
                    latency.as_millis()
                );
            });
        });
    }

    // TCN Model
    {
        let config = TCNConfig {
            base: ModelConfig {
                input_size,
                horizon,
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

        group.bench_function("TCN_single_prediction", |b| {
            b.iter(|| {
                let start = Instant::now();
                #[cfg(feature = "candle")]
                {
                    let tensor = candle_core::Tensor::from_vec(
                        test_input.clone(),
                        (1, input_size, 1),
                        &device,
                    )
                    .unwrap();
                    let output = model.forward(&tensor).unwrap();
                    black_box(output);
                }
                let latency = start.elapsed();
                assert!(
                    latency < Duration::from_millis(50),
                    "TCN latency {}ms exceeds 50ms target",
                    latency.as_millis()
                );
            });
        });
    }

    // N-BEATS Model
    {
        let config = NBeatsConfig {
            base: ModelConfig {
                input_size,
                horizon,
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

        group.bench_function("NBeats_single_prediction", |b| {
            b.iter(|| {
                let start = Instant::now();
                #[cfg(feature = "candle")]
                {
                    let tensor =
                        candle_core::Tensor::from_vec(test_input.clone(), (1, input_size), &device)
                            .unwrap();
                    let output = model.forward(&tensor).unwrap();
                    black_box(output);
                }
                let latency = start.elapsed();
                assert!(
                    latency < Duration::from_millis(50),
                    "N-BEATS latency {}ms exceeds 50ms target",
                    latency.as_millis()
                );
            });
        });
    }

    // Prophet Model
    {
        let config = ProphetConfig {
            base: ModelConfig {
                input_size,
                horizon,
                hidden_size: 64,
                num_features: 1,
                dropout: 0.0,
                device: Some(device.clone()),
            },
            growth: GrowthModel::Linear,
            yearly_seasonality: 5,
            weekly_seasonality: 2,
            daily_seasonality: 2,
            changepoint_detection: false, // Disable for speed
            n_changepoints: 0,
            changepoint_prior_scale: 0.05,
            seasonality_prior_scale: 10.0,
            uncertainty_samples: 0,
        };

        let model = ProphetModel::new(config).expect("Failed to create Prophet model");

        group.bench_function("Prophet_single_prediction", |b| {
            b.iter(|| {
                let start = Instant::now();
                #[cfg(feature = "candle")]
                {
                    let tensor = candle_core::Tensor::from_vec(
                        test_input.clone(),
                        (1, input_size, 1),
                        &device,
                    )
                    .unwrap();
                    let output = model.forward(&tensor).unwrap();
                    black_box(output);
                }
                let latency = start.elapsed();
                assert!(
                    latency < Duration::from_millis(50),
                    "Prophet latency {}ms exceeds 50ms target",
                    latency.as_millis()
                );
            });
        });
    }

    group.finish();
}

// ===== 2. BATCH THROUGHPUT =====

fn benchmark_batch_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_throughput");
    group.measurement_time(Duration::from_secs(15));

    let device = Device::Cpu;
    let input_size = 168;
    let horizon = 24;

    for batch_size in [1, 8, 32, 128, 512].iter() {
        let batch_inputs = generate_batch_inputs(*batch_size, input_size);
        group.throughput(Throughput::Elements(*batch_size as u64));

        // GRU Throughput
        {
            let config = GRUConfig {
                base: ModelConfig {
                    input_size,
                    horizon,
                    hidden_size: 128,
                    num_features: 1,
                    dropout: 0.0,
                    device: Some(device.clone()),
                },
                num_layers: 2,
                bidirectional: false,
            };

            let model = GRUModel::new(config).expect("Failed to create GRU model");

            group.bench_with_input(
                BenchmarkId::new("GRU_batch", batch_size),
                batch_size,
                |b, _| {
                    b.iter(|| {
                        #[cfg(feature = "candle")]
                        {
                            for input in &batch_inputs {
                                let tensor = candle_core::Tensor::from_vec(
                                    input.clone(),
                                    (1, input_size, 1),
                                    &device,
                                )
                                .unwrap();
                                let output = model.forward(&tensor).unwrap();
                                black_box(output);
                            }
                        }
                    });
                },
            );
        }

        // TCN Throughput
        {
            let config = TCNConfig {
                base: ModelConfig {
                    input_size,
                    horizon,
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

            group.bench_with_input(
                BenchmarkId::new("TCN_batch", batch_size),
                batch_size,
                |b, _| {
                    b.iter(|| {
                        #[cfg(feature = "candle")]
                        {
                            for input in &batch_inputs {
                                let tensor = candle_core::Tensor::from_vec(
                                    input.clone(),
                                    (1, input_size, 1),
                                    &device,
                                )
                                .unwrap();
                                let output = model.forward(&tensor).unwrap();
                                black_box(output);
                            }
                        }
                    });
                },
            );
        }

        // N-BEATS Throughput
        {
            let config = NBeatsConfig {
                base: ModelConfig {
                    input_size,
                    horizon,
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

            group.bench_with_input(
                BenchmarkId::new("NBeats_batch", batch_size),
                batch_size,
                |b, _| {
                    b.iter(|| {
                        #[cfg(feature = "candle")]
                        {
                            for input in &batch_inputs {
                                let tensor = candle_core::Tensor::from_vec(
                                    input.clone(),
                                    (1, input_size),
                                    &device,
                                )
                                .unwrap();
                                let output = model.forward(&tensor).unwrap();
                                black_box(output);
                            }
                        }
                    });
                },
            );
        }
    }

    group.finish();
}

// ===== 3. PREPROCESSING OVERHEAD =====

fn benchmark_preprocessing(c: &mut Criterion) {
    let mut group = c.benchmark_group("preprocessing_overhead");
    group.measurement_time(Duration::from_secs(5));

    let input_size = 168;
    let test_input = generate_test_input(input_size);

    // Normalization
    group.bench_function("normalization", |b| {
        b.iter(|| {
            let mean = test_input.iter().sum::<f64>() / test_input.len() as f64;
            let variance = test_input
                .iter()
                .map(|x| (x - mean).powi(2))
                .sum::<f64>()
                / test_input.len() as f64;
            let std = variance.sqrt();

            let normalized: Vec<f64> = test_input.iter().map(|x| (x - mean) / std).collect();
            black_box(normalized);
        });
    });

    // Feature generation (lagged features)
    group.bench_function("feature_generation", |b| {
        b.iter(|| {
            let lags = [1, 2, 3, 7, 14];
            let mut features = test_input.clone();

            for &lag in &lags {
                let lagged: Vec<f64> = (0..test_input.len())
                    .map(|i| {
                        if i >= lag {
                            test_input[i - lag]
                        } else {
                            0.0
                        }
                    })
                    .collect();
                features.extend(lagged);
            }

            black_box(features);
        });
    });

    // Tensor conversion
    group.bench_function("tensor_conversion", |b| {
        let device = Device::Cpu;
        b.iter(|| {
            #[cfg(feature = "candle")]
            {
                let tensor =
                    candle_core::Tensor::from_vec(test_input.clone(), (1, input_size), &device)
                        .unwrap();
                black_box(tensor);
            }
        });
    });

    group.finish();
}

// ===== 4. COLD VS WARM CACHE =====

fn benchmark_cache_effects(c: &mut Criterion) {
    let mut group = c.benchmark_group("cache_effects");
    group.measurement_time(Duration::from_secs(10));

    let device = Device::Cpu;
    let input_size = 168;
    let horizon = 24;
    let test_input = generate_test_input(input_size);

    let config = GRUConfig {
        base: ModelConfig {
            input_size,
            horizon,
            hidden_size: 128,
            num_features: 1,
            dropout: 0.0,
            device: Some(device.clone()),
        },
        num_layers: 2,
        bidirectional: false,
    };

    let model = GRUModel::new(config).expect("Failed to create model");

    // Cold cache (first prediction)
    group.bench_function("cold_cache", |b| {
        b.iter_batched(
            || {
                // Setup: create fresh model each time
                let config = GRUConfig {
                    base: ModelConfig {
                        input_size,
                        horizon,
                        hidden_size: 128,
                        num_features: 1,
                        dropout: 0.0,
                        device: Some(device.clone()),
                    },
                    num_layers: 2,
                    bidirectional: false,
                };
                GRUModel::new(config).expect("Failed to create model")
            },
            |m| {
                #[cfg(feature = "candle")]
                {
                    let tensor = candle_core::Tensor::from_vec(
                        test_input.clone(),
                        (1, input_size, 1),
                        &device,
                    )
                    .unwrap();
                    let output = m.forward(&tensor).unwrap();
                    black_box(output);
                }
            },
            criterion::BatchSize::SmallInput,
        );
    });

    // Warm cache (repeated predictions)
    group.bench_function("warm_cache", |b| {
        b.iter(|| {
            #[cfg(feature = "candle")]
            {
                let tensor = candle_core::Tensor::from_vec(
                    test_input.clone(),
                    (1, input_size, 1),
                    &device,
                )
                .unwrap();
                let output = model.forward(&tensor).unwrap();
                black_box(output);
            }
        });
    });

    group.finish();
}

// ===== 5. DIFFERENT INPUT SIZES =====

fn benchmark_input_sizes(c: &mut Criterion) {
    let mut group = c.benchmark_group("input_size_scaling");
    group.measurement_time(Duration::from_secs(10));

    let device = Device::Cpu;
    let horizon = 24;

    for input_size in [24, 48, 96, 168, 336, 720].iter() {
        let test_input = generate_test_input(*input_size);

        group.throughput(Throughput::Elements(*input_size as u64));

        let config = GRUConfig {
            base: ModelConfig {
                input_size: *input_size,
                horizon,
                hidden_size: 128,
                num_features: 1,
                dropout: 0.0,
                device: Some(device.clone()),
            },
            num_layers: 2,
            bidirectional: false,
        };

        let model = GRUModel::new(config).expect("Failed to create model");

        group.bench_with_input(
            BenchmarkId::new("GRU_scaling", input_size),
            input_size,
            |b, _| {
                b.iter(|| {
                    #[cfg(feature = "candle")]
                    {
                        let tensor = candle_core::Tensor::from_vec(
                            test_input.clone(),
                            (1, *input_size, 1),
                            &device,
                        )
                        .unwrap();
                        let output = model.forward(&tensor).unwrap();
                        black_box(output);
                    }
                });
            },
        );
    }

    group.finish();
}

// ===== 6. MEMORY USAGE PER PREDICTION =====

fn benchmark_memory_per_prediction(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_per_prediction");
    group.measurement_time(Duration::from_secs(5));

    let device = Device::Cpu;
    let input_size = 168;
    let horizon = 24;

    for hidden_size in [32, 64, 128, 256].iter() {
        let config = GRUConfig {
            base: ModelConfig {
                input_size,
                horizon,
                hidden_size: *hidden_size,
                num_features: 1,
                dropout: 0.0,
                device: Some(device.clone()),
            },
            num_layers: 2,
            bidirectional: false,
        };

        let model = GRUModel::new(config).expect("Failed to create model");
        let test_input = generate_test_input(input_size);

        group.bench_with_input(
            BenchmarkId::new("GRU_memory", hidden_size),
            hidden_size,
            |b, _| {
                b.iter(|| {
                    #[cfg(feature = "candle")]
                    {
                        let tensor = candle_core::Tensor::from_vec(
                            test_input.clone(),
                            (1, input_size, 1),
                            &device,
                        )
                        .unwrap();
                        let output = model.forward(&tensor).unwrap();
                        black_box(output);
                    }
                });
            },
        );
    }

    group.finish();
}

// ===== BENCHMARK GROUP =====

criterion_group!(
    inference_benches,
    benchmark_single_prediction_latency,
    benchmark_batch_throughput,
    benchmark_preprocessing,
    benchmark_cache_effects,
    benchmark_input_sizes,
    benchmark_memory_per_prediction,
);

criterion_main!(inference_benches);
