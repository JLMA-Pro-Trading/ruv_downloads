/// Two-Nearest-Neighbor (TwoNN) estimator
/// Based on Facco et al. (2017)
/// More robust than MLE for small samples
use super::pairwise_distances;

pub fn estimate(data: &[Vec<f64>]) -> Result<usize, String> {
    if data.len() < 20 {
        return Err("TwoNN requires at least 20 samples".to_string());
    }

    let distances = pairwise_distances(data);
    let n = data.len();

    let mut ratios = Vec::new();

    for i in 0..n {
        // Get distances to all other points
        let mut dists: Vec<f64> = distances[i]
            .iter()
            .enumerate()
            .filter(|(j, _)| *j != i)
            .map(|(_, &d)| d)
            .filter(|&d| d > 1e-10)  // Filter out zero distances
            .collect();

        if dists.len() < 2 {
            continue;
        }

        dists.sort_by(|a, b| a.partial_cmp(b).unwrap());

        // Ratio of distances to 2nd and 1st nearest neighbors
        let r1 = dists[0];
        let r2 = dists[1];

        if r1 > 0.0 {
            let ratio = r2 / r1;
            ratios.push(ratio);
        }
    }

    if ratios.len() < 10 {
        return Err("Insufficient valid distance ratios".to_string());
    }

    // Fit Pareto distribution to ratios
    // The shape parameter relates to intrinsic dimension
    let dimension = estimate_pareto_dimension(&ratios)?;

    Ok(dimension.round() as usize)
}

fn estimate_pareto_dimension(ratios: &[f64]) -> Result<f64, String> {
    // Filter ratios > 1 (Pareto support)
    let valid_ratios: Vec<f64> = ratios.iter()
        .filter(|&&r| r > 1.0)
        .cloned()
        .collect();

    if valid_ratios.len() < 5 {
        return Err("Not enough valid ratios for Pareto fit".to_string());
    }

    // Maximum likelihood estimation of Pareto shape parameter
    let n = valid_ratios.len() as f64;
    let sum_log: f64 = valid_ratios.iter()
        .map(|r| r.ln())
        .sum();

    if sum_log <= 0.0 {
        return Err("Invalid log sum".to_string());
    }

    // Shape parameter α relates to dimension d as: d = 2α
    let alpha = n / sum_log;
    let dimension = 2.0 * alpha;

    // Apply correction factor for finite samples
    let corrected = dimension * (1.0 - 2.0 / n);

    Ok(corrected.max(1.0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_twonn_uniform() {
        // Generate uniformly distributed data in 3D
        let true_dim = 3;
        let n_samples = 500;

        let mut data = Vec::new();
        for _ in 0..n_samples {
            let point = vec![
                rand::random::<f64>(),
                rand::random::<f64>(),
                rand::random::<f64>(),
            ];
            data.push(point);
        }

        let estimated = estimate(&data).unwrap();
        assert!(
            (estimated as i32 - true_dim as i32).abs() <= 1,
            "TwoNN should estimate close to true dimension for uniform data"
        );
    }

    #[test]
    fn test_twonn_manifold() {
        // Generate data on a 2D manifold (surface) in 10D
        let true_dim = 2;
        let ambient_dim = 10;
        let n_samples = 300;

        let mut data = Vec::new();
        for _ in 0..n_samples {
            // Parametric surface
            let u = rand::random::<f64>() * 2.0 * std::f64::consts::PI;
            let v = rand::random::<f64>() * 2.0 * std::f64::consts::PI;

            let mut point = vec![0.0; ambient_dim];
            point[0] = u.cos();
            point[1] = u.sin();
            point[2] = v.cos();
            point[3] = v.sin();
            point[4] = (u + v).cos();

            // Add small noise
            for i in 0..ambient_dim {
                point[i] += (rand::random::<f64>() - 0.5) * 0.01;
            }

            data.push(point);
        }

        let estimated = estimate(&data).unwrap();
        assert!(
            estimated <= 4,
            "TwoNN should detect low dimension for manifold data"
        );
    }
}