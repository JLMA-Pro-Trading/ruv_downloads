//! ACP Performance Benchmarks

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use agentic_payments::acp::*;
use agentic_payments::ap2::mandates::*;
use agentic_payments::crypto::AgentIdentity;
use std::collections::HashMap;

fn benchmark_checkout_creation(c: &mut Criterion) {
    c.bench_function("checkout_creation", |b| {
        b.iter(|| {
            let checkout = CheckoutSession {
                id: format!("cs_{}", uuid::Uuid::new_v4()),
                status: CheckoutStatus::Created,
                amount: black_box(1000),
                currency: "USD".to_string(),
                merchant_id: "merchant_bench".to_string(),
                items: vec![],
                created_at: chrono::Utc::now().timestamp(),
                expires_at: Some(chrono::Utc::now().timestamp() + 3600),
            };
            black_box(checkout)
        })
    });
}

fn benchmark_spt_creation(c: &mut Criterion) {
    c.bench_function("spt_creation", |b| {
        b.iter(|| {
            let spt = SharedPaymentToken {
                token_id: format!("spt_{}", uuid::Uuid::new_v4()),
                payment_method_id: "pm_card_bench".to_string(),
                merchant_id: "merchant_bench".to_string(),
                amount_limit: Some(black_box(10000)),
                currency: "USD".to_string(),
                expires_at: chrono::Utc::now().timestamp() + 3600,
                scope: vec!["charge".to_string()],
                metadata: HashMap::new(),
            };
            black_box(spt)
        })
    });
}

fn benchmark_protocol_detection(c: &mut Criterion) {
    let mut router = ProtocolRouter::new();
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());

    let acp_body = br#"{"checkout_session":{"id":"cs_123"}}"#;
    let ap2_body = br#"{"intent_mandate":{"id":"intent_123"}}"#;

    let mut group = c.benchmark_group("protocol_detection");

    group.bench_function("acp", |b| {
        b.iter(|| {
            black_box(router.detect_protocol(&headers, acp_body))
        })
    });

    group.bench_function("ap2", |b| {
        b.iter(|| {
            black_box(router.detect_protocol(&headers, ap2_body))
        })
    });

    group.finish();
}

fn benchmark_cart_to_checkout_conversion(c: &mut Criterion) {
    let user = AgentIdentity::generate().expect("Failed to generate identity");

    let items = vec![
        CartItem::new("item_1".to_string(), "Product A".to_string(), 2, 500),
        CartItem::new("item_2".to_string(), "Product B".to_string(), 1, 1000),
    ];

    let cart = CartMandate::new(
        user.did().to_string(),
        items,
        2000,
        "USD".to_string(),
    );

    c.bench_function("cart_to_checkout_conversion", |b| {
        b.iter(|| {
            black_box(cart_mandate_to_checkout(&cart))
        })
    });
}

fn benchmark_hmac_signing(c: &mut Criterion) {
    let secret = b"webhook_secret_key_for_benchmarking_tests";
    let payload = b"test_webhook_payload_data_for_performance_testing";

    c.bench_function("hmac_sha256_signing", |b| {
        b.iter(|| {
            black_box(hmac_sha256(secret, payload))
        })
    });
}

fn benchmark_concurrent_checkouts(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_operations");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.iter(|| {
                let checkouts: Vec<_> = (0..size)
                    .map(|i| CheckoutSession {
                        id: format!("cs_{}", i),
                        status: CheckoutStatus::Created,
                        amount: 1000,
                        currency: "USD".to_string(),
                        merchant_id: format!("merchant_{}", i),
                        items: vec![],
                        created_at: chrono::Utc::now().timestamp(),
                        expires_at: Some(chrono::Utc::now().timestamp() + 3600),
                    })
                    .collect();
                black_box(checkouts)
            })
        });
    }

    group.finish();
}

fn benchmark_json_serialization(c: &mut Criterion) {
    let checkout = CheckoutSession {
        id: "cs_json_bench".to_string(),
        status: CheckoutStatus::Created,
        amount: 5000,
        currency: "USD".to_string(),
        merchant_id: "merchant_json".to_string(),
        items: vec![
            LineItem {
                id: "item_1".to_string(),
                name: "Product A".to_string(),
                quantity: 2,
                unit_price: 1000,
                total_price: 2000,
                metadata: HashMap::new(),
            },
            LineItem {
                id: "item_2".to_string(),
                name: "Product B".to_string(),
                quantity: 3,
                unit_price: 1000,
                total_price: 3000,
                metadata: HashMap::new(),
            },
        ],
        created_at: chrono::Utc::now().timestamp(),
        expires_at: Some(chrono::Utc::now().timestamp() + 3600),
    };

    c.bench_function("json_serialization", |b| {
        b.iter(|| {
            black_box(serde_json::to_string(&checkout))
        })
    });

    let json = serde_json::to_string(&checkout).unwrap();

    c.bench_function("json_deserialization", |b| {
        b.iter(|| {
            black_box(serde_json::from_str::<CheckoutSession>(&json))
        })
    });
}

criterion_group!(
    benches,
    benchmark_checkout_creation,
    benchmark_spt_creation,
    benchmark_protocol_detection,
    benchmark_cart_to_checkout_conversion,
    benchmark_hmac_signing,
    benchmark_concurrent_checkouts,
    benchmark_json_serialization,
);

criterion_main!(benches);

// Helper functions and types
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};

fn hmac_sha256(secret: &[u8], data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret);
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn cart_mandate_to_checkout(cart: &CartMandate) -> Result<CheckoutSession, String> {
    let items: Vec<LineItem> = cart.items.iter().map(|item| {
        LineItem {
            id: item.id.clone(),
            name: item.name.clone(),
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity as u64,
            metadata: HashMap::new(),
        }
    }).collect();

    Ok(CheckoutSession {
        id: format!("cs_{}", uuid::Uuid::new_v4()),
        status: CheckoutStatus::Created,
        amount: cart.total_amount,
        currency: cart.currency.clone(),
        merchant_id: "bridge_merchant".to_string(),
        items,
        created_at: chrono::Utc::now().timestamp(),
        expires_at: Some(chrono::Utc::now().timestamp() + 3600),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutSession {
    pub id: String,
    pub status: CheckoutStatus,
    pub amount: u64,
    pub currency: String,
    pub merchant_id: String,
    pub items: Vec<LineItem>,
    pub created_at: i64,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CheckoutStatus {
    Created,
    Pending,
    Completed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineItem {
    pub id: String,
    pub name: String,
    pub quantity: u32,
    pub unit_price: u64,
    pub total_price: u64,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct SharedPaymentToken {
    pub token_id: String,
    pub payment_method_id: String,
    pub merchant_id: String,
    pub amount_limit: Option<u64>,
    pub currency: String,
    pub expires_at: i64,
    pub scope: Vec<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Protocol {
    ACP,
    AP2,
}

pub struct ProtocolRouter {
    total_requests: u64,
    acp_requests: u64,
    ap2_requests: u64,
}

impl ProtocolRouter {
    pub fn new() -> Self {
        Self {
            total_requests: 0,
            acp_requests: 0,
            ap2_requests: 0,
        }
    }

    pub fn detect_protocol(&mut self, _headers: &HashMap<String, String>, body: &[u8]) -> Option<Protocol> {
        self.total_requests += 1;

        let body_str = std::str::from_utf8(body).ok()?;

        if body_str.contains("checkout_session") {
            self.acp_requests += 1;
            Some(Protocol::ACP)
        } else if body_str.contains("intent_mandate") {
            self.ap2_requests += 1;
            Some(Protocol::AP2)
        } else {
            None
        }
    }
}