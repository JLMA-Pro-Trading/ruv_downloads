//! WASM bindings for aimds-detection
//!
//! This module provides WebAssembly bindings for the detection layer.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use crate::{DetectionService, PatternMatcher, Sanitizer};

#[wasm_bindgen]
pub struct WasmDetectionService {
    inner: DetectionService,
}

#[derive(Serialize, Deserialize)]
pub struct WasmDetectionResult {
    pub threats: Vec<WasmThreat>,
    pub confidence: f64,
    pub processing_time_ms: f64,
}

#[derive(Serialize, Deserialize)]
pub struct WasmThreat {
    pub threat_type: String,
    pub severity: String,
    pub description: String,
    pub location: Option<WasmLocation>,
}

#[derive(Serialize, Deserialize)]
pub struct WasmLocation {
    pub start: usize,
    pub end: usize,
}

#[wasm_bindgen]
impl WasmDetectionService {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmDetectionService, JsValue> {
        console_error_panic_hook::set_once();

        DetectionService::new()
            .map(|inner| WasmDetectionService { inner })
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Detect threats in the given text (<10ms target)
    #[wasm_bindgen]
    pub async fn detect(&self, text: &str) -> Result<JsValue, JsValue> {
        let start = js_sys::Date::now();

        let input = aimds_core::PromptInput::new(text.to_string());

        let result = self.inner.detect(&input)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let processing_time = js_sys::Date::now() - start;

        let wasm_result = WasmDetectionResult {
            threats: result.threats.into_iter().map(|t| WasmThreat {
                threat_type: format!("{:?}", t.threat_type),
                severity: format!("{:?}", t.severity),
                description: t.description.clone(),
                location: t.location.map(|l| WasmLocation {
                    start: l.start,
                    end: l.end,
                }),
            }).collect(),
            confidence: result.confidence,
            processing_time_ms: processing_time,
        };

        Ok(serde_wasm_bindgen::to_value(&wasm_result)?)
    }

    /// Check if text contains PII (Personally Identifiable Information)
    #[wasm_bindgen(js_name = detectPII)]
    pub async fn detect_pii(&self, text: &str) -> Result<JsValue, JsValue> {
        let sanitizer = Sanitizer::new();
        let matches = sanitizer.detect_pii(text)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(serde_wasm_bindgen::to_value(&matches)?)
    }

    /// Match against known attack patterns
    #[wasm_bindgen(js_name = matchPatterns)]
    pub async fn match_patterns(&self, text: &str) -> Result<JsValue, JsValue> {
        let matcher = PatternMatcher::new()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let result = matcher.match_patterns(text)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}
