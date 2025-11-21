//! Basic Conformal Prediction Example
//!
//! This example demonstrates the fundamental usage of conformal prediction
//! to create prediction intervals with statistical guarantees.

use neural_trader_predictor::{
    scores::AbsoluteScore,
    ConformalPredictor,
    PredictionInterval,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Neural Trader Predictor - Basic Usage Example ===\n");

    // Create a conformal predictor with 90% coverage (alpha = 0.1)
    let mut predictor = ConformalPredictor::new(0.1, AbsoluteScore);

    // Step 1: Prepare calibration data
    // In real applications, this would come from a trained model's predictions
    // and the actual observed values
    println!("Step 1: Preparing calibration data...");
    let model_predictions = vec![
        100.0, 105.0, 98.0, 102.0, 101.0, 99.5, 103.5, 100.5, 102.5, 101.5,
    ];
    let actual_values = vec![
        102.0, 104.0, 99.0, 101.0, 100.5, 98.5, 104.0, 101.0, 102.0, 100.5,
    ];

    println!("  Model predictions: {:?}", model_predictions);
    println!("  Actual values:     {:?}", actual_values);

    // Step 2: Calibrate the predictor
    // This computes the quantile threshold needed to achieve the desired coverage
    println!("\nStep 2: Calibrating predictor...");
    predictor.calibrate(&model_predictions, &actual_values)?;
    println!("  ✓ Calibration complete");

    // Step 3: Make predictions with intervals
    println!("\nStep 3: Making predictions with guaranteed intervals...\n");

    let test_predictions = vec![100.5, 102.0, 101.5, 103.0, 99.0];

    for (i, pred) in test_predictions.iter().enumerate() {
        let interval = predictor.predict(*pred);

        println!("  Prediction {}", i + 1);
        println!("    Point estimate:       {}", interval.point);
        println!("    90% confidence interval: [{}, {}]", interval.lower, interval.upper);
        println!("    Interval width:       {}", interval.width());
        println!("    Relative width:       {:.2}%", interval.relative_width());
        println!("    Coverage guarantee:   {:.0}%", interval.coverage() * 100.0);
        println!();
    }

    // Step 4: Update predictor with new observations
    println!("Step 4: Updating predictor with new observations...");
    let new_pred = 100.5;
    let new_actual = 100.2;

    predictor.update(new_pred, new_actual)?;
    println!("  ✓ Updated with prediction: {}, actual: {}", new_pred, new_actual);

    // Step 5: Make prediction with updated calibration
    println!("\nStep 5: Prediction with updated calibration...");
    let final_pred = 102.0;
    let interval = predictor.predict(final_pred);

    println!("  New prediction for {}:", final_pred);
    println!("    Interval: [{}, {}]", interval.lower, interval.upper);
    println!("    Width: {}", interval.width());

    // Practical application: Trading decision
    println!("\n=== Practical Application: Trading Decision ===\n");

    let max_acceptable_width = 2.0;
    let min_acceptable_confidence = 0.85;

    println!("Trading criteria:");
    println!("  Max acceptable interval width: {}", max_acceptable_width);
    println!("  Min acceptable confidence: {:.0}%\n", min_acceptable_confidence * 100.0);

    for (i, pred) in test_predictions.iter().enumerate() {
        let interval = predictor.predict(*pred);
        let width_acceptable = interval.width() <= max_acceptable_width;
        let confidence_acceptable = interval.coverage() >= min_acceptable_confidence;
        let should_trade = width_acceptable && confidence_acceptable;

        println!("  Opportunity {}", i + 1);
        println!("    Price range: [{:.2}, {:.2}]", interval.lower, interval.upper);
        println!("    Width: {:.2} - {}", interval.width(),
                 if width_acceptable { "✓ OK" } else { "✗ Too wide" });
        println!("    Confidence: {:.0}% - {}", interval.coverage() * 100.0,
                 if confidence_acceptable { "✓ OK" } else { "✗ Too low" });
        println!("    Trade signal: {} {}",
                 if should_trade { "✓" } else { "✗" },
                 if should_trade { "EXECUTE" } else { "SKIP" });
        println!();
    }

    println!("=== Example Complete ===");
    println!("\nKey Takeaways:");
    println!("1. Conformal prediction provides intervals with statistical guarantees");
    println!("2. The width of intervals reflects model uncertainty");
    println!("3. Calibration is crucial for achieving target coverage");
    println!("4. Intervals can be used to make informed trading decisions");

    Ok(())
}
