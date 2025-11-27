/// Maximum Likelihood Estimation of intrinsic dimension
/// Based on Levina & Bickel (2004) method
use super::pairwise_distances;

pub fn estimate(data: &[Vec<f64>]) -> Result<usize, String> {
    if data.len() < 10 {
        return Err("MLE requires at least 10 samples".to_string());
    }

    let distances = pairwise_distances(data);
    let n = data.len();

    // For each point, find k nearest neighbors
    let k = (n as f64).sqrt() as usize; // Heuristic for k
    let k = k.max(2).min(n - 1);

    let mut estimates = Vec::new();

    for i in 0..n {
        // Get distances to all other points
        let mut dists: Vec<f64> = distances[i]
            .iter()
            .enumerate()
            .filter(|(j, _)| *j != i)
            .map(|(_, &d)| d)
            .collect();

        dists.sort_by(|a, b| a.partial_cmp(b).unwrap());

        // MLE formula for local dimension
        let t_k = dists[k - 1];
        if t_k < 1e-10 {
            continue; // Skip if distances too small
        }

        let mut sum = 0.0;
        for j in 0..k {
            if dists[j] > 0.0 {
                sum += (t_k / dists[j]).ln();
            }
        }

        if sum > 0.0 {
            let local_dim = (k - 1) as f64 / sum;
            estimates.push(local_dim);
        }
    }

    if estimates.is_empty() {
        return Err("Could not estimate dimension".to_string());
    }

    // Return median estimate for robustness
    estimates.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median_idx = estimates.len() / 2;
    Ok(estimates[median_idx].round() as usize)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mle_synthetic() {
        // Generate data on a 5D manifold in 20D space
        let true_dim = 5;
        let ambient_dim = 20;
        let n_samples = 200;

        let mut data = Vec::new();
        for _ in 0..n_samples {
            // Generate 5D point
            let mut manifold_point = vec![0.0; true_dim];
            for i in 0..true_dim {
                manifold_point[i] = rand::random::<f64>() * 2.0 - 1.0;
            }

            // Embed in higher dimension
            let mut point = vec![0.0; ambient_dim];
            for i in 0..true_dim {
                point[i] = manifold_point[i];
            }

            // Add small noise
            for i in 0..ambient_dim {
                point[i] += (rand::random::<f64>() - 0.5) * 0.01;
            }

            data.push(point);
        }

        let estimated = estimate(&data).unwrap();
        assert!(
            (estimated as i32 - true_dim as i32).abs() <= 2,
            "MLE should estimate close to true dimension"
        );
    }
}