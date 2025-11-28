//! WASM bindings for aimds-core
//!
//! Core types and utilities for WebAssembly.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use crate::types::*;

#[wasm_bindgen]
pub struct WasmPromptInput {
    inner: PromptInput,
}

#[wasm_bindgen]
impl WasmPromptInput {
    #[wasm_bindgen(constructor)]
    pub fn new(content: String) -> WasmPromptInput {
        WasmPromptInput {
            inner: PromptInput::new(content),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.inner.id.to_string()
    }

    #[wasm_bindgen(getter)]
    pub fn content(&self) -> String {
        self.inner.content.clone()
    }

    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.inner)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

#[wasm_bindgen]
pub struct WasmDetectionResult {
    inner: DetectionResult,
}

#[wasm_bindgen]
impl WasmDetectionResult {
    #[wasm_bindgen(getter)]
    pub fn confidence(&self) -> f64 {
        self.inner.confidence
    }

    #[wasm_bindgen(getter, js_name = threatCount)]
    pub fn threat_count(&self) -> usize {
        self.inner.threats.len()
    }

    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.inner)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

/// Get AIMDS version
#[wasm_bindgen(js_name = getVersion)]
pub fn get_version() -> String {
    crate::VERSION.to_string()
}

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}
