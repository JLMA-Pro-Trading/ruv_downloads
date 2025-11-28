//! Inference engine for neural models with <10ms latency
//!
//! This module provides comprehensive prediction pipelines:
//! - Single predictions with <10ms latency
//! - Batch processing for high throughput
//! - Real-time streaming inference
//! - Quantile predictions for uncertainty estimation
//! - Multi-horizon forecasting
//! - Model ensembling with multiple strategies
//! - SIMD optimizations and memory pooling
//! - GPU acceleration (CUDA)

#[cfg(feature = "candle")]
pub mod predictor;
#[cfg(feature = "candle")]
pub mod batch;
#[cfg(feature = "candle")]
pub mod streaming;

use serde::{Deserialize, Serialize};

// Re-export main types when candle is enabled
#[cfg(feature = "candle")]
pub use predictor::{
    EnsemblePredictor, EnsembleStrategy, FastPredictor, Predictor, PredictionResult,
};

#[cfg(feature = "candle")]
pub use batch::{
    BatchConfig, BatchPredictor, BatchStats, EnsembleBatchPredictor, StreamingBatchProcessor,
};

#[cfg(feature = "candle")]
pub use streaming::{
    AdaptiveStreamingPredictor, EnsembleStreamingPredictor, StreamingConfig, StreamingPredictor,
    StreamingStatsSummary,
};

#[cfg(all(feature = "candle", feature = "cuda"))]
pub use batch::GpuBatchPredictor;

// Stub prediction result for when candle is not available
#[cfg(not(feature = "candle"))]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionResult {
    pub point_forecast: Vec<f64>,
    #[allow(clippy::type_complexity)]
    pub prediction_intervals: Option<Vec<(f64, Vec<f64>, Vec<f64>)>>,
    pub inference_time_ms: f64,
    pub uncertainty_scores: Option<Vec<f64>>,
    pub confidence: Option<f64>,
}
