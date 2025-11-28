//! Real-time streaming inference with advanced features

use crate::error::{NeuralError, Result};
use crate::inference::PredictionResult;
use crate::models::NeuralModel;
#[cfg(feature = "candle")]
use candle_core::{Device, Tensor};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Configuration for streaming prediction
#[derive(Debug, Clone)]
pub struct StreamingConfig {
    /// Window size for sliding window
    pub window_size: usize,
    /// Latency target in milliseconds
    pub latency_target_ms: f64,
    /// Enable uncertainty quantification
    pub enable_uncertainty: bool,
    /// Multi-horizon prediction settings
    pub horizons: Vec<usize>,
    /// Buffer size for rate limiting
    pub buffer_size: usize,
}

impl Default for StreamingConfig {
    fn default() -> Self {
        Self {
            window_size: 100,
            latency_target_ms: 10.0,
            enable_uncertainty: true,
            horizons: vec![1, 5, 10, 24],
            buffer_size: 100,
        }
    }
}

/// Streaming predictor for real-time inference with advanced features
pub struct StreamingPredictor<M: NeuralModel> {
    model: Arc<M>,
    device: Device,
    /// Sliding window buffer
    window: Arc<RwLock<VecDeque<f64>>>,
    config: StreamingConfig,
    /// Statistics for adaptive behavior
    stats: Arc<Mutex<StreamingStats>>,
    /// Normalization parameters
    mean: Option<f64>,
    std: Option<f64>,
}

/// Statistics for streaming prediction
#[derive(Debug, Clone)]
struct StreamingStats {
    total_predictions: usize,
    total_latency_ms: f64,
    max_latency_ms: f64,
    latency_violations: usize,
}

/// Public streaming statistics summary
#[derive(Debug, Clone)]
pub struct StreamingStatsSummary {
    pub total_predictions: usize,
    pub avg_latency_ms: f64,
    pub max_latency_ms: f64,
    pub latency_violations: usize,
    pub violation_rate: f64,
}

impl<M: NeuralModel + Send + Sync> StreamingPredictor<M> {
    /// Create a new streaming predictor
    pub fn new(model: M, device: Device, window_size: usize) -> Self {
        Self::with_config(model, device, StreamingConfig {
            window_size,
            ..Default::default()
        })
    }

    /// Create with custom configuration
    pub fn with_config(model: M, device: Device, config: StreamingConfig) -> Self {
        Self {
            model: Arc::new(model),
            device,
            window: Arc::new(RwLock::new(VecDeque::with_capacity(config.window_size))),
            config,
            stats: Arc::new(Mutex::new(StreamingStats {
                total_predictions: 0,
                total_latency_ms: 0.0,
                max_latency_ms: 0.0,
                latency_violations: 0,
            })),
            mean: None,
            std: None,
        }
    }

    /// Set latency target
    pub fn with_latency_target(mut self, target_ms: f64) -> Self {
        self.config.latency_target_ms = target_ms;
        self
    }

    /// Set normalization parameters
    pub fn with_normalization(mut self, mean: f64, std: f64) -> Self {
        self.mean = Some(mean);
        self.std = Some(std);
        self
    }

    /// Enable or disable uncertainty quantification
    pub fn with_uncertainty(mut self, enable: bool) -> Self {
        self.config.enable_uncertainty = enable;
        self
    }

    /// Set prediction horizons for multi-horizon forecasting
    pub fn with_horizons(mut self, horizons: Vec<usize>) -> Self {
        self.config.horizons = horizons;
        self
    }

    /// Add a new data point and get prediction if window is full
    pub fn add_and_predict(&self, value: f64) -> Result<Option<PredictionResult>> {
        let mut window = self.window.write().unwrap();

        // Add to window
        window.push_back(value);

        // Remove old values if window is full
        while window.len() > self.config.window_size {
            window.pop_front();
        }

        // Only predict if window is full
        if window.len() == self.config.window_size {
            let input: Vec<f64> = window.iter().copied().collect();
            drop(window); // Release lock before prediction

            let result = if self.config.enable_uncertainty {
                self.predict_with_uncertainty(&input)?
            } else {
                self.predict_from_window(&input)?
            };

            // Update statistics
            self.update_stats(&result);

            Ok(Some(result))
        } else {
            Ok(None)
        }
    }

    /// Add point and predict multiple horizons
    pub fn add_and_predict_multi_horizon(
        &self,
        value: f64,
    ) -> Result<Option<Vec<PredictionResult>>> {
        let mut window = self.window.write().unwrap();

        window.push_back(value);
        while window.len() > self.config.window_size {
            window.pop_front();
        }

        if window.len() == self.config.window_size {
            let input: Vec<f64> = window.iter().copied().collect();
            drop(window);

            let results = self.predict_multi_horizon(&input)?;
            Ok(Some(results))
        } else {
            Ok(None)
        }
    }

    /// Predict from a complete window
    fn predict_from_window(&self, input: &[f64]) -> Result<PredictionResult> {
        let start = Instant::now();

        // Normalize if parameters are set
        let normalized_input = if let (Some(mean), Some(std)) = (self.mean, self.std) {
            input.iter().map(|x| (x - mean) / std).collect()
        } else {
            input.to_vec()
        };

        // Convert to tensor
        let input_tensor = Tensor::from_vec(
            normalized_input,
            (1, input.len()),
            &self.device,
        )?;

        // Forward pass
        let output = self.model.forward(&input_tensor)?;

        // Convert to Vec<f64>
        let predictions = output.to_vec2::<f64>()?;
        let mut point_forecast = predictions[0].clone();

        // Denormalize if needed
        if let (Some(mean), Some(std)) = (self.mean, self.std) {
            point_forecast = point_forecast
                .iter()
                .map(|x| x * std + mean)
                .collect();
        }

        let inference_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        // Warn if latency target is exceeded
        if inference_time_ms > self.config.latency_target_ms {
            let mut stats = self.stats.lock().unwrap();
            stats.latency_violations += 1;
            warn!(
                "Inference time ({:.2}ms) exceeded target ({:.2}ms) [violations: {}]",
                inference_time_ms, self.config.latency_target_ms, stats.latency_violations
            );
        }

        Ok(PredictionResult::new(point_forecast, inference_time_ms))
    }

    /// Predict with uncertainty quantification
    fn predict_with_uncertainty(&self, input: &[f64]) -> Result<PredictionResult> {
        let start = Instant::now();

        // Get base prediction
        let mut result = self.predict_from_window(input)?;

        // Estimate uncertainty from recent volatility
        let uncertainty_scores = self.estimate_uncertainty(input);

        // Calculate confidence (inverse of mean uncertainty)
        let confidence = 1.0 - (uncertainty_scores.iter().sum::<f64>() / uncertainty_scores.len() as f64);

        result.uncertainty_scores = Some(uncertainty_scores);
        result.confidence = Some(confidence);
        result.inference_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        debug!("Streaming prediction with uncertainty: confidence={:.2}%", confidence * 100.0);

        Ok(result)
    }

    /// Predict multiple horizons from current window
    fn predict_multi_horizon(&self, input: &[f64]) -> Result<Vec<PredictionResult>> {
        let start = Instant::now();
        let mut results = Vec::with_capacity(self.config.horizons.len());

        for &horizon in &self.config.horizons {
            let mut result = self.predict_from_window(input)?;

            // Adjust forecast to match horizon
            if result.point_forecast.len() > horizon {
                result.point_forecast.truncate(horizon);
            } else if result.point_forecast.len() < horizon {
                // Extrapolate linearly
                let last_val = *result.point_forecast.last().unwrap_or(&0.0);
                result.point_forecast.resize(horizon, last_val);
            }

            results.push(result);
        }

        debug!("Multi-horizon prediction completed in {:.2}ms for {} horizons",
               start.elapsed().as_secs_f64() * 1000.0,
               self.config.horizons.len());

        Ok(results)
    }

    /// Estimate uncertainty from input volatility
    fn estimate_uncertainty(&self, input: &[f64]) -> Vec<f64> {
        // Calculate rolling volatility
        let window_size = 10.min(input.len());
        let mut uncertainties = Vec::with_capacity(window_size);

        for i in 0..window_size {
            let start_idx = if i >= window_size { i - window_size } else { 0 };
            let window = &input[start_idx..=i];

            let mean = window.iter().sum::<f64>() / window.len() as f64;
            let variance = window.iter()
                .map(|x| (x - mean).powi(2))
                .sum::<f64>() / window.len() as f64;

            let volatility = variance.sqrt();
            let normalized_uncertainty = (volatility / mean.abs()).min(1.0);

            uncertainties.push(normalized_uncertainty);
        }

        uncertainties
    }

    /// Update statistics
    fn update_stats(&self, result: &PredictionResult) {
        let mut stats = self.stats.lock().unwrap();
        stats.total_predictions += 1;
        stats.total_latency_ms += result.inference_time_ms;
        stats.max_latency_ms = stats.max_latency_ms.max(result.inference_time_ms);
    }

    /// Get streaming statistics
    pub fn get_stats(&self) -> StreamingStatsSummary {
        let stats = self.stats.lock().unwrap();
        StreamingStatsSummary {
            total_predictions: stats.total_predictions,
            avg_latency_ms: if stats.total_predictions > 0 {
                stats.total_latency_ms / stats.total_predictions as f64
            } else {
                0.0
            },
            max_latency_ms: stats.max_latency_ms,
            latency_violations: stats.latency_violations,
            violation_rate: if stats.total_predictions > 0 {
                stats.latency_violations as f64 / stats.total_predictions as f64
            } else {
                0.0
            },
        }
    }

    /// Reset statistics
    pub fn reset_stats(&self) {
        let mut stats = self.stats.lock().unwrap();
        *stats = StreamingStats {
            total_predictions: 0,
            total_latency_ms: 0.0,
            max_latency_ms: 0.0,
            latency_violations: 0,
        };
    }

    /// Start streaming prediction loop
    pub async fn start_stream(
        self: Arc<Self>,
        mut input_rx: mpsc::Receiver<f64>,
        output_tx: mpsc::Sender<PredictionResult>,
    ) -> Result<()> {
        debug!("Starting streaming prediction loop");

        while let Some(value) = input_rx.recv().await {
            if let Some(result) = self.add_and_predict(value)? {
                if output_tx.send(result).await.is_err() {
                    warn!("Output channel closed, stopping stream");
                    break;
                }
            }
        }

        debug!("Streaming prediction loop terminated");
        Ok(())
    }

    /// Get current window size
    pub fn window_len(&self) -> usize {
        self.window.read().unwrap().len()
    }

    /// Clear the window
    pub fn clear_window(&self) {
        self.window.write().unwrap().clear();
    }
}

/// Multi-model ensemble streaming predictor
pub struct EnsembleStreamingPredictor<M: NeuralModel> {
    predictors: Vec<Arc<StreamingPredictor<M>>>,
    weights: Vec<f64>,
}

impl<M: NeuralModel + Send + Sync> EnsembleStreamingPredictor<M> {
    /// Create ensemble from multiple models
    pub fn new(
        models: Vec<M>,
        device: Device,
        window_size: usize,
        weights: Option<Vec<f64>>,
    ) -> Self {
        let num_models = models.len();
        let weights = weights.unwrap_or_else(|| vec![1.0 / num_models as f64; num_models]);

        let predictors = models
            .into_iter()
            .map(|model| Arc::new(StreamingPredictor::new(model, device.clone(), window_size)))
            .collect();

        Self { predictors, weights }
    }

    /// Add data point and get ensemble prediction
    pub fn add_and_predict(&self, value: f64) -> Result<Option<PredictionResult>> {
        let predictions: Vec<_> = self
            .predictors
            .iter()
            .filter_map(|predictor| predictor.add_and_predict(value).ok().flatten())
            .collect();

        if predictions.is_empty() {
            return Ok(None);
        }

        // Weighted ensemble
        let point_forecast = self.ensemble_predictions(&predictions)?;

        // Average inference time
        let avg_inference_time = predictions
            .iter()
            .map(|p| p.inference_time_ms)
            .sum::<f64>() / predictions.len() as f64;

        Ok(Some(PredictionResult {
            point_forecast,
            prediction_intervals: None,
            inference_time_ms: avg_inference_time,
        }))
    }

    /// Compute weighted ensemble prediction
    fn ensemble_predictions(&self, predictions: &[PredictionResult]) -> Result<Vec<f64>> {
        if predictions.is_empty() {
            return Err(NeuralError::inference("No predictions to ensemble"));
        }

        let horizon = predictions[0].point_forecast.len();
        let mut result = vec![0.0; horizon];

        for (pred, &weight) in predictions.iter().zip(&self.weights) {
            for (i, &val) in pred.point_forecast.iter().enumerate() {
                result[i] += val * weight;
            }
        }

        Ok(result)
    }
}

/// Adaptive streaming predictor that adjusts to data patterns
pub struct AdaptiveStreamingPredictor<M: NeuralModel> {
    base_predictor: Arc<StreamingPredictor<M>>,
    /// Moving average of recent values for trend detection
    moving_avg: VecDeque<f64>,
    moving_avg_window: usize,
    /// Volatility estimate
    volatility: f64,
}

impl<M: NeuralModel + Send + Sync> AdaptiveStreamingPredictor<M> {
    pub fn new(model: M, device: Device, window_size: usize) -> Self {
        Self {
            base_predictor: Arc::new(StreamingPredictor::new(model, device, window_size)),
            moving_avg: VecDeque::with_capacity(20),
            moving_avg_window: 20,
            volatility: 0.0,
        }
    }

    /// Add value and update adaptive statistics
    pub fn add_and_predict(&mut self, value: f64) -> Result<Option<PredictionResult>> {
        // Update moving average
        self.moving_avg.push_back(value);
        if self.moving_avg.len() > self.moving_avg_window {
            self.moving_avg.pop_front();
        }

        // Update volatility estimate
        if self.moving_avg.len() >= 2 {
            let mean = self.moving_avg.iter().sum::<f64>() / self.moving_avg.len() as f64;
            let variance = self.moving_avg
                .iter()
                .map(|x| (x - mean).powi(2))
                .sum::<f64>() / self.moving_avg.len() as f64;
            self.volatility = variance.sqrt();
        }

        // Get base prediction
        let mut result = self.base_predictor.add_and_predict(value)?;

        // Adjust prediction based on recent volatility
        if let Some(ref mut pred) = result {
            pred.point_forecast = pred
                .point_forecast
                .iter()
                .map(|&x| x * (1.0 + self.volatility * 0.1))
                .collect();
        }

        Ok(result)
    }

    /// Get current volatility estimate
    pub fn volatility(&self) -> f64 {
        self.volatility
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_streaming_window() {
        // Mock test for window management
        let window_size = 100;
        let mut window = VecDeque::with_capacity(window_size);

        for i in 0..150 {
            window.push_back(i as f64);
            while window.len() > window_size {
                window.pop_front();
            }
        }

        assert_eq!(window.len(), window_size);
        assert_eq!(window.front(), Some(&50.0));
        assert_eq!(window.back(), Some(&149.0));
    }
}
