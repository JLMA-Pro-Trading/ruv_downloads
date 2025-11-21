//! AP2 Mandate Management Example
//!
//! Demonstrates creating and managing different types of mandates:
//! - Intent Mandates with permissions
//! - Cart Mandates with calculations
//! - Payment Mandates with lifecycle management

use agentic_payments::ap2::*;
use agentic_payments::error::Result;

fn main() -> Result<()> {
    println!("📋 AP2 Mandate Management Example\n");

    // Example 1: Intent Mandate with Permissions
    println!("1️⃣  Intent Mandate with Permissions");
    println!("   =====================================");

    let mut intent_mandate = IntentMandate::new(
        "did:ap2:user-alice".to_string(),
        "did:ap2:shopping-agent".to_string(),
        "Authorize shopping agent to purchase items on my behalf".to_string(),
    );

    // Add specific permissions
    intent_mandate.add_permission(Permission {
        action: "purchase".to_string(),
        resource: "electronics".to_string(),
        conditions: vec![
            "max_amount:50000".to_string(),
            "require_review:true".to_string(),
        ],
    });

    intent_mandate.add_permission(Permission {
        action: "purchase".to_string(),
        resource: "books".to_string(),
        conditions: vec!["max_amount:10000".to_string()],
    });

    intent_mandate.add_permission(Permission {
        action: "view".to_string(),
        resource: "catalog".to_string(),
        conditions: vec![],
    });

    // Add constraints
    intent_mandate.add_constraint(
        "daily_limit".to_string(),
        serde_json::json!(100000),
    );
    intent_mandate.add_constraint(
        "approved_merchants".to_string(),
        serde_json::json!(["merchant-001", "merchant-002"]),
    );

    println!("   Intent ID: {}", intent_mandate.id);
    println!("   Status: {:?}", intent_mandate.status);
    println!("   Permissions:");
    for perm in &intent_mandate.permissions {
        println!("     - {}: {} (conditions: {:?})", perm.action, perm.resource, perm.conditions);
    }
    println!("   Constraints: {} defined", intent_mandate.constraints.len());
    println!("   Valid: {}\n", intent_mandate.is_valid());

    // Example 2: Cart Mandate with Detailed Calculations
    println!("2️⃣  Cart Mandate with Detailed Calculations");
    println!("   =========================================");

    let items = vec![
        CartItem::new(
            "laptop-pro-001".to_string(),
            "Professional Laptop 16GB RAM".to_string(),
            1,
            129999, // $1,299.99
        )
        .with_description("High-end laptop for professional use".to_string())
        .with_metadata("category".to_string(), "electronics".to_string())
        .with_metadata("warranty".to_string(), "2-years".to_string()),
        CartItem::new(
            "book-rust-001".to_string(),
            "The Rust Programming Language".to_string(),
            3,
            4999, // $49.99 each
        )
        .with_description("Official Rust book".to_string())
        .with_metadata("category".to_string(), "books".to_string()),
        CartItem::new(
            "usbc-cable-001".to_string(),
            "USB-C Cable 2M".to_string(),
            2,
            1499, // $14.99 each
        )
        .with_metadata("category".to_string(), "accessories".to_string()),
    ];

    let subtotal: u64 = items.iter().map(|i| i.total_price).sum();

    let mut cart_mandate = CartMandate::new(
        "did:ap2:user-alice".to_string(),
        items.clone(),
        subtotal,
        "USD".to_string(),
    )
    .with_merchant("did:ap2:merchant-techstore".to_string())
    .with_tax((subtotal as f64 * 0.0825) as u64) // 8.25% tax
    .with_shipping(1299) // $12.99 shipping
    .with_discount(5000); // $50.00 discount

    println!("   Cart ID: {}", cart_mandate.id);
    println!("   Merchant: {}", cart_mandate.merchant);
    println!("\n   Items:");
    for item in &items {
        println!(
            "     - {} x{}: ${:.2}",
            item.name,
            item.quantity,
            item.total_price as f64 / 100.0
        );
    }

    println!("\n   Breakdown:");
    let items_total: u64 = items.iter().map(|i| i.total_price).sum();
    println!("     Items:    ${:>10.2}", items_total as f64 / 100.0);
    println!("     Tax:      ${:>10.2}", cart_mandate.tax_amount.unwrap_or(0) as f64 / 100.0);
    println!("     Shipping: ${:>10.2}", cart_mandate.shipping_amount.unwrap_or(0) as f64 / 100.0);
    println!("     Discount: -${:>9.2}", cart_mandate.discount_amount.unwrap_or(0) as f64 / 100.0);
    println!("     ─────────────────────");
    println!("     Total:    ${:>10.2}", cart_mandate.calculate_total() as f64 / 100.0);

    println!("\n   Total Verified: {}", cart_mandate.verify_total());
    println!("   Status: {:?}\n", cart_mandate.status);

    // Example 3: Payment Mandate Lifecycle
    println!("3️⃣  Payment Mandate Lifecycle");
    println!("   ===========================");

    let mut payment_mandate = PaymentMandate::new(
        "did:ap2:user-alice".to_string(),
        "did:ap2:merchant-techstore".to_string(),
        cart_mandate.calculate_total(),
        "USD".to_string(),
        "credit_card".to_string(),
    )
    .with_payment_method(PaymentMethod::CreditCard {
        last_four: "4242".to_string(),
    })
    .with_payment_network("stripe".to_string())
    .with_reference("ORDER-2025-09-29-001".to_string())
    .link_cart_mandate(cart_mandate.id.clone());

    println!("   Payment ID: {}", payment_mandate.id);
    println!("   Amount: ${:.2}", payment_mandate.amount as f64 / 100.0);
    println!("   Currency: {}", payment_mandate.currency);
    println!("   Linked Cart: {}", payment_mandate.cart_mandate_id.as_ref().unwrap());

    println!("\n   Lifecycle states:");
    println!("     Initial state: {:?}", payment_mandate.status);
    println!("     Is valid: {}", payment_mandate.is_valid());

    payment_mandate.activate();
    println!("\n     After activation: {:?}", payment_mandate.status);
    println!("     Is valid: {}", payment_mandate.is_valid());

    payment_mandate.complete();
    println!("\n     After completion: {:?}", payment_mandate.status);
    println!("     Is valid: {}\n", payment_mandate.is_valid());

    // Example 4: Mandate Expiration
    println!("4️⃣  Mandate Expiration Handling");
    println!("   ============================");

    let expired_mandate = IntentMandate::new(
        "did:ap2:user".to_string(),
        "did:ap2:agent".to_string(),
        "Test mandate".to_string(),
    )
    .with_expiration(chrono::Utc::now() - chrono::Duration::hours(1)); // Already expired

    println!("   Mandate created with past expiration");
    println!("   Created: {}", expired_mandate.created_at);
    println!("   Expires: {}", expired_mandate.expires_at.unwrap());
    println!("   Is valid: {}", expired_mandate.is_valid());
    println!("   Status: {:?}\n", expired_mandate.status);

    println!("✨ Mandate Management Examples Complete!");
    Ok(())
}
