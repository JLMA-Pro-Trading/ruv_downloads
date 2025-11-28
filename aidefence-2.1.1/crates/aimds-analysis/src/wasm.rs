//! WASM bindings for aimds-analysis
//!
//! Behavioral analysis and policy verification for WebAssembly.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use crate::{AnalysisEngine, FullAnalysis};

#[wasm_bindgen]
pub struct WasmAnalysisEngine {
    inner: AnalysisEngine,
}

#[derive(Serialize, Deserialize)]
pub struct WasmAnalysisResult {
    pub is_threat: bool,
    pub threat_level: f64,
    pub behavioral_score: f64,
    pub policy_verified: bool,
    pub violations: Vec<String>,
    pub processing_time_ms: f64,
    pub confidence: f64,
}

#[wasm_bindgen]
impl WasmAnalysisEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(dimensions: usize) -> Result<WasmAnalysisEngine, JsValue> {
        console_error_panic_hook::set_once();

        AnalysisEngine::new(dimensions)
            .map(|inner| WasmAnalysisEngine { inner })
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Analyze behavioral patterns (<100ms target)
    #[wasm_bindgen(js_name = analyzeBehavior)]
    pub async fn analyze_behavior(&self, sequence: &[f64]) -> Result<JsValue, JsValue> {
        let start = js_sys::Date::now();

        let result = self.inner.behavioral().analyze_behavior(sequence)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let processing_time = js_sys::Date::now() - start;

        let wasm_result = WasmAnalysisResult {
            is_threat: result.is_anomalous,
            threat_level: result.score,
            behavioral_score: result.score,
            policy_verified: true,
            violations: vec![],
            processing_time_ms: processing_time,
            confidence: result.confidence,
        };

        Ok(serde_wasm_bindgen::to_value(&wasm_result)?)
    }

    /// Full analysis with behavioral and policy verification (<520ms target)
    #[wasm_bindgen(js_name = analyzeFull)]
    pub async fn analyze_full(
        &self,
        sequence: &[f64],
        prompt_text: &str,
    ) -> Result<JsValue, JsValue> {
        let start = js_sys::Date::now();

        let input = aimds_core::PromptInput::new(prompt_text.to_string());

        let result = self.inner.analyze_full(sequence, &input)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let processing_time = js_sys::Date::now() - start;

        let wasm_result = WasmAnalysisResult {
            is_threat: result.is_threat(),
            threat_level: result.threat_level(),
            behavioral_score: result.behavior.score,
            policy_verified: result.policy.verified,
            violations: result.policy.violations.clone(),
            processing_time_ms: processing_time,
            confidence: result.behavior.confidence.min(result.policy.confidence),
        };

        Ok(serde_wasm_bindgen::to_value(&wasm_result)?)
    }

    /// Verify LTL policy (<500ms target)
    #[wasm_bindgen(js_name = verifyPolicy)]
    pub async fn verify_policy(&self, prompt_text: &str) -> Result<JsValue, JsValue> {
        let input = aimds_core::PromptInput::new(prompt_text.to_string());

        let policy_guard = self.inner.policy().read().await;
        let result = policy_guard.verify_policy(&input)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}
