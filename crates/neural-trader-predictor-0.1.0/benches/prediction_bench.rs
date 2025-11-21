//! Benchmarks for prediction latency
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use neural_trader_predictor::{SplitConformalPredictor, AbsoluteScore};

fn benchmark_prediction(c: &mut Criterion) {
    let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

    // Calibration data
    let mut predictions = Vec::new();
    let mut actuals = Vec::new();
    for i in 0..1000 {
        predictions.push(100.0 + (i as f64 % 10.0) - 5.0);
        actuals.push(100.0 + ((i as f64 + 1.0) % 10.0) - 5.0);
    }

    predictor.calibrate(&predictions, &actuals).unwrap();

    c.bench_function("predict_latency", |b| {
        b.iter(|| {
            let _ = black_box(predictor.predict(100.0));
        });
    });
}

criterion_group!(benches, benchmark_prediction);
criterion_main!(benches);
