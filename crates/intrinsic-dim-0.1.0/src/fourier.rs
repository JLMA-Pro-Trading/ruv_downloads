use ndarray::{Array1, Array2};
use ndarray_rand::RandomExt;
use ndarray_rand::rand_distr::{StandardNormal, Uniform};
use std::f64::consts::PI;

/// Fourier-based intrinsic dimensionality estimator
/// Uses the emergent sparsity of Random Fourier Features
pub struct FourierEstimator {
    n_features: usize,
    omega: Array2<f64>,     // Random frequencies
    bias: Array1<f64>,      // Random phase shifts
    weights: Option<Array1<f64>>,  // Learned weights
    _sigma: f64,              // RBF kernel bandwidth
}

impl FourierEstimator {
    pub fn new(input_dim: usize, n_features: usize) -> Self {
        // Initialize random Fourier features
        let omega = Array2::random((n_features, input_dim), StandardNormal) / 1.0;
        let bias = Array1::random(n_features, Uniform::new(0.0, 2.0 * PI));

        Self {
            n_features,
            omega,
            bias,
            weights: None,
            _sigma: 1.0,
        }
    }

    pub fn estimate_from_data(&self, data: &[Vec<f64>]) -> Result<usize, String> {
        if data.is_empty() {
            return Err("Empty data".to_string());
        }

        // Transform data using random Fourier features
        let features = self.transform_batch(data);

        // Create target (use next value prediction as proxy task)
        let targets = self.create_targets(data);

        // Solve ridge regression
        let weights = self.ridge_regression(&features, &targets, 0.001)?;

        // Count effective features (non-zero weights)
        let effective_features = self.count_effective_features(&weights);

        Ok(effective_features)
    }

    fn transform_batch(&self, data: &[Vec<f64>]) -> Array2<f64> {
        let n_samples = data.len();
        let mut features = Array2::zeros((n_samples, self.n_features));

        for (i, sample) in data.iter().enumerate() {
            let sample_array = Array1::from_vec(sample.clone());
            let projections = self.omega.dot(&sample_array) + &self.bias;

            for (j, &proj) in projections.iter().enumerate() {
                features[[i, j]] = (2.0 / self.n_features as f64).sqrt() * proj.cos();
            }
        }

        features
    }

    fn create_targets(&self, data: &[Vec<f64>]) -> Array1<f64> {
        // Use simple reconstruction task or next-value prediction
        let n_samples = data.len();
        let mut targets = Array1::zeros(n_samples);

        for i in 0..n_samples {
            // Use first component as target (or could use reconstruction error)
            targets[i] = data[i][0];
        }

        targets
    }

    fn ridge_regression(
        &self,
        x: &Array2<f64>,
        y: &Array1<f64>,
        lambda: f64,
    ) -> Result<Array1<f64>, String> {
        let n_features = x.shape()[1];

        // X^T X
        let xtx = x.t().dot(x);

        // Add ridge penalty
        let mut regularized = xtx;
        for i in 0..n_features {
            regularized[[i, i]] += lambda;
        }

        // X^T y
        let xty = x.t().dot(y);

        // Solve using Cholesky decomposition (simplified)
        // In production, use proper linear algebra library
        let weights = self.solve_cholesky(&regularized, &xty)?;

        Ok(weights)
    }

    fn solve_cholesky(&self, a: &Array2<f64>, b: &Array1<f64>) -> Result<Array1<f64>, String> {
        // Simplified solver - in practice use LAPACK
        let n = a.shape()[0];

        // Gauss-Seidel iteration (simple iterative solver)
        let mut x = Array1::zeros(n);
        let max_iter = 1000;
        let tol = 1e-6;

        for _ in 0..max_iter {
            let mut x_new = x.clone();

            for i in 0..n {
                let mut sum = b[i];
                for j in 0..n {
                    if i != j {
                        sum -= a[[i, j]] * x[j];
                    }
                }
                x_new[i] = sum / a[[i, i]];
            }

            // Check convergence
            let diff: f64 = (&x_new - &x)
                .iter()
                .map(|&d| d * d)
                .sum::<f64>()
                .sqrt();

            x = x_new;

            if diff < tol {
                break;
            }
        }

        Ok(x)
    }

    fn count_effective_features(&self, weights: &Array1<f64>) -> usize {
        let threshold = 0.01 * weights.iter().map(|w| w.abs()).fold(0.0, f64::max);

        weights.iter()
            .filter(|&&w| w.abs() > threshold)
            .count()
    }

    pub fn get_sparsity(&self) -> f64 {
        if let Some(ref weights) = self.weights {
            let threshold = 0.01 * weights.iter().map(|w| w.abs()).fold(0.0, f64::max);
            let sparse_count = weights.iter()
                .filter(|&&w| w.abs() <= threshold)
                .count();

            sparse_count as f64 / self.n_features as f64
        } else {
            0.0
        }
    }

    /// Adaptive version that learns optimal frequencies
    pub fn estimate_adaptive(
        &mut self,
        data: &[Vec<f64>],
        iterations: usize,
    ) -> Result<usize, String> {
        for _ in 0..iterations {
            // Transform with current features
            let features = self.transform_batch(data);
            let targets = self.create_targets(data);

            // Learn weights
            let weights = self.ridge_regression(&features, &targets, 0.001)?;

            // Identify important features
            let threshold = 0.01 * weights.iter().map(|w| w.abs()).fold(0.0, f64::max);
            let important_indices: Vec<usize> = weights
                .iter()
                .enumerate()
                .filter(|(_, &w)| w.abs() > threshold)
                .map(|(i, _)| i)
                .collect();

            // Reinitialize unimportant features
            for i in 0..self.n_features {
                if !important_indices.contains(&i) {
                    // Resample this frequency
                    for j in 0..self.omega.shape()[1] {
                        self.omega[[i, j]] = rand::random::<f64>() * 2.0 - 1.0;
                    }
                    self.bias[i] = rand::random::<f64>() * 2.0 * PI;
                }
            }

            self.weights = Some(weights);
        }

        Ok(self.count_effective_features(
            self.weights.as_ref().unwrap(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fourier_emergence() {
        // Generate data with intrinsic dimension ~5
        let n_samples = 200;
        let ambient_dim = 50;
        let intrinsic_dim = 5;

        let mut data = Vec::new();
        for _ in 0..n_samples {
            // Generate low-dimensional data
            let mut latent = vec![0.0; intrinsic_dim];
            for i in 0..intrinsic_dim {
                latent[i] = rand::random::<f64>() * 2.0 - 1.0;
            }

            // Embed in high dimension with linear transformation
            let mut sample = vec![0.0; ambient_dim];
            for i in 0..intrinsic_dim {
                for j in 0..ambient_dim {
                    // Random linear embedding
                    let weight = ((i * ambient_dim + j) as f64).sin();
                    sample[j] += latent[i] * weight;
                }
            }

            data.push(sample);
        }

        // Use many random features
        let estimator = FourierEstimator::new(ambient_dim, 100);
        let effective_dim = estimator.estimate_from_data(&data).unwrap();

        // Should discover sparsity: ~30% of features active
        assert!(
            effective_dim < 40,
            "Should discover sparse effective dimension"
        );
    }

    #[test]
    fn test_adaptive_fourier() {
        // Simple 2D data in 10D space
        let n_samples = 100;
        let mut data = Vec::new();

        for _ in 0..n_samples {
            let x = rand::random::<f64>();
            let y = rand::random::<f64>();

            // Embed 2D in 10D
            let sample = vec![
                x, y,
                x + y, x - y,
                x * 0.5, y * 0.5,
                0.1, 0.1, 0.1, 0.1,  // Padding
            ];
            data.push(sample);
        }

        let mut estimator = FourierEstimator::new(10, 50);
        let dim = estimator.estimate_adaptive(&data, 10).unwrap();

        assert!(
            dim <= 10,
            "Adaptive should find very sparse representation"
        );
    }
}