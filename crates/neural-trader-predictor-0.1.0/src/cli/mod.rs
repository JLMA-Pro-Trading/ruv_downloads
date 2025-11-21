//! CLI interface for neural trader predictor
//!
//! Provides command-line tools for:
//! - Calibrating predictors with historical data
//! - Making predictions with guaranteed confidence intervals
//! - Streaming predictions with adaptive coverage
//! - Evaluating coverage on test data
//! - Benchmarking performance

pub mod commands;
pub mod config;

pub use commands::Commands;
pub use config::Config;
