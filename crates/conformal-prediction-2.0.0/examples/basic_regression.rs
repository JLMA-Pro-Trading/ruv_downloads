//! Basic regression example with conformal prediction
//!
//! This example demonstrates how to use conformal prediction for
//! regression with guaranteed coverage.

use conformal_prediction::{ConformalPredictor, KNNNonconformity};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Conformal Prediction: Basic Regression ===\n");

    // Generate synthetic data: y = 3x + 2 + noise
    println!("Generating synthetic calibration data (y = 3x + 2)...");

    let n_calibration = 50;
    let mut cal_x = Vec::new();
    let mut cal_y = Vec::new();

    for i in 0..n_calibration {
        let x = i as f64 / 5.0;
        let y = 3.0 * x + 2.0 + (i % 3) as f64 * 0.5 - 0.5; // Add small noise
        cal_x.push(vec![x]);
        cal_y.push(y);
    }

    println!("Calibration set size: {}", n_calibration);

    // Create nonconformity measure (k-NN with k=5)
    println!("\nCreating k-NN nonconformity measure (k=5)...");
    let mut measure = KNNNonconformity::new(5);
    measure.fit(&cal_x, &cal_y);

    // Create conformal predictor with different confidence levels
    let confidence_levels = vec![0.90, 0.95, 0.99];

    for confidence in confidence_levels {
        let alpha = 1.0 - confidence;

        println!("\n--- Confidence Level: {:.0}% (α = {:.2}) ---", confidence * 100.0, alpha);

        let mut predictor = ConformalPredictor::new(alpha, measure.clone())?;
        predictor.calibrate(&cal_x, &cal_y)?;

        // Make predictions for test points
        let test_points = vec![2.0, 5.0, 8.0];

        println!("\nPredictions:");
        println!("{:<10} {:<15} {:<20} {:<10}", "x", "True y", "Prediction Interval", "Width");
        println!("{}", "-".repeat(60));

        for x in test_points {
            let y_true = 3.0 * x + 2.0;

            // Get point estimate (for interval center)
            let (lower, upper) = predictor.predict_interval(&[x], y_true)?;

            let width = upper - lower;
            let contained = if lower <= y_true && y_true <= upper {
                "✓"
            } else {
                "✗"
            };

            println!(
                "{:<10.2} {:<15.2} [{:.2}, {:.2}] {:<10.2} {}",
                x, y_true, lower, upper, width, contained
            );
        }
    }

    println!("\n=== Key Insights ===");
    println!("• Higher confidence → wider intervals");
    println!("• Intervals guaranteed to contain true value with specified probability");
    println!("• No distributional assumptions required");
    println!("• Works with any underlying model (here: k-NN)");

    Ok(())
}
