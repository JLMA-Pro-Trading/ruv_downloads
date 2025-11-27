use crate::{Estimator, EstimationMethod};
use std::time::Instant;

pub struct BenchmarkResult {
    pub method: String,
    pub time_ms: f64,
    pub estimated_dim: usize,
    pub true_dim: usize,
    pub error: f64,
}

/// Benchmark all methods on synthetic data
pub fn benchmark_all_methods(
    n_samples: usize,
    true_dim: usize,
    ambient_dim: usize,
) -> Vec<BenchmarkResult> {
    let data = crate::utils::generate_synthetic_data(
        n_samples,
        true_dim,
        ambient_dim,
        0.01,
    );

    let methods = vec![
        EstimationMethod::PCA,
        EstimationMethod::MLE,
        EstimationMethod::TwoNN,
        EstimationMethod::FourierEmergence,
    ];

    let mut results = Vec::new();

    for method in methods {
        let estimator = Estimator::with_method(method);
        let start = Instant::now();

        match estimator.estimate(&data) {
            Ok(result) => {
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                let error = ((result.intrinsic_dim as i32 - true_dim as i32).abs() as f64)
                    / true_dim as f64 * 100.0;

                results.push(BenchmarkResult {
                    method: format!("{:?}", method),
                    time_ms: elapsed,
                    estimated_dim: result.intrinsic_dim,
                    true_dim,
                    error,
                });
            }
            Err(e) => {
                eprintln!("Method {:?} failed: {}", method, e);
            }
        }
    }

    results
}

/// Benchmark scaling with data size
pub fn benchmark_scaling(
    true_dim: usize,
    ambient_dim: usize,
) -> Vec<(usize, Vec<BenchmarkResult>)> {
    let sample_sizes = vec![100, 500, 1000, 5000, 10000];
    let mut all_results = Vec::new();

    for n_samples in sample_sizes {
        println!("Benchmarking with {} samples...", n_samples);
        let results = benchmark_all_methods(n_samples, true_dim, ambient_dim);
        all_results.push((n_samples, results));
    }

    all_results
}

/// Print benchmark results in a nice table
pub fn print_results(results: &[BenchmarkResult]) {
    println!("\n{:-<60}", "");
    println!("| {:15} | {:8} | {:8} | {:8} | {:8} |",
             "Method", "Time(ms)", "Estimate", "True", "Error(%)");
    println!("{:-<60}", "");

    for result in results {
        println!("| {:15} | {:8.2} | {:8} | {:8} | {:8.1} |",
                 result.method,
                 result.time_ms,
                 result.estimated_dim,
                 result.true_dim,
                 result.error);
    }
    println!("{:-<60}", "");
}