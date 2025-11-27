use ndarray::{Array1, Array2};
use ndarray_rand::RandomExt;
use ndarray_rand::rand_distr::StandardNormal;

/// Estimate intrinsic dimensionality using PCA
/// Returns the number of components explaining 95% of variance
pub fn estimate(data: &[Vec<f64>]) -> Result<usize, String> {
    if data.is_empty() || data[0].is_empty() {
        return Err("Empty data".to_string());
    }

    let n_samples = data.len();
    let n_features = data[0].len();

    // Convert to ndarray
    let mut matrix = Array2::<f64>::zeros((n_samples, n_features));
    for (i, sample) in data.iter().enumerate() {
        for (j, &val) in sample.iter().enumerate() {
            matrix[[i, j]] = val;
        }
    }

    // Center the data
    let means = matrix.mean_axis(ndarray::Axis(0)).unwrap();
    for i in 0..n_samples {
        for j in 0..n_features {
            matrix[[i, j]] -= means[j];
        }
    }

    // Compute covariance matrix (simplified for demonstration)
    // In production, use proper SVD library
    let cov = matrix.t().dot(&matrix) / (n_samples - 1) as f64;

    // Simplified eigenvalue estimation
    // In practice, use proper eigenvalue decomposition
    let eigenvalues = estimate_eigenvalues(&cov)?;

    // Find number of components for 95% variance
    let total_variance: f64 = eigenvalues.iter().sum();
    let mut cumulative_variance = 0.0;
    let mut n_components = 0;

    for eigenvalue in eigenvalues.iter() {
        cumulative_variance += eigenvalue;
        n_components += 1;
        if cumulative_variance / total_variance >= 0.95 {
            break;
        }
    }

    Ok(n_components.max(1))
}

/// Power iteration method for largest eigenvalues (simplified)
fn estimate_eigenvalues(matrix: &Array2<f64>) -> Result<Vec<f64>, String> {
    let n = matrix.shape()[0];
    let mut eigenvalues = Vec::new();

    // Power iteration for top eigenvalues
    let n_iter = n.min(50); // Limit iterations

    for _ in 0..n_iter.min(10) {
        // Random initial vector
        let mut v = Array1::<f64>::random(n, StandardNormal);

        // Power iteration
        for _ in 0..20 {
            let new_v = matrix.dot(&v);
            let norm = new_v.dot(&new_v).sqrt();
            if norm < 1e-10 {
                break;
            }
            v = new_v / norm;
        }

        // Rayleigh quotient for eigenvalue
        let av = matrix.dot(&v);
        let eigenvalue = v.dot(&av);

        if eigenvalue > 1e-6 {
            eigenvalues.push(eigenvalue);
        }
    }

    eigenvalues.sort_by(|a, b| b.partial_cmp(a).unwrap());

    if eigenvalues.is_empty() {
        return Err("Failed to compute eigenvalues".to_string());
    }

    Ok(eigenvalues)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pca_low_rank() {
        // Create low-rank data (3D embedded in 10D)
        let mut data = Vec::new();
        for _ in 0..100 {
            let a = rand::random::<f64>();
            let b = rand::random::<f64>();
            let c = rand::random::<f64>();

            // Embed 3D data in 10D space
            let sample = vec![
                a, b, c,
                a + b, b + c, a + c,  // Linear combinations
                a * 0.5, b * 0.5, c * 0.5,  // Scaled versions
                a + b + c,  // Another combination
            ];
            data.push(sample);
        }

        let dim = estimate(&data).unwrap();
        assert!(dim <= 4, "Should detect low intrinsic dimension");
    }
}