use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Serialize, Deserialize};

/// Real-time market quote
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub symbol: String,
    pub timestamp: DateTime<Utc>,
    pub bid: Decimal,
    pub ask: Decimal,
    pub bid_size: u64,
    pub ask_size: u64,
}

impl Quote {
    pub fn mid_price(&self) -> Decimal {
        (self.bid + self.ask) / Decimal::from(2)
    }

    pub fn spread(&self) -> Decimal {
        self.ask - self.bid
    }

    pub fn spread_bps(&self) -> Decimal {
        (self.spread() / self.mid_price()) * Decimal::from(10000)
    }
}

/// OHLCV bar
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bar {
    pub symbol: String,
    pub timestamp: DateTime<Utc>,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: u64,
}

impl Bar {
    pub fn typical_price(&self) -> Decimal {
        (self.high + self.low + self.close) / Decimal::from(3)
    }

    pub fn range(&self) -> Decimal {
        self.high - self.low
    }
}

/// Individual trade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub symbol: String,
    pub timestamp: DateTime<Utc>,
    pub price: Decimal,
    pub size: u64,
    pub conditions: Vec<String>,
}

/// Raw tick data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tick {
    pub symbol: String,
    pub timestamp: DateTime<Utc>,
    pub price: Decimal,
    pub volume: u64,
}

/// Timeframe for bars
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Timeframe {
    Minute1,
    Minute5,
    Minute15,
    Hour1,
    Day1,
}

impl Timeframe {
    pub fn as_str(&self) -> &'static str {
        match self {
            Timeframe::Minute1 => "1Min",
            Timeframe::Minute5 => "5Min",
            Timeframe::Minute15 => "15Min",
            Timeframe::Hour1 => "1Hour",
            Timeframe::Day1 => "1Day",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_quote_calculations() {
        let quote = Quote {
            symbol: "AAPL".to_string(),
            timestamp: Utc::now(),
            bid: dec!(150.00),
            ask: dec!(150.10),
            bid_size: 100,
            ask_size: 200,
        };

        assert_eq!(quote.mid_price(), dec!(150.05));
        assert_eq!(quote.spread(), dec!(0.10));
    }

    #[test]
    fn test_bar_calculations() {
        let bar = Bar {
            symbol: "AAPL".to_string(),
            timestamp: Utc::now(),
            open: dec!(150.00),
            high: dec!(152.00),
            low: dec!(149.00),
            close: dec!(151.00),
            volume: 1000000,
        };

        assert_eq!(bar.range(), dec!(3.00));
    }
}
