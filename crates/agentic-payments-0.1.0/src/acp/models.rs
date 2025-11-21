//! ACP (Agentic Commerce Protocol) Data Models
//!
//! Core types for checkout sessions and payment delegation

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Checkout Session Status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CheckoutStatus {
    Created,
    Active,
    Completed,
    Cancelled,
    Expired,
}

/// Checkout Session - represents an active shopping session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutSession {
    pub id: String,
    pub status: CheckoutStatus,
    pub amount: i64, // Amount in minor units (cents)
    pub currency: String,
    pub merchant_id: String,
    pub items: Vec<CheckoutItem>,
    pub created_at: i64, // Unix timestamp
    pub expires_at: Option<i64>, // Unix timestamp
}

/// Checkout Item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutItem {
    pub id: String,
    pub name: String,
    pub quantity: u32,
    pub unit_price: i64,
}

impl CheckoutSession {
    pub fn new(merchant_id: String, amount: i64, currency: String) -> Self {
        Self {
            id: format!("cs_{}", uuid::Uuid::new_v4()),
            status: CheckoutStatus::Created,
            amount,
            currency,
            merchant_id,
            items: Vec::new(),
            created_at: Utc::now().timestamp(),
            expires_at: None,
        }
    }

    pub fn add_item(&mut self, item: CheckoutItem) {
        self.items.push(item);
    }

    pub fn is_valid(&self) -> bool {
        match self.status {
            CheckoutStatus::Created | CheckoutStatus::Active => {
                if let Some(expires_at) = self.expires_at {
                    Utc::now().timestamp() < expires_at
                } else {
                    true
                }
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checkout_session_creation() {
        let session = CheckoutSession::new(
            "merchant_123".to_string(),
            5000,
            "USD".to_string(),
        );

        assert_eq!(session.status, CheckoutStatus::Created);
        assert_eq!(session.amount, 5000);
        assert_eq!(session.currency, "USD");
        assert!(session.is_valid());
    }

    #[test]
    fn test_add_item() {
        let mut session = CheckoutSession::new(
            "merchant_123".to_string(),
            5000,
            "USD".to_string(),
        );

        let item = CheckoutItem {
            id: "item_1".to_string(),
            name: "Test Product".to_string(),
            quantity: 2,
            unit_price: 2500,
        };

        session.add_item(item);
        assert_eq!(session.items.len(), 1);
    }
}