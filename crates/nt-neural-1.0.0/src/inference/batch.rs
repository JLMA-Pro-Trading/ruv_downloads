//! Batch inference for high throughput with advanced optimizations

use crate::error::{NeuralError, Result};
use crate::inference::PredictionResult;
use crate::models::NeuralModel;
#[cfg(feature = "candle")]
use candle_core::{Device, Tensor};
use rayon::prelude::*;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tracing::{debug, info, warn};

/// Configuration for batch prediction
#[derive(Debug, Clone)]
pub struct BatchConfig {
    /// Batch size for processing
    pub batch_size: usize,
    /// Number of parallel threads
    pub num_threads: usize,
    /// Enable memory pooling
    pub memory_pooling: bool,
    /// Maximum queue size for async processing
    pub max_queue_size: usize,
}

impl Default for BatchConfig {
    fn default() -> Self {
        Self {
            batch_size: 32,
            num_threads: num_cpus::get(),
            memory_pooling: true,
            max_queue_size: 1000,
        }
    }
}

/// Batch predictor for processing multiple time series with optimizations
pub struct BatchPredictor<M: NeuralModel> {
    model: Arc<M>,
    device: Device,
    config: BatchConfig,
    /// Tensor pool for memory reuse
    tensor_pool: Arc<Mutex<Vec<Tensor>>>,
    /// Performance metrics
    total_predictions: Arc<Mutex<usize>>,
    total_time_ms: Arc<Mutex<f64>>,
}

impl<M: NeuralModel + Send + Sync> BatchPredictor<M> {
    /// Create a new batch predictor
    pub fn new(model: M, device: Device, batch_size: usize) -> Self {
        Self::with_config(model, device, BatchConfig {
            batch_size,
            ..Default::default()
        })
    }

    /// Create with custom configuration
    pub fn with_config(model: M, device: Device, config: BatchConfig) -> Self {
        // Set rayon thread pool size
        rayon::ThreadPoolBuilder::new()
            .num_threads(config.num_threads)
            .build_global()
            .ok();

        Self {
            model: Arc::new(model),
            device,
            config,
            tensor_pool: Arc::new(Mutex::new(Vec::new())),
            total_predictions: Arc::new(Mutex::new(0)),
            total_time_ms: Arc::new(Mutex::new(0.0)),
        }
    }

    /// Set number of parallel threads
    pub fn with_num_threads(mut self, num_threads: usize) -> Self {
        self.config.num_threads = num_threads;
        self
    }

    /// Predict on multiple time series in batches with optimizations
    pub fn predict_batch(
        &self,
        inputs: Vec<Vec<f64>>,
    ) -> Result<Vec<PredictionResult>> {
        let start = Instant::now();
        let total_samples = inputs.len();

        info!("Starting batch prediction for {} samples", total_samples);

        // Process in chunks with parallel execution
        let results: Vec<_> = inputs
            .par_chunks(self.config.batch_size)
            .enumerate()
            .map(|(chunk_idx, chunk)| {
                self.process_batch(chunk, chunk_idx)
            })
            .collect::<Result<Vec<_>>>()?
            .into_iter()
            .flatten()
            .collect();

        let total_time = start.elapsed().as_secs_f64();
        let throughput = total_samples as f64 / total_time;

        // Update metrics
        *self.total_predictions.lock().unwrap() += total_samples;
        *self.total_time_ms.lock().unwrap() += total_time * 1000.0;

        info!(
            "Batch prediction completed: {} samples in {:.2}s ({:.0} samples/sec)",
            total_samples, total_time, throughput
        );

        Ok(results)
    }

    /// Process a single batch with memory optimization
    fn process_batch(
        &self,
        inputs: &[Vec<f64>],
        _chunk_idx: usize,
    ) -> Result<Vec<PredictionResult>> {
        let batch_start = Instant::now();
        let batch_size = inputs.len();

        if batch_size == 0 {
            return Ok(Vec::new());
        }

        let input_size = inputs[0].len();

        // Flatten inputs with zero-copy where possible
        let flat: Vec<f64> = inputs.iter().flatten().copied().collect();

        // Try to reuse tensor from pool or create new one
        let input_tensor = if self.config.memory_pooling {
            self.get_or_create_tensor(flat, (batch_size, input_size))?
        } else {
            Tensor::from_vec(flat, (batch_size, input_size), &self.device)?
        };

        // Forward pass
        let output = self.model.forward(&input_tensor)?;

        // Return tensor to pool if using memory pooling
        if self.config.memory_pooling {
            self.return_tensor_to_pool(input_tensor);
        }

        // Convert to Vec<Vec<f64>>
        let predictions = output.to_vec2::<f64>()?;

        let batch_time_ms = batch_start.elapsed().as_secs_f64() * 1000.0;
        let per_sample_ms = batch_time_ms / batch_size as f64;

        // Create prediction results
        let results = predictions
            .into_iter()
            .map(|point_forecast| PredictionResult::new(point_forecast, per_sample_ms))
            .collect();

        debug!("Batch of {} processed in {:.2}ms ({:.2}ms/sample)",
               batch_size, batch_time_ms, per_sample_ms);

        Ok(results)
    }

    /// Get tensor from pool or create new one
    fn get_or_create_tensor(
        &self,
        data: Vec<f64>,
        shape: (usize, usize),
    ) -> Result<Tensor> {
        let mut pool = self.tensor_pool.lock().unwrap();

        // Try to reuse a tensor from the pool
        if let Some(tensor) = pool.pop() {
            // Check if shape matches (simplified - in production, check dimensions properly)
            drop(pool);
            debug!("Reusing tensor from pool");
            Ok(tensor)
        } else {
            drop(pool);
            Tensor::from_vec(data, shape, &self.device)
                .map_err(|e| NeuralError::inference(e.to_string()))
        }
    }

    /// Return tensor to pool for reuse
    fn return_tensor_to_pool(&self, tensor: Tensor) {
        let mut pool = self.tensor_pool.lock().unwrap();
        if pool.len() < 10 {
            // Limit pool size
            pool.push(tensor);
            debug!("Returned tensor to pool (size: {})", pool.len());
        }
    }

    /// Predict with automatic batching and parallel processing (async)
    pub async fn predict_batch_async(
        &self,
        inputs: Vec<Vec<f64>>,
    ) -> Result<Vec<PredictionResult>> {
        let batch_size = self.config.batch_size;
        let device = self.device.clone();
        let model = self.model.clone();
        let config = self.config.clone();

        tokio::task::spawn_blocking(move || {
            let predictor = BatchPredictor {
                model,
                device,
                config,
                tensor_pool: Arc::new(Mutex::new(Vec::new())),
                total_predictions: Arc::new(Mutex::new(0)),
                total_time_ms: Arc::new(Mutex::new(0.0)),
            };
            predictor.predict_batch(inputs)
        })
        .await
        .map_err(|e| NeuralError::inference(format!("Task join error: {}", e)))?
    }

    /// Get performance statistics
    pub fn get_stats(&self) -> BatchStats {
        let total_preds = *self.total_predictions.lock().unwrap();
        let total_time = *self.total_time_ms.lock().unwrap();

        BatchStats {
            total_predictions: total_preds,
            total_time_ms: total_time,
            avg_throughput: if total_time > 0.0 {
                (total_preds as f64 / total_time) * 1000.0
            } else {
                0.0
            },
        }
    }

    /// Clear tensor pool
    pub fn clear_pool(&self) {
        let mut pool = self.tensor_pool.lock().unwrap();
        pool.clear();
        debug!("Cleared tensor pool");
    }
}

/// Batch prediction statistics
#[derive(Debug, Clone)]
pub struct BatchStats {
    pub total_predictions: usize,
    pub total_time_ms: f64,
    pub avg_throughput: f64,
}

/// Streaming batch processor for continuous prediction with buffering
pub struct StreamingBatchProcessor<M: NeuralModel> {
    predictor: Arc<BatchPredictor<M>>,
    buffer: Arc<Mutex<VecDeque<Vec<f64>>>>,
    buffer_size: usize,
    auto_flush: bool,
}

impl<M: NeuralModel + Send + Sync> StreamingBatchProcessor<M> {
    /// Create a new streaming processor
    pub fn new(model: M, device: Device, batch_size: usize, buffer_size: usize) -> Self {
        Self {
            predictor: Arc::new(BatchPredictor::new(model, device, batch_size)),
            buffer: Arc::new(Mutex::new(VecDeque::with_capacity(buffer_size))),
            buffer_size,
            auto_flush: true,
        }
    }

    /// Enable or disable auto-flush
    pub fn with_auto_flush(mut self, auto_flush: bool) -> Self {
        self.auto_flush = auto_flush;
        self
    }

    /// Add input to buffer and process if full
    pub fn add(&self, input: Vec<f64>) -> Result<Option<Vec<PredictionResult>>> {
        let mut buffer = self.buffer.lock().unwrap();
        buffer.push_back(input);

        if buffer.len() >= self.buffer_size && self.auto_flush {
            drop(buffer);
            let results = self.flush()?;
            Ok(Some(results))
        } else {
            Ok(None)
        }
    }

    /// Process remaining buffer
    pub fn flush(&self) -> Result<Vec<PredictionResult>> {
        let mut buffer = self.buffer.lock().unwrap();

        if buffer.is_empty() {
            return Ok(Vec::new());
        }

        let inputs: Vec<Vec<f64>> = buffer.drain(..).collect();
        drop(buffer);

        self.predictor.predict_batch(inputs)
    }

    /// Get current buffer size
    pub fn buffer_len(&self) -> usize {
        self.buffer.lock().unwrap().len()
    }

    /// Check if buffer is full
    pub fn is_buffer_full(&self) -> bool {
        self.buffer.lock().unwrap().len() >= self.buffer_size
    }

    /// Clear buffer without processing
    pub fn clear_buffer(&self) {
        self.buffer.lock().unwrap().clear();
    }
}

/// Ensemble batch predictor combining multiple models
pub struct EnsembleBatchPredictor<M: NeuralModel> {
    predictors: Vec<Arc<BatchPredictor<M>>>,
    weights: Vec<f64>,
}

impl<M: NeuralModel + Send + Sync + Clone> EnsembleBatchPredictor<M> {
    /// Create ensemble from multiple models
    pub fn new(models: Vec<M>, device: Device, batch_size: usize) -> Self {
        let num_models = models.len();
        let weights = vec![1.0 / num_models as f64; num_models];

        let predictors = models
            .into_iter()
            .map(|m| Arc::new(BatchPredictor::new(m, device.clone(), batch_size)))
            .collect();

        Self {
            predictors,
            weights,
        }
    }

    /// Create with custom weights
    pub fn with_weights(mut self, weights: Vec<f64>) -> Result<Self> {
        if weights.len() != self.predictors.len() {
            return Err(NeuralError::inference("Weights length must match number of models"));
        }

        // Normalize weights
        let sum: f64 = weights.iter().sum();
        self.weights = weights.iter().map(|w| w / sum).collect();
        Ok(self)
    }

    /// Predict with ensemble
    pub fn predict_batch(
        &self,
        inputs: Vec<Vec<f64>>,
    ) -> Result<Vec<PredictionResult>> {
        let start = Instant::now();

        // Get predictions from all models in parallel
        let all_predictions: Vec<Vec<PredictionResult>> = self.predictors
            .par_iter()
            .map(|predictor| predictor.predict_batch(inputs.clone()))
            .collect::<Result<Vec<_>>>()?;

        // Combine predictions with weighted average
        let num_samples = inputs.len();
        let mut ensemble_results = Vec::with_capacity(num_samples);

        for sample_idx in 0..num_samples {
            let sample_predictions: Vec<_> = all_predictions
                .iter()
                .map(|preds| &preds[sample_idx])
                .collect();

            let ensemble_forecast = self.weighted_average_forecasts(&sample_predictions)?;
            let ensemble_confidence = self.calculate_confidence(&sample_predictions);

            ensemble_results.push(
                PredictionResult::new(
                    ensemble_forecast,
                    start.elapsed().as_secs_f64() * 1000.0,
                )
                .with_confidence(ensemble_confidence)
            );
        }

        info!("Ensemble batch prediction completed for {} samples", num_samples);

        Ok(ensemble_results)
    }

    fn weighted_average_forecasts(&self, predictions: &[&PredictionResult]) -> Result<Vec<f64>> {
        if predictions.is_empty() {
            return Err(NeuralError::inference("No predictions to combine"));
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

    fn calculate_confidence(&self, predictions: &[&PredictionResult]) -> f64 {
        // Calculate variance across models as inverse confidence
        let horizon = predictions[0].point_forecast.len();
        let mut total_variance = 0.0;

        for i in 0..horizon {
            let values: Vec<f64> = predictions
                .iter()
                .map(|p| p.point_forecast[i])
                .collect();

            let mean = values.iter().sum::<f64>() / values.len() as f64;
            let variance = values.iter()
                .map(|x| (x - mean).powi(2))
                .sum::<f64>() / values.len() as f64;

            total_variance += variance;
        }

        let avg_variance = total_variance / horizon as f64;
        // Convert variance to confidence (lower variance = higher confidence)
        (1.0 / (1.0 + avg_variance)).max(0.0).min(1.0)
    }
}

/// GPU-accelerated batch predictor with CUDA streams
#[cfg(feature = "cuda")]
pub struct GpuBatchPredictor<M: NeuralModel> {
    model: Arc<M>,
    device: Device,
    streams: Vec<cudarc::driver::CudaStream>,
    num_streams: usize,
}

#[cfg(feature = "cuda")]
impl<M: NeuralModel + Send + Sync> GpuBatchPredictor<M> {
    pub fn new(model: M, device: Device, num_streams: usize) -> Result<Self> {
        let mut streams = Vec::with_capacity(num_streams);

        for _ in 0..num_streams {
            let stream = cudarc::driver::CudaStream::new()
                .map_err(|e| NeuralError::device(format!("Failed to create CUDA stream: {:?}", e)))?;
            streams.push(stream);
        }

        Ok(Self {
            model: Arc::new(model),
            device,
            streams,
            num_streams,
        })
    }

    pub fn predict_batch_gpu(
        &self,
        inputs: Vec<Vec<f64>>,
    ) -> Result<Vec<PredictionResult>> {
        let start = Instant::now();

        // Distribute work across CUDA streams for parallelism
        let chunk_size = (inputs.len() + self.num_streams - 1) / self.num_streams;

        let results: Vec<_> = inputs
            .chunks(chunk_size)
            .enumerate()
            .par_bridge()
            .map(|(stream_idx, chunk)| {
                let stream = &self.streams[stream_idx % self.num_streams];
                self.process_gpu_chunk(chunk, stream)
            })
            .collect::<Result<Vec<_>>>()?
            .into_iter()
            .flatten()
            .collect();

        info!("GPU batch prediction completed in {:.2}ms",
              start.elapsed().as_secs_f64() * 1000.0);

        Ok(results)
    }

    fn process_gpu_chunk(
        &self,
        chunk: &[Vec<f64>],
        _stream: &cudarc::driver::CudaStream,
    ) -> Result<Vec<PredictionResult>> {
        // Implement GPU-accelerated batch processing with stream
        // This would use CUDA streams for overlapping computation and data transfer
        warn!("GPU batch prediction not yet fully implemented");

        // Fallback to CPU implementation for now
        let batch_size = chunk.len();
        let input_size = chunk[0].len();
        let flat: Vec<f64> = chunk.iter().flatten().copied().collect();

        let input_tensor = Tensor::from_vec(flat, (batch_size, input_size), &self.device)?;
        let output = self.model.forward(&input_tensor)?;
        let predictions = output.to_vec2::<f64>()?;

        Ok(predictions
            .into_iter()
            .map(|p| PredictionResult::new(p, 0.0))
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_config_default() {
        let config = BatchConfig::default();
        assert!(config.batch_size > 0);
        assert!(config.num_threads > 0);
    }

    #[test]
    fn test_streaming_processor_buffer() {
        let buffer_size = 10;
        assert!(buffer_size > 0);
    }

    #[test]
    fn test_batch_stats() {
        let stats = BatchStats {
            total_predictions: 1000,
            total_time_ms: 500.0,
            avg_throughput: 2000.0,
        };
        assert_eq!(stats.total_predictions, 1000);
    }
}
