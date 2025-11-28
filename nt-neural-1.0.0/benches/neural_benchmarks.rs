//! Comprehensive neural module benchmarks

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use nt_neural::{
    models::{
        nhits::{NHITSModel, NHITSConfig},
        lstm_attention::{LSTMAttentionModel, LSTMAttentionConfig},
        transformer::{TransformerModel, TransformerConfig},
        ModelConfig,
    },
    training::{DataLoader, TimeSeriesDataset},
    utils::{normalize, EvaluationMetrics},
    inference::{Predictor, BatchPredictor},
    initialize,
};
use polars::prelude::*;
use candle_nn::VarMap;
use candle_core::{Device, DType};

fn create_test_dataframe(n: usize) -> DataFrame {
    let values: Vec<f64> = (0..n).map(|x| x as f64 + rand::random::<f64>()).collect();
    let timestamps: Vec<String> = (0..n).map(|i| format!("2024-01-{}", i % 30 + 1)).collect();

    df!(
        "timestamp" => timestamps,
        "value" => values
    )
    .unwrap()
}

fn benchmark_data_loader(c: &mut Criterion) {
    let mut group = c.benchmark_group("data_loader");

    for size in [1000, 5000, 10000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let df = create_test_dataframe(size);
            let device = candle_core::Device::Cpu;

            b.iter(|| {
                let dataset = TimeSeriesDataset::new(df.clone(), "value", 100, 24).unwrap();
                let mut loader = DataLoader::new(dataset, 32);
                let mut count = 0;

                while let Some(_) = loader.next_batch(&device).unwrap() {
                    count += 1;
                }

                black_box(count)
            });
        });
    }

    group.finish();
}

fn benchmark_normalization(c: &mut Criterion) {
    let mut group = c.benchmark_group("normalization");

    for size in [1000, 10000, 100000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let data: Vec<f64> = (0..size).map(|x| x as f64).collect();

            b.iter(|| {
                let (normalized, params) = normalize(&data);
                black_box((normalized, params))
            });
        });
    }

    group.finish();
}

fn benchmark_metrics(c: &mut Criterion) {
    let mut group = c.benchmark_group("metrics");

    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let y_true: Vec<f64> = (0..size).map(|x| x as f64).collect();
            let y_pred: Vec<f64> = (0..size).map(|x| x as f64 + 0.1).collect();

            b.iter(|| {
                let metrics = EvaluationMetrics::compute(&y_true, &y_pred, None).unwrap();
                black_box(metrics)
            });
        });
    }

    group.finish();
}

fn benchmark_model_forward(c: &mut Criterion) {
    let mut group = c.benchmark_group("model_forward");

    let device = candle_core::Device::Cpu;
    let varmap = VarMap::new();

    for batch_size in [1, 16, 32].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(batch_size), batch_size, |b, &batch_size| {
            let _config = NHITSConfig {
                input_size: 168,
                horizon: 24,
                num_stacks: 3,
                num_blocks: vec![1, 1, 1],
                num_layers: vec![2, 2, 2],
                layer_size: 256,
                pooling_kernel_sizes: Some(vec![vec![2, 2], vec![4, 4], vec![8, 8]]),
                ..Default::default()
            };

            let model = NHITSModel::new(config, &varmap).unwrap();

            // Create input tensor
            let input = candle_core::Tensor::randn(
                0.0f32,
                1.0,
                (batch_size, 168),
                &device,
            )
            .unwrap();

            b.iter(|| {
                let output = model.forward(&input).unwrap();
                black_box(output)
            });
        });
    }

    group.finish();
}

fn benchmark_model_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("model_comparison");
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
        ..Default::default()
    };

    let varmap = VarMap::new();
    let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
    let nhits_model = NHITSModel::new(nhits_config, vb.pp("nhits")).unwrap();
    let input = candle_core::Tensor::randn(0.0f32, 1.0, (32, 168), &device).unwrap();

    group.bench_function("NHITS_forward", |b| {
        b.iter(|| {
            let output = nhits_model.forward(&input).unwrap();
            black_box(output)
        });
    });

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
        ..Default::default()
    };

    let lstm_model = LSTMAttentionModel::new(lstm_config, vb.pp("lstm")).unwrap();
    let lstm_input = candle_core::Tensor::randn(0.0f32, 1.0, (32, 168, 1), &device).unwrap();

    group.bench_function("LSTM_Attention_forward", |b| {
        b.iter(|| {
            let output = lstm_model.forward(&lstm_input).unwrap();
            black_box(output)
        });
    });

    // Transformer model
    let transformer_config = TransformerConfig {
        base: ModelConfig {
            input_size: 168,
            horizon: 24,
            hidden_size: 256,
            num_features: 1,
            dropout: 0.0,
            device: None,
        },
        ..Default::default()
    };

    let transformer_model = TransformerModel::new(transformer_config, vb.pp("transformer")).unwrap();
    let transformer_input = candle_core::Tensor::randn(0.0f32, 1.0, (32, 168, 1), &device).unwrap();

    group.bench_function("Transformer_forward", |b| {
        b.iter(|| {
            let output = transformer_model.forward(&transformer_input).unwrap();
            black_box(output)
        });
    });

    group.finish();
}

fn benchmark_inference_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("inference_latency");

    for batch_size in [1, 4, 16, 32] {
        group.throughput(Throughput::Elements(batch_size as u64));

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
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = NHITSModel::new(config, vb).unwrap();

        let device = Device::Cpu;
        let input = candle_core::Tensor::randn(0.0f32, 1.0, (batch_size, 168), &device).unwrap();

        group.bench_with_input(
            BenchmarkId::new("batch_inference", batch_size),
            &batch_size,
            |b, _| {
                b.iter(|| {
                    let output = model.forward(&input).unwrap();
                    black_box(output)
                });
            },
        );
    }

    group.finish();
}

fn benchmark_memory_usage(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_usage");

    for hidden_size in [64, 128, 256, 512] {
        let config = NHITSConfig {
            base: ModelConfig {
                input_size: 168,
                horizon: 24,
                hidden_size,
                num_features: 1,
                dropout: 0.0,
                device: None,
            },
            ..Default::default()
        };

        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);

        group.bench_with_input(
            BenchmarkId::new("model_creation", hidden_size),
            &hidden_size,
            |b, _| {
                b.iter(|| {
                    let model = NHITSModel::new(config.clone(), vb.clone()).unwrap();
                    black_box(model)
                });
            },
        );
    }

    group.finish();
}

fn benchmark_data_preprocessing(c: &mut Criterion) {
    let mut group = c.benchmark_group("data_preprocessing");

    for size in [1000, 10000, 100000] {
        group.throughput(Throughput::Elements(size as u64));

        let data: Vec<f64> = (0..size).map(|x| x as f64 * 0.5 + 100.0).collect();

        group.bench_with_input(
            BenchmarkId::new("normalize", size),
            &size,
            |b, _| {
                b.iter(|| {
                    let (normalized, params) = normalize(&data);
                    black_box((normalized, params))
                });
            },
        );

        let (normalized, params) = normalize(&data);

        group.bench_with_input(
            BenchmarkId::new("denormalize", size),
            &size,
            |b, _| {
                b.iter(|| {
                    let denormalized: Vec<f64> = normalized
                        .iter()
                        .map(|&x| x * params.std + params.mean)
                        .collect();
                    black_box(denormalized)
                });
            },
        );
    }

    group.finish();
}

fn benchmark_parameter_count(c: &mut Criterion) {
    let mut group = c.benchmark_group("parameter_count");

    for hidden_size in [64, 128, 256, 512] {
        let config = NHITSConfig {
            base: ModelConfig {
                input_size: 168,
                horizon: 24,
                hidden_size,
                num_features: 1,
                dropout: 0.0,
                device: None,
            },
            ..Default::default()
        };

        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = NHITSModel::new(config, vb).unwrap();

        group.bench_with_input(
            BenchmarkId::new("count_params", hidden_size),
            &hidden_size,
            |b, _| {
                b.iter(|| {
                    let params = model.num_parameters();
                    black_box(params)
                });
            },
        );
    }

    group.finish();
}

fn benchmark_sequence_lengths(c: &mut Criterion) {
    let mut group = c.benchmark_group("sequence_lengths");
    let device = Device::Cpu;

    for seq_len in [24, 48, 96, 168, 336] {
        let config = NHITSConfig {
            base: ModelConfig {
                input_size: seq_len,
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

        let input = candle_core::Tensor::randn(0.0f32, 1.0, (16, seq_len), &device).unwrap();

        group.bench_with_input(
            BenchmarkId::new("forward_pass", seq_len),
            &seq_len,
            |b, _| {
                b.iter(|| {
                    let output = model.forward(&input).unwrap();
                    black_box(output)
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_data_loader,
    benchmark_normalization,
    benchmark_metrics,
    benchmark_model_forward,
    benchmark_model_comparison,
    benchmark_inference_latency,
    benchmark_memory_usage,
    benchmark_data_preprocessing,
    benchmark_parameter_count,
    benchmark_sequence_lengths
);
criterion_main!(benches);
