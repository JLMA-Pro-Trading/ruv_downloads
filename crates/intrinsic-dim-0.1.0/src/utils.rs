use rand::Rng;
use std::fs::File;
use std::io::{BufRead, BufReader};

/// Generate synthetic data with known intrinsic dimensionality
pub fn generate_synthetic_data(
    n_samples: usize,
    intrinsic_dim: usize,
    ambient_dim: usize,
    noise_level: f64,
) -> Vec<Vec<f64>> {
    let mut rng = rand::thread_rng();
    let mut data = Vec::new();

    for _ in 0..n_samples {
        // Generate low-dimensional data
        let mut latent = vec![0.0; intrinsic_dim];
        for i in 0..intrinsic_dim {
            latent[i] = rng.gen_range(-1.0..1.0);
        }

        // Random linear embedding
        let mut sample = vec![0.0; ambient_dim];
        for i in 0..intrinsic_dim {
            for j in 0..ambient_dim {
                // Deterministic but "random-looking" projection
                let weight = ((i * 7 + j * 13) as f64 * 0.618).sin();
                sample[j] += latent[i] * weight;
            }
        }

        // Add noise
        for j in 0..ambient_dim {
            sample[j] += rng.gen_range(-noise_level..noise_level);
        }

        data.push(sample);
    }

    data
}

/// Load data from CSV file
pub fn load_csv(path: &str) -> Result<Vec<Vec<f64>>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut data = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        let values: Result<Vec<f64>, _> = line
            .split(',')
            .map(|s| s.trim().parse())
            .collect();

        match values {
            Ok(row) => data.push(row),
            Err(_) => continue,  // Skip header or invalid rows
        }
    }

    Ok(data)
}

/// Compute statistics about dimensionality results
pub struct DimensionalityStats {
    pub mean_dim: f64,
    pub std_dim: f64,
    pub min_dim: usize,
    pub max_dim: usize,
    pub compression_potential: f64,
}

pub fn compute_stats(results: &[crate::DimensionalityResult]) -> DimensionalityStats {
    if results.is_empty() {
        return DimensionalityStats {
            mean_dim: 0.0,
            std_dim: 0.0,
            min_dim: 0,
            max_dim: 0,
            compression_potential: 0.0,
        };
    }

    let dims: Vec<f64> = results.iter()
        .map(|r| r.intrinsic_dim as f64)
        .collect();

    let mean = dims.iter().sum::<f64>() / dims.len() as f64;

    let variance = dims.iter()
        .map(|d| (d - mean).powi(2))
        .sum::<f64>() / dims.len() as f64;

    let std = variance.sqrt();

    let min = results.iter().map(|r| r.intrinsic_dim).min().unwrap();
    let max = results.iter().map(|r| r.intrinsic_dim).max().unwrap();

    let avg_compression = results.iter()
        .map(|r| r.compression_ratio)
        .sum::<f64>() / results.len() as f64;

    DimensionalityStats {
        mean_dim: mean,
        std_dim: std,
        min_dim: min,
        max_dim: max,
        compression_potential: avg_compression,
    }
}

/// Validate if estimated dimension is reasonable
pub fn validate_dimension(
    estimated: usize,
    data_size: usize,
    ambient_dim: usize,
) -> bool {
    // Basic sanity checks
    if estimated == 0 || estimated > ambient_dim {
        return false;
    }

    // Check if we have enough samples for the estimated dimension
    // Rule of thumb: need at least 10 * dim samples
    if data_size < estimated * 10 {
        return false;
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_synthetic_generation() {
        let data = generate_synthetic_data(100, 3, 10, 0.01);
        assert_eq!(data.len(), 100);
        assert_eq!(data[0].len(), 10);
    }

    #[test]
    fn test_validation() {
        assert!(validate_dimension(5, 100, 20));
        assert!(!validate_dimension(0, 100, 20));  // Zero dimension
        assert!(!validate_dimension(25, 100, 20)); // Exceeds ambient
        assert!(!validate_dimension(15, 50, 20));  // Too few samples
    }
}