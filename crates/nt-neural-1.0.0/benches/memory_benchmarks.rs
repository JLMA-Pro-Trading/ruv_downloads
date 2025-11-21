//! Memory usage benchmarks for CPU code optimizations

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use nt_neural::utils::{
    preprocessing::{normalize, robust_scale, difference},
    preprocessing_optimized::{
        normalize_pooled, normalize_in_place, robust_scale_optimized,
        difference_optimized, WindowPreprocessor,
    },
    memory_pool::TensorPool,
};

/// Benchmark normalization variants
fn bench_normalize_variants(c: &mut Criterion) {
    let mut group = c.benchmark_group("normalization");

    for size in [100, 1000, 10000].iter() {
        let data = vec![1.0; *size];

        group.bench_with_input(
            BenchmarkId::new("allocating", size),
            size,
            |b, _| {
                b.iter(|| {
                    let (normalized, _params) = normalize(black_box(&data));
                    black_box(normalized);
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("pooled", size),
            size,
            |b, _| {
                let pool = TensorPool::new(32);
                b.iter(|| {
                    let (normalized, _params) = normalize_pooled(black_box(&data), Some(&pool));
                    pool.return_buffer(normalized);
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("in_place", size),
            size,
            |b, _| {
                let mut data_copy = data.clone();
                b.iter(|| {
                    let _params = normalize_in_place(black_box(&mut data_copy));
                    black_box(&data_copy);
                })
            },
        );
    }

    group.finish();
}

/// Benchmark robust scaling variants
fn bench_robust_scale_variants(c: &mut Criterion) {
    let mut group = c.benchmark_group("robust_scale");

    for size in [100, 1000, 10000].iter() {
        let data = vec![1.0; *size];

        group.bench_with_input(
            BenchmarkId::new("allocating", size),
            size,
            |b, _| {
                b.iter(|| {
                    let (scaled, _, _) = robust_scale(black_box(&data));
                    black_box(scaled);
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("pooled", size),
            size,
            |b, _| {
                let pool = TensorPool::new(32);
                b.iter(|| {
                    let (scaled, _, _) = robust_scale_optimized(black_box(&data), Some(&pool));
                    black_box(scaled);
                })
            },
        );
    }

    group.finish();
}

/// Benchmark difference calculation variants
fn bench_difference_variants(c: &mut Criterion) {
    let mut group = c.benchmark_group("difference");
    let data: Vec<f64> = (0..10000).map(|x| x as f64).collect();

    group.bench_function("allocating", |b| {
        b.iter(|| {
            let diff = difference(black_box(&data), 1);
            black_box(diff);
        })
    });

    group.bench_function("pooled", |b| {
        let pool = TensorPool::new(32);
        b.iter(|| {
            let diff = difference_optimized(black_box(&data), 1, Some(&pool));
            black_box(diff);
        })
    });

    group.finish();
}

/// Benchmark window preprocessing with pooling
fn bench_window_preprocessing(c: &mut Criterion) {
    let mut group = c.benchmark_group("window_preprocessing");
    let data: Vec<f64> = (0..10000).map(|x| x as f64).collect();

    group.bench_function("without_pool", |b| {
        b.iter(|| {
            let mut windows = Vec::new();
            for i in (0..data.len() - 100).step_by(50) {
                let window = &data[i..i + 100];
                let (normalized, params) = normalize(window);
                windows.push((normalized, params));
            }
            black_box(windows);
        })
    });

    group.bench_function("with_pool", |b| {
        let processor = WindowPreprocessor::new(100, 50);
        b.iter(|| {
            let windows = processor.process_windows(black_box(&data));
            black_box(windows);
        })
    });

    group.finish();
}

/// Benchmark pool hit rates with different sizes
fn bench_pool_hit_rates(c: &mut Criterion) {
    let mut group = c.benchmark_group("pool_hit_rates");

    for pool_size in [8, 16, 32, 64].iter() {
        group.bench_with_input(
            BenchmarkId::new("pool", pool_size),
            pool_size,
            |b, &size| {
                let pool = TensorPool::new(size);
                b.iter(|| {
                    for _ in 0..100 {
                        let buffer = pool.get(1000);
                        // Simulate some work
                        black_box(&buffer);
                        pool.return_buffer(buffer);
                    }
                })
            },
        );
    }

    group.finish();
}

/// Benchmark memory allocation overhead
fn bench_allocation_overhead(c: &mut Criterion) {
    let mut group = c.benchmark_group("allocation_overhead");

    group.bench_function("vec_allocation", |b| {
        b.iter(|| {
            for _ in 0..100 {
                let buffer = vec![0.0; 1000];
                black_box(buffer);
            }
        })
    });

    group.bench_function("pool_reuse", |b| {
        let pool = TensorPool::new(32);
        b.iter(|| {
            for _ in 0..100 {
                let buffer = pool.get(1000);
                black_box(&buffer);
                pool.return_buffer(buffer);
            }
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_normalize_variants,
    bench_robust_scale_variants,
    bench_difference_variants,
    bench_window_preprocessing,
    bench_pool_hit_rates,
    bench_allocation_overhead,
);
criterion_main!(benches);
