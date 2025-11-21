//! Example: Using HybridPredictor with CPD for full probability distributions

use neural_trader_predictor::{HybridPredictor, AbsoluteScore, Result};

fn main() -> Result<()> {
    println!("🎯 Hybrid Predictor with CPD Example\n");

    // Create hybrid predictor with 90% coverage
    let mut predictor = HybridPredictor::new(0.1, AbsoluteScore)?;

    // Enable CPD for full probability distributions
    predictor.enable_cpd()?;
    println!("✅ CPD enabled - can now query full distributions");

    // Simulated calibration data (historical predictions and actuals)
    let predictions = vec![
        100.0, 105.0, 98.0, 102.0, 101.0,
        99.0, 103.0, 100.5, 104.0, 97.0,
    ];
    let actuals = vec![
        102.0, 104.0, 99.0, 101.0, 100.0,
        98.5, 102.5, 101.0, 103.5, 97.5,
    ];

    // Calibrate predictor
    predictor.calibrate(&predictions, &actuals)?;
    println!("✅ Calibrated with {} samples\n", predictions.len());

    // Make a prediction for entry price of $103
    let entry_price = 103.0;
    let interval = predictor.predict(entry_price);

    println!("📊 Prediction Interval:");
    println!("   Point: ${:.2}", interval.point);
    println!("   Range: [${:.2}, ${:.2}]", interval.lower, interval.upper);
    println!("   Width: ${:.2} ({:.1}%)", interval.width(), interval.relative_width());
    println!("   Coverage: {:.0}%\n", interval.coverage() * 100.0);

    // Query CDF for different scenarios
    println!("📈 Probability Analysis:");

    let scenarios = vec![
        ("Breakeven", entry_price),
        ("Target (+5%)", entry_price * 1.05),
        ("Stop (-3%)", entry_price * 0.97),
    ];

    for (name, price) in scenarios {
        let cdf = predictor.cdf(price)?;
        let prob_above = 1.0 - cdf;

        println!("   {} (${:.2}):", name, price);
        println!("     P(price ≤ ${:.2}) = {:.1}%", price, cdf * 100.0);
        println!("     P(price > ${:.2}) = {:.1}%", price, prob_above * 100.0);
    }

    // Trading decision example
    println!("\n💰 Trading Decision:");
    let target = entry_price * 1.05;
    let stop = entry_price * 0.97;

    let prob_target = 1.0 - predictor.cdf(target)?;
    let prob_stop = predictor.cdf(stop)?;

    println!("   Entry: ${:.2}", entry_price);
    println!("   Target: ${:.2} (P={:.1}%)", target, prob_target * 100.0);
    println!("   Stop: ${:.2} (P={:.1}%)", stop, prob_stop * 100.0);

    let risk_reward = prob_target / prob_stop;
    println!("   Risk/Reward Ratio: {:.2}", risk_reward);

    if risk_reward > 2.0 && prob_target > 0.4 {
        println!("   ✅ TRADE SIGNAL: Good risk/reward");
    } else {
        println!("   ❌ NO TRADE: Insufficient edge");
    }

    Ok(())
}
