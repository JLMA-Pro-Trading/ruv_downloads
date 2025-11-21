//! Benchmark comparison: SIMD vs Scalar operations
//!
//! Run with: `cargo bench --bench simd_benchmarks --features simd`

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use nt_neural::utils::preprocessing::{normalize, min_max_normalize, NormalizationParams};
use nt_neural::utils::features::{rolling_mean, rolling_std, ema};

#[cfg(feature = "simd")]
use nt_neural::utils::simd::*;

fn generate_test_data(size: usize) -> Vec<f64> {
    (0..size).map(|i| (i as f64 * 0.1).sin() * 100.0 + 50.0).collect()
}

fn bench_normalization(c: &mut Criterion) {
    let mut group = c.benchmark_group("normalization");

    for size in [100, 1_000, 10_000, 100_000].iter() {
        let data = generate_test_data(*size);
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::new("normalize", size), &data, |b, d| {
            b.iter(|| {
                let (normalized, _) = normalize(black_box(d));
                black_box(normalized)
            });
        });

        #[cfg(feature = "simd")]
        {
            let params = NormalizationParams::from_data(&data);
            group.bench_with_input(BenchmarkId::new("simd_normalize", size), &data, |b, d| {
                b.iter(|| {
                    let normalized = simd_normalize(black_box(d), params.mean, params.std);
                    black_box(normalized)
                });
            });
        }
    }

    group.finish();
}

fn bench_min_max(c: &mut Criterion) {
    let mut group = c.benchmark_group("min_max_normalization");

    for size in [100, 1_000, 10_000, 100_000].iter() {
        let data = generate_test_data(*size);
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::new("min_max_normalize", size), &data, |b, d| {
            b.iter(|| {
                let (normalized, _) = min_max_normalize(black_box(d));
                black_box(normalized)
            });
        });

        #[cfg(feature = "simd")]
        {
            let params = NormalizationParams::from_data(&data);
            group.bench_with_input(BenchmarkId::new("simd_min_max_normalize", size), &data, |b, d| {
                b.iter(|| {
                    let normalized = simd_min_max_normalize(black_box(d), params.min, params.max);
                    black_box(normalized)
                });
            });
        }
    }

    group.finish();
}

fn bench_rolling_mean(c: &mut Criterion) {
    let mut group = c.benchmark_group("rolling_mean");

    for size in [100, 1_000, 10_000, 100_000].iter() {
        let data = generate_test_data(*size);
        group.throughput(Throughput::Elements(*size as u64));

        for window in [10, 20, 50].iter() {
            let bench_name = format!("size_{}_window_{}", size, window);

            group.bench_with_input(
                BenchmarkId::new("rolling_mean", &bench_name),
                &(&data, window),
                |b, (d, w)| {
                    b.iter(|| {
                        let means = rolling_mean(black_box(d), black_box(**w));
                        black_box(means)
                    });
                },
            );

            #[cfg(feature = "simd")]
            {
                group.bench_with_input(
                    BenchmarkId::new("simd_rolling_mean", &bench_name),
                    &(&data, window),
                    |b, (d, w)| {
                        b.iter(|| {
                            let means = simd_rolling_mean(black_box(d), black_box(**w));
                            black_box(means)
                        });
                    },
                );
            }
        }
    }

    group.finish();
}

fn bench_rolling_std(c: &mut Criterion) {
    let mut group = c.benchmark_group("rolling_std");

    for size in [100, 1_000, 10_000].iter() {
        let data = generate_test_data(*size);
        group.throughput(Throughput::Elements(*size as u64));

        for window in [10, 20, 50].iter() {
            let bench_name = format!("size_{}_window_{}", size, window);

            group.bench_with_input(
                BenchmarkId::new("rolling_std", &bench_name),
                &(&data, window),
                |b, (d, w)| {
                    b.iter(|| {
                        let stds = rolling_std(black_box(d), black_box(**w));
                        black_box(stds)
                    });
                },
            );

            #[cfg(feature = "simd")]
            {
                group.bench_with_input(
                    BenchmarkId::new("simd_rolling_std", &bench_name),
                    &(&data, window),
                    |b, (d, w)| {
                        b.iter(|| {
                            let stds = simd_rolling_std(black_box(d), black_box(**w));
                            black_box(stds)
                        });
                    },
                );
            }
        }
    }

    group.finish();
}

fn bench_ema(c: &mut Criterion) {
    let mut group = c.benchmark_group("exponential_moving_average");

    for size in [100, 1_000, 10_000, 100_000].iter() {
        let data = generate_test_data(*size);
        group.throughput(Throughput::Elements(*size as u64));

        for alpha in [0.1, 0.3, 0.5].iter() {
            let bench_name = format!("size_{}_alpha_{}", size, alpha);

            group.bench_with_input(
                BenchmarkId::new("ema", &bench_name),
                &(&data, alpha),
                |b, (d, a)| {
                    b.iter(|| {
                        let ema_values = ema(black_box(d), black_box(**a));
                        black_box(ema_values)
                    });
                },
            );

            #[cfg(feature = "simd")]
            {
                group.bench_with_input(
                    BenchmarkId::new("simd_ema", &bench_name),
                    &(&data, alpha),
                    |b, (d, a)| {
                        b.iter(|| {
                            let ema_values = simd_ema(black_box(d), black_box(**a));
                            black_box(ema_values)
                        });
                    },
                );
            }
        }
    }

    group.finish();
}

fn bench_mean_variance(c: &mut Criterion) {
    let mut group = c.benchmark_group("mean_variance");

    for size in [100, 1_000, 10_000, 100_000].iter() {
        let data = generate_test_data(*size);
        group.throughput(Throughput::Elements(*size as u64));

        group.bench_with_input(BenchmarkId::new("scalar_mean", size), &data, |b, d| {
            b.iter(|| {
                let mean = d.iter().sum::<f64>() / d.len() as f64;
                black_box(mean)
            });
        });

        #[cfg(feature = "simd")]
        {
            group.bench_with_input(BenchmarkId::new("simd_mean", size), &data, |b, d| {
                b.iter(|| {
                    let mean = simd_mean(black_box(d));
                    black_box(mean)
                });
            });

            let mean = simd_mean(&data);
            group.bench_with_input(BenchmarkId::new("scalar_variance", size), &data, |b, d| {
                b.iter(|| {
                    let variance = d.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / d.len() as f64;
                    black_box(variance)
                });
            });

            group.bench_with_input(BenchmarkId::new("simd_variance", size), &data, |b, d| {
                b.iter(|| {
                    let variance = simd_variance(black_box(d), mean);
                    black_box(variance)
                });
            });
        }
    }

    group.finish();
}

#[cfg(feature = "simd")]
fn bench_simd_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("simd_operations");

    for size in [100, 1_000, 10_000, 100_000].iter() {
        let data_a = generate_test_data(*size);
        let data_b = generate_test_data(*size);
        group.throughput(Throughput::Elements(*size as u64));

        // Sum operations
        group.bench_with_input(BenchmarkId::new("simd_sum", size), &data_a, |b, d| {
            b.iter(|| {
                let sum = simd_sum(black_box(d));
                black_box(sum)
            });
        });

        group.bench_with_input(BenchmarkId::new("simd_sum_wide", size), &data_a, |b, d| {
            b.iter(|| {
                let sum = simd_sum_wide(black_box(d));
                black_box(sum)
            });
        });

        // Vector operations
        group.bench_with_input(
            BenchmarkId::new("simd_add", size),
            &(&data_a, &data_b),
            |b, (a, d)| {
                b.iter(|| {
                    let result = simd_add(black_box(a), black_box(d));
                    black_box(result)
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("simd_multiply", size),
            &(&data_a, &data_b),
            |b, (a, d)| {
                b.iter(|| {
                    let result = simd_multiply(black_box(a), black_box(d));
                    black_box(result)
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("simd_scalar_multiply", size),
            &data_a,
            |b, d| {
                b.iter(|| {
                    let result = simd_scalar_multiply(black_box(d), black_box(2.5));
                    black_box(result)
                });
            },
        );
    }

    group.finish();
}

#[cfg(feature = "simd")]
criterion_group!(
    benches,
    bench_normalization,
    bench_min_max,
    bench_rolling_mean,
    bench_rolling_std,
    bench_ema,
    bench_mean_variance,
    bench_simd_operations
);

#[cfg(not(feature = "simd"))]
criterion_group!(
    benches,
    bench_normalization,
    bench_min_max,
    bench_rolling_mean,
    bench_rolling_std,
    bench_ema,
    bench_mean_variance
);

criterion_main!(benches);
