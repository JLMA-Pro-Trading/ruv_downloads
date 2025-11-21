//! Synthetic time series data generation for testing and examples

use ndarray::{Array1, Array2};
use rand_distr::{Distribution, Normal};

/// Generate a sine wave with optional noise
pub fn sine_wave(length: usize, frequency: f64, amplitude: f64, noise_level: f64) -> Array1<f64> {
    let mut rng = rand::thread_rng();
    let normal = Normal::new(0.0, noise_level).unwrap();

    Array1::from_shape_fn(length, |i| {
        let t = i as f64 / length as f64;
        amplitude * (2.0 * std::f64::consts::PI * frequency * t).sin() + normal.sample(&mut rng)
    })
}

/// Generate trend + seasonality
pub fn trend_seasonality(
    length: usize,
    trend_slope: f64,
    seasonal_amplitude: f64,
    seasonal_period: f64,
    noise_level: f64,
) -> Array1<f64> {
    let mut rng = rand::thread_rng();
    let normal = Normal::new(0.0, noise_level).unwrap();

    Array1::from_shape_fn(length, |i| {
        let t = i as f64;
        let trend = trend_slope * t;
        let seasonality =
            seasonal_amplitude * (2.0 * std::f64::consts::PI * t / seasonal_period).sin();
        trend + seasonality + normal.sample(&mut rng)
    })
}

/// Generate a random walk
pub fn random_walk(length: usize, step_size: f64, start: f64) -> Array1<f64> {
    let mut rng = rand::thread_rng();
    let normal = Normal::new(0.0, step_size).unwrap();

    let mut values = Vec::with_capacity(length);
    let mut current = start;
    values.push(current);

    for _ in 1..length {
        current += normal.sample(&mut rng);
        values.push(current);
    }

    Array1::from_vec(values)
}

/// Generate an AR(1) process: X_t = phi * X_{t-1} + epsilon_t
pub fn ar_process(length: usize, phi: f64, noise_level: f64) -> Array1<f64> {
    let mut rng = rand::thread_rng();
    let normal = Normal::new(0.0, noise_level).unwrap();

    let mut values = Vec::with_capacity(length);
    let mut current = normal.sample(&mut rng);
    values.push(current);

    for _ in 1..length {
        current = phi * current + normal.sample(&mut rng);
        values.push(current);
    }

    Array1::from_vec(values)
}

/// Create sequences for time series forecasting
///
/// # Arguments
/// * `data` - Input time series data
/// * `input_len` - Length of input sequence
/// * `output_len` - Length of output sequence (forecast horizon)
///
/// # Returns
/// (X, y) where X is input sequences and y is target sequences
pub fn create_sequences(
    data: &Array1<f64>,
    input_len: usize,
    output_len: usize,
) -> (Array2<f64>, Array2<f64>) {
    let num_samples = data.len() - input_len - output_len + 1;

    let mut x_data = Vec::new();
    let mut y_data = Vec::new();

    for i in 0..num_samples {
        // Input sequence
        let x = data.slice(s![i..i + input_len]).to_vec();
        x_data.extend(x);

        // Output sequence
        let y = data.slice(s![i + input_len..i + input_len + output_len]).to_vec();
        y_data.extend(y);
    }

    let x = Array2::from_shape_vec((num_samples, input_len), x_data).unwrap();
    let y = Array2::from_shape_vec((num_samples, output_len), y_data).unwrap();

    (x, y)
}

/// Split data into train and validation sets
pub fn train_val_split(
    x: Array2<f64>,
    y: Array2<f64>,
    val_ratio: f64,
) -> (Array2<f64>, Array2<f64>, Array2<f64>, Array2<f64>) {
    let n_samples = x.nrows();
    let split_idx = (n_samples as f64 * (1.0 - val_ratio)) as usize;

    let train_x = x.slice(s![..split_idx, ..]).to_owned();
    let train_y = y.slice(s![..split_idx, ..]).to_owned();
    let val_x = x.slice(s![split_idx.., ..]).to_owned();
    let val_y = y.slice(s![split_idx.., ..]).to_owned();

    (train_x, train_y, val_x, val_y)
}

// Re-export ndarray's s! macro
use ndarray::s;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sine_wave() {
        let data = sine_wave(100, 1.0, 1.0, 0.1);
        assert_eq!(data.len(), 100);
        // Check that values are bounded by amplitude + noise
        assert!(data.iter().all(|&x| x.abs() < 2.0));
    }

    #[test]
    fn test_trend_seasonality() {
        let data = trend_seasonality(100, 0.1, 1.0, 10.0, 0.1);
        assert_eq!(data.len(), 100);
    }

    #[test]
    fn test_random_walk() {
        let data = random_walk(100, 0.5, 0.0);
        assert_eq!(data.len(), 100);
    }

    #[test]
    fn test_ar_process() {
        let data = ar_process(100, 0.7, 1.0);
        assert_eq!(data.len(), 100);
    }

    #[test]
    fn test_create_sequences() {
        let data = Array1::from_vec((0..100).map(|x| x as f64).collect());
        let (x, y) = create_sequences(&data, 10, 5);

        assert_eq!(x.nrows(), 100 - 10 - 5 + 1);
        assert_eq!(x.ncols(), 10);
        assert_eq!(y.ncols(), 5);

        // Check that sequences are correct
        assert_eq!(x[[0, 0]], 0.0);
        assert_eq!(x[[0, 9]], 9.0);
        assert_eq!(y[[0, 0]], 10.0);
        assert_eq!(y[[0, 4]], 14.0);
    }

    #[test]
    fn test_train_val_split() {
        let x = Array2::from_shape_fn((100, 10), |(i, j)| (i * 10 + j) as f64);
        let y = Array2::from_shape_fn((100, 5), |(i, j)| (i * 5 + j) as f64);

        let (train_x, train_y, val_x, val_y) = train_val_split(x, y, 0.2);

        assert_eq!(train_x.nrows(), 80);
        assert_eq!(val_x.nrows(), 20);
        assert_eq!(train_y.nrows(), 80);
        assert_eq!(val_y.nrows(), 20);
    }
}
