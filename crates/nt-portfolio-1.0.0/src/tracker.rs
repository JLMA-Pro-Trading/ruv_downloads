// Portfolio position tracking
//
// Features:
// - Real-time position tracking
// - Concurrent position updates
// - Position aggregation
// - Portfolio value calculation

use crate::{PortfolioError, Result};
use chrono::{Utc};
use dashmap::DashMap;
use nt_core::types::Symbol;
use rust_decimal::Decimal;
use serde::Serialize;
use std::sync::Arc;
use tracing::{debug, info};

/// Portfolio position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioPosition {
    pub symbol: Symbol,
    pub quantity: i64, // Can be negative for short positions
    pub avg_entry_price: Decimal,
    pub current_price: Decimal,
    pub market_value: Decimal,
    pub cost_basis: Decimal,
    pub unrealized_pnl: Decimal,
    pub realized_pnl: Decimal,
    pub last_updated: DateTime<Utc>,
}

impl PortfolioPosition {
    /// Create a new position
    pub fn new(symbol: Symbol, quantity: i64, entry_price: Decimal) -> Self {
        let cost_basis = Decimal::from(quantity.abs()) * entry_price;
        let market_value = Decimal::from(quantity) * entry_price;

        Self {
            symbol,
            quantity,
            avg_entry_price: entry_price,
            current_price: entry_price,
            market_value,
            cost_basis,
            unrealized_pnl: Decimal::ZERO,
            realized_pnl: Decimal::ZERO,
            last_updated: Utc::now(),
        }
    }

    /// Update position with new fill
    pub fn update_with_fill(&mut self, quantity: i64, price: Decimal, realized_pnl: Decimal) {
        let old_quantity = self.quantity;
        let new_quantity = old_quantity + quantity;

        // Update average entry price (FIFO)
        if (old_quantity > 0 && quantity > 0) || (old_quantity < 0 && quantity < 0) {
            // Adding to position
            let old_value = Decimal::from(old_quantity.abs()) * self.avg_entry_price;
            let new_value = Decimal::from(quantity.abs()) * price;
            let total_value = old_value + new_value;
            let total_quantity = Decimal::from((old_quantity + quantity).abs());

            if total_quantity > Decimal::ZERO {
                self.avg_entry_price = total_value / total_quantity;
            }
        }

        self.quantity = new_quantity;
        self.realized_pnl += realized_pnl;
        self.cost_basis = Decimal::from(new_quantity.abs()) * self.avg_entry_price;
        self.market_value = Decimal::from(new_quantity) * self.current_price;
        self.unrealized_pnl = self.market_value - self.cost_basis;
        self.last_updated = Utc::now();

        debug!(
            "Updated position for {}: qty={}, avg_price=${}, realized_pnl=${}",
            self.symbol, self.quantity, self.avg_entry_price, self.realized_pnl
        );
    }

    /// Update current price and recalculate unrealized P&L
    pub fn update_price(&mut self, new_price: Decimal) {
        self.current_price = new_price;
        self.market_value = Decimal::from(self.quantity) * new_price;
        self.unrealized_pnl = self.market_value - self.cost_basis;
        self.last_updated = Utc::now();
    }

    /// Get total P&L (realized + unrealized)
    pub fn total_pnl(&self) -> Decimal {
        self.realized_pnl + self.unrealized_pnl
    }

    /// Get P&L percentage
    pub fn pnl_percentage(&self) -> Decimal {
        if self.cost_basis == Decimal::ZERO {
            return Decimal::ZERO;
        }
        (self.total_pnl() / self.cost_basis) * Decimal::from(100)
    }

    /// Check if position is closed
    pub fn is_closed(&self) -> bool {
        self.quantity == 0
    }
}

/// Portfolio tracker
pub struct Portfolio {
    positions: Arc<DashMap<Symbol, PortfolioPosition>>,
    cash: parking_lot::RwLock<Decimal>,
    initial_capital: Decimal,
}

impl Portfolio {
    /// Create a new portfolio
    pub fn new(initial_capital: Decimal) -> Self {
        info!("Creating new portfolio with ${} initial capital", initial_capital);

        Self {
            positions: Arc::new(DashMap::new()),
            cash: parking_lot::RwLock::new(initial_capital),
            initial_capital,
        }
    }

    /// Open a new position or add to existing position
    pub fn open_position(&self, symbol: Symbol, quantity: i64, price: Decimal) -> Result<()> {
        let trade_value = Decimal::from(quantity.abs()) * price;

        // Check cash availability for long positions
        if quantity > 0 {
            let cash = *self.cash.read();
            if cash < trade_value {
                return Err(PortfolioError::InvalidCalculation(format!(
                    "Insufficient cash: have ${}, need ${}",
                    cash, trade_value
                )));
            }
        }

        // Update or create position
        if let Some(mut position) = self.positions.get_mut(&symbol) {
            // Calculate realized P&L for closing trades
            let realized_pnl = self.calculate_realized_pnl(&position, quantity, price);
            position.update_with_fill(quantity, price, realized_pnl);
        } else {
            let position = PortfolioPosition::new(symbol.clone(), quantity, price);
            self.positions.insert(symbol.clone(), position);
        }

        // Update cash
        if quantity > 0 {
            // Buying: reduce cash
            let mut cash = self.cash.write();
            *cash -= trade_value;
        } else {
            // Selling: increase cash
            let mut cash = self.cash.write();
            *cash += trade_value;
        }

        info!(
            "Opened/updated position: {} x {} @ ${}",
            symbol, quantity, price
        );

        Ok(())
    }

    /// Calculate realized P&L for a closing trade
    fn calculate_realized_pnl(
        &self,
        position: &PortfolioPosition,
        quantity: i64,
        price: Decimal,
    ) -> Decimal {
        // If closing or reducing position
        if (position.quantity > 0 && quantity < 0) || (position.quantity < 0 && quantity > 0) {
            let closing_quantity = quantity.abs().min(position.quantity.abs());
            let closing_value = Decimal::from(closing_quantity) * price;
            let cost_value = Decimal::from(closing_quantity) * position.avg_entry_price;

            if position.quantity > 0 {
                // Closing long: P&L = sell price - entry price
                closing_value - cost_value
            } else {
                // Closing short: P&L = entry price - buy price
                cost_value - closing_value
            }
        } else {
            Decimal::ZERO
        }
    }

    /// Close a position completely
    pub fn close_position(&self, symbol: &Symbol, price: Decimal) -> Result<()> {
        let position = self
            .positions
            .get(symbol)
            .ok_or_else(|| PortfolioError::PositionNotFound(symbol.to_string()))?;

        let closing_quantity = -position.quantity;
        drop(position); // Release the lock

        self.open_position(symbol.clone(), closing_quantity, price)?;

        // Remove closed position
        if let Some(pos) = self.positions.get(symbol) {
            if pos.is_closed() {
                drop(pos);
                self.positions.remove(symbol);
                info!("Closed position for {}", symbol);
            }
        }

        Ok(())
    }

    /// Update price for a position
    pub fn update_price(&self, symbol: &Symbol, new_price: Decimal) -> Result<()> {
        let mut position = self
            .positions
            .get_mut(symbol)
            .ok_or_else(|| PortfolioError::PositionNotFound(symbol.to_string()))?;

        position.update_price(new_price);
        Ok(())
    }

    /// Update all prices
    pub fn update_all_prices(&self, prices: &std::collections::HashMap<Symbol, Decimal>) {
        for (symbol, price) in prices {
            let _ = self.update_price(symbol, *price);
        }
    }

    /// Get current cash balance
    pub fn cash(&self) -> Decimal {
        *self.cash.read()
    }

    /// Get all positions
    pub fn positions(&self) -> Vec<PortfolioPosition> {
        self.positions
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get specific position
    pub fn get_position(&self, symbol: &Symbol) -> Option<PortfolioPosition> {
        self.positions.get(symbol).map(|p| p.clone())
    }

    /// Get total portfolio value (cash + positions)
    pub fn total_value(&self) -> Decimal {
        let cash = self.cash();
        let positions_value: Decimal = self
            .positions
            .iter()
            .map(|entry| entry.value().market_value)
            .sum();

        cash + positions_value
    }

    /// Get total unrealized P&L
    pub fn unrealized_pnl(&self) -> Decimal {
        self.positions
            .iter()
            .map(|entry| entry.value().unrealized_pnl)
            .sum()
    }

    /// Get total realized P&L
    pub fn realized_pnl(&self) -> Decimal {
        self.positions
            .iter()
            .map(|entry| entry.value().realized_pnl)
            .sum()
    }

    /// Get total P&L
    pub fn total_pnl(&self) -> Decimal {
        self.total_value() - self.initial_capital
    }

    /// Get return percentage
    pub fn return_percentage(&self) -> Decimal {
        if self.initial_capital == Decimal::ZERO {
            return Decimal::ZERO;
        }
        (self.total_pnl() / self.initial_capital) * Decimal::from(100)
    }

    /// Get number of open positions
    pub fn position_count(&self) -> usize {
        self.positions.len()
    }

    /// Clear all positions (for testing)
    pub fn clear(&self) {
        self.positions.clear();
        let mut cash = self.cash.write();
        *cash = self.initial_capital;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_portfolio_creation() {
        let portfolio = Portfolio::new(Decimal::from(10000));
        assert_eq!(portfolio.cash(), Decimal::from(10000));
        assert_eq!(portfolio.position_count(), 0);
    }

    #[test]
    fn test_open_position() {
        let portfolio = Portfolio::new(Decimal::from(10000));
        let symbol = Symbol::new("AAPL");

        portfolio
            .open_position(symbol.clone(), 10, Decimal::from(150))
            .unwrap();

        assert_eq!(portfolio.cash(), Decimal::from(8500)); // 10000 - (10 * 150)
        assert_eq!(portfolio.position_count(), 1);

        let position = portfolio.get_position(&symbol).unwrap();
        assert_eq!(position.quantity, 10);
        assert_eq!(position.avg_entry_price, Decimal::from(150));
    }

    #[test]
    fn test_close_position() {
        let portfolio = Portfolio::new(Decimal::from(10000));
        let symbol = Symbol::new("AAPL");

        // Open position
        portfolio
            .open_position(symbol.clone(), 10, Decimal::from(150))
            .unwrap();

        // Close position at profit
        portfolio.close_position(&symbol, Decimal::from(160)).unwrap();

        assert_eq!(portfolio.position_count(), 0);
        // Cash should be: 10000 - 1500 + 1600 = 10100
        assert_eq!(portfolio.cash(), Decimal::from(10100));
    }

    #[test]
    fn test_unrealized_pnl() {
        let portfolio = Portfolio::new(Decimal::from(10000));
        let symbol = Symbol::new("AAPL");

        portfolio
            .open_position(symbol.clone(), 10, Decimal::from(150))
            .unwrap();

        // Update price to $160 (profit of $100)
        portfolio.update_price(&symbol, Decimal::from(160)).unwrap();

        assert_eq!(portfolio.unrealized_pnl(), Decimal::from(100));
    }

    #[test]
    fn test_total_portfolio_value() {
        let portfolio = Portfolio::new(Decimal::from(10000));

        // Open two positions
        portfolio
            .open_position(Symbol::new("AAPL"), 10, Decimal::from(150))
            .unwrap();
        portfolio
            .open_position(Symbol::new("GOOGL"), 5, Decimal::from(200))
            .unwrap();

        // Cash: 10000 - 1500 - 1000 = 7500
        // Positions: 1500 + 1000 = 2500
        // Total: 10000
        assert_eq!(portfolio.total_value(), Decimal::from(10000));
    }

    #[test]
    fn test_average_entry_price() {
        let portfolio = Portfolio::new(Decimal::from(10000));
        let symbol = Symbol::new("AAPL");

        // Buy 10 @ $150
        portfolio
            .open_position(symbol.clone(), 10, Decimal::from(150))
            .unwrap();

        // Buy 10 more @ $160
        portfolio
            .open_position(symbol.clone(), 10, Decimal::from(160))
            .unwrap();

        let position = portfolio.get_position(&symbol).unwrap();
        // Average: (10 * 150 + 10 * 160) / 20 = 155
        assert_eq!(position.avg_entry_price, Decimal::from(155));
        assert_eq!(position.quantity, 20);
    }
}
