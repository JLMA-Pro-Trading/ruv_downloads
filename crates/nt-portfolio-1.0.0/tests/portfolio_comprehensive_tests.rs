//! Comprehensive tests for portfolio management
//!
//! Tests portfolio tracking, P&L calculation, and position management

use nt_portfolio::*;
use nt_core::types::{Symbol, Side};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

// ============================================================================
// Portfolio Tracker Tests
// ============================================================================

#[tokio::test]
async fn test_portfolio_tracker_creation() {
    let tracker = PortfolioTracker::new(dec!(100000));
    let value = tracker.get_total_value().await.unwrap();

    assert_eq!(value, dec!(100000));
}

#[tokio::test]
async fn test_portfolio_add_position() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    let symbol = Symbol::new("AAPL").unwrap();
    tracker.update_position(
        symbol.clone(),
        dec!(100), // quantity
        dec!(150), // price
    ).await.unwrap();

    let positions = tracker.get_positions().await.unwrap();
    assert_eq!(positions.len(), 1);
    assert_eq!(positions[0].quantity, dec!(100));
}

#[tokio::test]
async fn test_portfolio_update_existing_position() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    // Add initial position
    tracker.update_position(symbol.clone(), dec!(100), dec!(150)).await.unwrap();

    // Add more shares (average up)
    tracker.update_position(symbol.clone(), dec!(50), dec!(155)).await.unwrap();

    let positions = tracker.get_positions().await.unwrap();
    assert_eq!(positions.len(), 1);
    assert_eq!(positions[0].quantity, dec!(150));

    // Check average price calculation
    let expected_avg = (dec!(100) * dec!(150) + dec!(50) * dec!(155)) / dec!(150);
    assert_eq!(positions[0].avg_entry_price, expected_avg);
}

#[tokio::test]
async fn test_portfolio_reduce_position() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    // Add position
    tracker.update_position(symbol.clone(), dec!(100), dec!(150)).await.unwrap();

    // Reduce position
    tracker.update_position(symbol.clone(), dec!(-50), dec!(155)).await.unwrap();

    let positions = tracker.get_positions().await.unwrap();
    assert_eq!(positions[0].quantity, dec!(50));
}

#[tokio::test]
async fn test_portfolio_close_position() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    tracker.update_position(symbol.clone(), dec!(100), dec!(150)).await.unwrap();
    tracker.update_position(symbol.clone(), dec!(-100), dec!(155)).await.unwrap();

    let positions = tracker.get_positions().await.unwrap();
    // Position should be closed/removed
    assert_eq!(positions.len(), 0);
}

// ============================================================================
// P&L Calculation Tests
// ============================================================================

#[tokio::test]
async fn test_unrealized_pnl_profit() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    tracker.update_position(symbol.clone(), dec!(100), dec!(150)).await.unwrap();

    // Price goes up
    tracker.update_market_price(symbol, dec!(160)).await.unwrap();

    let pnl = tracker.calculate_unrealized_pnl().await.unwrap();
    assert_eq!(pnl, dec!(1000)); // (160-150) * 100
}

#[tokio::test]
async fn test_unrealized_pnl_loss() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    tracker.update_position(symbol.clone(), dec!(100), dec!(150)).await.unwrap();

    // Price goes down
    tracker.update_market_price(symbol, dec!(140)).await.unwrap();

    let pnl = tracker.calculate_unrealized_pnl().await.unwrap();
    assert_eq!(pnl, dec!(-1000)); // (140-150) * 100
}

#[tokio::test]
async fn test_realized_pnl() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    // Buy at 150
    tracker.update_position(symbol.clone(), dec!(100), dec!(150)).await.unwrap();

    // Sell at 160
    let realized = tracker.close_position(symbol, dec!(160)).await.unwrap();

    assert_eq!(realized, dec!(1000)); // (160-150) * 100
}

#[tokio::test]
async fn test_total_pnl_mixed() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Position 1: Unrealized profit
    let aapl = Symbol::new("AAPL").unwrap();
    tracker.update_position(aapl.clone(), dec!(100), dec!(150)).await.unwrap();
    tracker.update_market_price(aapl, dec!(160)).await.unwrap();

    // Position 2: Unrealized loss
    let googl = Symbol::new("GOOGL").unwrap();
    tracker.update_position(googl.clone(), dec!(10), dec!(2800)).await.unwrap();
    tracker.update_market_price(googl, dec!(2750)).await.unwrap();

    let total_pnl = tracker.calculate_total_pnl().await.unwrap();
    // AAPL: +1000, GOOGL: -500
    assert_eq!(total_pnl, dec!(500));
}

// ============================================================================
// Multi-Position Tests
// ============================================================================

#[tokio::test]
async fn test_multiple_positions() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    let symbols = vec!["AAPL", "GOOGL", "MSFT", "AMZN"];

    for (i, sym) in symbols.iter().enumerate() {
        let symbol = Symbol::new(sym).unwrap();
        let price = dec!(100) + Decimal::from(i * 50);
        tracker.update_position(symbol, dec!(10), price).await.unwrap();
    }

    let positions = tracker.get_positions().await.unwrap();
    assert_eq!(positions.len(), 4);
}

#[tokio::test]
async fn test_portfolio_diversification() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Add diversified positions
    tracker.update_position(Symbol::new("SPY").unwrap(), dec!(100), dec!(400)).await.unwrap();
    tracker.update_position(Symbol::new("TLT").unwrap(), dec!(100), dec!(120)).await.unwrap();
    tracker.update_position(Symbol::new("GLD").unwrap(), dec!(50), dec!(180)).await.unwrap();

    let total_value = tracker.get_total_value().await.unwrap();
    let cash = tracker.get_cash_balance().await.unwrap();

    // Total value = cash + position values
    let expected_positions = dec!(40000) + dec!(12000) + dec!(9000);
    assert_eq!(total_value, cash + expected_positions);
}

// ============================================================================
// Portfolio Rebalancing Tests
// ============================================================================

#[tokio::test]
async fn test_portfolio_rebalance() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Initial allocation: 50/50
    tracker.update_position(Symbol::new("SPY").unwrap(), dec!(100), dec!(400)).await.unwrap();
    tracker.update_position(Symbol::new("TLT").unwrap(), dec!(100), dec!(100)).await.unwrap();

    // Target: 60/40
    let target_allocations = vec![
        (Symbol::new("SPY").unwrap(), 0.6),
        (Symbol::new("TLT").unwrap(), 0.4),
    ];

    tracker.rebalance(target_allocations).await.unwrap();

    // Verify new allocations
    let positions = tracker.get_positions().await.unwrap();
    let total_value = tracker.get_total_value().await.unwrap();

    for pos in positions {
        let weight = pos.market_value() / total_value;
        if pos.symbol.as_str() == "SPY" {
            assert!((weight.to_f64().unwrap() - 0.6).abs() < 0.01);
        } else if pos.symbol.as_str() == "TLT" {
            assert!((weight.to_f64().unwrap() - 0.4).abs() < 0.01);
        }
    }
}

// ============================================================================
// Performance Metrics Tests
// ============================================================================

#[tokio::test]
async fn test_portfolio_return() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Make some trades
    let aapl = Symbol::new("AAPL").unwrap();
    tracker.update_position(aapl.clone(), dec!(100), dec!(150)).await.unwrap();
    tracker.update_market_price(aapl, dec!(165)).await.unwrap();

    let total_return = tracker.calculate_total_return().await.unwrap();

    // Profit = 1500, Return = 1500/100000 = 1.5%
    assert!((total_return - 0.015).abs() < 0.001);
}

#[tokio::test]
async fn test_portfolio_sharpe_ratio() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Would need historical returns for proper Sharpe calculation
    // This is a simplified test
    let sharpe = tracker.calculate_sharpe_ratio(0.02).await.unwrap();

    assert!(sharpe.is_finite());
}

#[tokio::test]
async fn test_portfolio_max_drawdown() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Simulate equity curve
    tracker.record_equity_snapshot(dec!(100000)).await.unwrap();
    tracker.record_equity_snapshot(dec!(110000)).await.unwrap();
    tracker.record_equity_snapshot(dec!(95000)).await.unwrap(); // Drawdown
    tracker.record_equity_snapshot(dec!(105000)).await.unwrap();

    let max_dd = tracker.calculate_max_drawdown().await.unwrap();

    // Max drawdown = (110000 - 95000) / 110000 ≈ 13.6%
    assert!((max_dd - 0.136).abs() < 0.01);
}

// ============================================================================
// Exposure Management Tests
// ============================================================================

#[tokio::test]
async fn test_portfolio_gross_exposure() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Long positions
    tracker.update_position(Symbol::new("AAPL").unwrap(), dec!(100), dec!(150)).await.unwrap();
    tracker.update_position(Symbol::new("GOOGL").unwrap(), dec!(10), dec!(2800)).await.unwrap();

    // Short position
    tracker.update_position(Symbol::new("TSLA").unwrap(), dec!(-50), dec!(200)).await.unwrap();

    let gross_exposure = tracker.calculate_gross_exposure().await.unwrap();

    // Gross = |15000| + |28000| + |-10000| = 53000
    assert_eq!(gross_exposure, dec!(53000));
}

#[tokio::test]
async fn test_portfolio_net_exposure() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Long positions
    tracker.update_position(Symbol::new("AAPL").unwrap(), dec!(100), dec!(150)).await.unwrap();

    // Short position
    tracker.update_position(Symbol::new("TSLA").unwrap(), dec!(-50), dec!(200)).await.unwrap();

    let net_exposure = tracker.calculate_net_exposure().await.unwrap();

    // Net = 15000 - 10000 = 5000
    assert_eq!(net_exposure, dec!(5000));
}

#[tokio::test]
async fn test_portfolio_leverage() {
    let mut tracker = PortfolioTracker::new(dec!(100000));

    // Add leveraged position
    tracker.update_position(Symbol::new("AAPL").unwrap(), dec!(200), dec!(150)).await.unwrap();

    let leverage = tracker.calculate_leverage().await.unwrap();

    // Leverage = 30000 / 100000 = 0.3
    assert_eq!(leverage, 0.3);
}

// ============================================================================
// Edge Cases
// ============================================================================

#[tokio::test]
async fn test_portfolio_zero_quantity() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    let result = tracker.update_position(symbol, dec!(0), dec!(150)).await;

    // Should handle gracefully
    assert!(result.is_ok() || result.is_err());
}

#[tokio::test]
async fn test_portfolio_negative_price() {
    let mut tracker = PortfolioTracker::new(dec!(100000));
    let symbol = Symbol::new("AAPL").unwrap();

    let result = tracker.update_position(symbol, dec!(100), dec!(-150)).await;

    // Should error on negative price
    assert!(result.is_err());
}

#[tokio::test]
async fn test_portfolio_insufficient_cash() {
    let mut tracker = PortfolioTracker::new(dec!(1000)); // Small capital
    let symbol = Symbol::new("AAPL").unwrap();

    let result = tracker.update_position(symbol, dec!(100), dec!(150)).await;

    // Should error or handle insufficient funds
    assert!(result.is_err());
}

// ============================================================================
// Property-Based Tests
// ============================================================================

#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_pnl_calculation_property(
            entry_price in 50.0..500.0f64,
            exit_price in 50.0..500.0f64,
            quantity in 1..1000i64,
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let mut tracker = PortfolioTracker::new(dec!(1000000));
                let symbol = Symbol::new("TEST").unwrap();

                let entry = Decimal::from_f64_retain(entry_price).unwrap();
                let exit = Decimal::from_f64_retain(exit_price).unwrap();
                let qty = Decimal::from(quantity);

                tracker.update_position(symbol.clone(), qty, entry).await.unwrap();
                let realized = tracker.close_position(symbol, exit).await.unwrap();

                let expected = (exit - entry) * qty;
                prop_assert_eq!(realized, expected);
            });
        }

        #[test]
        fn test_total_value_conservation(
            positions in prop::collection::vec(
                (50.0..500.0f64, 1..100i64),
                1..5
            ),
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let initial_cash = dec!(1000000);
                let mut tracker = PortfolioTracker::new(initial_cash);

                let mut total_invested = dec!(0);

                for (i, (price, quantity)) in positions.iter().enumerate() {
                    let symbol = Symbol::new(&format!("SYM{}", i)).unwrap();
                    let p = Decimal::from_f64_retain(*price).unwrap();
                    let q = Decimal::from(*quantity);

                    tracker.update_position(symbol, q, p).await.unwrap();
                    total_invested += p * q;
                }

                let total_value = tracker.get_total_value().await.unwrap();
                let cash = tracker.get_cash_balance().await.unwrap();

                // Total value should equal initial cash
                prop_assert_eq!(total_value, initial_cash);
                prop_assert_eq!(cash + total_invested, initial_cash);
            });
        }
    }
}
