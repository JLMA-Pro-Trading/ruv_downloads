//! AP2 Integration Test - Comprehensive validation of AP2 protocol implementation

use agentic_payments::crypto::AgentIdentity;
use agentic_payments::ap2::*;
use serde_json::json;

#[test]
fn test_intent_mandate_creation() {
    let user = AgentIdentity::generate().expect("Failed to generate user identity");
    let bot = AgentIdentity::generate().expect("Failed to generate bot identity");

    let intent = IntentMandate::new(
        user.did().to_string(),
        bot.did().to_string(),
        "Purchase groceries weekly".to_string(),
    );

    assert_eq!(intent.issuer, user.did());
    assert_eq!(intent.subject_agent, bot.did());
    assert_eq!(intent.status, MandateStatus::Active);
    assert!(intent.id.starts_with("urn:uuid:"));
}

#[test]
fn test_intent_mandate_permissions() {
    let user = AgentIdentity::generate().expect("Failed to generate user");
    let bot = AgentIdentity::generate().expect("Failed to generate bot");

    let mut intent = IntentMandate::new(
        user.did().to_string(),
        bot.did().to_string(),
        "Shopping agent".to_string(),
    );

    let permission = Permission {
        action: "purchase".to_string(),
        resource: "groceries".to_string(),
        conditions: vec![],
    };
    intent.add_permission(permission);

    assert!(intent.has_permission("purchase", "groceries"));
    assert!(!intent.has_permission("purchase", "electronics"));
}

#[test]
fn test_intent_mandate_constraints() {
    let user = AgentIdentity::generate().expect("Failed to generate user");
    let bot = AgentIdentity::generate().expect("Failed to generate bot");

    let mut intent = IntentMandate::new(
        user.did().to_string(),
        bot.did().to_string(),
        "Limited shopping agent".to_string(),
    );

    intent.add_constraint("max_amount".to_string(), json!(100.00));
    intent.add_constraint("category".to_string(), json!("groceries"));

    assert_eq!(intent.constraints.len(), 2);
    assert_eq!(intent.constraints.get("max_amount"), Some(&json!(100.00)));
}

#[test]
fn test_cart_mandate_creation() {
    let bot = AgentIdentity::generate().expect("Failed to generate bot");

    let items = vec![
        CartItem::new("item-001".to_string(), "Bananas".to_string(), 2, 199),
        CartItem::new("item-002".to_string(), "Milk".to_string(), 1, 349),
    ];

    let total = 199 * 2 + 349;

    let cart = CartMandate::new(
        bot.did().to_string(),
        items.clone(),
        total,
        "USD".to_string(),
    );

    assert_eq!(cart.items.len(), 2);
    assert_eq!(cart.total_amount, total);
}

#[test]
fn test_cart_total_verification() {
    let bot = AgentIdentity::generate().expect("Failed to generate bot");

    let items = vec![
        CartItem::new("item-001".to_string(), "Product A".to_string(), 2, 500),
    ];

    let cart = CartMandate::new(
        bot.did().to_string(),
        items,
        1000,
        "USD".to_string(),
    );

    assert!(cart.verify_total());
}

#[test]
fn test_payment_mandate_creation() {
    let payer = AgentIdentity::generate().expect("Failed to generate payer");
    let payee = AgentIdentity::generate().expect("Failed to generate payee");

    let mandate = PaymentMandate::new(
        payer.did().to_string(),
        payee.did().to_string(),
        1000,
        "USD".to_string(),
        "credit_card".to_string(),
    );

    assert_eq!(mandate.issuer, payer.did());
    assert_eq!(mandate.recipient, payee.did());
    assert_eq!(mandate.amount, 1000);
}

#[test]
fn test_credential_subject_creation() {
    let user = AgentIdentity::generate().expect("Failed to generate user");

    let subject = CredentialSubject::new(
        user.did().to_string(),
        "payment-authorization-123".to_string(),
    );

    assert_eq!(subject.id, user.did());
    assert_eq!(subject.credential_subject_type, "payment-authorization-123");
}

#[test]
fn test_verifiable_credential_creation() {
    let issuer = AgentIdentity::generate().expect("Failed to generate issuer");
    let subject_id = AgentIdentity::generate().expect("Failed to generate subject");

    let subject = CredentialSubject::new(
        subject_id.did().to_string(),
        "PaymentAuthorization".to_string(),
    );

    let dummy_key = [1u8; 32];
    let credential = VerifiableCredential::new(
        issuer.did().to_string(),
        subject,
        &dummy_key,
    ).expect("Failed to create credential");

    assert!(credential.id.starts_with("urn:uuid:"));
    assert_eq!(credential.issuer, issuer.did());
}

#[test]
fn test_credential_builder() {
    let issuer = AgentIdentity::generate().expect("Failed to generate issuer");
    let subject_id = AgentIdentity::generate().expect("Failed to generate subject");

    let credential = CredentialBuilder::new(
        issuer.did().to_string(),
        subject_id.did().to_string(),
    )
    .add_claim("maxAmount".to_string(), json!(500.00))
    .add_claim("currency".to_string(), json!("USD"))
    .add_type("PaymentAuthorization".to_string())
    .build_unsigned()
    .expect("Failed to build credential");

    assert_eq!(credential.issuer, issuer.did());
    assert!(credential.credential_subject.claims.contains_key("maxAmount"));
    assert!(credential.credential_type.contains(&"PaymentAuthorization".to_string()));
}

#[test]
fn test_did_document_creation() {
    let identity = AgentIdentity::generate().expect("Failed to generate identity");

    let doc = DidDocument::new(identity.did().to_string());

    assert_eq!(doc.id, identity.did());
    assert_eq!(doc.context, "https://www.w3.org/ns/did/v1");
}

#[test]
fn test_full_ap2_workflow() {
    let user = AgentIdentity::generate().expect("Failed to generate user");
    let bot = AgentIdentity::generate().expect("Failed to generate bot");
    let store = AgentIdentity::generate().expect("Failed to generate store");

    let mut intent = IntentMandate::new(
        user.did().to_string(),
        bot.did().to_string(),
        "Weekly grocery shopping".to_string(),
    );

    intent.add_permission(Permission {
        action: "purchase".to_string(),
        resource: "groceries".to_string(),
        conditions: vec![],
    });

    intent.add_constraint("max_weekly_spend".to_string(), json!(150.00));

    let items = vec![
        CartItem::new("bananas".to_string(), "Organic Bananas".to_string(), 2, 199),
        CartItem::new("milk".to_string(), "Almond Milk".to_string(), 1, 449),
    ];

    let total = 199 * 2 + 449;

    let cart = CartMandate::new(
        bot.did().to_string(),
        items,
        total,
        "USD".to_string(),
    );

    let payment = PaymentMandate::new(
        user.did().to_string(),
        store.did().to_string(),
        cart.total_amount,
        "USD".to_string(),
        "credit_card".to_string(),
    );

    assert!(cart.verify_total());
    assert!(intent.has_permission("purchase", "groceries"));
    assert_eq!(cart.total_amount, total);
    assert_eq!(payment.amount, cart.total_amount);
}
