pub mod pca;
pub mod mle;
pub mod twonn;

// Common utilities for all estimators
pub(crate) fn _normalize_data(data: &[Vec<f64>]) -> Vec<Vec<f64>> {
    if data.is_empty() || data[0].is_empty() {
        return vec![];
    }

    let n = data.len();
    let d = data[0].len();

    // Calculate means
    let mut means = vec![0.0; d];
    for sample in data {
        for (i, &val) in sample.iter().enumerate() {
            means[i] += val;
        }
    }
    for mean in &mut means {
        *mean /= n as f64;
    }

    // Calculate standard deviations
    let mut stds = vec![0.0; d];
    for sample in data {
        for (i, &val) in sample.iter().enumerate() {
            stds[i] += (val - means[i]).powi(2);
        }
    }
    for std in &mut stds {
        *std = (*std / n as f64).sqrt().max(1e-10); // Avoid division by zero
    }

    // Normalize
    let mut normalized = Vec::with_capacity(n);
    for sample in data {
        let mut norm_sample = Vec::with_capacity(d);
        for (i, &val) in sample.iter().enumerate() {
            norm_sample.push((val - means[i]) / stds[i]);
        }
        normalized.push(norm_sample);
    }

    normalized
}

/// Calculate pairwise distances efficiently
pub(crate) fn pairwise_distances(data: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let n = data.len();
    let mut distances = vec![vec![0.0; n]; n];

    for i in 0..n {
        for j in i + 1..n {
            let dist = euclidean_distance(&data[i], &data[j]);
            distances[i][j] = dist;
            distances[j][i] = dist;
        }
    }

    distances
}

fn euclidean_distance(a: &[f64], b: &[f64]) -> f64 {
    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f64>()
        .sqrt()
}