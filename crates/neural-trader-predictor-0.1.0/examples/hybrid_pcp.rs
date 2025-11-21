//! Example: Using HybridPredictor with PCP for regime-aware predictions

use neural_trader_predictor::{HybridPredictor, AbsoluteScore, Result};

fn main() -> Result<()> {
    println!("🎯 Hybrid Predictor with PCP Example\n");

    // Create hybrid predictor with 90% coverage
    let mut predictor = HybridPredictor::new(0.1, AbsoluteScore)?;

    // Enable PCP with 3 clusters (bull/bear/sideways)
    predictor.enable_pcp(3)?;
    println!("✅ PCP enabled with 3 clusters (bull/bear/sideways)");

    // Simulated calibration data with different market regimes
    let predictions = vec![
        // Bull market regime
        100.0, 105.0, 110.0, 115.0, 120.0,
        // Bear market regime
        95.0, 90.0, 85.0, 80.0, 75.0,
        // Sideways regime
        98.0, 100.0, 99.0, 101.0, 100.0,
    ];
    let actuals = vec![
        // Bull (high volatility upward)
        102.0, 107.0, 112.0, 118.0, 122.0,
        // Bear (high volatility downward)
        93.0, 88.0, 83.0, 78.0, 73.0,
        // Sideways (low volatility)
        98.5, 100.5, 99.5, 101.5, 100.5,
    ];

    // Calibrate predictor
    predictor.calibrate(&predictions, &actuals)?;
    println!("✅ Calibrated with {} samples across 3 regimes\n", predictions.len());

    // Make predictions in different scenarios
    let scenarios = vec![
        ("Bull Market", 115.0),
        ("Bear Market", 80.0),
        ("Sideways", 100.0),
    ];

    println!("📊 Regime-Aware Predictions:");
    for (regime, price) in scenarios {
        let interval = predictor.predict(price);

        println!("\n   {} (entry: ${:.2}):", regime, price);
        println!("     Range: [${:.2}, ${:.2}]", interval.lower, interval.upper);
        println!("     Width: ${:.2} ({:.1}%)", interval.width(), interval.relative_width());

        // Trading strategy based on regime
        let width_pct = interval.relative_width();
        match regime {
            "Bull Market" => {
                if width_pct < 5.0 {
                    println!("     ✅ AGGRESSIVE: Narrow interval in uptrend");
                } else {
                    println!("     ⚠️  CAUTION: Wide interval despite uptrend");
                }
            }
            "Bear Market" => {
                if width_pct < 5.0 {
                    println!("     ✅ SHORT: Narrow interval in downtrend");
                } else {
                    println!("     ⚠️  AVOID: Wide interval in downtrend");
                }
            }
            "Sideways" => {
                if width_pct < 3.0 {
                    println!("     ✅ RANGE TRADE: Very narrow interval");
                } else {
                    println!("     ❌ WAIT: Too much uncertainty");
                }
            }
            _ => {}
        }
    }

    // Cluster information
    println!("\n🔍 Cluster Information:");
    println!("   Number of clusters: {}", predictor.n_clusters().unwrap());
    println!("   PCP enabled: {}", predictor.pcp_enabled());

    // Statistical summary
    if let Some(coverage) = predictor.empirical_coverage() {
        println!("\n📈 Performance:");
        println!("   Empirical coverage: {:.1}%", coverage * 100.0);
        println!("   Target coverage: {:.0}%", 90.0);

        if (coverage - 0.90).abs() < 0.05 {
            println!("   ✅ Coverage within target range");
        } else {
            println!("   ⚠️  Coverage outside target range");
        }
    }

    Ok(())
}
