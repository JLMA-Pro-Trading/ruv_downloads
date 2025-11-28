//! Data loading utilities for time series with polars integration

use crate::error::{NeuralError, Result};
#[cfg(feature = "candle")]
use candle_core::{Device, Tensor};
use polars::prelude::*;
use rand::seq::SliceRandom;
use rayon::prelude::*;
use std::path::Path;

/// Time series dataset with efficient polars backend
pub struct TimeSeriesDataset {
    /// Input sequences (features)
    pub data: DataFrame,
    /// Target values
    pub targets: DataFrame,
    /// Sequence length (lookback window)
    pub sequence_length: usize,
    /// Forecast horizon
    pub horizon: usize,
    /// Indices for data access
    indices: Vec<usize>,
}

impl TimeSeriesDataset {
    /// Create a new time series dataset from a DataFrame
    ///
    /// # Arguments
    /// * `df` - Input DataFrame with time series data
    /// * `target_col` - Name of the target column
    /// * `sequence_length` - Lookback window size
    /// * `horizon` - Forecast horizon
    pub fn new(
        df: DataFrame,
        target_col: &str,
        sequence_length: usize,
        horizon: usize,
    ) -> Result<Self> {
        if df.height() < sequence_length + horizon {
            return Err(NeuralError::data(format!(
                "DataFrame too small: {} rows, need at least {}",
                df.height(),
                sequence_length + horizon
            )));
        }

        // Extract target column
        let _targets = df
            .select([target_col])
            .map_err(|e| NeuralError::data(format!("Failed to select target column: {}", e)))?;

        // Create valid indices (ensuring we can create full sequences + horizons)
        let max_idx = df.height() - sequence_length - horizon;
        let indices: Vec<usize> = (0..max_idx).collect();

        Ok(Self {
            data: df,
            targets,
            sequence_length,
            horizon,
            indices,
        })
    }

    /// Create from CSV file
    pub fn from_csv(path: impl AsRef<Path>, target_col: &str, sequence_length: usize, horizon: usize) -> Result<Self> {
        let df = CsvReader::from_path(path)
            .map_err(|e| NeuralError::data(format!("Failed to read CSV: {}", e)))?
            .finish()
            .map_err(|e| NeuralError::data(format!("Failed to parse CSV: {}", e)))?;

        Self::new(df, target_col, sequence_length, horizon)
    }

    /// Create from Parquet file (faster for large datasets)
    pub fn from_parquet(path: impl AsRef<Path>, target_col: &str, sequence_length: usize, horizon: usize) -> Result<Self> {
        let df = ParquetReader::new(std::fs::File::open(path)?)
            .finish()
            .map_err(|e| NeuralError::data(format!("Failed to read Parquet: {}", e)))?;

        Self::new(df, target_col, sequence_length, horizon)
    }

    /// Get the number of samples
    pub fn len(&self) -> usize {
        self.indices.len()
    }

    /// Check if dataset is empty
    pub fn is_empty(&self) -> bool {
        self.indices.is_empty()
    }

    /// Get a single sample (X, y) at index
    pub fn get(&self, idx: usize) -> Result<(Vec<f64>, Vec<f64>)> {
        if idx >= self.indices.len() {
            return Err(NeuralError::data(format!("Index {} out of bounds", idx)));
        }

        let start_idx = self.indices[idx];
        let end_idx = start_idx + self.sequence_length;
        let target_end = end_idx + self.horizon;

        // Extract input sequence
        let input_slice = self.data.slice((start_idx as i64), self.sequence_length);
        let input = self.dataframe_to_vec(&input_slice)?;

        // Extract target sequence
        let target_slice = self.targets.slice((end_idx as i64), self.horizon);
        let target = self.dataframe_to_vec(&target_slice)?;

        Ok((input, target))
    }

    /// Convert DataFrame to flat Vec<f64>
    fn dataframe_to_vec(&self, df: &DataFrame) -> Result<Vec<f64>> {
        let mut result = Vec::new();

        for col in df.get_columns() {
            match col.dtype() {
                DataType::Float64 => {
                    let series = col.f64().map_err(|e| NeuralError::data(format!("Failed to cast column: {}", e)))?;
                    for val in series.into_iter() {
                        result.push(val.unwrap_or(0.0));
                    }
                }
                DataType::Float32 => {
                    let series = col.f32().map_err(|e| NeuralError::data(format!("Failed to cast column: {}", e)))?;
                    for val in series.into_iter() {
                        result.push(val.unwrap_or(0.0) as f64);
                    }
                }
                DataType::Int64 => {
                    let series = col.i64().map_err(|e| NeuralError::data(format!("Failed to cast column: {}", e)))?;
                    for val in series.into_iter() {
                        result.push(val.unwrap_or(0) as f64);
                    }
                }
                _ => {
                    return Err(NeuralError::data(format!("Unsupported column type: {:?}", col.dtype())));
                }
            }
        }

        Ok(result)
    }

    /// Shuffle the dataset indices
    pub fn shuffle(&mut self) {
        let mut rng = rand::thread_rng();
        self.indices.shuffle(&mut rng);
    }

    /// Split dataset into train and validation sets
    pub fn train_val_split(&self, val_split: f64) -> Result<(Self, Self)> {
        if !(0.0..1.0).contains(&val_split) {
            return Err(NeuralError::data("val_split must be between 0 and 1"));
        }

        let val_size = (self.len() as f64 * val_split) as usize;
        let train_size = self.len() - val_size;

        let train_indices = self.indices[..train_size].to_vec();
        let val_indices = self.indices[train_size..].to_vec();

        let train_dataset = Self {
            data: self.data.clone(),
            targets: self.targets.clone(),
            sequence_length: self.sequence_length,
            horizon: self.horizon,
            indices: train_indices,
        };

        let val_dataset = Self {
            data: self.data.clone(),
            targets: self.targets.clone(),
            sequence_length: self.sequence_length,
            horizon: self.horizon,
            indices: val_indices,
        };

        Ok((train_dataset, val_dataset))
    }
}

/// Mini-batch data loader with parallel processing
pub struct DataLoader {
    dataset: TimeSeriesDataset,
    batch_size: usize,
    shuffle: bool,
    drop_last: bool,
    num_workers: usize,
    current_idx: usize,
}

impl DataLoader {
    /// Create a new data loader
    pub fn new(dataset: TimeSeriesDataset, batch_size: usize) -> Self {
        Self {
            dataset,
            batch_size,
            shuffle: false,
            drop_last: false,
            num_workers: num_cpus::get(),
            current_idx: 0,
        }
    }

    /// Enable shuffling
    pub fn with_shuffle(mut self, shuffle: bool) -> Self {
        self.shuffle = shuffle;
        self
    }

    /// Drop last incomplete batch
    pub fn with_drop_last(mut self, drop_last: bool) -> Self {
        self.drop_last = drop_last;
        self
    }

    /// Set number of parallel workers
    pub fn with_num_workers(mut self, num_workers: usize) -> Self {
        self.num_workers = num_workers;
        self
    }

    /// Get the number of batches
    pub fn num_batches(&self) -> usize {
        let total = self.dataset.len();
        if self.drop_last {
            total / self.batch_size
        } else {
            (total + self.batch_size - 1) / self.batch_size
        }
    }

    /// Reset the loader for a new epoch
    pub fn reset(&mut self) {
        self.current_idx = 0;
        if self.shuffle {
            self.dataset.shuffle();
        }
    }

    /// Get the next batch as Tensors
    pub fn next_batch(&mut self, device: &Device) -> Result<Option<(Tensor, Tensor)>> {
        if self.current_idx >= self.dataset.len() {
            return Ok(None);
        }

        let end_idx = (self.current_idx + self.batch_size).min(self.dataset.len());
        let batch_size = end_idx - self.current_idx;

        // Drop last incomplete batch if requested
        if self.drop_last && batch_size < self.batch_size {
            return Ok(None);
        }

        // Parallel loading of samples
        let samples: Vec<_> = (self.current_idx..end_idx)
            .into_par_iter()
            .map(|idx| self.dataset.get(idx))
            .collect::<Result<Vec<_>>>()?;

        // Convert to tensors
        let (inputs, targets): (Vec<_>, Vec<_>) = samples.into_iter().unzip();

        let input_tensor = self.vec_to_tensor(&inputs, device)?;
        let target_tensor = self.vec_to_tensor(&targets, device)?;

        self.current_idx = end_idx;

        Ok(Some((input_tensor, target_tensor)))
    }

    /// Convert Vec<Vec<f64>> to Tensor
    fn vec_to_tensor(&self, data: &[Vec<f64>], device: &Device) -> Result<Tensor> {
        let batch_size = data.len();
        let seq_len = data[0].len();

        let flat: Vec<f64> = data.iter().flatten().copied().collect();

        Tensor::from_vec(flat, (batch_size, seq_len), device)
            .map_err(|e| NeuralError::data(format!("Failed to create tensor: {}", e)))
    }

    /// Iterate over all batches
    pub fn iter_batches<'a>(
        &'a mut self,
        device: &'a Device,
    ) -> impl Iterator<Item = Result<(Tensor, Tensor)>> + 'a {
        std::iter::from_fn(move || {
            match self.next_batch(device) {
                Ok(Some(batch)) => Some(Ok(batch)),
                Ok(None) => None,
                Err(e) => Some(Err(e)),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_dataframe() -> DataFrame {
        let values: Vec<f64> = (0..1000).map(|x| x as f64).collect();
        let dates: Vec<String> = (0..1000).map(|i| format!("2024-01-{}", i % 30 + 1)).collect();

        df!(
            "date" => dates,
            "value" => values.clone(),
            "value2" => values.iter().map(|x| x * 2.0).collect::<Vec<_>>()
        ).unwrap()
    }

    #[test]
    fn test_dataset_creation() {
        let df = create_test_dataframe();
        let dataset = TimeSeriesDataset::new(df, "value", 100, 24).unwrap();

        assert_eq!(dataset.sequence_length, 100);
        assert_eq!(dataset.horizon, 24);
        assert!(dataset.len() > 0);
    }

    #[test]
    fn test_dataset_get() {
        let df = create_test_dataframe();
        let dataset = TimeSeriesDataset::new(df, "value", 100, 24).unwrap();

        let (input, target) = dataset.get(0).unwrap();
        assert_eq!(input.len(), 100 * 2); // 2 features
        assert_eq!(target.len(), 24);
    }

    #[test]
    fn test_train_val_split() {
        let df = create_test_dataframe();
        let dataset = TimeSeriesDataset::new(df, "value", 100, 24).unwrap();

        let (train, val) = dataset.train_val_split(0.2).unwrap();

        let total_len = dataset.len();
        assert!(train.len() > val.len());
        assert_eq!(train.len() + val.len(), total_len);
    }

    #[test]
    fn test_dataloader() {
        let df = create_test_dataframe();
        let dataset = TimeSeriesDataset::new(df, "value", 100, 24).unwrap();

        let mut loader = DataLoader::new(dataset, 32)
            .with_shuffle(true)
            .with_drop_last(false);

        assert!(loader.num_batches() > 0);
    }

    #[test]
    fn test_dataloader_iteration() {
        let df = create_test_dataframe();
        let dataset = TimeSeriesDataset::new(df, "value", 100, 24).unwrap();
        let device = Device::Cpu;

        let mut loader = DataLoader::new(dataset, 32);

        let mut batch_count = 0;
        while let Some((inputs, targets)) = loader.next_batch(&device).unwrap() {
            batch_count += 1;
            assert!(inputs.dims()[0] <= 32); // batch size
        }

        assert!(batch_count > 0);
    }
}
