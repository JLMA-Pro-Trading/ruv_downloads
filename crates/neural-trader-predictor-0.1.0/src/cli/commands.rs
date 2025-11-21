//! CLI command implementations
//!
//! Provides implementations for:
//! - calibrate: Calibrate predictor with historical data
//! - predict: Make predictions with confidence intervals
//! - stream: Streaming predictions with adaptive adjustment
//! - evaluate: Evaluate coverage on test data
//! - benchmark: Performance benchmarking

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[cfg(feature = "cli")]
use {
    clap::{Parser, Subcommand},
    colored::Colorize,
    indicatif::{ProgressBar, ProgressStyle},
};

/// Main CLI command structure
#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
#[command(name = "neural-predictor")]
#[command(version = crate::VERSION)]
#[command(about = "Conformal prediction CLI for neural trading", long_about = None)]
#[command(author = "Neural Trader Team")]
pub struct Cli {
    /// Configuration file (YAML or JSON)
    #[arg(short, long, global = true)]
    pub config: Option<PathBuf>,

    /// Verbosity level (can be repeated)
    #[arg(short, long, action = clap::ArgAction::Count, global = true)]
    pub verbose: u8,

    /// Disable colored output
    #[arg(long, global = true)]
    pub no_color: bool,

    #[command(subcommand)]
    pub command: Commands,
}

/// CLI subcommands
#[cfg(feature = "cli")]
#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Calibrate predictor with historical data
    Calibrate(CalibrateArgs),

    /// Make predictions with confidence intervals
    Predict(PredictArgs),

    /// Streaming predictions with adaptive adjustment
    Stream(StreamArgs),

    /// Evaluate coverage on test data
    Evaluate(EvaluateArgs),

    /// Benchmark performance
    Benchmark(BenchmarkArgs),

    /// Show configuration template
    ConfigTemplate(ConfigTemplateArgs),
}

/// Calibrate command arguments
#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
pub struct CalibrateArgs {
    /// Path to model predictor (JSON serialized)
    #[arg(short = 'm', long, value_name = "FILE")]
    pub model_path: PathBuf,

    /// Path to calibration data (CSV: prediction,actual)
    #[arg(short = 'd', long, value_name = "FILE")]
    pub calibration_data: PathBuf,

    /// Miscoverage rate (default: 0.1 for 90% coverage)
    #[arg(short = 'a', long, default_value = "0.1")]
    pub alpha: f64,

    /// Output path for calibrated predictor
    #[arg(short = 'o', long, value_name = "FILE")]
    pub output: Option<PathBuf>,

    /// Maximum calibration size
    #[arg(long, default_value = "2000")]
    pub max_calibration_size: usize,

    /// Recalibration frequency
    #[arg(long, default_value = "100")]
    pub recalibration_freq: usize,

    /// Show progress bar
    #[arg(long, default_value = "true")]
    pub progress: bool,
}

/// Predict command arguments
#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
pub struct PredictArgs {
    /// Path to calibrated predictor
    #[arg(short = 'p', long, value_name = "FILE")]
    pub predictor: PathBuf,

    /// Input features as comma-separated values
    #[arg(short = 'f', long, value_name = "FEATURES")]
    pub features: String,

    /// Output format: "json" or "csv"
    #[arg(short = 't', long, default_value = "json")]
    pub format: String,

    /// Number of decimal places
    #[arg(long, default_value = "6")]
    pub decimals: usize,

    /// Include timestamp
    #[arg(long)]
    pub timestamp: bool,

    /// Color output (if supported)
    #[arg(long)]
    pub color: bool,
}

/// Stream command arguments
#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
pub struct StreamArgs {
    /// Path to calibrated predictor
    #[arg(short = 'p', long, value_name = "FILE")]
    pub predictor: PathBuf,

    /// Input stream (file path or TCP address)
    #[arg(short = 'i', long, value_name = "STREAM")]
    pub input_stream: String,

    /// Enable adaptive coverage adjustment
    #[arg(long)]
    pub adaptive: bool,

    /// Adaptive learning rate (PID control)
    #[arg(long, default_value = "0.02")]
    pub gamma: f64,

    /// Target coverage for adaptive mode
    #[arg(long, default_value = "0.90")]
    pub target_coverage: f64,

    /// Coverage window size
    #[arg(long, default_value = "200")]
    pub coverage_window: usize,

    /// Output format
    #[arg(short = 't', long, default_value = "json")]
    pub format: String,

    /// Number of batches to process (0 = infinite)
    #[arg(long)]
    pub max_batches: Option<usize>,
}

/// Evaluate command arguments
#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
pub struct EvaluateArgs {
    /// Path to calibrated predictor
    #[arg(short = 'p', long, value_name = "FILE")]
    pub predictor: PathBuf,

    /// Path to test data (CSV: prediction,actual)
    #[arg(short = 't', long, value_name = "FILE")]
    pub test_data: PathBuf,

    /// Output format for results
    #[arg(short = 'f', long, default_value = "json")]
    pub format: String,

    /// Output file for results
    #[arg(short = 'o', long)]
    pub output: Option<PathBuf>,

    /// Show coverage statistics
    #[arg(long)]
    pub coverage: bool,

    /// Show interval width statistics
    #[arg(long)]
    pub width: bool,

    /// Show progress bar
    #[arg(long, default_value = "true")]
    pub progress: bool,
}

/// Benchmark command arguments
#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
pub struct BenchmarkArgs {
    /// Path to calibrated predictor
    #[arg(short = 'p', long, value_name = "FILE")]
    pub predictor: PathBuf,

    /// Number of iterations
    #[arg(short = 'n', long, default_value = "1000")]
    pub iterations: usize,

    /// Input data shape: num_features
    #[arg(long, default_value = "10")]
    pub features: usize,

    /// Batch size for benchmarking
    #[arg(long, default_value = "100")]
    pub batch_size: usize,

    /// Output format for results
    #[arg(short = 'f', long, default_value = "json")]
    pub format: String,

    /// Warm-up iterations
    #[arg(long, default_value = "10")]
    pub warmup: usize,

    /// Show detailed statistics
    #[arg(long)]
    pub detailed: bool,
}

/// Config template command arguments
#[cfg(feature = "cli")]
#[derive(Parser, Debug)]
pub struct ConfigTemplateArgs {
    /// Output file for template
    #[arg(short = 'o', long)]
    pub output: Option<PathBuf>,

    /// Template format: "json" or "yaml"
    #[arg(short = 'f', long, default_value = "yaml")]
    pub format: String,
}

/// Benchmark results
#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkResults {
    /// Total iterations
    pub iterations: usize,

    /// Mean time per prediction (microseconds)
    pub mean_time_us: f64,

    /// Median time per prediction (microseconds)
    pub median_time_us: f64,

    /// Std dev of times (microseconds)
    pub stddev_time_us: f64,

    /// Min time (microseconds)
    pub min_time_us: f64,

    /// Max time (microseconds)
    pub max_time_us: f64,

    /// Predictions per second
    pub predictions_per_sec: f64,

    /// Throughput (MB/s)
    pub throughput_mbps: f64,
}

/// Evaluation results
#[derive(Debug, Serialize, Deserialize)]
pub struct EvaluationResults {
    /// Number of test samples
    pub num_samples: usize,

    /// Empirical coverage (% of actual values in intervals)
    pub empirical_coverage: f64,

    /// Target coverage
    pub target_coverage: f64,

    /// Mean interval width
    pub mean_width: f64,

    /// Median interval width
    pub median_width: f64,

    /// Std dev of interval widths
    pub stddev_width: f64,

    /// Min interval width
    pub min_width: f64,

    /// Max interval width
    pub max_width: f64,

    /// Mean relative width (% of point prediction)
    pub mean_relative_width: f64,

    /// Coverage efficiency (coverage / mean_relative_width)
    pub efficiency: f64,
}

/// Prediction output
#[derive(Debug, Serialize, Deserialize)]
pub struct PredictionOutput {
    /// Point prediction
    pub point: f64,

    /// Lower bound
    pub lower: f64,

    /// Upper bound
    pub upper: f64,

    /// Interval width
    pub width: f64,

    /// Relative width (%)
    pub relative_width: f64,

    /// Expected coverage
    pub coverage: f64,

    /// Timestamp (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

// Print helpers for different output formats
#[cfg(feature = "cli")]
pub mod formatters {
    use super::*;

    /// Create a progress bar with standard style
    pub fn create_progress_bar(total: u64, msg: &str) -> ProgressBar {
        let bar = ProgressBar::new(total);
        bar.set_style(
            ProgressStyle::default_bar()
                .template("{msg} {bar:40.cyan/blue} {pos}/{len} ({eta})")
                .unwrap()
                .progress_chars("=>-"),
        );
        bar.set_message(msg.to_string());
        bar
    }

    /// Format number with specified decimal places
    pub fn format_number(value: f64, decimals: usize) -> String {
        format!("{:.prec$}", value, prec = decimals)
    }

    /// Format output value
    pub fn format_value(label: &str, value: f64, use_color: bool) -> String {
        let formatted = format!("{}: {:.6}", label, value);
        if use_color {
            formatted.cyan().to_string()
        } else {
            formatted
        }
    }

    /// Format success message
    pub fn success(msg: &str) -> String {
        msg.green().to_string()
    }

    /// Format error message
    pub fn error(msg: &str) -> String {
        msg.red().to_string()
    }

    /// Format warning message
    pub fn warning(msg: &str) -> String {
        msg.yellow().to_string()
    }

    /// Format info message
    pub fn info(msg: &str) -> String {
        msg.cyan().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_results_serialization() {
        let results = BenchmarkResults {
            iterations: 1000,
            mean_time_us: 100.5,
            median_time_us: 95.0,
            stddev_time_us: 20.0,
            min_time_us: 50.0,
            max_time_us: 500.0,
            predictions_per_sec: 10000.0,
            throughput_mbps: 50.0,
        };

        let json = serde_json::to_string(&results).unwrap();
        let parsed: BenchmarkResults = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.iterations, 1000);
        assert_eq!(parsed.mean_time_us, 100.5);
    }

    #[test]
    fn test_evaluation_results_serialization() {
        let results = EvaluationResults {
            num_samples: 100,
            empirical_coverage: 0.92,
            target_coverage: 0.90,
            mean_width: 10.0,
            median_width: 9.5,
            stddev_width: 2.0,
            min_width: 5.0,
            max_width: 20.0,
            mean_relative_width: 5.0,
            efficiency: 18.4,
        };

        let json = serde_json::to_string(&results).unwrap();
        let parsed: EvaluationResults = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.num_samples, 100);
        assert_eq!(parsed.empirical_coverage, 0.92);
    }

    #[test]
    fn test_prediction_output_serialization() {
        let output = PredictionOutput {
            point: 100.0,
            lower: 95.0,
            upper: 105.0,
            width: 10.0,
            relative_width: 10.0,
            coverage: 0.9,
            timestamp: Some("2024-01-01T00:00:00Z".to_string()),
        };

        let json = serde_json::to_string(&output).unwrap();
        let parsed: PredictionOutput = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.point, 100.0);
        assert_eq!(parsed.width, 10.0);
    }
}
