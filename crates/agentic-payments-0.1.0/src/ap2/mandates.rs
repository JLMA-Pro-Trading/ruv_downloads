//! Mandate Types for AP2 Protocol
//!
//! Three types of mandates:
//! 1. Intent Mandates - User authorization for agent actions
//! 2. Cart Mandates - Explicit purchase authorization
//! 3. Payment Mandates - Payment network signaling

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Mandate Type Enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MandateType {
    Intent,
    Cart,
    Payment,
}

/// Mandate Status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MandateStatus {
    Pending,
    Active,
    Completed,
    Cancelled,
    Expired,
}

/// Base Mandate Trait
pub trait Mandate {
    fn mandate_type(&self) -> MandateType;
    fn issuer(&self) -> &str;
    fn created_at(&self) -> DateTime<Utc>;
    fn expires_at(&self) -> Option<DateTime<Utc>>;
    fn status(&self) -> MandateStatus;
    fn is_valid(&self) -> bool {
        let now = Utc::now();
        match self.expires_at() {
            Some(expiry) => now < expiry && self.status() == MandateStatus::Active,
            None => self.status() == MandateStatus::Active,
        }
    }
}

/// Intent Mandate - User authorizes agent to perform specific actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentMandate {
    pub id: String,
    pub issuer: String,           // User DID
    pub subject_agent: String,    // Agent DID
    pub intent_description: String,
    pub permissions: Vec<Permission>,
    pub constraints: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub status: MandateStatus,
    pub metadata: HashMap<String, String>,
}

/// Permission for agent actions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Permission {
    pub action: String,
    pub resource: String,
    pub conditions: Vec<String>,
}

impl IntentMandate {
    pub fn new(issuer: String, subject_agent: String, intent_description: String) -> Self {
        Self {
            id: format!("intent:{}", uuid::Uuid::new_v4()),
            issuer,
            subject_agent,
            intent_description,
            permissions: Vec::new(),
            constraints: HashMap::new(),
            created_at: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::hours(24)),
            status: MandateStatus::Active,
            metadata: HashMap::new(),
        }
    }

    pub fn add_permission(&mut self, permission: Permission) {
        self.permissions.push(permission);
    }

    pub fn add_constraint(&mut self, key: String, value: serde_json::Value) {
        self.constraints.insert(key, value);
    }

    pub fn has_permission(&self, action: &str, resource: &str) -> bool {
        self.permissions
            .iter()
            .any(|p| p.action == action && p.resource == resource)
    }

    pub fn with_expiration(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }

    pub fn cancel(&mut self) {
        self.status = MandateStatus::Cancelled;
    }
}

impl Mandate for IntentMandate {
    fn mandate_type(&self) -> MandateType {
        MandateType::Intent
    }

    fn issuer(&self) -> &str {
        &self.issuer
    }

    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn expires_at(&self) -> Option<DateTime<Utc>> {
        self.expires_at
    }

    fn status(&self) -> MandateStatus {
        self.status.clone()
    }
}

/// Cart Mandate - Explicit purchase authorization with itemized cart
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartMandate {
    pub id: String,
    pub issuer: String,        // User DID
    pub merchant: String,      // Merchant DID
    pub items: Vec<CartItem>,
    pub total_amount: u64,     // Amount in smallest currency unit (e.g., cents)
    pub currency: String,
    pub tax_amount: Option<u64>,
    pub shipping_amount: Option<u64>,
    pub discount_amount: Option<u64>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub status: MandateStatus,
    pub metadata: HashMap<String, String>,
}

/// Cart Item representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub quantity: u32,
    pub unit_price: u64,
    pub total_price: u64,
    pub metadata: HashMap<String, String>,
}

impl CartItem {
    pub fn new(id: String, name: String, quantity: u32, unit_price: u64) -> Self {
        Self {
            id,
            name,
            description: None,
            quantity,
            unit_price,
            total_price: unit_price * quantity as u64,
            metadata: HashMap::new(),
        }
    }

    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

impl CartMandate {
    pub fn new(issuer: String, items: Vec<CartItem>, total_amount: u64, currency: String) -> Self {
        Self {
            id: format!("cart:{}", uuid::Uuid::new_v4()),
            issuer,
            merchant: String::new(),
            items,
            total_amount,
            currency,
            tax_amount: None,
            shipping_amount: None,
            discount_amount: None,
            created_at: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::hours(1)),
            status: MandateStatus::Active,
            metadata: HashMap::new(),
        }
    }

    pub fn calculate_total(&self) -> u64 {
        let items_total: u64 = self.items.iter().map(|item| item.total_price).sum();
        let tax = self.tax_amount.unwrap_or(0);
        let shipping = self.shipping_amount.unwrap_or(0);
        let discount = self.discount_amount.unwrap_or(0);

        items_total + tax + shipping - discount
    }

    pub fn verify_total(&self) -> bool {
        self.calculate_total() == self.total_amount
    }

    pub fn with_merchant(mut self, merchant: String) -> Self {
        self.merchant = merchant;
        self
    }

    pub fn with_tax(mut self, tax_amount: u64) -> Self {
        self.tax_amount = Some(tax_amount);
        self
    }

    pub fn with_shipping(mut self, shipping_amount: u64) -> Self {
        self.shipping_amount = Some(shipping_amount);
        self
    }

    pub fn with_discount(mut self, discount_amount: u64) -> Self {
        self.discount_amount = Some(discount_amount);
        self
    }

    pub fn complete(&mut self) {
        self.status = MandateStatus::Completed;
    }

    pub fn cancel(&mut self) {
        self.status = MandateStatus::Cancelled;
    }
}

impl Mandate for CartMandate {
    fn mandate_type(&self) -> MandateType {
        MandateType::Cart
    }

    fn issuer(&self) -> &str {
        &self.issuer
    }

    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn expires_at(&self) -> Option<DateTime<Utc>> {
        self.expires_at
    }

    fn status(&self) -> MandateStatus {
        self.status.clone()
    }
}

/// Payment Mandate - Payment network signaling for actual transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentMandate {
    pub id: String,
    pub issuer: String,         // Payer DID
    pub recipient: String,      // Payee DID
    pub amount: u64,
    pub currency: String,
    pub payment_method: PaymentMethod,
    pub payment_network: Option<String>,
    pub reference: Option<String>,
    pub cart_mandate_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub status: MandateStatus,
    pub metadata: HashMap<String, String>,
}

/// Payment Method Types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    CreditCard { last_four: String },
    BankTransfer { account_id: String },
    Cryptocurrency { chain: String, token: String },
    DigitalWallet { provider: String },
    Other { method_type: String },
}

impl PaymentMandate {
    pub fn new(
        issuer: String,
        recipient: String,
        amount: u64,
        currency: String,
        payment_method_type: String,
    ) -> Self {
        Self {
            id: format!("payment:{}", uuid::Uuid::new_v4()),
            issuer,
            recipient,
            amount,
            currency,
            payment_method: PaymentMethod::Other {
                method_type: payment_method_type,
            },
            payment_network: None,
            reference: None,
            cart_mandate_id: None,
            created_at: Utc::now(),
            expires_at: Some(Utc::now() + chrono::Duration::minutes(30)),
            status: MandateStatus::Pending,
            metadata: HashMap::new(),
        }
    }

    pub fn with_payment_method(mut self, method: PaymentMethod) -> Self {
        self.payment_method = method;
        self
    }

    pub fn with_payment_network(mut self, network: String) -> Self {
        self.payment_network = Some(network);
        self
    }

    pub fn with_reference(mut self, reference: String) -> Self {
        self.reference = Some(reference);
        self
    }

    pub fn link_cart_mandate(mut self, cart_mandate_id: String) -> Self {
        self.cart_mandate_id = Some(cart_mandate_id);
        self
    }

    pub fn activate(&mut self) {
        self.status = MandateStatus::Active;
    }

    pub fn complete(&mut self) {
        self.status = MandateStatus::Completed;
    }

    pub fn cancel(&mut self) {
        self.status = MandateStatus::Cancelled;
    }
}

impl Mandate for PaymentMandate {
    fn mandate_type(&self) -> MandateType {
        MandateType::Payment
    }

    fn issuer(&self) -> &str {
        &self.issuer
    }

    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn expires_at(&self) -> Option<DateTime<Utc>> {
        self.expires_at
    }

    fn status(&self) -> MandateStatus {
        self.status.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intent_mandate_creation() {
        let mandate = IntentMandate::new(
            "did:example:user".to_string(),
            "did:example:agent".to_string(),
            "Purchase items on behalf of user".to_string(),
        );

        assert_eq!(mandate.mandate_type(), MandateType::Intent);
        assert_eq!(mandate.status(), MandateStatus::Active);
        assert!(mandate.is_valid());
    }

    #[test]
    fn test_cart_mandate_total_calculation() {
        let items = vec![
            CartItem::new("item1".to_string(), "Product A".to_string(), 2, 1000),
            CartItem::new("item2".to_string(), "Product B".to_string(), 1, 1500),
        ];

        let mut mandate = CartMandate::new(
            "did:example:user".to_string(),
            items,
            3500,
            "USD".to_string(),
        );

        assert!(mandate.verify_total());

        mandate = mandate.with_tax(350);
        assert_eq!(mandate.calculate_total(), 3850);
    }

    #[test]
    fn test_payment_mandate_lifecycle() {
        let mut mandate = PaymentMandate::new(
            "did:example:payer".to_string(),
            "did:example:payee".to_string(),
            5000,
            "USD".to_string(),
            "credit_card".to_string(),
        );

        assert_eq!(mandate.status(), MandateStatus::Pending);

        mandate.activate();
        assert_eq!(mandate.status(), MandateStatus::Active);

        mandate.complete();
        assert_eq!(mandate.status(), MandateStatus::Completed);
    }

    #[test]
    fn test_cart_item_calculation() {
        let item = CartItem::new("item1".to_string(), "Test Item".to_string(), 3, 500);
        assert_eq!(item.total_price, 1500);
    }
}