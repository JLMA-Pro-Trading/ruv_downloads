use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use intrinsic_dim::{Estimator, EstimationMethod};

fn benchmark_methods(c: &mut Criterion) {
    let mut group = c.benchmark_group("estimation_methods");

    // Test different data sizes
    let sizes = vec![(100, 10, 50), (500, 20, 100), (1000, 30, 200)];

    for (n_samples, intrinsic, ambient) in sizes {
        let data = intrinsic_dim::utils::generate_synthetic_data(
            n_samples,
            intrinsic,
            ambient,
            0.01,
        );

        // Benchmark each method
        group.bench_with_input(
            BenchmarkId::new("PCA", format!("{}x{}", n_samples, ambient)),
            &data,
            |b, data| {
                let estimator = Estimator::with_method(EstimationMethod::PCA);
                b.iter(|| {
                    estimator.estimate(black_box(data))
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("MLE", format!("{}x{}", n_samples, ambient)),
            &data,
            |b, data| {
                let estimator = Estimator::with_method(EstimationMethod::MLE);
                b.iter(|| {
                    estimator.estimate(black_box(data))
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("TwoNN", format!("{}x{}", n_samples, ambient)),
            &data,
            |b, data| {
                let estimator = Estimator::with_method(EstimationMethod::TwoNN);
                b.iter(|| {
                    estimator.estimate(black_box(data))
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("Fourier", format!("{}x{}", n_samples, ambient)),
            &data,
            |b, data| {
                let estimator = Estimator::with_method(EstimationMethod::FourierEmergence);
                b.iter(|| {
                    estimator.estimate(black_box(data))
                });
            },
        );
    }

    group.finish();
}

fn benchmark_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("data_scaling");

    // Test how performance scales with data size
    let sample_sizes = vec![100, 500, 1000, 5000];

    for n_samples in sample_sizes {
        let data = intrinsic_dim::utils::generate_synthetic_data(
            n_samples,
            10,
            100,
            0.01,
        );

        group.bench_with_input(
            BenchmarkId::new("Fourier_scaling", n_samples),
            &data,
            |b, data| {
                let estimator = Estimator::new();
                b.iter(|| {
                    estimator.estimate(black_box(data))
                });
            },
        );
    }

    group.finish();
}

fn benchmark_fast_estimation(c: &mut Criterion) {
    let mut group = c.benchmark_group("fast_estimation");

    // Large dataset
    let data = intrinsic_dim::utils::generate_synthetic_data(
        10000,
        20,
        200,
        0.01,
    );

    group.bench_function("full_10000", |b| {
        let estimator = Estimator::new();
        b.iter(|| {
            estimator.estimate(black_box(&data))
        });
    });

    group.bench_function("fast_1000", |b| {
        let estimator = Estimator::new();
        b.iter(|| {
            estimator.estimate_fast(black_box(&data), 1000)
        });
    });

    group.bench_function("fast_500", |b| {
        let estimator = Estimator::new();
        b.iter(|| {
            estimator.estimate_fast(black_box(&data), 500)
        });
    });

    group.finish();
}

fn benchmark_high_dimensions(c: &mut Criterion) {
    let mut group = c.benchmark_group("high_dimensions");

    // Test with very high dimensional data (like real embeddings)
    let dimensions = vec![512, 768, 1024, 2048];

    for dim in dimensions {
        let data = intrinsic_dim::utils::generate_synthetic_data(
            200,
            30,  // Typical intrinsic dimension
            dim,
            0.01,
        );

        group.bench_with_input(
            BenchmarkId::new("Fourier_highdim", dim),
            &data,
            |b, data| {
                let estimator = Estimator::new();
                b.iter(|| {
                    estimator.estimate(black_box(data))
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_methods,
    benchmark_scaling,
    benchmark_fast_estimation,
    benchmark_high_dimensions
);
criterion_main!(benches);