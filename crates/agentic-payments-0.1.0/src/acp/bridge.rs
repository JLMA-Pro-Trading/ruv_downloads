//! AP2 ↔ ACP Protocol Bridge Adapters
//!
//! Bidirectional data model translation between AP2 mandates and ACP checkout sessions

use crate::ap2::mandates::{CartMandate, CartItem, IntentMandate, PaymentMandate, MandateStatus};
use crate::acp::models::{CheckoutSession, CheckoutItem, CheckoutStatus};
use crate::error::Result;
use chrono::{TimeZone, Utc};

/// Convert AP2 CartMandate to ACP CheckoutSession
pub fn cart_mandate_to_checkout(cart: &CartMandate) -> Result<CheckoutSession> {
    let items = cart.items.iter().map(|item| CheckoutItem {
        id: item.id.clone(),
        name: item.name.clone(),
        quantity: item.quantity,
        unit_price: item.unit_price as i64,
    }).collect();

    Ok(CheckoutSession {
        id: format!("cs_from_cart_{}", cart.id),
        status: match cart.status {
            MandateStatus::Pending => CheckoutStatus::Created,
            MandateStatus::Active => CheckoutStatus::Active,
            MandateStatus::Completed => CheckoutStatus::Completed,
            MandateStatus::Cancelled => CheckoutStatus::Cancelled,
            MandateStatus::Expired => CheckoutStatus::Expired,
        },
        amount: cart.total_amount as i64,
        currency: cart.currency.clone(),
        merchant_id: cart.merchant.clone(),
        items,
        created_at: cart.created_at.timestamp(),
        expires_at: cart.expires_at.map(|dt| dt.timestamp()),
    })
}

/// Convert ACP CheckoutSession to AP2 CartMandate
pub fn checkout_to_cart_mandate(session: &CheckoutSession, issuer_did: &str) -> Result<CartMandate> {
    let items = session.items.iter().map(|item| CartItem::new(
        item.id.clone(),
        item.name.clone(),
        item.quantity,
        item.unit_price as u64,
    )).collect();

    let mut cart = CartMandate::new(
        issuer_did.to_string(),
        items,
        session.amount as u64,
        session.currency.clone(),
    );

    cart = cart.with_merchant(session.merchant_id.clone());

    if let Some(expires_at) = session.expires_at {
        cart.expires_at = Some(Utc.timestamp_opt(expires_at, 0).single().unwrap());
    }

    cart.status = match session.status {
        CheckoutStatus::Created => MandateStatus::Pending,
        CheckoutStatus::Active => MandateStatus::Active,
        CheckoutStatus::Completed => MandateStatus::Completed,
        CheckoutStatus::Cancelled => MandateStatus::Cancelled,
        CheckoutStatus::Expired => MandateStatus::Expired,
    };

    Ok(cart)
}

/// Convert AP2 IntentMandate to ACP allowance concept
pub fn intent_to_allowance(intent: &IntentMandate) -> serde_json::Value {
    serde_json::json!({
        "type": "intent_allowance",
        "issuer": intent.issuer,
        "subject_agent": intent.subject_agent,
        "description": intent.intent_description,
        "permissions": intent.permissions,
        "constraints": intent.constraints,
        "expires_at": intent.expires_at,
    })
}

/// Convert AP2 PaymentMandate to ACP payment delegation
pub fn payment_mandate_to_delegate(payment: &PaymentMandate) -> serde_json::Value {
    serde_json::json!({
        "type": "payment_delegate",
        "issuer": payment.issuer,
        "recipient": payment.recipient,
        "amount": payment.amount,
        "currency": payment.currency,
        "payment_method": payment.payment_method,
        "reference": payment.reference,
        "cart_mandate_id": payment.cart_mandate_id,
        "created_at": payment.created_at.timestamp(),
        "expires_at": payment.expires_at.map(|dt| dt.timestamp()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ap2::mandates::Permission;
    use chrono::Utc;

    #[test]
    fn test_cart_to_checkout() {
        let items = vec![CartItem::new(
            "item_1".to_string(),
            "Test Item".to_string(),
            2,
            1000,
        )];

        let cart = CartMandate::new(
            "user_did".to_string(),
            items,
            2000,
            "USD".to_string(),
        ).with_merchant("merchant_123".to_string());

        let checkout = cart_mandate_to_checkout(&cart).unwrap();
        assert_eq!(checkout.amount, 2000);
        assert_eq!(checkout.currency, "USD");
        assert_eq!(checkout.items.len(), 1);
        assert_eq!(checkout.merchant_id, "merchant_123");
    }

    #[test]
    fn test_checkout_to_cart() {
        let checkout = CheckoutSession {
            id: "cs_123".to_string(),
            status: CheckoutStatus::Active,
            amount: 5000,
            currency: "USD".to_string(),
            merchant_id: "merch_456".to_string(),
            items: vec![CheckoutItem {
                id: "item_2".to_string(),
                name: "Product".to_string(),
                quantity: 1,
                unit_price: 5000,
            }],
            created_at: Utc::now().timestamp(),
            expires_at: None,
        };

        let cart = checkout_to_cart_mandate(&checkout, "user_123").unwrap();
        assert_eq!(cart.total_amount, 5000);
        assert_eq!(cart.currency, "USD");
        assert_eq!(cart.items.len(), 1);
        assert_eq!(cart.merchant, "merch_456");
    }

    #[test]
    fn test_intent_to_allowance() {
        let intent = IntentMandate::new(
            "user_123".to_string(),
            "agent_456".to_string(),
            "Purchase groceries".to_string(),
        );

        let allowance = intent_to_allowance(&intent);
        assert_eq!(allowance["type"], "intent_allowance");
        assert_eq!(allowance["issuer"], "user_123");
        assert_eq!(allowance["subject_agent"], "agent_456");
    }

    #[test]
    fn test_payment_to_delegate() {
        let payment = PaymentMandate::new(
            "payer_123".to_string(),
            "payee_456".to_string(),
            10000,
            "USD".to_string(),
            "credit_card".to_string(),
        );

        let delegate = payment_mandate_to_delegate(&payment);
        assert_eq!(delegate["type"], "payment_delegate");
        assert_eq!(delegate["amount"], 10000);
        assert_eq!(delegate["currency"], "USD");
    }

    #[test]
    fn test_bidirectional_conversion() {
        // Create AP2 cart
        let items = vec![
            CartItem::new("item_1".to_string(), "Product A".to_string(), 2, 1999),
            CartItem::new("item_2".to_string(), "Product B".to_string(), 1, 4999),
        ];

        let cart = CartMandate::new(
            "user_did".to_string(),
            items,
            8997,
            "USD".to_string(),
        ).with_merchant("merchant_123".to_string());

        // Convert to ACP
        let checkout = cart_mandate_to_checkout(&cart).unwrap();

        // Convert back to AP2
        let cart_back = checkout_to_cart_mandate(&checkout, "user_did").unwrap();

        // Verify round-trip
        assert_eq!(cart_back.total_amount, cart.total_amount);
        assert_eq!(cart_back.currency, cart.currency);
        assert_eq!(cart_back.items.len(), cart.items.len());
        assert_eq!(cart_back.merchant, cart.merchant);
    }

    #[test]
    fn test_status_mapping() {
        let statuses = vec![
            (MandateStatus::Pending, CheckoutStatus::Created),
            (MandateStatus::Active, CheckoutStatus::Active),
            (MandateStatus::Completed, CheckoutStatus::Completed),
            (MandateStatus::Cancelled, CheckoutStatus::Cancelled),
            (MandateStatus::Expired, CheckoutStatus::Expired),
        ];

        for (mandate_status, expected_checkout_status) in statuses {
            let items = vec![CartItem::new(
                "item_1".to_string(),
                "Test".to_string(),
                1,
                1000,
            )];

            let mut cart = CartMandate::new(
                "user_did".to_string(),
                items,
                1000,
                "USD".to_string(),
            );
            cart.status = mandate_status;

            let checkout = cart_mandate_to_checkout(&cart).unwrap();
            assert_eq!(checkout.status, expected_checkout_status);
        }
    }

    #[test]
    fn test_expiration_handling() {
        let items = vec![CartItem::new(
            "item_1".to_string(),
            "Test".to_string(),
            1,
            1000,
        )];

        let mut cart = CartMandate::new(
            "user_did".to_string(),
            items,
            1000,
            "USD".to_string(),
        );

        let expires = Utc::now() + chrono::Duration::hours(1);
        cart.expires_at = Some(expires);

        let checkout = cart_mandate_to_checkout(&cart).unwrap();
        assert!(checkout.expires_at.is_some());

        let cart_back = checkout_to_cart_mandate(&checkout, "user_did").unwrap();
        assert!(cart_back.expires_at.is_some());
    }
}