// Order lifecycle management with actor pattern
//
// Features:
// - Async order placement with timeout
// - Fill tracking and reconciliation
// - Partial fill handling
// - Order cancellation
// - Retry logic with exponential backoff

use crate::{BrokerClient, ExecutionError, OrderSide, OrderType, Result, Symbol, TimeInForce};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use tokio::time::timeout;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Order status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderStatus {
    /// Order submitted but not yet acknowledged
    Pending,
    /// Order acknowledged by broker
    Accepted,
    /// Order partially filled
    PartiallyFilled,
    /// Order completely filled
    Filled,
    /// Order cancelled
    Cancelled,
    /// Order rejected by broker
    Rejected,
    /// Order expired
    Expired,
}

/// Order request structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderRequest {
    pub symbol: Symbol,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub quantity: u32,
    pub limit_price: Option<Decimal>,
    pub stop_price: Option<Decimal>,
    pub time_in_force: TimeInForce,
}

/// Order response from broker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResponse {
    pub order_id: String,
    pub client_order_id: String,
    pub status: OrderStatus,
    pub filled_qty: u32,
    pub filled_avg_price: Option<Decimal>,
    pub submitted_at: DateTime<Utc>,
    pub filled_at: Option<DateTime<Utc>>,
}

/// Order update notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderUpdate {
    pub order_id: String,
    pub status: OrderStatus,
    pub filled_qty: u32,
    pub filled_avg_price: Option<Decimal>,
    pub timestamp: DateTime<Utc>,
}

/// Tracked order information
#[derive(Debug, Clone)]
struct TrackedOrder {
    request: OrderRequest,
    response: Option<OrderResponse>,
    status: OrderStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

/// Order manager actor messages
enum OrderMessage {
    PlaceOrder {
        request: OrderRequest,
        response_tx: oneshot::Sender<Result<OrderResponse>>,
    },
    CancelOrder {
        order_id: String,
        response_tx: oneshot::Sender<Result<()>>,
    },
    GetOrderStatus {
        order_id: String,
        response_tx: oneshot::Sender<Result<OrderStatus>>,
    },
    UpdateOrder {
        update: OrderUpdate,
    },
    Shutdown,
}

/// Order manager for managing order lifecycle
pub struct OrderManager {
    message_tx: mpsc::Sender<OrderMessage>,
    orders: Arc<DashMap<String, TrackedOrder>>,
}

impl OrderManager {
    /// Create a new order manager
    pub fn new<B: BrokerClient + 'static>(broker: Arc<B>) -> Self {
        let (message_tx, message_rx) = mpsc::channel(1000);
        let orders = Arc::new(DashMap::new());

        // Spawn actor task
        let orders_clone = Arc::clone(&orders);
        tokio::spawn(async move {
            Self::actor_loop(broker, message_rx, orders_clone).await;
        });

        Self { message_tx, orders }
    }

    /// Place an order asynchronously with timeout
    ///
    /// Target: <10ms end-to-end
    pub async fn place_order(&self, request: OrderRequest) -> Result<OrderResponse> {
        let (response_tx, response_rx) = oneshot::channel();

        self.message_tx
            .send(OrderMessage::PlaceOrder {
                request,
                response_tx,
            })
            .await
            .map_err(|e| ExecutionError::Order(format!("Failed to send message: {}", e)))?;

        // Wait for response with timeout (10 seconds)
        timeout(Duration::from_secs(10), response_rx)
            .await
            .map_err(|_| ExecutionError::Timeout)?
            .map_err(|e| ExecutionError::Order(format!("Failed to receive response: {}", e)))?
    }

    /// Cancel an order
    pub async fn cancel_order(&self, order_id: String) -> Result<()> {
        let (response_tx, response_rx) = oneshot::channel();

        self.message_tx
            .send(OrderMessage::CancelOrder {
                order_id,
                response_tx,
            })
            .await
            .map_err(|e| ExecutionError::Order(format!("Failed to send message: {}", e)))?;

        timeout(Duration::from_secs(5), response_rx)
            .await
            .map_err(|_| ExecutionError::Timeout)?
            .map_err(|e| ExecutionError::Order(format!("Failed to receive response: {}", e)))?
    }

    /// Get order status
    pub async fn get_order_status(&self, order_id: &str) -> Result<OrderStatus> {
        // Fast path: check cache first
        if let Some(order) = self.orders.get(order_id) {
            return Ok(order.status);
        }

        let (response_tx, response_rx) = oneshot::channel();

        self.message_tx
            .send(OrderMessage::GetOrderStatus {
                order_id: order_id.to_string(),
                response_tx,
            })
            .await
            .map_err(|e| ExecutionError::Order(format!("Failed to send message: {}", e)))?;

        timeout(Duration::from_secs(5), response_rx)
            .await
            .map_err(|_| ExecutionError::Timeout)?
            .map_err(|e| ExecutionError::Order(format!("Failed to receive response: {}", e)))?
    }

    /// Handle order update (from WebSocket or polling)
    pub async fn handle_order_update(&self, update: OrderUpdate) -> Result<()> {
        self.message_tx
            .send(OrderMessage::UpdateOrder { update })
            .await
            .map_err(|e| ExecutionError::Order(format!("Failed to send update: {}", e)))?;

        Ok(())
    }

    /// Get all orders
    pub fn get_all_orders(&self) -> Vec<(String, OrderStatus)> {
        self.orders
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().status))
            .collect()
    }

    /// Shutdown the order manager
    pub async fn shutdown(&self) -> Result<()> {
        self.message_tx
            .send(OrderMessage::Shutdown)
            .await
            .map_err(|e| ExecutionError::Order(format!("Failed to send shutdown: {}", e)))?;

        Ok(())
    }

    /// Actor loop that processes messages
    async fn actor_loop<B: BrokerClient + 'static>(
        broker: Arc<B>,
        mut message_rx: mpsc::Receiver<OrderMessage>,
        orders: Arc<DashMap<String, TrackedOrder>>,
    ) {
        info!("Order manager actor started");

        while let Some(message) = message_rx.recv().await {
            match message {
                OrderMessage::PlaceOrder {
                    request,
                    response_tx,
                } => {
                    let result =
                        Self::handle_place_order(Arc::clone(&broker), &orders, request).await;
                    let _ = response_tx.send(result);
                }

                OrderMessage::CancelOrder {
                    order_id,
                    response_tx,
                } => {
                    let result =
                        Self::handle_cancel_order(Arc::clone(&broker), &orders, &order_id).await;
                    let _ = response_tx.send(result);
                }

                OrderMessage::GetOrderStatus {
                    order_id,
                    response_tx,
                } => {
                    let result =
                        Self::handle_get_status(Arc::clone(&broker), &orders, &order_id).await;
                    let _ = response_tx.send(result);
                }

                OrderMessage::UpdateOrder { update } => {
                    Self::handle_order_update_internal(&orders, update);
                }

                OrderMessage::Shutdown => {
                    info!("Order manager actor shutting down");
                    break;
                }
            }
        }

        info!("Order manager actor stopped");
    }

    async fn handle_place_order<B: BrokerClient + 'static>(
        broker: Arc<B>,
        orders: &Arc<DashMap<String, TrackedOrder>>,
        request: OrderRequest,
    ) -> Result<OrderResponse> {
        debug!("Placing order: {:?}", request);

        // Retry with exponential backoff (max 3 attempts)
        let response = retry_with_backoff(
            || {
                let broker = Arc::clone(&broker);
                let req = request.clone();
                Box::pin(async move { broker.place_order(req).await })
            },
            3,
            Duration::from_millis(100),
        )
        .await?;

        info!(
            "Order placed: {} status={:?}",
            response.order_id, response.status
        );

        // Track the order
        orders.insert(
            response.order_id.clone(),
            TrackedOrder {
                request: request.clone(),
                response: Some(response.clone()),
                status: response.status,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
        );

        Ok(response)
    }

    async fn handle_cancel_order<B: BrokerClient>(
        broker: Arc<B>,
        orders: &Arc<DashMap<String, TrackedOrder>>,
        order_id: &str,
    ) -> Result<()> {
        debug!("Cancelling order: {}", order_id);

        broker.cancel_order(order_id).await?;

        // Update tracked order
        if let Some(mut order) = orders.get_mut(order_id) {
            order.status = OrderStatus::Cancelled;
            order.updated_at = Utc::now();
        }

        info!("Order cancelled: {}", order_id);
        Ok(())
    }

    async fn handle_get_status<B: BrokerClient>(
        broker: Arc<B>,
        orders: &Arc<DashMap<String, TrackedOrder>>,
        order_id: &str,
    ) -> Result<OrderStatus> {
        // Check cache first
        if let Some(order) = orders.get(order_id) {
            return Ok(order.status);
        }

        // Query broker
        let order = broker.get_order(order_id).await?;

        // Update cache
        if let Some(mut tracked) = orders.get_mut(order_id) {
            tracked.status = order.status;
            tracked.updated_at = Utc::now();
        }

        Ok(order.status)
    }

    fn handle_order_update_internal(orders: &Arc<DashMap<String, TrackedOrder>>, update: OrderUpdate) {
        if let Some(mut order) = orders.get_mut(&update.order_id) {
            order.status = update.status;
            order.updated_at = update.timestamp;

            if let Some(ref mut response) = order.response {
                response.status = update.status;
                response.filled_qty = update.filled_qty;
                response.filled_avg_price = update.filled_avg_price;
            }

            debug!(
                "Order updated: {} status={:?} filled={}",
                update.order_id, update.status, update.filled_qty
            );
        } else {
            warn!("Received update for unknown order: {}", update.order_id);
        }
    }
}

/// Retry an async operation with exponential backoff
async fn retry_with_backoff<F, T, E>(
    mut f: F,
    max_attempts: u32,
    initial_delay: Duration,
) -> Result<T>
where
    F: FnMut() -> std::pin::Pin<Box<dyn std::future::Future<Output = std::result::Result<T, E>> + Send>>,
    E: Into<ExecutionError>,
{
    let mut delay = initial_delay;

    for attempt in 1..=max_attempts {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) if attempt == max_attempts => {
                error!("All {} retry attempts failed", max_attempts);
                return Err(e.into());
            }
            Err(e) => {
                warn!(
                    "Attempt {} failed, retrying in {:?}...",
                    attempt, delay
                );
                tokio::time::sleep(delay).await;
                delay *= 2; // Exponential backoff
            }
        }
    }

    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_order_request_serialization() {
        let request = OrderRequest {
            symbol: Symbol::new("AAPL").expect("Valid symbol"),
            side: OrderSide::Buy,
            order_type: OrderType::Market,
            quantity: 100,
            limit_price: None,
            stop_price: None,
            time_in_force: TimeInForce::Day,
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: OrderRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.symbol, deserialized.symbol);
        assert_eq!(request.quantity, deserialized.quantity);
    }
}
