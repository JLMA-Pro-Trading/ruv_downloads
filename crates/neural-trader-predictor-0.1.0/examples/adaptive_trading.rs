//! Adaptive Conformal Inference for Trading
//!
//! This example demonstrates adaptive conformal prediction (ACI) where the coverage
//! level is dynamically adjusted in real-time based on observed outcomes.
//! This is particularly useful for trading as market conditions change.

use neural_trader_predictor::{
    scores::AbsoluteScore,
    AdaptiveConformalPredictor,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Adaptive Conformal Inference for Trading ===\n");

    // Create an adaptive predictor that maintains 90% coverage
    // using PID control with learning rate gamma = 0.02
    let mut predictor = AdaptiveConformalPredictor::new(
        0.90,      // target coverage
        0.02,      // learning rate (gamma)
        AbsoluteScore,
    );

    // Simulate market predictions and actual prices
    let market_predictions = vec![
        100.0, 101.2, 99.8, 102.1, 100.9, 101.5, 100.2, 102.8, 99.5, 101.0,
        100.8, 101.3, 99.9, 102.5, 100.6, 101.1, 100.3, 102.0, 99.8, 101.2,
    ];

    let market_actuals = vec![
        100.2, 101.5, 99.5, 102.3, 100.8, 101.8, 100.0, 103.0, 99.3, 101.2,
        100.6, 101.5, 99.8, 102.7, 100.5, 101.3, 100.1, 102.2, 99.9, 101.4,
    ];

    println!("Simulating {} market predictions with adaptive coverage...\n", market_predictions.len());

    // Parameters for trading decisions
    let max_interval_width = 2.0;
    let min_confidence_threshold = 0.85;
    let position_size_pct = 1.0;

    let mut trades_executed = 0;
    let mut total_pnl = 0.0;
    let mut correct_predictions = 0;
    let mut total_predictions = 0;

    // Process each prediction-actual pair
    for (i, (pred, actual)) in market_predictions
        .iter()
        .zip(market_actuals.iter())
        .enumerate()
    {
        // Get prediction interval and adapt coverage based on outcome
        let interval = predictor.predict_and_adapt(*pred, Some(*actual));

        // Calculate prediction accuracy
        if interval.contains(*actual) {
            correct_predictions += 1;
        }
        total_predictions += 1;

        // Check trading criteria
        let width_ok = interval.width() <= max_interval_width;
        let confidence_ok = interval.coverage() >= min_confidence_threshold;
        let should_trade = width_ok && confidence_ok;

        if should_trade {
            trades_executed += 1;

            // Calculate P&L for this trade
            // Simple strategy: go long at point prediction, exit at interval midpoint
            let entry = interval.point;
            let exit = (interval.upper + interval.lower) / 2.0;
            let trade_pnl = (exit - entry) * position_size_pct;
            total_pnl += trade_pnl;

            // Determine position signal
            let signal = if interval.point > *actual { "SELL" } else { "BUY" };

            println!("Trade #{} (Iteration {})", trades_executed, i + 1);
            println!("  Signal:              {}", signal);
            println!("  Prediction:          {:.2}", interval.point);
            println!("  Actual:              {:.2}", actual);
            println!("  Interval:            [{:.2}, {:.2}]", interval.lower, interval.upper);
            println!("  Width:               {:.2}", interval.width());
            println!("  Current coverage:    {:.1}%", predictor.empirical_coverage() * 100.0);
            println!("  Current alpha:       {:.4}", predictor.current_alpha());
            println!("  Trade P&L:           {:.2}", trade_pnl);
            println!("  Cumulative P&L:      {:.2}", total_pnl);
            println!();
        }
    }

    // Summary statistics
    println!("\n=== Trading Summary ===\n");
    println!("Total predictions:      {}", total_predictions);
    println!("Prediction accuracy:    {:.1}%", (correct_predictions as f64 / total_predictions as f64) * 100.0);
    println!("Trades executed:        {}", trades_executed);
    println!("Trade success rate:     {:.1}%", if trades_executed > 0 {
        (correct_predictions as f64 / trades_executed as f64) * 100.0
    } else {
        0.0
    });
    println!("Total P&L:              {:.2}", total_pnl);
    println!("Final coverage:         {:.1}%", predictor.empirical_coverage() * 100.0);
    println!("Final alpha:            {:.4}", predictor.current_alpha());

    // Demonstrate different market regimes
    println!("\n=== Market Regime Analysis ===\n");

    let regimes = vec![
        ("High volatility (wide intervals)", 3.0),
        ("Normal conditions (medium intervals)", 1.5),
        ("Low volatility (narrow intervals)", 0.5),
    ];

    for (regime_name, max_width) in regimes {
        let suitable_intervals = market_predictions
            .iter()
            .zip(market_actuals.iter())
            .filter(|(_, actual)| {
                let interval = predictor.predict_and_adapt(**_, Some(**actual));
                interval.width() <= max_width && interval.coverage() >= min_confidence_threshold
            })
            .count();

        println!("{}", regime_name);
        println!("  Max acceptable width: {:.2}", max_width);
        println!("  Tradeable opportunities: {}/{}", suitable_intervals, total_predictions);
        println!("  Trade potential: {:.1}%\n",
                 (suitable_intervals as f64 / total_predictions as f64) * 100.0);
    }

    // Adaptive behavior explanation
    println!("=== How Adaptive Conformal Inference Works ===\n");
    println!("1. Target coverage is set to {:.0}%", predictor.current_alpha() * 100.0);
    println!("2. For each prediction, actual outcome is observed");
    println!("3. If empirical coverage diverges from target:");
    println!("   - Too high coverage → decrease alpha (tighter intervals)");
    println!("   - Too low coverage → increase alpha (wider intervals)");
    println!("4. Adjustment uses PID control: α_new = α - γ × (coverage - target)");
    println!("5. This maintains target coverage as conditions change\n");

    println!("Key Benefits for Trading:");
    println!("✓ Intervals adapt to changing market volatility");
    println!("✓ Maintains coverage guarantees automatically");
    println!("✓ Identifies tradeable opportunities in real-time");
    println!("✓ Reduces false signals in choppy markets");
    println!("✓ No manual recalibration needed");

    Ok(())
}
