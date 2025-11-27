use intrinsic_dim::{Estimator, EstimationMethod};
use std::time::Instant;

fn main() {
    println!("🖼️  Image Data Compression Analysis\n");

    // Simulate different types of image data
    analyze_image_patches();
    analyze_face_embeddings();
    analyze_neural_features();
}

fn analyze_image_patches() {
    println!("📷 Analyzing image patches (like from ImageNet)");
    println!("{}", "-".repeat(50));

    // Simulate 32x32 RGB patches (3072 dimensions)
    let patch_size = 32 * 32 * 3;

    // Natural images typically have intrinsic dimension ~50-100
    let data = intrinsic_dim::utils::generate_synthetic_data(
        500,
        75,  // Typical for natural image patches
        patch_size,
        0.05,
    );

    let estimator = Estimator::new();
    let start = Instant::now();
    let result = estimator.estimate(&data).unwrap();
    let elapsed = start.elapsed();

    println!("Image patch analysis ({}D):", patch_size);
    println!("  Intrinsic dimension: {}", result.intrinsic_dim);
    println!("  Compression ratio: {:.1}x", result.compression_ratio);
    println!("  Analysis time: {:.2}ms", elapsed.as_millis());

    // Show practical impact
    let gb_per_million = (patch_size * 1_000_000 * 4) as f64 / 1_000_000_000.0;
    let gb_compressed = gb_per_million / result.compression_ratio;

    println!("\n  Storage for 1M patches:");
    println!("    Original: {:.2} GB", gb_per_million);
    println!("    Compressed: {:.2} GB", gb_compressed);
    println!("    Saved: {:.2} GB\n", gb_per_million - gb_compressed);
}

fn analyze_face_embeddings() {
    println!("👤 Analyzing face recognition embeddings");
    println!("{}", "-".repeat(50));

    // FaceNet/ArcFace embeddings are typically 512D
    let embedding_dim = 512;

    // Face embeddings have intrinsic dimension ~15-30
    let data = intrinsic_dim::utils::generate_synthetic_data(
        1000,
        22,  // Typical for face embeddings
        embedding_dim,
        0.02,
    );

    let methods = vec![
        EstimationMethod::PCA,
        EstimationMethod::FourierEmergence,
        EstimationMethod::TwoNN,
    ];

    println!("Face embedding dimension: {}D\n", embedding_dim);

    for method in methods {
        let estimator = Estimator::with_method(method);
        let start = Instant::now();

        match estimator.estimate(&data) {
            Ok(result) => {
                let elapsed = start.elapsed();
                println!("  {:20} → {}D (ratio: {:.1}x, time: {:.2}ms)",
                        format!("{:?}:", method),
                        result.intrinsic_dim,
                        result.compression_ratio,
                        elapsed.as_millis());
            }
            Err(e) => println!("  {:?} failed: {}", method, e),
        }
    }

    println!("\n💡 Face embeddings can be compressed ~20x!");
    println!("   This enables faster face matching and reduced storage.\n");
}

fn analyze_neural_features() {
    println!("🧠 Analyzing CNN feature maps");
    println!("{}", "-".repeat(50));

    // Different layers of a CNN have different intrinsic dimensions
    let layer_configs = vec![
        ("Conv1 (early)", 256, 50),    // Early layers: lower intrinsic dim
        ("Conv3 (middle)", 512, 100),  // Middle layers: moderate
        ("Conv5 (deep)", 2048, 200),   // Deep layers: higher complexity
        ("FC (final)", 4096, 150),     // Fully connected: moderate
    ];

    println!("Layer compression potential:\n");

    for (name, ambient_dim, intrinsic) in layer_configs {
        let data = intrinsic_dim::utils::generate_synthetic_data(
            300,
            intrinsic,
            ambient_dim,
            0.03,
        );

        let estimator = Estimator::new();
        if let Ok(result) = estimator.estimate_fast(&data, 200) {
            let params_original = ambient_dim * 1000;  // Assuming 1000 neurons
            let params_compressed = result.intrinsic_dim * 1000;
            let savings_mb = ((params_original - params_compressed) * 4) as f64 / 1_000_000.0;

            println!("  {:15} {}D → {}D",
                    name,
                    ambient_dim,
                    result.intrinsic_dim);
            println!("  {:15} Compression: {:.1}x, Params saved: {:.2}MB",
                    "",
                    result.compression_ratio,
                    savings_mb);
        }
    }

    println!("\n🎯 Key insights for neural network compression:");
    println!("   • Early layers can be compressed more (simpler features)");
    println!("   • Deep layers need more dimensions (complex patterns)");
    println!("   • Overall model can be 5-10x smaller with minimal accuracy loss");
}