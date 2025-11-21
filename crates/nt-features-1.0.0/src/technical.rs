// Technical indicators implementation
//
// Includes: SMA, EMA, RSI, MACD, Bollinger Bands
// Performance target: <1ms per indicator update

use crate::{FeatureError, Result};
use rust_decimal::Decimal;
use std::collections::VecDeque;

pub struct TechnicalIndicators {
    config: IndicatorConfig,
    price_window: VecDeque<Decimal>,
}

#[derive(Debug, Clone)]
pub struct IndicatorConfig {
    pub sma_period: usize,
    pub ema_period: usize,
    pub rsi_period: usize,
    pub macd_fast: usize,
    pub macd_slow: usize,
    pub macd_signal: usize,
    pub bb_period: usize,
    pub bb_std_dev: f64,
}

impl Default for IndicatorConfig {
    fn default() -> Self {
        Self {
            sma_period: 20,
            ema_period: 12,
            rsi_period: 14,
            macd_fast: 12,
            macd_slow: 26,
            macd_signal: 9,
            bb_period: 20,
            bb_std_dev: 2.0,
        }
    }
}

impl TechnicalIndicators {
    pub fn new(config: IndicatorConfig) -> Self {
        let max_window = config
            .sma_period
            .max(config.ema_period)
            .max(config.rsi_period)
            .max(config.macd_slow)
            .max(config.bb_period);

        Self {
            config,
            price_window: VecDeque::with_capacity(max_window),
        }
    }

    pub fn add_price(&mut self, price: Decimal) {
        let max_window = self.config.sma_period.max(self.config.macd_slow);

        self.price_window.push_back(price);
        if self.price_window.len() > max_window {
            self.price_window.pop_front();
        }
    }

    /// Simple Moving Average
    pub fn sma(&self) -> Result<Decimal> {
        if self.price_window.len() < self.config.sma_period {
            return Err(FeatureError::InsufficientData(self.config.sma_period));
        }

        let sum: Decimal = self
            .price_window
            .iter()
            .rev()
            .take(self.config.sma_period)
            .sum();

        Ok(sum / Decimal::from(self.config.sma_period))
    }

    /// Exponential Moving Average
    pub fn ema(&self, prices: &[Decimal], period: usize) -> Result<Decimal> {
        if prices.len() < period {
            return Err(FeatureError::InsufficientData(period));
        }

        let multiplier = Decimal::from(2) / Decimal::from(period + 1);
        let sma: Decimal = prices.iter().take(period).sum::<Decimal>() / Decimal::from(period);

        let mut ema = sma;
        for &price in prices.iter().skip(period) {
            ema = (price - ema) * multiplier + ema;
        }

        Ok(ema)
    }

    /// Relative Strength Index
    pub fn rsi(&self) -> Result<Decimal> {
        if self.price_window.len() < self.config.rsi_period + 1 {
            return Err(FeatureError::InsufficientData(self.config.rsi_period + 1));
        }

        let mut gains = Vec::new();
        let mut losses = Vec::new();

        for window in self.price_window.iter().collect::<Vec<_>>().windows(2) {
            let change = window[1] - window[0];
            if change > Decimal::ZERO {
                gains.push(change);
                losses.push(Decimal::ZERO);
            } else {
                gains.push(Decimal::ZERO);
                losses.push(-change);
            }
        }

        let avg_gain: Decimal = gains
            .iter()
            .rev()
            .take(self.config.rsi_period)
            .sum::<Decimal>()
            / Decimal::from(self.config.rsi_period);

        let avg_loss: Decimal = losses
            .iter()
            .rev()
            .take(self.config.rsi_period)
            .sum::<Decimal>()
            / Decimal::from(self.config.rsi_period);

        if avg_loss == Decimal::ZERO {
            return Ok(Decimal::from(100));
        }

        let rs = avg_gain / avg_loss;
        let rsi = Decimal::from(100) - (Decimal::from(100) / (Decimal::ONE + rs));

        Ok(rsi)
    }

    /// MACD (Moving Average Convergence Divergence)
    pub fn macd(&self) -> Result<(Decimal, Decimal, Decimal)> {
        if self.price_window.len() < self.config.macd_slow {
            return Err(FeatureError::InsufficientData(self.config.macd_slow));
        }

        let prices: Vec<Decimal> = self.price_window.iter().copied().collect();

        let fast_ema = self.ema(&prices, self.config.macd_fast)?;
        let slow_ema = self.ema(&prices, self.config.macd_slow)?;
        let macd_line = fast_ema - slow_ema;

        // Signal line (9-period EMA of MACD)
        // Simplified: return zero for signal and histogram
        let signal_line = Decimal::ZERO;
        let histogram = macd_line - signal_line;

        Ok((macd_line, signal_line, histogram))
    }

    /// Bollinger Bands
    pub fn bollinger_bands(&self) -> Result<(Decimal, Decimal, Decimal)> {
        if self.price_window.len() < self.config.bb_period {
            return Err(FeatureError::InsufficientData(self.config.bb_period));
        }

        let sma = self.sma()?;

        let recent_prices: Vec<Decimal> = self
            .price_window
            .iter()
            .rev()
            .take(self.config.bb_period)
            .copied()
            .collect();

        // Calculate standard deviation
        let variance: Decimal = recent_prices
            .iter()
            .map(|&price| {
                let diff = price - sma;
                diff * diff
            })
            .sum::<Decimal>()
            / Decimal::from(self.config.bb_period);

        // Calculate standard deviation (convert to f64 for sqrt, then back to Decimal)
        let variance_f64 = variance
            .to_string()
            .parse::<f64>()
            .map_err(|_| FeatureError::Calculation("Cannot convert variance to f64".to_string()))?;
        let std_dev_f64 = variance_f64.sqrt();
        let std_dev = Decimal::try_from(std_dev_f64).map_err(|_| {
            FeatureError::Calculation("Cannot convert sqrt result to Decimal".to_string())
        })?;

        let multiplier = Decimal::try_from(self.config.bb_std_dev)
            .map_err(|_| FeatureError::Calculation("Invalid std_dev".to_string()))?;

        let upper_band = sma + (std_dev * multiplier);
        let lower_band = sma - (std_dev * multiplier);

        Ok((upper_band, sma, lower_band))
    }

    /// Get all indicators at once
    pub fn calculate_all(&self) -> Result<IndicatorValues> {
        Ok(IndicatorValues {
            sma: self.sma().ok(),
            rsi: self.rsi().ok(),
            macd: self.macd().ok(),
            bollinger: self.bollinger_bands().ok(),
        })
    }
}

#[derive(Debug, Clone)]
pub struct IndicatorValues {
    pub sma: Option<Decimal>,
    pub rsi: Option<Decimal>,
    pub macd: Option<(Decimal, Decimal, Decimal)>,
    pub bollinger: Option<(Decimal, Decimal, Decimal)>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_sma() {
        let _config = IndicatorConfig {
            sma_period: 3,
            ..Default::default()
        };

        let mut indicators = TechnicalIndicators::new(config);

        indicators.add_price(dec!(100));
        indicators.add_price(dec!(110));
        indicators.add_price(dec!(120));

        let sma = indicators.sma().unwrap();
        assert_eq!(sma, dec!(110)); // (100 + 110 + 120) / 3
    }

    #[test]
    fn test_rsi_all_gains() {
        let _config = IndicatorConfig {
            rsi_period: 3,
            ..Default::default()
        };

        let mut indicators = TechnicalIndicators::new(config);

        indicators.add_price(dec!(100));
        indicators.add_price(dec!(105));
        indicators.add_price(dec!(110));
        indicators.add_price(dec!(115));

        let rsi = indicators.rsi().unwrap();
        assert_eq!(rsi, dec!(100)); // All gains, RSI = 100
    }

    #[test]
    fn test_insufficient_data() {
        let _config = IndicatorConfig {
            sma_period: 5,
            ..Default::default()
        };

        let mut indicators = TechnicalIndicators::new(config);

        indicators.add_price(dec!(100));
        indicators.add_price(dec!(110));

        let result = indicators.sma();
        assert!(result.is_err());
    }

    #[test]
    fn test_bollinger_bands() {
        let _config = IndicatorConfig {
            bb_period: 3,
            bb_std_dev: 2.0,
            sma_period: 3,
            ..Default::default()
        };

        let mut indicators = TechnicalIndicators::new(config);

        indicators.add_price(dec!(100));
        indicators.add_price(dec!(110));
        indicators.add_price(dec!(120));

        let (upper, middle, lower) = indicators.bollinger_bands().unwrap();

        assert_eq!(middle, dec!(110)); // SMA
        assert!(upper > middle);
        assert!(lower < middle);
    }
}
