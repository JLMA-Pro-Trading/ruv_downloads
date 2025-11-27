use intrinsic_dim::{Estimator, EstimationMethod};

fn main() {
    println!("🎯 Intrinsic Dimensionality Estimation Demo\n");

    // Example 1: Simple 3D data embedded in 10D space
    simple_example();

    // Example 2: Compare all methods
    compare_methods();

    // Example 3: Discover compression potential
    compression_discovery();
}

fn simple_example() {
    println!("📊 Example 1: Simple 3D data in 10D space");
    println!("{}", "-".repeat(50));

    // Generate data: 3D manifold in 10D ambient space
    let data = intrinsic_dim::utils::generate_synthetic_data(
        200,  // samples
        3,    // true intrinsic dimension
        10,   // ambient dimension
        0.01, // noise
    );

    let estimator = Estimator::new();  // Uses Fourier by default
    let result = estimator.estimate(&data).unwrap();

    println!("Original dimension: {}", result.original_dim);
    println!("Intrinsic dimension: {}", result.intrinsic_dim);
    println!("Compression ratio: {:.1}x", result.compression_ratio);
    println!("Confidence interval: ({:.1}, {:.1})",
             result.confidence_interval.0,
             result.confidence_interval.1);

    if let Some(sparsity) = result.sparsity {
        println!("Sparsity: {:.1}%", sparsity * 100.0);
    }

    println!("\n✅ You can compress this 10D data to ~3D!");
    println!("   Memory savings: {:.0}%",
             (1.0 - 1.0/result.compression_ratio) * 100.0);
    println!();
}

fn compare_methods() {
    println!("🔬 Example 2: Comparing estimation methods");
    println!("{}", "-".repeat(50));

    // Generate more complex data
    let data = intrinsic_dim::utils::generate_synthetic_data(
        500,  // samples
        5,    // true dimension
        20,   // ambient dimension
        0.02, // noise
    );

    let methods = vec![
        ("PCA", EstimationMethod::PCA),
        ("MLE", EstimationMethod::MLE),
        ("TwoNN", EstimationMethod::TwoNN),
        ("Fourier", EstimationMethod::FourierEmergence),
    ];

    println!("True intrinsic dimension: 5\n");

    for (name, method) in methods {
        let estimator = Estimator::with_method(method);
        match estimator.estimate(&data) {
            Ok(result) => {
                println!("{:10} estimate: {} (compression: {:.1}x)",
                        name,
                        result.intrinsic_dim,
                        result.compression_ratio);
            }
            Err(e) => {
                println!("{:10} failed: {}", name, e);
            }
        }
    }
    println!();
}

fn compression_discovery() {
    println!("💾 Example 3: Discovering compression potential");
    println!("{}", "-".repeat(50));

    // Simulate high-dimensional data (like images or embeddings)
    let dimensions = vec![
        (784, 10),   // MNIST-like: 784D → ~10D
        (2048, 50),  // Image features: 2048D → ~50D
        (768, 30),   // BERT embeddings: 768D → ~30D
        (1024, 20),  // Audio features: 1024D → ~20D
    ];

    for (ambient, intrinsic) in dimensions {
        let data = intrinsic_dim::utils::generate_synthetic_data(
            300,
            intrinsic,
            ambient,
            0.01,
        );

        let estimator = Estimator::new();
        let result = estimator.estimate(&data).unwrap();

        println!("{}D data:", ambient);
        println!("  → Intrinsic: {}D", result.intrinsic_dim);
        println!("  → Compression: {:.1}x", result.compression_ratio);
        println!("  → Memory saved: {:.0}%",
                (1.0 - 1.0/result.compression_ratio) * 100.0);

        // Show practical impact
        let mb_original = (ambient * 300 * 4) as f64 / 1_000_000.0;
        let mb_compressed = mb_original / result.compression_ratio;
        println!("  → Size: {:.2}MB → {:.2}MB\n",
                mb_original, mb_compressed);
    }

    println!("🚀 Key insight: Most high-dimensional data can be");
    println!("   compressed 10-50x without losing information!");
}