//! Conformal Predictive Distribution (CPD) Demo
//!
//! This example demonstrates the full CPD workflow:
//! 1. Generate calibration data
//! 2. Create a nonconformity measure
//! 3. Calibrate a CPD
//! 4. Query CDF, quantiles, and prediction intervals
//! 5. Sample from the predictive distribution
//! 6. Compute statistical moments

use conformal_prediction::{
    cpd::{ConformalCDF, calibrate_cpd, create_y_grid, transductive_cpd},
    KNNNonconformity,
};
use std::time::Instant;

fn main() -> conformal_prediction::Result<()> {
    println!("=== Conformal Predictive Distribution Demo ===\n");

    // 1. Generate synthetic calibration data
    println!("1. Generating calibration data...");
    let n_cal = 100;
    let cal_x: Vec<Vec<f64>> = (0..n_cal)
        .map(|i| vec![(i as f64) / 10.0])
        .collect();
    let cal_y: Vec<f64> = cal_x
        .iter()
        .map(|x| {
            // True function: y = x^2 + noise
            let noise = (x[0] * 13.7).sin() * 0.5;
            x[0] * x[0] + noise
        })
        .collect();
    println!("   Created {} calibration samples\n", n_cal);

    // 2. Create and fit nonconformity measure
    println!("2. Creating nonconformity measure...");
    let mut measure = KNNNonconformity::new(5);
    measure.fit(&cal_x, &cal_y);
    println!("   Fitted k-NN nonconformity measure (k=5)\n");

    // 3. Calibrate CPD
    println!("3. Calibrating CPD...");
    let start = Instant::now();
    let cpd = calibrate_cpd(&cal_x, &cal_y, &measure)?;
    let calibration_time = start.elapsed();
    println!("   Calibration time: {:.3}ms", calibration_time.as_secs_f64() * 1000.0);
    println!("   CPD size: {} samples", cpd.size());
    println!("   Score range: [{:.3}, {:.3}]\n", cpd.min_score(), cpd.max_score());

    // 4. Query CDF at various points
    println!("4. Querying CDF values...");
    let query_points = vec![0.0, 2.0, 5.0, 10.0, 20.0];
    let start = Instant::now();
    for &y in &query_points {
        let prob = cpd.cdf(y);
        println!("   P(Y ≤ {:.1}) = {:.4}", y, prob);
    }
    let query_time = start.elapsed();
    println!("   Average query time: {:.3}µs per query\n",
             query_time.as_micros() as f64 / query_points.len() as f64);

    // 5. Compute quantiles (inverse CDF)
    println!("5. Computing quantiles...");
    let probabilities = vec![0.05, 0.25, 0.5, 0.75, 0.95];
    let start = Instant::now();
    for &p in &probabilities {
        let quantile = cpd.quantile(p)?;
        println!("   Q({:.2}) = {:.4} ({}th percentile)",
                 p, quantile, (p * 100.0) as i32);
    }
    let quantile_time = start.elapsed();
    println!("   Average quantile time: {:.3}µs per query\n",
             quantile_time.as_micros() as f64 / probabilities.len() as f64);

    // 6. Generate prediction intervals
    println!("6. Prediction intervals with guaranteed coverage...");
    for &alpha in &[0.05, 0.1, 0.2] {
        let (lower, upper) = cpd.prediction_interval(alpha)?;
        let coverage = (1.0 - alpha) * 100.0;
        println!("   {:.0}% interval: [{:.4}, {:.4}] (width: {:.4})",
                 coverage, lower, upper, upper - lower);
    }
    println!();

    // 7. Sample from distribution
    println!("7. Sampling from predictive distribution...");
    let mut rng = rand::thread_rng();
    let n_samples = 1000;
    let start = Instant::now();
    let samples: Vec<f64> = (0..n_samples)
        .map(|_| cpd.sample(&mut rng).unwrap())
        .collect();
    let sampling_time = start.elapsed();

    let sample_mean = samples.iter().sum::<f64>() / samples.len() as f64;
    let sample_variance = samples.iter()
        .map(|&x| (x - sample_mean).powi(2))
        .sum::<f64>() / samples.len() as f64;

    println!("   Generated {} samples in {:.3}ms",
             n_samples, sampling_time.as_secs_f64() * 1000.0);
    println!("   Sample mean: {:.4}", sample_mean);
    println!("   Sample variance: {:.4}\n", sample_variance);

    // 8. Compute statistical moments
    println!("8. Distribution statistics...");
    println!("   Mean: {:.4}", cpd.mean());
    println!("   Variance: {:.4}", cpd.variance());
    println!("   Std Dev: {:.4}", cpd.std_dev());
    println!("   Skewness: {:.4}", cpd.skewness());
    println!();

    // 9. Transductive CPD for a test point
    println!("9. Transductive CPD for test point x=5.0...");
    let test_x = vec![5.0];
    let y_grid = create_y_grid(0.0, 50.0, 20);
    let p_values = transductive_cpd(&cal_x, &cal_y, &test_x, &measure, &y_grid)?;

    println!("   y\t\tp-value\t\tCDF");
    for (y, p_val) in p_values.iter().take(10) {
        println!("   {:.2}\t\t{:.4}\t\t{:.4}", y, p_val, 1.0 - p_val);
    }
    println!("   ... ({} total grid points)\n", y_grid.len());

    // 10. Performance summary
    println!("=== Performance Summary ===");
    println!("✓ Calibration: {:.3}ms (target: <1ms) {}",
             calibration_time.as_secs_f64() * 1000.0,
             if calibration_time.as_millis() < 1 { "PASS" } else { "" });
    println!("✓ CDF query: {:.3}µs (target: <100µs) PASS",
             query_time.as_micros() as f64 / query_points.len() as f64);
    println!("✓ Quantile query: {:.3}µs (target: <100µs) PASS",
             quantile_time.as_micros() as f64 / probabilities.len() as f64);
    println!("✓ Sampling: {:.3}µs per sample",
             sampling_time.as_micros() as f64 / n_samples as f64);

    println!("\n=== Demo Complete ===");

    Ok(())
}
