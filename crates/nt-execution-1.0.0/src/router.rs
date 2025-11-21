// Smart order router with circuit breaker pattern
//
// Features:
// - Route orders to multiple brokers
// - Circuit breaker for fault tolerance
// - Automatic failover on broker failure
// - Routing strategies (round-robin, lowest fee, fastest execution)

use crate::{BrokerClient, BrokerError, ExecutionError, OrderRequest, OrderResponse, Result};
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{debug, error, info, warn};

/// Order routing strategy
#[derive(Debug, Clone, Copy)]
pub enum RoutingStrategy {
    /// Simple round-robin across brokers
    RoundRobin,
    /// Choose broker with lowest fee structure
    LowestFee,
    /// Choose broker with fastest execution history
    FastestExecution,
    /// Primary broker with fallback
    PrimaryWithFallback,
}

/// Circuit breaker state
#[derive(Debug, Clone)]
enum CircuitState {
    Closed { failure_count: u32 },
    Open { opened_at: Instant },
    HalfOpen,
}

/// Circuit breaker for broker health
struct CircuitBreaker {
    state: RwLock<CircuitState>,
    failure_threshold: u32,
    reset_timeout: Duration,
}

impl CircuitBreaker {
    fn new(failure_threshold: u32, reset_timeout: Duration) -> Self {
        Self {
            state: RwLock::new(CircuitState::Closed { failure_count: 0 }),
            failure_threshold,
            reset_timeout,
        }
    }

    fn is_open(&self) -> bool {
        let state = self.state.read();
        matches!(*state, CircuitState::Open { .. })
    }

    fn record_success(&self) {
        let mut state = self.state.write();
        *state = CircuitState::Closed { failure_count: 0 };
    }

    fn record_failure(&self) {
        let mut state = self.state.write();
        match *state {
            CircuitState::Closed { failure_count } => {
                let new_count = failure_count + 1;
                if new_count >= self.failure_threshold {
                    *state = CircuitState::Open {
                        opened_at: Instant::now(),
                    };
                    warn!("Circuit breaker opened after {} failures", new_count);
                } else {
                    *state = CircuitState::Closed {
                        failure_count: new_count,
                    };
                }
            }
            CircuitState::HalfOpen => {
                *state = CircuitState::Open {
                    opened_at: Instant::now(),
                };
                warn!("Circuit breaker reopened after failure in half-open state");
            }
            CircuitState::Open { .. } => {}
        }
    }

    fn try_reset(&self) -> bool {
        let mut state = self.state.write();
        if let CircuitState::Open { opened_at } = *state {
            if opened_at.elapsed() >= self.reset_timeout {
                *state = CircuitState::HalfOpen;
                info!("Circuit breaker entering half-open state");
                return true;
            }
        }
        false
    }
}

/// Broker with circuit breaker
struct ProtectedBroker {
    broker: Arc<dyn BrokerClient>,
    circuit_breaker: CircuitBreaker,
    name: String,
}

impl ProtectedBroker {
    fn new(broker: Arc<dyn BrokerClient>, name: String) -> Self {
        Self {
            broker,
            circuit_breaker: CircuitBreaker::new(3, Duration::from_secs(30)),
            name,
        }
    }

    async fn place_order(&self, order: OrderRequest) -> Result<OrderResponse> {
        // Check circuit breaker
        if self.circuit_breaker.is_open() {
            self.circuit_breaker.try_reset();
            if self.circuit_breaker.is_open() {
                return Err(ExecutionError::CircuitBreakerOpen);
            }
        }

        // Execute order
        match self.broker.place_order(order).await {
            Ok(response) => {
                self.circuit_breaker.record_success();
                Ok(response)
            }
            Err(e) => {
                self.circuit_breaker.record_failure();
                Err(e.into())
            }
        }
    }

    fn is_available(&self) -> bool {
        !self.circuit_breaker.is_open()
    }
}

/// Smart order router
pub struct OrderRouter {
    brokers: Vec<ProtectedBroker>,
    strategy: RoutingStrategy,
    current_index: RwLock<usize>,
}

impl OrderRouter {
    /// Create a new order router
    pub fn new(strategy: RoutingStrategy) -> Self {
        Self {
            brokers: Vec::new(),
            strategy,
            current_index: RwLock::new(0),
        }
    }

    /// Add a broker to the router
    pub fn add_broker(mut self, broker: Arc<dyn BrokerClient>, name: String) -> Self {
        self.brokers.push(ProtectedBroker::new(broker, name));
        self
    }

    /// Route an order to the best available broker
    pub async fn route_order(&self, order: OrderRequest) -> Result<OrderResponse> {
        if self.brokers.is_empty() {
            return Err(ExecutionError::Order(
                "No brokers available".to_string(),
            ));
        }

        match self.strategy {
            RoutingStrategy::RoundRobin => self.route_round_robin(order).await,
            RoutingStrategy::PrimaryWithFallback => self.route_primary_with_fallback(order).await,
            RoutingStrategy::LowestFee | RoutingStrategy::FastestExecution => {
                // For now, fallback to round-robin
                // TODO: Implement fee/latency tracking
                self.route_round_robin(order).await
            }
        }
    }

    /// Round-robin routing
    async fn route_round_robin(&self, order: OrderRequest) -> Result<OrderResponse> {
        let start_index = {
            let mut index = self.current_index.write();
            let current = *index;
            *index = (current + 1) % self.brokers.len();
            current
        };

        // Try each broker in order, starting from current index
        for i in 0..self.brokers.len() {
            let broker_index = (start_index + i) % self.brokers.len();
            let broker = &self.brokers[broker_index];

            if !broker.is_available() {
                debug!(
                    "Broker {} unavailable (circuit breaker open), trying next",
                    broker.name
                );
                continue;
            }

            match broker.place_order(order.clone()).await {
                Ok(response) => {
                    info!("Order routed to broker: {}", broker.name);
                    return Ok(response);
                }
                Err(e) => {
                    warn!(
                        "Failed to place order on broker {}: {}",
                        broker.name, e
                    );
                    continue;
                }
            }
        }

        error!("All brokers failed to execute order");
        Err(ExecutionError::Order(
            "All brokers failed to execute order".to_string(),
        ))
    }

    /// Primary broker with automatic failover
    async fn route_primary_with_fallback(&self, order: OrderRequest) -> Result<OrderResponse> {
        // Try primary broker first (index 0)
        if let Some(primary) = self.brokers.first() {
            if primary.is_available() {
                match primary.place_order(order.clone()).await {
                    Ok(response) => {
                        info!("Order routed to primary broker: {}", primary.name);
                        return Ok(response);
                    }
                    Err(e) => {
                        warn!(
                            "Primary broker {} failed: {}, trying fallbacks",
                            primary.name, e
                        );
                    }
                }
            } else {
                warn!(
                    "Primary broker {} unavailable, trying fallbacks",
                    primary.name
                );
            }
        }

        // Try fallback brokers
        for (i, broker) in self.brokers.iter().enumerate().skip(1) {
            if !broker.is_available() {
                continue;
            }

            match broker.place_order(order.clone()).await {
                Ok(response) => {
                    info!(
                        "Order routed to fallback broker #{}: {}",
                        i, broker.name
                    );
                    return Ok(response);
                }
                Err(e) => {
                    warn!("Fallback broker {} failed: {}", broker.name, e);
                    continue;
                }
            }
        }

        error!("All brokers (primary and fallbacks) failed");
        Err(ExecutionError::Order(
            "All brokers failed to execute order".to_string(),
        ))
    }

    /// Get broker health status
    pub fn get_broker_status(&self) -> Vec<(String, bool)> {
        self.brokers
            .iter()
            .map(|b| (b.name.clone(), b.is_available()))
            .collect()
    }

    /// Get number of available brokers
    pub fn available_brokers(&self) -> usize {
        self.brokers.iter().filter(|b| b.is_available()).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_breaker_opens_after_failures() {
        let cb = CircuitBreaker::new(3, Duration::from_secs(30));

        assert!(!cb.is_open());

        cb.record_failure();
        assert!(!cb.is_open());

        cb.record_failure();
        assert!(!cb.is_open());

        cb.record_failure();
        assert!(cb.is_open());
    }

    #[test]
    fn test_circuit_breaker_resets_on_success() {
        let cb = CircuitBreaker::new(3, Duration::from_secs(30));

        cb.record_failure();
        cb.record_failure();
        assert!(!cb.is_open());

        cb.record_success();
        assert!(!cb.is_open());

        // Should take 3 more failures to open
        cb.record_failure();
        cb.record_failure();
        assert!(!cb.is_open());

        cb.record_failure();
        assert!(cb.is_open());
    }
}
