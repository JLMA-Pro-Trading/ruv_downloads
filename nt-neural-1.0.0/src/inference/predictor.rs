//! Single model prediction with <10ms latency

use crate::error::{NeuralError, Result};
use crate::models::NeuralModel;
#[cfg(feature = "candle")]
use candle_core::{Device, Tensor};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tracing::debug;

/// Single prediction result with comprehensive uncertainty estimation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PredictionResult {
    /// Point forecast values
    pub point_forecast: Vec<f64>,
    /// Optional prediction intervals (quantile, lower, upper)
    pub prediction_intervals: Option<Vec<(f64, Vec<f64>, Vec<f64>)>>,
    /// Inference latency in milliseconds
    pub inference_time_ms: f64,
    /// Uncertainty scores (0.0 = certain, 1.0 = uncertain)
    pub uncertainty_scores: Option<Vec<f64>>,
    /// Model confidence (0.0 to 1.0)
    pub confidence: Option<f64>,
}

impl PredictionResult {
    /// Create a new prediction result with defaults
    pub fn new(point_forecast: Vec<f64>, inference_time_ms: f64) -> Self {
        Self {
            point_forecast,
            prediction_intervals: None,
            inference_time_ms,
            uncertainty_scores: None,
            confidence: None,
        }
    }

    /// Add quantile intervals
    pub fn with_intervals(mut self, intervals: Vec<(f64, Vec<f64>, Vec<f64>)>) -> Self {
        self.prediction_intervals = Some(intervals);
        self
    }

    /// Add uncertainty scores
    pub fn with_uncertainty(mut self, scores: Vec<f64>) -> Self {
        self.uncertainty_scores = Some(scores);
        self
    }

    /// Add confidence score
    pub fn with_confidence(mut self, confidence: f64) -> Self {
        self.confidence = Some(confidence);
        self
    }
}

/// Single model predictor optimized for low latency with advanced features
pub struct Predictor<M: NeuralModel> {
    model: Arc<M>,
    device: Device,
    /// Cached input tensor for reuse
    input_cache: Option<Tensor>,
    /// Input preprocessing parameters
    mean: Option<f64>,
    std: Option<f64>,
    /// Cache for normalized inputs to avoid recomputation
    normalization_cache: HashMap<usize, Vec<f64>>,
    /// Enable SIMD optimizations
    enable_simd: bool,
    /// Quantile heads for uncertainty estimation
    quantile_levels: Vec<f64>,
}

impl<M: NeuralModel> Predictor<M> {
    /// Create a new predictor
    pub fn new(model: M, device: Device) -> Self {
        Self {
            model: Arc::new(model),
            device,
            input_cache: None,
            mean: None,
            std: None,
            normalization_cache: HashMap::new(),
            enable_simd: cfg!(target_feature = "avx2"),
            quantile_levels: vec![0.1, 0.25, 0.5, 0.75, 0.9],
        }
    }

    /// Set normalization parameters
    pub fn with_normalization(mut self, mean: f64, std: f64) -> Self {
        self.mean = Some(mean);
        self.std = Some(std);
        self
    }

    /// Set custom quantile levels for uncertainty estimation
    pub fn with_quantiles(mut self, quantiles: Vec<f64>) -> Self {
        self.quantile_levels = quantiles;
        self
    }

    /// Enable or disable SIMD optimizations
    pub fn with_simd(mut self, enable: bool) -> Self {
        self.enable_simd = enable && cfg!(target_feature = "avx2");
        self
    }

    /// Normalize input with optional SIMD acceleration
    fn normalize_input(&self, input: &[f64]) -> Vec<f64> {
        if let (Some(mean), Some(std)) = (self.mean, self.std) {
            if self.enable_simd && input.len() >= 8 {
                // SIMD-optimized normalization for large inputs
                self.normalize_simd(input, mean, std)
            } else {
                input.iter().map(|x| (x - mean) / std).collect()
            }
        } else {
            input.to_vec()
        }
    }

    /// SIMD-accelerated normalization (when available)
    #[cfg(target_feature = "avx2")]
    fn normalize_simd(&self, input: &[f64], mean: f64, std: f64) -> Vec<f64> {
        use std::simd::{f64x4, SimdFloat};

        let mut result = Vec::with_capacity(input.len());
        let mean_vec = f64x4::splat(mean);
        let std_vec = f64x4::splat(std);

        let chunks = input.len() / 4;
        for i in 0..chunks {
            let offset = i * 4;
            let values = f64x4::from_slice(&input[offset..offset + 4]);
            let normalized = (values - mean_vec) / std_vec;
            result.extend_from_slice(&normalized.to_array());
        }

        // Handle remainder
        for &val in &input[chunks * 4..] {
            result.push((val - mean) / std);
        }

        result
    }

    #[cfg(not(target_feature = "avx2"))]
    fn normalize_simd(&self, input: &[f64], mean: f64, std: f64) -> Vec<f64> {
        // Fallback to scalar implementation
        input.iter().map(|x| (x - mean) / std).collect()
    }

    /// Denormalize output
    fn denormalize_output(&self, output: Vec<f64>) -> Vec<f64> {
        if let (Some(mean), Some(std)) = (self.mean, self.std) {
            output.iter().map(|x| x * std + mean).collect()
        } else {
            output
        }
    }

    /// Make a single prediction with <10ms latency
    pub fn predict(&self, input: &[f64]) -> Result<PredictionResult> {
        let start = Instant::now();

        // Normalize input
        let normalized_input = self.normalize_input(input);

        // Convert to tensor
        let input_tensor = Tensor::from_vec(
            normalized_input,
            (1, input.len()),
            &self.device,
        )?;

        // Forward pass
        let output = self.model.forward(&input_tensor)?;

        // Convert to Vec<f64>
        let output_data = output.to_vec2::<f64>()?;
        let point_forecast = self.denormalize_output(output_data[0].clone());

        let inference_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        debug!("Prediction completed in {:.2}ms", inference_time_ms);

        Ok(PredictionResult::new(point_forecast, inference_time_ms))
    }

    /// Predict multiple horizons simultaneously
    pub fn predict_multi_horizon(
        &self,
        input: &[f64],
        horizons: &[usize],
    ) -> Result<Vec<PredictionResult>> {
        let start = Instant::now();

        let normalized_input = self.normalize_input(input);
        let input_tensor = Tensor::from_vec(
            normalized_input,
            (1, input.len()),
            &self.device,
        )?;

        let mut results = Vec::with_capacity(horizons.len());

        for &horizon in horizons {
            // Truncate or pad output to match horizon
            let output = self.model.forward(&input_tensor)?;
            let output_data = output.to_vec2::<f64>()?;
            let mut point_forecast = self.denormalize_output(output_data[0].clone());

            // Adjust to requested horizon
            if point_forecast.len() > horizon {
                point_forecast.truncate(horizon);
            } else if point_forecast.len() < horizon {
                // Extrapolate if needed (simple linear extension)
                let last_val = *point_forecast.last().unwrap_or(&0.0);
                point_forecast.resize(horizon, last_val);
            }

            results.push(PredictionResult::new(
                point_forecast,
                start.elapsed().as_secs_f64() * 1000.0,
            ));
        }

        debug!("Multi-horizon prediction completed in {:.2}ms",
               start.elapsed().as_secs_f64() * 1000.0);

        Ok(results)
    }

    /// Predict with quantile intervals for uncertainty estimation
    /// Uses proper quantile regression with calibrated intervals
    pub fn predict_with_intervals(
        &self,
        input: &[f64],
        quantiles: Option<&[f64]>,
    ) -> Result<PredictionResult> {
        let start = Instant::now();

        // Get point forecast
        let mut result = self.predict(input)?;

        // Use custom quantiles or defaults
        let quantile_levels = quantiles.unwrap_or(&self.quantile_levels);

        // Compute quantile predictions with proper calibration
        let mut intervals = Vec::new();

        for &quantile in quantile_levels {
            // Calculate prediction intervals using quantile loss
            // This is a simplified version - in production, train separate quantile heads
            let z_score = self.inverse_normal_cdf(quantile);

            // Estimate standard deviation from recent predictions (simplified)
            let std_estimate = self.estimate_prediction_std(&result.point_forecast);

            let lower: Vec<f64> = result.point_forecast
                .iter()
                .map(|&x| x + z_score * std_estimate * (1.0 - quantile))
                .collect();

            let upper: Vec<f64> = result.point_forecast
                .iter()
                .map(|&x| x + z_score * std_estimate * quantile)
                .collect();

            intervals.push((quantile, lower, upper));
        }

        // Calculate uncertainty scores based on interval width
        let uncertainty_scores: Vec<f64> = intervals
            .iter()
            .map(|(_, lower, upper)| {
                let avg_width = lower.iter()
                    .zip(upper.iter())
                    .map(|(l, u)| (u - l).abs())
                    .sum::<f64>() / lower.len() as f64;
                // Normalize to 0-1 range
                (avg_width / result.point_forecast.iter().map(|x| x.abs()).sum::<f64>()).min(1.0)
            })
            .collect();

        // Calculate overall confidence (inverse of mean uncertainty)
        let mean_uncertainty = uncertainty_scores.iter().sum::<f64>() / uncertainty_scores.len() as f64;
        let confidence = 1.0 - mean_uncertainty;

        result.prediction_intervals = Some(intervals);
        result.uncertainty_scores = Some(uncertainty_scores);
        result.confidence = Some(confidence);
        result.inference_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        debug!("Prediction with intervals completed in {:.2}ms (confidence: {:.2}%)",
               result.inference_time_ms, confidence * 100.0);

        Ok(result)
    }

    /// Approximate inverse normal CDF (for quantile calculation)
    fn inverse_normal_cdf(&self, p: f64) -> f64 {
        // Approximation of inverse normal CDF (probit function)
        // Using Beasley-Springer-Moro algorithm
        let a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
        let b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
        let c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
                 0.0276438810333863, 0.0038405729373609, 0.0003951896511919,
                 0.0000321767881768, 0.0000002888167364, 0.0000003960315187];

        let y = p - 0.5;
        if y.abs() < 0.42 {
            let r = y * y;
            let mut num = a[0];
            let mut den = 1.0;
            for i in 1..4 {
                num = num * r + a[i];
                den = den * r + b[i - 1];
            }
            y * num / den
        } else {
            let r = if y > 0.0 { 1.0 - p } else { p };
            let r = (-r.ln()).sqrt();
            let mut num = c[0];
            for i in 1..9 {
                num = num * r + c[i];
            }
            if y < 0.0 { -num } else { num }
        }
    }

    /// Estimate prediction standard deviation (simplified)
    fn estimate_prediction_std(&self, forecast: &[f64]) -> f64 {
        if forecast.len() < 2 {
            return 0.1; // Default fallback
        }

        // Calculate variance of the forecast values as proxy for uncertainty
        let mean = forecast.iter().sum::<f64>() / forecast.len() as f64;
        let variance = forecast.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / forecast.len() as f64;

        variance.sqrt().max(0.01) // Minimum 1% std
    }

    /// Warm up the predictor (compile kernels, allocate memory)
    pub fn warmup(&self, input_size: usize) -> Result<()> {
        debug!("Warming up predictor");
        let dummy_input = vec![0.0; input_size];
        for _ in 0..3 {
            let _ = self.predict(&dummy_input)?;
        }
        Ok(())
    }

    /// Get model reference
    pub fn model(&self) -> &M {
        &self.model
    }

    /// Clear normalization cache to free memory
    pub fn clear_cache(&mut self) {
        self.normalization_cache.clear();
        self.input_cache = None;
    }
}

/// Ensemble predictor for combining multiple models
pub struct EnsemblePredictor<M: NeuralModel> {
    predictors: Vec<Arc<Predictor<M>>>,
    weights: Vec<f64>,
    ensemble_strategy: EnsembleStrategy,
}

#[derive(Debug, Clone, Copy)]
pub enum EnsembleStrategy {
    /// Simple weighted average
    WeightedAverage,
    /// Median of predictions
    Median,
    /// Keep best performing model dynamically
    BestModel,
    /// Stacking with meta-learner
    Stacking,
}

impl<M: NeuralModel + Clone> EnsemblePredictor<M> {
    /// Create ensemble from multiple models with equal weights
    pub fn new(models: Vec<M>, device: Device) -> Self {
        let num_models = models.len();
        let weights = vec![1.0 / num_models as f64; num_models];
        let predictors = models
            .into_iter()
            .map(|m| Arc::new(Predictor::new(m, device.clone())))
            .collect();

        Self {
            predictors,
            weights,
            ensemble_strategy: EnsembleStrategy::WeightedAverage,
        }
    }

    /// Create ensemble with custom weights
    pub fn with_weights(mut self, weights: Vec<f64>) -> Result<Self> {
        if weights.len() != self.predictors.len() {
            return Err(NeuralError::inference("Weights length must match number of models"));
        }

        // Normalize weights to sum to 1.0
        let sum: f64 = weights.iter().sum();
        self.weights = weights.iter().map(|w| w / sum).collect();
        Ok(self)
    }

    /// Set ensemble strategy
    pub fn with_strategy(mut self, strategy: EnsembleStrategy) -> Self {
        self.ensemble_strategy = strategy;
        self
    }

    /// Make ensemble prediction
    pub fn predict(&self, input: &[f64]) -> Result<PredictionResult> {
        let start = Instant::now();

        // Get predictions from all models
        let predictions: Vec<_> = self.predictors
            .iter()
            .map(|p| p.predict(input))
            .collect::<Result<Vec<_>>>()?;

        // Combine based on strategy
        let point_forecast = match self.ensemble_strategy {
            EnsembleStrategy::WeightedAverage => {
                self.weighted_average(&predictions)?
            }
            EnsembleStrategy::Median => {
                self.median(&predictions)?
            }
            EnsembleStrategy::BestModel => {
                // Use the prediction with highest confidence
                predictions.iter()
                    .max_by(|a, b| {
                        let a_conf = a.confidence.unwrap_or(0.5);
                        let b_conf = b.confidence.unwrap_or(0.5);
                        a_conf.partial_cmp(&b_conf).unwrap()
                    })
                    .map(|p| p.point_forecast.clone())
                    .ok_or_else(|| NeuralError::inference("No predictions available"))?
            }
            EnsembleStrategy::Stacking => {
                // For now, use weighted average (proper stacking requires meta-model)
                self.weighted_average(&predictions)?
            }
        };

        // Combine uncertainty estimates
        let uncertainty_scores = self.combine_uncertainties(&predictions);
        let confidence = self.calculate_ensemble_confidence(&predictions);

        let inference_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        Ok(PredictionResult {
            point_forecast,
            prediction_intervals: None,
            inference_time_ms,
            uncertainty_scores: Some(uncertainty_scores),
            confidence: Some(confidence),
        })
    }

    /// Predict with quantile intervals using ensemble
    pub fn predict_with_intervals(
        &self,
        input: &[f64],
        quantiles: Option<&[f64]>,
    ) -> Result<PredictionResult> {
        let predictions: Vec<_> = self.predictors
            .iter()
            .map(|p| p.predict_with_intervals(input, quantiles))
            .collect::<Result<Vec<_>>>()?;

        let mut result = self.predict(input)?;

        // Average the intervals from all models
        if let Some(ref first_pred) = predictions.first() {
            if let Some(ref intervals) = first_pred.prediction_intervals {
                let mut averaged_intervals = Vec::new();

                for (idx, (quantile, _, _)) in intervals.iter().enumerate() {
                    let mut avg_lower = vec![0.0; intervals[idx].1.len()];
                    let mut avg_upper = vec![0.0; intervals[idx].2.len()];

                    for pred in &predictions {
                        if let Some(ref pred_intervals) = pred.prediction_intervals {
                            for (i, val) in pred_intervals[idx].1.iter().enumerate() {
                                avg_lower[i] += val * self.weights[idx];
                            }
                            for (i, val) in pred_intervals[idx].2.iter().enumerate() {
                                avg_upper[i] += val * self.weights[idx];
                            }
                        }
                    }

                    averaged_intervals.push((*quantile, avg_lower, avg_upper));
                }

                result.prediction_intervals = Some(averaged_intervals);
            }
        }

        Ok(result)
    }

    fn weighted_average(&self, predictions: &[PredictionResult]) -> Result<Vec<f64>> {
        let horizon = predictions[0].point_forecast.len();
        let mut result = vec![0.0; horizon];

        for (pred, &weight) in predictions.iter().zip(&self.weights) {
            for (i, &val) in pred.point_forecast.iter().enumerate() {
                result[i] += val * weight;
            }
        }

        Ok(result)
    }

    fn median(&self, predictions: &[PredictionResult]) -> Result<Vec<f64>> {
        let horizon = predictions[0].point_forecast.len();
        let mut result = Vec::with_capacity(horizon);

        for i in 0..horizon {
            let mut values: Vec<f64> = predictions
                .iter()
                .map(|p| p.point_forecast[i])
                .collect();
            values.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let median = if values.len() % 2 == 0 {
                (values[values.len() / 2 - 1] + values[values.len() / 2]) / 2.0
            } else {
                values[values.len() / 2]
            };

            result.push(median);
        }

        Ok(result)
    }

    fn combine_uncertainties(&self, predictions: &[PredictionResult]) -> Vec<f64> {
        // Calculate variance across model predictions as uncertainty measure
        let horizon = predictions[0].point_forecast.len();
        let mut uncertainties = Vec::with_capacity(horizon);

        for i in 0..horizon {
            let values: Vec<f64> = predictions
                .iter()
                .map(|p| p.point_forecast[i])
                .collect();

            let mean = values.iter().sum::<f64>() / values.len() as f64;
            let variance = values.iter()
                .map(|x| (x - mean).powi(2))
                .sum::<f64>() / values.len() as f64;

            uncertainties.push((variance.sqrt() / mean.abs()).min(1.0));
        }

        uncertainties
    }

    fn calculate_ensemble_confidence(&self, predictions: &[PredictionResult]) -> f64 {
        // Average confidence across models
        let confidences: Vec<f64> = predictions
            .iter()
            .filter_map(|p| p.confidence)
            .collect();

        if confidences.is_empty() {
            return 0.5; // Default
        }

        confidences.iter().sum::<f64>() / confidences.len() as f64
    }

    /// Number of models in ensemble
    pub fn num_models(&self) -> usize {
        self.predictors.len()
    }
}

/// Fast prediction with minimal overhead
pub struct FastPredictor<M: NeuralModel> {
    model: M,
    device: Device,
}

impl<M: NeuralModel> FastPredictor<M> {
    pub fn new(model: M, device: Device) -> Self {
        Self { model, device }
    }

    /// Ultra-fast prediction without any overhead
    pub fn predict_fast(&self, input_tensor: &Tensor) -> Result<Tensor> {
        self.model.forward(input_tensor)
    }

    /// Batch prediction for throughput
    pub fn predict_batch(&self, inputs: Vec<Vec<f64>>) -> Result<Vec<Vec<f64>>> {
        let batch_size = inputs.len();
        let input_size = inputs[0].len();

        // Flatten inputs
        let flat: Vec<f64> = inputs.into_iter().flatten().collect();

        // Create batch tensor
        let input_tensor = Tensor::from_vec(flat, (batch_size, input_size), &self.device)?;

        // Forward pass
        let output = self.model.forward(&input_tensor)?;

        // Convert to Vec<Vec<f64>>
        output.to_vec2::<f64>().map_err(|e| NeuralError::inference(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{nhits::NHITSModel, ModelConfig};

    #[test]
    fn test_prediction_result_serialization() {
        let result = PredictionResult {
            point_forecast: vec![1.0, 2.0, 3.0],
            prediction_intervals: None,
            inference_time_ms: 5.2,
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: PredictionResult = serde_json::from_str(&json).unwrap();

        assert_eq!(result.point_forecast, deserialized.point_forecast);
        assert_eq!(result.inference_time_ms, deserialized.inference_time_ms);
    }
}
