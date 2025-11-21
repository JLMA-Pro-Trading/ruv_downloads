// P&L (Profit and Loss) calculation
//
// Features:
// - Realized P&L tracking
// - Unrealized P&L calculation
// - Trade-level P&L
// - Daily, weekly, monthly P&L aggregation

use crate::{PortfolioError, Result};
use chrono::{DateTime, Datelike, Utc};
use nt_core::types::Symbol;
use rust_decimal::Decimal;
use serde::Serialize;

/// P&L result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PnLResult {
    pub realized_pnl: Decimal,
    pub unrealized_pnl: Decimal,
    pub total_pnl: Decimal,
    pub return_pct: Decimal,
    pub timestamp: DateTime<Utc>,
}

/// Trade record for P&L calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub symbol: Symbol,
    pub side: TradeSide,
    pub quantity: u32,
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
}

/// Trade side
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TradeSide {
    Buy,
    Sell,
}

/// P&L calculator
pub struct PnLCalculator {
    trades: Vec<Trade>,
    initial_capital: Decimal,
}

impl PnLCalculator {
    /// Create a new P&L calculator
    pub fn new(initial_capital: Decimal) -> Self {
        Self {
            trades: Vec::new(),
            initial_capital,
        }
    }

    /// Record a trade
    pub fn record_trade(&mut self, trade: Trade) {
        self.trades.push(trade);
    }

    /// Calculate P&L for a period
    pub fn calculate_period_pnl(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<PnLResult> {
        let period_trades: Vec<&Trade> = self
            .trades
            .iter()
            .filter(|t| t.timestamp >= start && t.timestamp <= end)
            .collect();

        // Calculate realized P&L using FIFO
        let realized_pnl = self.calculate_realized_pnl(&period_trades);

        Ok(PnLResult {
            realized_pnl,
            unrealized_pnl: Decimal::ZERO, // Calculated separately by portfolio
            total_pnl: realized_pnl,
            return_pct: if self.initial_capital > Decimal::ZERO {
                (realized_pnl / self.initial_capital) * Decimal::from(100)
            } else {
                Decimal::ZERO
            },
            timestamp: Utc::now(),
        })
    }

    /// Calculate daily P&L
    pub fn daily_pnl(&self, date: DateTime<Utc>) -> Result<PnLResult> {
        let start = date
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Utc)
            .unwrap();
        let end = date
            .date_naive()
            .and_hms_opt(23, 59, 59)
            .unwrap()
            .and_local_timezone(Utc)
            .unwrap();

        self.calculate_period_pnl(start, end)
    }

    /// Calculate monthly P&L
    pub fn monthly_pnl(&self, year: i32, month: u32) -> Result<PnLResult> {
        let start = chrono::NaiveDate::from_ymd_opt(year, month, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Utc)
            .unwrap();

        let next_month = if month == 12 {
            chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
        } else {
            chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
        };

        let end = next_month
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Utc)
            .unwrap();

        self.calculate_period_pnl(start, end)
    }

    /// Calculate realized P&L from trades (FIFO)
    fn calculate_realized_pnl(&self, trades: &[&Trade]) -> Decimal {
        let mut pnl = Decimal::ZERO;
        let mut positions: HashMap<Symbol, Vec<(u32, Decimal)>> = HashMap::new();

        for trade in trades {
            let position_queue = positions.entry(trade.symbol.clone()).or_default();

            match trade.side {
                TradeSide::Buy => {
                    // Add to position
                    position_queue.push((trade.quantity, trade.price));
                }
                TradeSide::Sell => {
                    // Close position (FIFO)
                    let mut remaining_qty = trade.quantity;

                    while remaining_qty > 0 && !position_queue.is_empty() {
                        let (buy_qty, buy_price) = position_queue[0];
                        let qty_to_close = remaining_qty.min(buy_qty);

                        // Calculate P&L for this portion
                        let trade_pnl =
                            (trade.price - buy_price) * Decimal::from(qty_to_close);
                        pnl += trade_pnl;

                        if qty_to_close == buy_qty {
                            position_queue.remove(0);
                        } else {
                            position_queue[0] = (buy_qty - qty_to_close, buy_price);
                        }

                        remaining_qty -= qty_to_close;
                    }
                }
            }
        }

        pnl
    }

    /// Get all trades
    pub fn get_trades(&self) -> &[Trade] {
        &self.trades
    }

    /// Get trades for a symbol
    pub fn get_symbol_trades(&self, symbol: &Symbol) -> Vec<&Trade> {
        self.trades
            .iter()
            .filter(|t| &t.symbol == symbol)
            .collect()
    }

    /// Clear all trades
    pub fn clear(&mut self) {
        self.trades.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_realized_pnl_simple() {
        let mut calculator = PnLCalculator::new(Decimal::from(10000));
        let symbol = Symbol::new("AAPL");

        // Buy 10 @ $150
        calculator.record_trade(Trade {
            symbol: symbol.clone(),
            side: TradeSide::Buy,
            quantity: 10,
            price: Decimal::from(150),
            timestamp: Utc::now(),
        });

        // Sell 10 @ $160 (profit of $100)
        calculator.record_trade(Trade {
            symbol: symbol.clone(),
            side: TradeSide::Sell,
            quantity: 10,
            price: Decimal::from(160),
            timestamp: Utc::now(),
        });

        let result = calculator
            .calculate_period_pnl(
                Utc::now() - chrono::Duration::hours(1),
                Utc::now() + chrono::Duration::hours(1),
            )
            .unwrap();

        assert_eq!(result.realized_pnl, Decimal::from(100));
        assert_eq!(result.return_pct, Decimal::from(1)); // 100 / 10000 * 100 = 1%
    }

    #[test]
    fn test_fifo_pnl() {
        let mut calculator = PnLCalculator::new(Decimal::from(10000));
        let symbol = Symbol::new("AAPL");

        // Buy 10 @ $150
        calculator.record_trade(Trade {
            symbol: symbol.clone(),
            side: TradeSide::Buy,
            quantity: 10,
            price: Decimal::from(150),
            timestamp: Utc::now(),
        });

        // Buy 10 @ $160
        calculator.record_trade(Trade {
            symbol: symbol.clone(),
            side: TradeSide::Buy,
            quantity: 10,
            price: Decimal::from(160),
            timestamp: Utc::now(),
        });

        // Sell 15 @ $170
        // FIFO: 10 @ $150 + 5 @ $160
        // P&L = (170-150)*10 + (170-160)*5 = 200 + 50 = 250
        calculator.record_trade(Trade {
            symbol: symbol.clone(),
            side: TradeSide::Sell,
            quantity: 15,
            price: Decimal::from(170),
            timestamp: Utc::now(),
        });

        let result = calculator
            .calculate_period_pnl(
                Utc::now() - chrono::Duration::hours(1),
                Utc::now() + chrono::Duration::hours(1),
            )
            .unwrap();

        assert_eq!(result.realized_pnl, Decimal::from(250));
    }

    #[test]
    fn test_daily_pnl() {
        let mut calculator = PnLCalculator::new(Decimal::from(10000));
        let symbol = Symbol::new("AAPL");
        let today = Utc::now();

        calculator.record_trade(Trade {
            symbol: symbol.clone(),
            side: TradeSide::Buy,
            quantity: 10,
            price: Decimal::from(150),
            timestamp: today,
        });

        calculator.record_trade(Trade {
            symbol: symbol.clone(),
            side: TradeSide::Sell,
            quantity: 10,
            price: Decimal::from(160),
            timestamp: today,
        });

        let result = calculator.daily_pnl(today).unwrap();
        assert_eq!(result.realized_pnl, Decimal::from(100));
    }
}
