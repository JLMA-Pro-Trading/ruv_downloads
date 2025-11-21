//! WASM Compatibility Tests for ACP
//!
//! These tests verify that ACP components work correctly when compiled to WASM

#[cfg(all(test, target_arch = "wasm32", feature = "wasm"))]
mod wasm_tests {
    use wasm_bindgen_test::*;
    use agentic_payments::acp::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_checkout_creation_wasm() {
        let checkout = WasmCheckoutSession::new(
            1000,
            "USD".to_string(),
            "merchant_wasm_123".to_string(),
        );

        assert_eq!(checkout.amount(), 1000);
        assert!(checkout.id().starts_with("cs_"));
    }

    #[wasm_bindgen_test]
    fn test_spt_creation_wasm() {
        let spt = WasmSharedPaymentToken::new(
            "pm_test_card".to_string(),
            "merchant_wasm".to_string(),
            Some(5000),
            "USD".to_string(),
        );

        assert!(spt.token_id().starts_with("spt_"));
        assert_eq!(spt.amount_limit(), Some(5000));
    }

    #[wasm_bindgen_test]
    fn test_protocol_router_wasm() {
        let router = WasmProtocolRouter::new();
        assert!(router.is_ready());
    }

    #[wasm_bindgen_test]
    fn test_json_serialization_wasm() {
        let checkout = WasmCheckoutSession::new(
            2500,
            "EUR".to_string(),
            "merchant_euro".to_string(),
        );

        let json = checkout.to_json();
        assert!(json.contains("\"amount\":2500"));
        assert!(json.contains("\"currency\":\"EUR\""));
    }

    #[wasm_bindgen_test]
    async fn test_async_validation_wasm() {
        let checkout = WasmCheckoutSession::new(
            1500,
            "GBP".to_string(),
            "merchant_gbp".to_string(),
        );

        let is_valid = checkout.validate_async().await;
        assert!(is_valid);
    }

    #[wasm_bindgen_test]
    fn test_timestamp_handling_wasm() {
        let checkout = WasmCheckoutSession::new(
            1000,
            "USD".to_string(),
            "merchant_time".to_string(),
        );

        let created_at = checkout.created_at();
        assert!(created_at > 0);
    }

    #[wasm_bindgen_test]
    fn test_error_handling_wasm() {
        let result = WasmCheckoutSession::try_new(
            0, // Invalid amount
            "USD".to_string(),
            "merchant_err".to_string(),
        );

        assert!(result.is_err());
    }

    #[wasm_bindgen_test]
    fn test_multiple_checkouts_wasm() {
        let mut checkouts = Vec::new();

        for i in 0..10 {
            let checkout = WasmCheckoutSession::new(
                (i + 1) * 1000,
                "USD".to_string(),
                format!("merchant_{}", i),
            );
            checkouts.push(checkout);
        }

        assert_eq!(checkouts.len(), 10);
    }

    #[wasm_bindgen_test]
    fn test_unicode_support_wasm() {
        let checkout = WasmCheckoutSession::new(
            1000,
            "JPY".to_string(),
            "商店_123".to_string(),
        );

        assert_eq!(checkout.currency(), "JPY");
        assert!(checkout.merchant_id().contains("商店"));
    }

    #[wasm_bindgen_test]
    fn test_large_amounts_wasm() {
        let checkout = WasmCheckoutSession::new(
            999999999,
            "USD".to_string(),
            "merchant_large".to_string(),
        );

        assert_eq!(checkout.amount(), 999999999);
    }
}

// WASM-specific type definitions (would be in src/acp/wasm.rs)
#[cfg(target_arch = "wasm32")]
pub mod wasm_types {
    use wasm_bindgen::prelude::*;
    use serde::{Serialize, Deserialize};

    #[wasm_bindgen]
    pub struct WasmCheckoutSession {
        id: String,
        amount: u64,
        currency: String,
        merchant_id: String,
        created_at: i64,
    }

    #[wasm_bindgen]
    impl WasmCheckoutSession {
        #[wasm_bindgen(constructor)]
        pub fn new(amount: u64, currency: String, merchant_id: String) -> Self {
            let id = format!("cs_{}", uuid::Uuid::new_v4());
            let created_at = js_sys::Date::now() as i64 / 1000;

            Self {
                id,
                amount,
                currency,
                merchant_id,
                created_at,
            }
        }

        #[wasm_bindgen]
        pub fn try_new(amount: u64, currency: String, merchant_id: String) -> Result<WasmCheckoutSession, JsValue> {
            if amount == 0 {
                return Err(JsValue::from_str("Amount must be greater than zero"));
            }

            Ok(Self::new(amount, currency, merchant_id))
        }

        #[wasm_bindgen(getter)]
        pub fn id(&self) -> String {
            self.id.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn amount(&self) -> u64 {
            self.amount
        }

        #[wasm_bindgen(getter)]
        pub fn currency(&self) -> String {
            self.currency.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn merchant_id(&self) -> String {
            self.merchant_id.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn created_at(&self) -> i64 {
            self.created_at
        }

        #[wasm_bindgen]
        pub fn to_json(&self) -> String {
            serde_json::json!({
                "id": self.id,
                "amount": self.amount,
                "currency": self.currency,
                "merchant_id": self.merchant_id,
                "created_at": self.created_at,
            }).to_string()
        }

        #[wasm_bindgen]
        pub async fn validate_async(&self) -> bool {
            // Simulate async validation
            self.amount > 0 && !self.currency.is_empty()
        }
    }

    #[wasm_bindgen]
    pub struct WasmSharedPaymentToken {
        token_id: String,
        payment_method_id: String,
        merchant_id: String,
        amount_limit: Option<u64>,
        currency: String,
    }

    #[wasm_bindgen]
    impl WasmSharedPaymentToken {
        #[wasm_bindgen(constructor)]
        pub fn new(
            payment_method_id: String,
            merchant_id: String,
            amount_limit: Option<u64>,
            currency: String,
        ) -> Self {
            let token_id = format!("spt_{}", uuid::Uuid::new_v4());

            Self {
                token_id,
                payment_method_id,
                merchant_id,
                amount_limit,
                currency,
            }
        }

        #[wasm_bindgen(getter)]
        pub fn token_id(&self) -> String {
            self.token_id.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn amount_limit(&self) -> Option<u64> {
            self.amount_limit
        }
    }

    #[wasm_bindgen]
    pub struct WasmProtocolRouter;

    #[wasm_bindgen]
    impl WasmProtocolRouter {
        #[wasm_bindgen(constructor)]
        pub fn new() -> Self {
            Self
        }

        #[wasm_bindgen]
        pub fn is_ready(&self) -> bool {
            true
        }
    }
}