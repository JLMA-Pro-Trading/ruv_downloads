//! WASM bindings for aimds-response
//!
//! Adaptive threat response and mitigation for WebAssembly.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use crate::{ResponseSystem, MitigationOutcome, ResponseMetrics};

#[wasm_bindgen]
pub struct WasmResponseSystem {
    inner: ResponseSystem,
}

#[derive(Serialize, Deserialize)]
pub struct WasmMitigationResult {
    pub success: bool,
    pub strategy_id: String,
    pub actions_taken: Vec<String>,
    pub effectiveness_score: f64,
    pub processing_time_ms: f64,
    pub rollback_available: bool,
}

#[derive(Serialize, Deserialize)]
pub struct WasmResponseMetrics {
    pub learned_patterns: usize,
    pub active_strategies: usize,
    pub total_mitigations: u64,
    pub successful_mitigations: u64,
    pub optimization_level: usize,
    pub success_rate: f64,
}

#[wasm_bindgen]
impl WasmResponseSystem {
    #[wasm_bindgen(constructor)]
    pub async fn new() -> Result<WasmResponseSystem, JsValue> {
        console_error_panic_hook::set_once();

        let inner = ResponseSystem::new()
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(WasmResponseSystem { inner })
    }

    /// Apply adaptive mitigation (<50ms target)
    #[wasm_bindgen]
    pub async fn mitigate(&self, threat_json: &str) -> Result<JsValue, JsValue> {
        let start = js_sys::Date::now();

        let threat: crate::meta_learning::ThreatIncident = serde_json::from_str(threat_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let result = self.inner.mitigate(&threat)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let processing_time = js_sys::Date::now() - start;

        let wasm_result = WasmMitigationResult {
            success: true,
            strategy_id: result.strategy_id.clone(),
            actions_taken: result.actions_taken.iter()
                .map(|a| format!("{:?}", a))
                .collect(),
            effectiveness_score: result.effectiveness_score,
            processing_time_ms: processing_time,
            rollback_available: result.rollback_available,
        };

        Ok(serde_wasm_bindgen::to_value(&wasm_result)?)
    }

    /// Learn from mitigation outcome to improve future responses
    #[wasm_bindgen(js_name = learnFromResult)]
    pub async fn learn_from_result(&self, outcome_json: &str) -> Result<(), JsValue> {
        let outcome: MitigationOutcome = serde_json::from_str(outcome_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.inner.learn_from_result(&outcome)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(())
    }

    /// Get current system metrics
    #[wasm_bindgen]
    pub async fn metrics(&self) -> Result<JsValue, JsValue> {
        let metrics = self.inner.metrics().await;

        let success_rate = if metrics.total_mitigations > 0 {
            metrics.successful_mitigations as f64 / metrics.total_mitigations as f64
        } else {
            0.0
        };

        let wasm_metrics = WasmResponseMetrics {
            learned_patterns: metrics.learned_patterns,
            active_strategies: metrics.active_strategies,
            total_mitigations: metrics.total_mitigations,
            successful_mitigations: metrics.successful_mitigations,
            optimization_level: metrics.optimization_level,
            success_rate,
        };

        Ok(serde_wasm_bindgen::to_value(&wasm_metrics)?)
    }

    /// Optimize strategies based on feedback
    #[wasm_bindgen]
    pub async fn optimize(&self, feedback_json: &str) -> Result<(), JsValue> {
        let feedback: Vec<crate::FeedbackSignal> = serde_json::from_str(feedback_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.inner.optimize(&feedback)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(())
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}
