use intrinsic_dim::{Estimator, EstimationMethod};

#[test]
fn test_all_methods_work() {
    // Create simple low-rank data
    let data = intrinsic_dim::utils::generate_synthetic_data(100, 3, 10, 0.01);

    let methods = vec![
        EstimationMethod::PCA,
        EstimationMethod::MLE,
        EstimationMethod::TwoNN,
        EstimationMethod::FourierEmergence,
    ];

    for method in methods {
        let estimator = Estimator::with_method(method);
        let result = estimator.estimate(&data);
        assert!(result.is_ok(), "Method {:?} should work", method);

        let res = result.unwrap();
        assert!(res.intrinsic_dim > 0);
        assert!(res.intrinsic_dim <= res.original_dim);
        assert!(res.compression_ratio >= 1.0);
    }
}

#[test]
fn test_fourier_emergence() {
    // Test the key discovery: 100 features -> ~30 effective
    let data = intrinsic_dim::utils::generate_synthetic_data(
        200,
        5,   // True intrinsic dimension
        50,  // Ambient dimension
        0.01,
    );

    let estimator = Estimator::with_method(EstimationMethod::FourierEmergence);
    let result = estimator.estimate(&data).unwrap();

    // Should discover low intrinsic dimension
    assert!(result.intrinsic_dim < 20, "Should find sparse representation");
    assert!(result.compression_ratio > 2.0, "Should achieve compression");

    // Fourier method should report sparsity
    assert!(result.sparsity.is_some(), "Fourier should report sparsity");
    if let Some(sparsity) = result.sparsity {
        assert!(sparsity > 0.5, "Should achieve >50% sparsity");
    }
}

#[test]
fn test_fast_estimation() {
    // Large dataset
    let data = intrinsic_dim::utils::generate_synthetic_data(10000, 10, 100, 0.01);

    let estimator = Estimator::new();

    // Fast estimation with subsampling
    let result = estimator.estimate_fast(&data, 500).unwrap();

    assert!(result.intrinsic_dim > 0);
    assert!(result.intrinsic_dim < 30);  // Should still find low dimension
}

#[test]
fn test_confidence_intervals() {
    let data = intrinsic_dim::utils::generate_synthetic_data(500, 5, 20, 0.01);

    let estimator = Estimator::new();
    let result = estimator.estimate(&data).unwrap();

    let (lower, upper) = result.confidence_interval;
    assert!(lower > 0.0);
    assert!(upper > lower);
    assert!(result.intrinsic_dim as f64 >= lower);
    assert!(result.intrinsic_dim as f64 <= upper);
}

#[test]
fn test_edge_cases() {
    let estimator = Estimator::new();

    // Empty data
    let empty_data: Vec<Vec<f64>> = vec![];
    assert!(estimator.estimate(&empty_data).is_err());

    // Single sample
    let single = vec![vec![1.0, 2.0, 3.0]];
    assert!(estimator.estimate(&single).is_err());

    // Too few samples for some methods
    let few_samples = vec![
        vec![1.0, 2.0, 3.0],
        vec![2.0, 3.0, 4.0],
        vec![3.0, 4.0, 5.0],
    ];

    // PCA should work with few samples
    let pca = Estimator::with_method(EstimationMethod::PCA);
    assert!(pca.estimate(&few_samples).is_ok());

    // MLE needs more samples
    let mle = Estimator::with_method(EstimationMethod::MLE);
    assert!(mle.estimate(&few_samples).is_err());
}

#[test]
fn test_high_dimensional_data() {
    // Test with very high dimensional data (like embeddings)
    let data = intrinsic_dim::utils::generate_synthetic_data(
        200,
        30,   // Typical for embeddings
        768,  // BERT-like dimension
        0.02,
    );

    let estimator = Estimator::new();
    let result = estimator.estimate(&data).unwrap();

    assert!(result.intrinsic_dim < 100, "Should find much lower dimension");
    assert!(result.compression_ratio > 5.0, "Should achieve high compression");
}

#[test]
fn test_validation() {
    // Test the validation utility
    assert!(intrinsic_dim::utils::validate_dimension(5, 100, 20));
    assert!(!intrinsic_dim::utils::validate_dimension(0, 100, 20));
    assert!(!intrinsic_dim::utils::validate_dimension(25, 100, 20));
    assert!(!intrinsic_dim::utils::validate_dimension(15, 50, 20));
}