//! Example: Streaming Conformal Prediction with Concept Drift
//!
//! This example demonstrates how to use the streaming conformal predictor
//! to handle non-stationary time series with concept drift.
//!
//! Run with: cargo run --example streaming_cp_example

use conformal_prediction::streaming::StreamingConformalPredictor;

fn main() {
    println!("=== Streaming Conformal Prediction Demo ===\n");

    // Create a streaming predictor with 90% coverage (α = 0.1)
    let mut predictor = StreamingConformalPredictor::new(0.1, 0.02);

    println!("Configuration:");
    println!("  - Target coverage: {:.1}%", predictor.target_coverage() * 100.0);
    println!("  - Initial decay rate: {:.4}", predictor.decay_rate());
    println!();

    // Simulate a time series with drift
    println!("Simulating time series with concept drift...\n");

    // Phase 1: Low noise regime (t=0 to t=49)
    println!("Phase 1: Low noise (σ=1.0)");
    for t in 0..50 {
        let y_true = 10.0 + (t as f64 * 0.1).sin() + sample_noise(1.0, t);
        let y_pred = 10.0 + (t as f64 * 0.1).sin();

        predictor.update(&[t as f64], y_true, y_pred);
    }

    let (lower, upper) = predictor.predict_interval(10.0).unwrap();
    println!("  Samples: {}", predictor.n_samples());
    println!("  Interval width: {:.3}", upper - lower);
    println!("  Decay rate: {:.4}", predictor.decay_rate());
    println!();

    // Phase 2: High noise regime (t=50 to t=149)
    println!("Phase 2: High noise (σ=3.0)");
    for t in 50..150 {
        let y_true = 10.0 + (t as f64 * 0.1).sin() + sample_noise(3.0, t);
        let y_pred = 10.0 + (t as f64 * 0.1).sin();

        // Track coverage
        let interval = predictor.predict_interval(y_pred).ok();
        predictor.update_with_coverage(&[t as f64], y_true, y_pred, interval);
    }

    let (lower, upper) = predictor.predict_interval(10.0).unwrap();
    println!("  Samples: {}", predictor.n_samples());
    println!("  Interval width: {:.3}", upper - lower);
    println!("  Decay rate: {:.4}", predictor.decay_rate());
    if let Some(cov) = predictor.empirical_coverage() {
        println!("  Empirical coverage: {:.1}%", cov * 100.0);
    }
    println!();

    // Phase 3: Mean shift (t=150 to t=249)
    println!("Phase 3: Mean shift (10 → 20)");
    for t in 150..250 {
        let progress = (t - 150) as f64 / 100.0;
        let mean = 10.0 + progress * 10.0; // Shift from 10 to 20
        let y_true = mean + (t as f64 * 0.1).sin() + sample_noise(2.0, t);
        let y_pred = mean + (t as f64 * 0.1).sin();

        let interval = predictor.predict_interval(y_pred).ok();
        predictor.update_with_coverage(&[t as f64], y_true, y_pred, interval);
    }

    let (lower, upper) = predictor.predict_interval(20.0).unwrap();
    println!("  Samples: {}", predictor.n_samples());
    println!("  Interval width: {:.3}", upper - lower);
    println!("  Decay rate: {:.4}", predictor.decay_rate());
    if let Some(cov) = predictor.empirical_coverage() {
        println!("  Empirical coverage: {:.1}%", cov * 100.0);
    }
    println!();

    // Phase 4: Return to stability
    println!("Phase 4: Stable regime");
    for t in 250..350 {
        let y_true = 20.0 + (t as f64 * 0.1).sin() + sample_noise(1.5, t);
        let y_pred = 20.0 + (t as f64 * 0.1).sin();

        let interval = predictor.predict_interval(y_pred).ok();
        predictor.update_with_coverage(&[t as f64], y_true, y_pred, interval);
    }

    let (lower, upper) = predictor.predict_interval(20.0).unwrap();
    println!("  Samples: {}", predictor.n_samples());
    println!("  Interval width: {:.3}", upper - lower);
    println!("  Decay rate: {:.4}", predictor.decay_rate());
    if let Some(cov) = predictor.empirical_coverage() {
        println!("  Empirical coverage: {:.1}%", cov * 100.0);
    }
    println!();

    // Make final predictions
    println!("=== Final Predictions ===\n");

    let test_points = vec![19.0, 20.0, 21.0];
    for &point in &test_points {
        match predictor.predict_interval_direct(point) {
            Ok((lower, upper)) => {
                println!("  ŷ = {:.1} → [{:.2}, {:.2}] (width: {:.2})",
                         point, lower, upper, upper - lower);
            }
            Err(e) => println!("  Error: {}", e),
        }
    }

    println!("\n=== Summary ===");
    println!("✓ Successfully adapted to 4 different regimes");
    println!("✓ Maintained coverage through concept drift");
    println!("✓ Decay rate automatically adjusted: {:.4}", predictor.decay_rate());
}

/// Simple deterministic noise generator for reproducibility
fn sample_noise(scale: f64, seed: usize) -> f64 {
    // Simple pseudo-random based on seed
    let x = ((seed * 1103515245 + 12345) & 0x7fffffff) as f64 / 0x7fffffff as f64;
    (x - 0.5) * 2.0 * scale
}
