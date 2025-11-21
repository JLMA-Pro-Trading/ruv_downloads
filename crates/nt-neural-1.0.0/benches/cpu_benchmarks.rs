use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use ndarray::{Array1, Array2};
use rand::Rng;
use std::collections::HashMap;

// ============================================================================
// Helper Functions for Generating Test Data
// ============================================================================

fn generate_data(size: usize) -> Vec<f64> {
    let mut rng = rand::thread_rng();
    (0..size).map(|_| rng.gen_range(-100.0..100.0)).collect()
}

fn generate_array1(size: usize) -> Array1<f64> {
    let mut rng = rand::thread_rng();
    Array1::from_vec(
        (0..size).map(|_| rng.gen_range(-100.0..100.0)).collect()
    )
}

fn generate_array2(rows: usize, cols: usize) -> Array2<f64> {
    let mut rng = rand::thread_rng();
    Array2::from_shape_vec(
        (rows, cols),
        (0..rows * cols).map(|_| rng.gen_range(-100.0..100.0)).collect()
    ).unwrap()
}

fn generate_time_series(size: usize) -> Vec<f64> {
    let mut rng = rand::thread_rng();
    let mut series = vec![rng.gen_range(0.0..100.0)];
    for _ in 1..size {
        let last = *series.last().unwrap();
        let change = rng.gen_range(-5.0..5.0);
        series.push(last + change);
    }
    series
}

// ============================================================================
// 1. PREPROCESSING BENCHMARKS
// ============================================================================

fn normalize_zscore(data: &[f64]) -> Vec<f64> {
    let mean = data.iter().sum::<f64>() / data.len() as f64;
    let variance = data.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / data.len() as f64;
    let std_dev = variance.sqrt();

    if std_dev == 0.0 {
        vec![0.0; data.len()]
    } else {
        data.iter().map(|x| (x - mean) / std_dev).collect()
    }
}

fn normalize_minmax(data: &[f64]) -> Vec<f64> {
    let min = data.iter().fold(f64::INFINITY, |a, &b| a.min(b));
    let max = data.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));

    if max == min {
        vec![0.0; data.len()]
    } else {
        data.iter().map(|x| (x - min) / (max - min)).collect()
    }
}

fn normalize_robust(data: &[f64]) -> Vec<f64> {
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let q1_idx = sorted.len() / 4;
    let q3_idx = (sorted.len() * 3) / 4;
    let median_idx = sorted.len() / 2;

    let q1 = sorted[q1_idx];
    let q3 = sorted[q3_idx];
    let median = sorted[median_idx];
    let iqr = q3 - q1;

    if iqr == 0.0 {
        vec![0.0; data.len()]
    } else {
        data.iter().map(|x| (x - median) / iqr).collect()
    }
}

fn differencing_first_order(data: &[f64]) -> Vec<f64> {
    data.windows(2).map(|w| w[1] - w[0]).collect()
}

fn differencing_second_order(data: &[f64]) -> Vec<f64> {
    let first = differencing_first_order(data);
    differencing_first_order(&first)
}

fn detrend_linear(data: &[f64]) -> Vec<f64> {
    let n = data.len() as f64;
    let x_mean = (n - 1.0) / 2.0;
    let y_mean = data.iter().sum::<f64>() / n;

    let mut numerator = 0.0;
    let mut denominator = 0.0;

    for (i, &y) in data.iter().enumerate() {
        let x = i as f64;
        numerator += (x - x_mean) * (y - y_mean);
        denominator += (x - x_mean).powi(2);
    }

    let slope = if denominator != 0.0 { numerator / denominator } else { 0.0 };
    let intercept = y_mean - slope * x_mean;

    data.iter()
        .enumerate()
        .map(|(i, &y)| y - (slope * i as f64 + intercept))
        .collect()
}

fn remove_outliers_iqr(data: &[f64], multiplier: f64) -> Vec<f64> {
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let q1_idx = sorted.len() / 4;
    let q3_idx = (sorted.len() * 3) / 4;

    let q1 = sorted[q1_idx];
    let q3 = sorted[q3_idx];
    let iqr = q3 - q1;

    let lower_bound = q1 - multiplier * iqr;
    let upper_bound = q3 + multiplier * iqr;

    data.iter()
        .filter(|&&x| x >= lower_bound && x <= upper_bound)
        .copied()
        .collect()
}

fn benchmark_preprocessing(c: &mut Criterion) {
    let mut group = c.benchmark_group("preprocessing");

    for size in [100, 1000, 10000, 100000].iter() {
        let data = generate_data(*size);

        // Normalization benchmarks
        group.bench_with_input(
            BenchmarkId::new("zscore", size),
            &data,
            |b, data| b.iter(|| normalize_zscore(black_box(data)))
        );

        group.bench_with_input(
            BenchmarkId::new("minmax", size),
            &data,
            |b, data| b.iter(|| normalize_minmax(black_box(data)))
        );

        group.bench_with_input(
            BenchmarkId::new("robust", size),
            &data,
            |b, data| b.iter(|| normalize_robust(black_box(data)))
        );

        // Differencing benchmarks
        group.bench_with_input(
            BenchmarkId::new("diff_first_order", size),
            &data,
            |b, data| b.iter(|| differencing_first_order(black_box(data)))
        );

        group.bench_with_input(
            BenchmarkId::new("diff_second_order", size),
            &data,
            |b, data| b.iter(|| differencing_second_order(black_box(data)))
        );

        // Detrending benchmarks
        group.bench_with_input(
            BenchmarkId::new("detrend_linear", size),
            &data,
            |b, data| b.iter(|| detrend_linear(black_box(data)))
        );

        // Outlier removal
        group.bench_with_input(
            BenchmarkId::new("remove_outliers", size),
            &data,
            |b, data| b.iter(|| remove_outliers_iqr(black_box(data), 1.5))
        );
    }

    group.finish();
}

// ============================================================================
// 2. FEATURE ENGINEERING BENCHMARKS
// ============================================================================

fn create_lags(data: &[f64], n_lags: usize) -> Vec<Vec<f64>> {
    (1..=n_lags)
        .map(|lag| {
            let mut lagged = vec![0.0; lag];
            lagged.extend_from_slice(&data[..data.len() - lag]);
            lagged
        })
        .collect()
}

fn rolling_mean(data: &[f64], window: usize) -> Vec<f64> {
    data.windows(window)
        .map(|w| w.iter().sum::<f64>() / window as f64)
        .collect()
}

fn rolling_std(data: &[f64], window: usize) -> Vec<f64> {
    data.windows(window)
        .map(|w| {
            let mean = w.iter().sum::<f64>() / window as f64;
            let variance = w.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / window as f64;
            variance.sqrt()
        })
        .collect()
}

fn rolling_min(data: &[f64], window: usize) -> Vec<f64> {
    data.windows(window)
        .map(|w| w.iter().fold(f64::INFINITY, |a, &b| a.min(b)))
        .collect()
}

fn rolling_max(data: &[f64], window: usize) -> Vec<f64> {
    data.windows(window)
        .map(|w| w.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b)))
        .collect()
}

fn ema(data: &[f64], alpha: f64) -> Vec<f64> {
    let mut result = Vec::with_capacity(data.len());
    let mut ema_val = data[0];
    result.push(ema_val);

    for &value in &data[1..] {
        ema_val = alpha * value + (1.0 - alpha) * ema_val;
        result.push(ema_val);
    }

    result
}

fn rate_of_change(data: &[f64], period: usize) -> Vec<f64> {
    data.windows(period + 1)
        .map(|w| {
            let old = w[0];
            let new = w[period];
            if old != 0.0 {
                (new - old) / old * 100.0
            } else {
                0.0
            }
        })
        .collect()
}

fn fourier_features(data: &[f64], n_frequencies: usize) -> Vec<Vec<f64>> {
    let n = data.len();
    let mut features = Vec::new();

    for k in 1..=n_frequencies {
        let freq = 2.0 * std::f64::consts::PI * k as f64 / n as f64;

        let sin_feat: Vec<f64> = (0..n)
            .map(|i| (freq * i as f64).sin())
            .collect();

        let cos_feat: Vec<f64> = (0..n)
            .map(|i| (freq * i as f64).cos())
            .collect();

        features.push(sin_feat);
        features.push(cos_feat);
    }

    features
}

fn benchmark_feature_engineering(c: &mut Criterion) {
    let mut group = c.benchmark_group("feature_engineering");

    for size in [1000, 5000, 10000, 50000].iter() {
        let data = generate_time_series(*size);

        // Lag creation
        for n_lags in [1, 5, 10, 20].iter() {
            group.bench_with_input(
                BenchmarkId::new("lags", format!("size{}_lags{}", size, n_lags)),
                &data,
                |b, data| b.iter(|| create_lags(black_box(data), *n_lags))
            );
        }

        // Rolling statistics
        for window in [20, 50, 100].iter() {
            if *window < *size {
                group.bench_with_input(
                    BenchmarkId::new("rolling_mean", format!("size{}_win{}", size, window)),
                    &data,
                    |b, data| b.iter(|| rolling_mean(black_box(data), *window))
                );

                group.bench_with_input(
                    BenchmarkId::new("rolling_std", format!("size{}_win{}", size, window)),
                    &data,
                    |b, data| b.iter(|| rolling_std(black_box(data), *window))
                );

                group.bench_with_input(
                    BenchmarkId::new("rolling_min", format!("size{}_win{}", size, window)),
                    &data,
                    |b, data| b.iter(|| rolling_min(black_box(data), *window))
                );

                group.bench_with_input(
                    BenchmarkId::new("rolling_max", format!("size{}_win{}", size, window)),
                    &data,
                    |b, data| b.iter(|| rolling_max(black_box(data), *window))
                );
            }
        }

        // Technical indicators
        group.bench_with_input(
            BenchmarkId::new("ema", size),
            &data,
            |b, data| b.iter(|| ema(black_box(data), 0.1))
        );

        group.bench_with_input(
            BenchmarkId::new("roc", size),
            &data,
            |b, data| b.iter(|| rate_of_change(black_box(data), 14))
        );

        // Fourier features (only for smaller sizes)
        if *size <= 10000 {
            group.bench_with_input(
                BenchmarkId::new("fourier_5freq", size),
                &data,
                |b, data| b.iter(|| fourier_features(black_box(data), 5))
            );
        }
    }

    group.finish();
}

// ============================================================================
// 3. MODEL INFERENCE BENCHMARKS (Simulated)
// ============================================================================

fn gru_forward_pass(input: &Array2<f64>, hidden_size: usize) -> Array2<f64> {
    let (batch_size, seq_len) = input.dim();

    // Simulated GRU computation
    let mut output = Array2::zeros((batch_size, hidden_size));
    let mut hidden = Array1::zeros(hidden_size);

    for t in 0..seq_len {
        for b in 0..batch_size {
            let x = input[[b, t]];

            // Reset gate (simplified)
            let r = (0.5 * x + 0.3 * hidden.sum()).tanh();

            // Update gate (simplified)
            let z = (0.5 * x + 0.3 * hidden.sum()).tanh();

            // Candidate hidden (simplified)
            let h_tilde = (0.5 * x + 0.3 * r * hidden.sum()).tanh();

            // Update hidden state
            for i in 0..hidden_size {
                hidden[i] = (1.0 - z) * hidden[i] + z * h_tilde;
                output[[b, i]] = hidden[i];
            }
        }
    }

    output
}

fn tcn_forward_pass(input: &Array2<f64>, kernel_size: usize) -> Array2<f64> {
    let (batch_size, seq_len) = input.dim();
    let output_size = seq_len - kernel_size + 1;

    // Simulated TCN computation
    let mut output = Array2::zeros((batch_size, output_size));

    for b in 0..batch_size {
        for i in 0..output_size {
            let mut sum = 0.0;
            for k in 0..kernel_size {
                sum += input[[b, i + k]] * (k as f64 * 0.1);
            }
            output[[b, i]] = sum.tanh();
        }
    }

    output
}

fn nbeats_forward_pass(input: &Array1<f64>, stack_size: usize, block_size: usize) -> Array1<f64> {
    let input_len = input.len();
    let mut forecast = Array1::zeros(input_len);

    // Simulated N-BEATS computation
    for _ in 0..stack_size {
        for _ in 0..block_size {
            let mut block_output = Array1::zeros(input_len);

            // Basis expansion (polynomial)
            for i in 0..input_len {
                let t = i as f64 / input_len as f64;
                block_output[i] = t.powi(2) * input[i];
            }

            forecast = forecast + block_output;
        }
    }

    forecast
}

fn prophet_predict(data: &[f64], seasonality_order: usize) -> Vec<f64> {
    let n = data.len();
    let mut forecast = vec![0.0; n];

    // Trend component
    let trend_slope = (data[n-1] - data[0]) / (n as f64 - 1.0);
    for i in 0..n {
        forecast[i] = data[0] + trend_slope * i as f64;
    }

    // Seasonality component (simplified Fourier series)
    for k in 1..=seasonality_order {
        let freq = 2.0 * std::f64::consts::PI * k as f64 / n as f64;
        for i in 0..n {
            forecast[i] += 0.1 * (freq * i as f64).sin();
        }
    }

    forecast
}

fn benchmark_model_inference(c: &mut Criterion) {
    let mut group = c.benchmark_group("model_inference");

    // GRU benchmarks
    for batch_size in [1, 8, 32, 128].iter() {
        let input = generate_array2(*batch_size, 100);
        let hidden_size = 64;

        group.bench_with_input(
            BenchmarkId::new("gru_cpu", format!("batch{}", batch_size)),
            &input,
            |b, input| b.iter(|| gru_forward_pass(black_box(input), hidden_size))
        );
    }

    // TCN benchmarks
    for batch_size in [1, 8, 32, 128].iter() {
        let input = generate_array2(*batch_size, 100);
        let kernel_size = 3;

        group.bench_with_input(
            BenchmarkId::new("tcn_cpu", format!("batch{}", batch_size)),
            &input,
            |b, input| b.iter(|| tcn_forward_pass(black_box(input), kernel_size))
        );
    }

    // N-BEATS benchmarks
    for seq_len in [50, 100, 200].iter() {
        let input = generate_array1(*seq_len);

        group.bench_with_input(
            BenchmarkId::new("nbeats_cpu", format!("seq{}", seq_len)),
            &input,
            |b, input| b.iter(|| nbeats_forward_pass(black_box(input), 3, 3))
        );
    }

    // Prophet benchmarks
    for size in [100, 365, 730].iter() {
        let data = generate_time_series(*size);

        group.bench_with_input(
            BenchmarkId::new("prophet_cpu", format!("days{}", size)),
            &data,
            |b, data| b.iter(|| prophet_predict(black_box(data), 10))
        );
    }

    group.finish();
}

// ============================================================================
// 4. TRAINING BENCHMARKS
// ============================================================================

fn compute_gradients(weights: &Array1<f64>, inputs: &Array2<f64>, targets: &Array1<f64>) -> Array1<f64> {
    let (n_samples, n_features) = inputs.dim();
    let mut gradients = Array1::zeros(n_features);

    for i in 0..n_samples {
        let mut prediction = 0.0;
        for j in 0..n_features {
            prediction += weights[j] * inputs[[i, j]];
        }

        let error = prediction - targets[i];

        for j in 0..n_features {
            gradients[j] += 2.0 * error * inputs[[i, j]] / n_samples as f64;
        }
    }

    gradients
}

fn update_parameters(weights: &mut Array1<f64>, gradients: &Array1<f64>, learning_rate: f64) {
    for i in 0..weights.len() {
        weights[i] -= learning_rate * gradients[i];
    }
}

fn training_epoch(weights: &mut Array1<f64>, inputs: &Array2<f64>, targets: &Array1<f64>, lr: f64) {
    let gradients = compute_gradients(weights, inputs, targets);
    update_parameters(weights, &gradients, lr);
}

fn full_training_loop(n_epochs: usize, n_samples: usize, n_features: usize) -> Array1<f64> {
    let mut weights = Array1::zeros(n_features);
    let inputs = generate_array2(n_samples, n_features);
    let targets = generate_array1(n_samples);

    for _ in 0..n_epochs {
        training_epoch(&mut weights, &inputs, &targets, 0.01);
    }

    weights
}

fn benchmark_training(c: &mut Criterion) {
    let mut group = c.benchmark_group("training");

    // Single epoch benchmarks
    for (n_samples, n_features) in [(100, 10), (1000, 50), (10000, 100)].iter() {
        let mut weights = Array1::zeros(*n_features);
        let inputs = generate_array2(*n_samples, *n_features);
        let targets = generate_array1(*n_samples);

        group.bench_function(
            &format!("epoch_s{}_f{}", n_samples, n_features),
            |b| b.iter(|| training_epoch(black_box(&mut weights.clone()), black_box(&inputs), black_box(&targets), 0.01))
        );
    }

    // Gradient computation benchmarks
    for (n_samples, n_features) in [(100, 10), (1000, 50), (10000, 100)].iter() {
        let weights = Array1::zeros(*n_features);
        let inputs = generate_array2(*n_samples, *n_features);
        let targets = generate_array1(*n_samples);

        group.bench_function(
            &format!("gradients_s{}_f{}", n_samples, n_features),
            |b| b.iter(|| compute_gradients(black_box(&weights), black_box(&inputs), black_box(&targets)))
        );
    }

    // Parameter update benchmarks
    for n_features in [10, 50, 100, 500].iter() {
        let mut weights = Array1::zeros(*n_features);
        let gradients = generate_array1(*n_features);

        group.bench_function(
            &format!("param_update_f{}", n_features),
            |b| b.iter(|| update_parameters(black_box(&mut weights), black_box(&gradients), 0.01))
        );
    }

    // Full training loop (10 epochs)
    for (n_samples, n_features) in [(100, 10), (1000, 50)].iter() {
        group.bench_function(
            &format!("full_loop_10e_s{}_f{}", n_samples, n_features),
            |b| b.iter(|| full_training_loop(10, *n_samples, *n_features))
        );
    }

    group.finish();
}

// ============================================================================
// 5. MEMORY BENCHMARKS
// ============================================================================

fn allocation_benchmark(size: usize, count: usize) -> Vec<Vec<f64>> {
    (0..count)
        .map(|_| vec![0.0; size])
        .collect()
}

fn clone_benchmark(data: &[f64], count: usize) -> Vec<Vec<f64>> {
    (0..count)
        .map(|_| data.to_vec())
        .collect()
}

fn cache_efficient_sum(data: &[f64]) -> f64 {
    data.iter().sum()
}

fn cache_inefficient_sum(data: &Array2<f64>) -> f64 {
    let (rows, cols) = data.dim();
    let mut sum = 0.0;

    // Column-major access (cache inefficient for row-major storage)
    for col in 0..cols {
        for row in 0..rows {
            sum += data[[row, col]];
        }
    }

    sum
}

fn benchmark_memory(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory");

    // Allocation benchmarks
    for size in [100, 1000, 10000].iter() {
        group.bench_function(
            &format!("allocation_size{}_count100", size),
            |b| b.iter(|| allocation_benchmark(black_box(*size), 100))
        );
    }

    // Clone benchmarks
    for size in [100, 1000, 10000, 100000].iter() {
        let data = generate_data(*size);

        group.bench_function(
            &format!("clone_size{}_count10", size),
            |b| b.iter(|| clone_benchmark(black_box(&data), 10))
        );
    }

    // Cache efficiency benchmarks
    for size in [1000, 10000, 100000].iter() {
        let data = generate_data(*size);

        group.bench_function(
            &format!("cache_efficient_sum_{}", size),
            |b| b.iter(|| cache_efficient_sum(black_box(&data)))
        );
    }

    for dim in [100, 316, 1000].iter() {  // 316^2 ≈ 100k
        let data = generate_array2(*dim, *dim);

        group.bench_function(
            &format!("cache_inefficient_sum_{}x{}", dim, dim),
            |b| b.iter(|| cache_inefficient_sum(black_box(&data)))
        );
    }

    group.finish();
}

// ============================================================================
// Criterion Configuration
// ============================================================================

criterion_group! {
    name = benches;
    config = Criterion::default()
        .sample_size(100)
        .measurement_time(std::time::Duration::from_secs(10));
    targets =
        benchmark_preprocessing,
        benchmark_feature_engineering,
        benchmark_model_inference,
        benchmark_training,
        benchmark_memory
}

criterion_main!(benches);
