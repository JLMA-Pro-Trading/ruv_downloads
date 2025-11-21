// Multi-source market data aggregator with automatic failover
//
// Implements circuit breaker pattern for provider health management

use crate::{
    errors::{MarketDataError, Result},
    types::{Bar, Quote, Timeframe},
    {HealthStatus, MarketDataProvider, QuoteStream, TradeStream},
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{info, warn};

pub struct MarketDataAggregator {
    providers: Vec<ProviderWithHealth>,
    health_checker: Arc<HealthChecker>,
}

struct ProviderWithHealth {
    name: String,
    provider: Arc<dyn MarketDataProvider>,
}

impl MarketDataAggregator {
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
            health_checker: Arc::new(HealthChecker::new()),
        }
    }

    pub fn add_provider(mut self, name: String, provider: Arc<dyn MarketDataProvider>) -> Self {
        self.providers.push(ProviderWithHealth { name, provider });
        self
    }

    async fn try_providers<F, T>(&self, mut f: F) -> Result<T>
    where
        F: FnMut(
            &dyn MarketDataProvider,
        )
            -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T>> + Send + '_>>,
    {
        let mut last_error = None;

        for provider_with_health in &self.providers {
            let name = &provider_with_health.name;
            let provider = &provider_with_health.provider;

            // Skip unhealthy providers
            if !self.health_checker.is_healthy(name).await {
                warn!("Skipping unhealthy provider: {}", name);
                continue;
            }

            match f(provider.as_ref()).await {
                Ok(result) => {
                    info!("Successfully retrieved data from provider: {}", name);
                    self.health_checker.mark_healthy(name).await;
                    return Ok(result);
                }
                Err(e) => {
                    warn!("Provider {} failed: {}", name, e);
                    self.health_checker.mark_unhealthy(name).await;
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            MarketDataError::ProviderUnavailable("All providers failed".to_string())
        }))
    }
}

impl Default for MarketDataAggregator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MarketDataProvider for MarketDataAggregator {
    async fn get_quote(&self, symbol: &str) -> Result<Quote> {
        let symbol = symbol.to_string();
        self.try_providers(move |provider| {
            let symbol = symbol.clone();
            Box::pin(async move { provider.get_quote(&symbol).await })
        })
        .await
    }

    async fn get_bars(
        &self,
        symbol: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        timeframe: Timeframe,
    ) -> Result<Vec<Bar>> {
        let symbol = symbol.to_string();
        self.try_providers(move |provider| {
            let symbol = symbol.clone();
            Box::pin(async move { provider.get_bars(&symbol, start, end, timeframe).await })
        })
        .await
    }

    async fn subscribe_quotes(&self, symbols: Vec<String>) -> Result<QuoteStream> {
        // Try first healthy provider
        for provider_with_health in &self.providers {
            let name = &provider_with_health.name;
            let provider = &provider_with_health.provider;

            if !self.health_checker.is_healthy(name).await {
                continue;
            }

            match provider.subscribe_quotes(symbols.clone()).await {
                Ok(stream) => {
                    info!("Subscribed to quotes from provider: {}", name);
                    return Ok(stream);
                }
                Err(e) => {
                    warn!("Failed to subscribe to provider {}: {}", name, e);
                    self.health_checker.mark_unhealthy(name).await;
                }
            }
        }

        Err(MarketDataError::ProviderUnavailable(
            "No provider available for quote subscription".to_string(),
        ))
    }

    async fn subscribe_trades(&self, symbols: Vec<String>) -> Result<TradeStream> {
        // Try first healthy provider
        for provider_with_health in &self.providers {
            let name = &provider_with_health.name;
            let provider = &provider_with_health.provider;

            if !self.health_checker.is_healthy(name).await {
                continue;
            }

            match provider.subscribe_trades(symbols.clone()).await {
                Ok(stream) => {
                    info!("Subscribed to trades from provider: {}", name);
                    return Ok(stream);
                }
                Err(e) => {
                    warn!("Failed to subscribe to provider {}: {}", name, e);
                    self.health_checker.mark_unhealthy(name).await;
                }
            }
        }

        Err(MarketDataError::ProviderUnavailable(
            "No provider available for trade subscription".to_string(),
        ))
    }

    async fn health_check(&self) -> Result<HealthStatus> {
        let mut healthy_count = 0;
        let mut degraded_count = 0;

        for provider_with_health in &self.providers {
            let name = &provider_with_health.name;
            let provider = &provider_with_health.provider;

            match provider.health_check().await {
                Ok(HealthStatus::Healthy) => {
                    healthy_count += 1;
                    self.health_checker.mark_healthy(name).await;
                }
                Ok(HealthStatus::Degraded) => {
                    degraded_count += 1;
                }
                _ => {
                    self.health_checker.mark_unhealthy(name).await;
                }
            }
        }

        if healthy_count > 0 {
            Ok(HealthStatus::Healthy)
        } else if degraded_count > 0 {
            Ok(HealthStatus::Degraded)
        } else {
            Ok(HealthStatus::Unhealthy)
        }
    }
}

/// Circuit breaker pattern for provider health management
pub struct HealthChecker {
    states: Arc<DashMap<String, HealthState>>,
    recovery_timeout: Duration,
}

struct HealthState {
    is_healthy: bool,
    failure_count: u32,
    last_check: Instant,
}

impl HealthChecker {
    pub fn new() -> Self {
        Self {
            states: Arc::new(DashMap::new()),
            recovery_timeout: Duration::from_secs(30),
        }
    }

    pub async fn is_healthy(&self, provider: &str) -> bool {
        if let Some(state) = self.states.get(provider) {
            // Auto-recover after timeout
            if !state.is_healthy && state.last_check.elapsed() > self.recovery_timeout {
                drop(state);
                self.mark_healthy(provider).await;
                return true;
            }
            state.is_healthy
        } else {
            true // Assume healthy if not tracked
        }
    }

    pub async fn mark_healthy(&self, provider: &str) {
        self.states.insert(
            provider.to_string(),
            HealthState {
                is_healthy: true,
                failure_count: 0,
                last_check: Instant::now(),
            },
        );
    }

    pub async fn mark_unhealthy(&self, provider: &str) {
        self.states
            .entry(provider.to_string())
            .and_modify(|state| {
                state.is_healthy = false;
                state.failure_count += 1;
                state.last_check = Instant::now();
            })
            .or_insert(HealthState {
                is_healthy: false,
                failure_count: 1,
                last_check: Instant::now(),
            });
    }

    pub fn get_failure_count(&self, provider: &str) -> u32 {
        self.states
            .get(provider)
            .map(|state| state.failure_count)
            .unwrap_or(0)
    }
}

impl Default for HealthChecker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_checker() {
        let checker = HealthChecker::new();

        // Initially healthy
        assert!(checker.is_healthy("test_provider").await);

        // Mark unhealthy
        checker.mark_unhealthy("test_provider").await;
        assert!(!checker.is_healthy("test_provider").await);
        assert_eq!(checker.get_failure_count("test_provider"), 1);

        // Mark healthy again
        checker.mark_healthy("test_provider").await;
        assert!(checker.is_healthy("test_provider").await);
        assert_eq!(checker.get_failure_count("test_provider"), 0);
    }

    #[tokio::test]
    async fn test_aggregator_creation() {
        let aggregator = MarketDataAggregator::new();
        assert_eq!(aggregator.providers.len(), 0);
    }
}
