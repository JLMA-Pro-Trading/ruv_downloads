// Fill reconciliation and matching
//
// Features:
// - Track expected fills vs actual fills
// - Detect fill price anomalies
// - Handle partial fills
// - Reconciliation reports

use crate::{BrokerClient, OrderResponse, OrderStatus, Result};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use nt_core::types::Symbol;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error, warn};

/// Fill reconciliation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconciliationResult {
    pub order_id: String,
    pub status: ReconciliationStatus,
    pub discrepancies: Vec<Discrepancy>,
    pub checked_at: DateTime<Utc>,
}

/// Reconciliation status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReconciliationStatus {
    /// Fill matches expected
    Matched,
    /// Minor discrepancy within tolerance
    Warning,
    /// Significant discrepancy requiring attention
    Error,
}

/// Discrepancy type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Discrepancy {
    /// Quantity mismatch
    QuantityMismatch {
        expected: u32,
        actual: u32,
        difference: i32,
    },
    /// Price deviation
    PriceDeviation {
        expected: Decimal,
        actual: Decimal,
        deviation_pct: Decimal,
    },
    /// Unexpected order status
    StatusMismatch {
        expected: OrderStatus,
        actual: OrderStatus,
    },
    /// Timing issue
    TimingAnomaly { message: String },
}

/// Expected order information for reconciliation
#[derive(Debug, Clone)]
struct ExpectedOrder {
    order_id: String,
    symbol: Symbol,
    expected_qty: u32,
    expected_price_range: Option<(Decimal, Decimal)>,
    placed_at: DateTime<Utc>,
}

/// Fill reconciler
pub struct FillReconciler {
    expected_orders: Arc<DashMap<String, ExpectedOrder>>,
    /// Maximum allowed price deviation percentage (e.g., 0.01 = 1%)
    max_price_deviation: Decimal,
}

impl FillReconciler {
    /// Create a new fill reconciler
    pub fn new(max_price_deviation: Decimal) -> Self {
        Self {
            expected_orders: Arc::new(DashMap::new()),
            max_price_deviation,
        }
    }

    /// Register an order for reconciliation
    pub fn register_order(
        &self,
        order_id: String,
        symbol: Symbol,
        expected_qty: u32,
        expected_price_range: Option<(Decimal, Decimal)>,
    ) {
        debug!("Registering order for reconciliation: {}", order_id);

        self.expected_orders.insert(
            order_id.clone(),
            ExpectedOrder {
                order_id,
                symbol,
                expected_qty,
                expected_price_range,
                placed_at: Utc::now(),
            },
        );
    }

    /// Reconcile an order against actual fill
    pub async fn reconcile(
        &self,
        order_id: &str,
        broker: &dyn BrokerClient,
    ) -> Result<ReconciliationResult> {
        debug!("Reconciling order: {}", order_id);

        // Get expected order
        let expected = match self.expected_orders.get(order_id) {
            Some(order) => order.clone(),
            None => {
                warn!("No expected order found for reconciliation: {}", order_id);
                return Ok(ReconciliationResult {
                    order_id: order_id.to_string(),
                    status: ReconciliationStatus::Warning,
                    discrepancies: vec![],
                    checked_at: Utc::now(),
                });
            }
        };

        // Get actual order from broker
        let actual = broker.get_order(order_id).await?;

        // Perform checks
        let mut discrepancies = Vec::new();

        // Check quantity
        if actual.status == OrderStatus::Filled {
            if actual.filled_qty != expected.expected_qty {
                let difference = actual.filled_qty as i32 - expected.expected_qty as i32;
                discrepancies.push(Discrepancy::QuantityMismatch {
                    expected: expected.expected_qty,
                    actual: actual.filled_qty,
                    difference,
                });
            }
        } else if actual.status == OrderStatus::PartiallyFilled {
            if actual.filled_qty < expected.expected_qty {
                let difference = actual.filled_qty as i32 - expected.expected_qty as i32;
                discrepancies.push(Discrepancy::QuantityMismatch {
                    expected: expected.expected_qty,
                    actual: actual.filled_qty,
                    difference,
                });
            }
        }

        // Check fill price
        if let Some(filled_price) = actual.filled_avg_price {
            if let Some((min_price, max_price)) = expected.expected_price_range {
                if filled_price < min_price || filled_price > max_price {
                    let mid_price = (min_price + max_price) / Decimal::from(2);
                    let deviation = ((filled_price - mid_price).abs() / mid_price)
                        * Decimal::from(100);

                    discrepancies.push(Discrepancy::PriceDeviation {
                        expected: mid_price,
                        actual: filled_price,
                        deviation_pct: deviation,
                    });
                }
            }
        }

        // Check timing (warn if fill took too long)
        if let Some(filled_at) = actual.filled_at {
            let execution_time = (filled_at - expected.placed_at)
                .num_milliseconds()
                .abs();

            if execution_time > 60000 {
                // > 1 minute
                discrepancies.push(Discrepancy::TimingAnomaly {
                    message: format!(
                        "Order took {} seconds to fill",
                        execution_time / 1000
                    ),
                });
            }
        }

        // Determine overall status
        let status = if discrepancies.is_empty() {
            ReconciliationStatus::Matched
        } else if discrepancies.iter().any(|d| matches!(d, Discrepancy::PriceDeviation { deviation_pct, .. } if *deviation_pct > self.max_price_deviation * Decimal::from(100))) {
            error!("Significant price deviation detected for order {}", order_id);
            ReconciliationStatus::Error
        } else {
            ReconciliationStatus::Warning
        };

        let result = ReconciliationResult {
            order_id: order_id.to_string(),
            status,
            discrepancies,
            checked_at: Utc::now(),
        };

        // Log results
        match result.status {
            ReconciliationStatus::Matched => {
                debug!("Order {} reconciled successfully", order_id);
            }
            ReconciliationStatus::Warning => {
                warn!("Order {} reconciliation warnings: {:?}", order_id, result.discrepancies);
            }
            ReconciliationStatus::Error => {
                error!("Order {} reconciliation errors: {:?}", order_id, result.discrepancies);
            }
        }

        // Remove from expected orders
        self.expected_orders.remove(order_id);

        Ok(result)
    }

    /// Reconcile all pending orders
    pub async fn reconcile_all(
        &self,
        broker: &dyn BrokerClient,
    ) -> Result<Vec<ReconciliationResult>> {
        let order_ids: Vec<String> = self
            .expected_orders
            .iter()
            .map(|entry| entry.key().clone())
            .collect();

        let mut results = Vec::new();

        for order_id in order_ids {
            match self.reconcile(&order_id, broker).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    error!("Failed to reconcile order {}: {}", order_id, e);
                }
            }
        }

        Ok(results)
    }

    /// Get number of pending reconciliations
    pub fn pending_count(&self) -> usize {
        self.expected_orders.len()
    }

    /// Clear all expected orders
    pub fn clear(&self) {
        self.expected_orders.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconciliation_status() {
        let result = ReconciliationResult {
            order_id: "test123".to_string(),
            status: ReconciliationStatus::Matched,
            discrepancies: vec![],
            checked_at: Utc::now(),
        };

        assert_eq!(result.status, ReconciliationStatus::Matched);
        assert!(result.discrepancies.is_empty());
    }

    #[test]
    fn test_quantity_discrepancy() {
        let discrepancy = Discrepancy::QuantityMismatch {
            expected: 100,
            actual: 95,
            difference: -5,
        };

        match discrepancy {
            Discrepancy::QuantityMismatch {
                expected,
                actual,
                difference,
            } => {
                assert_eq!(expected, 100);
                assert_eq!(actual, 95);
                assert_eq!(difference, -5);
            }
            _ => panic!("Wrong discrepancy type"),
        }
    }
}
