//! Benchmarks for calibration performance
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use neural_trader_predictor::{SplitConformalPredictor, AbsoluteScore};

fn benchmark_calibration(c: &mut Criterion) {
    c.bench_function("calibration_100", |b| {
        b.iter(|| {
            let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

            let mut predictions = Vec::new();
            let mut actuals = Vec::new();
            for i in 0..100 {
                predictions.push(100.0 + (i as f64 % 10.0) - 5.0);
                actuals.push(100.0 + ((i as f64 + 1.0) % 10.0) - 5.0);
            }

            let _ = black_box(predictor.calibrate(&predictions, &actuals));
        });
    });

    c.bench_function("calibration_1000", |b| {
        b.iter(|| {
            let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

            let mut predictions = Vec::new();
            let mut actuals = Vec::new();
            for i in 0..1000 {
                predictions.push(100.0 + (i as f64 % 10.0) - 5.0);
                actuals.push(100.0 + ((i as f64 + 1.0) % 10.0) - 5.0);
            }

            let _ = black_box(predictor.calibrate(&predictions, &actuals));
        });
    });
}

criterion_group!(benches, benchmark_calibration);
criterion_main!(benches);
