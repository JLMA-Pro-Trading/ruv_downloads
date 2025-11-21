//! Type conversions for WASM bindings

use wasm_bindgen::prelude::*;
use js_sys::{Array, Object, Reflect, Uint8Array};
use serde::{Deserialize, Serialize};

/// Convert a byte array to Uint8Array
pub fn to_uint8_array(bytes: &[u8]) -> Uint8Array {
    Uint8Array::from(bytes)
}

/// Convert Uint8Array to Vec<u8>
pub fn from_uint8_array(array: &Uint8Array) -> Vec<u8> {
    array.to_vec()
}

/// Convert a Rust struct to JsValue
pub fn to_js_value<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Convert JsValue to Rust struct
pub fn from_js_value<T: for<'a> Deserialize<'a>>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))
}

/// Verification result for JavaScript
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    /// Whether the signature is valid
    is_valid: bool,
    /// Number of votes for validation
    votes_for: usize,
    /// Total number of votes
    total_votes: usize,
    /// Consensus ratio (0.0 to 1.0)
    consensus_ratio: f64,
    /// Verification timestamp (milliseconds since epoch)
    timestamp: u64,
}

#[wasm_bindgen]
impl VerificationResult {
    /// Create a new verification result
    #[wasm_bindgen(constructor)]
    pub fn new(
        is_valid: bool,
        votes_for: usize,
        total_votes: usize,
        consensus_ratio: f64,
        timestamp: u64,
    ) -> Self {
        Self {
            is_valid,
            votes_for,
            total_votes,
            consensus_ratio,
            timestamp,
        }
    }

    /// Check if signature is valid
    #[wasm_bindgen(getter)]
    pub fn is_valid(&self) -> bool {
        self.is_valid
    }

    /// Get votes for validation
    #[wasm_bindgen(getter, js_name = votesFor)]
    pub fn votes_for(&self) -> usize {
        self.votes_for
    }

    /// Get total votes
    #[wasm_bindgen(getter, js_name = totalVotes)]
    pub fn total_votes(&self) -> usize {
        self.total_votes
    }

    /// Get consensus ratio
    #[wasm_bindgen(getter, js_name = consensusRatio)]
    pub fn consensus_ratio(&self) -> f64 {
        self.consensus_ratio
    }

    /// Get timestamp
    #[wasm_bindgen(getter)]
    pub fn timestamp(&self) -> f64 {
        self.timestamp as f64
    }

    /// Convert to JavaScript object
    #[wasm_bindgen(js_name = toObject)]
    pub fn to_object(&self) -> Result<Object, JsValue> {
        let obj = Object::new();
        Reflect::set(&obj, &"isValid".into(), &JsValue::from(self.is_valid))?;
        Reflect::set(&obj, &"votesFor".into(), &JsValue::from(self.votes_for as u32))?;
        Reflect::set(&obj, &"totalVotes".into(), &JsValue::from(self.total_votes as u32))?;
        Reflect::set(&obj, &"consensusRatio".into(), &JsValue::from(self.consensus_ratio))?;
        Reflect::set(&obj, &"timestamp".into(), &JsValue::from(self.timestamp as f64))?;
        Ok(obj)
    }

    /// Convert to JSON string
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(self)
            .map_err(|e| JsValue::from_str(&format!("JSON serialization error: {}", e)))
    }
}

/// Agent health status for JavaScript
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AgentStatus {
    Healthy = 0,
    Busy = 1,
    Error = 2,
    Recovering = 3,
    Quarantined = 4,
}

#[wasm_bindgen]
impl AgentStatus {
    /// Convert to string
    #[wasm_bindgen(js_name = toString)]
    pub fn to_string_js(&self) -> String {
        match self {
            AgentStatus::Healthy => "healthy".to_string(),
            AgentStatus::Busy => "busy".to_string(),
            AgentStatus::Error => "error".to_string(),
            AgentStatus::Recovering => "recovering".to_string(),
            AgentStatus::Quarantined => "quarantined".to_string(),
        }
    }
}

/// Agent health metrics for JavaScript
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHealthMetrics {
    agent_id: String,
    status: AgentStatus,
    total_verifications: usize,
    successful_verifications: usize,
    failed_verifications: usize,
    avg_response_time_ms: f64,
    success_rate: f64,
}

#[wasm_bindgen]
impl AgentHealthMetrics {
    /// Get agent ID
    #[wasm_bindgen(getter, js_name = agentId)]
    pub fn agent_id(&self) -> String {
        self.agent_id.clone()
    }

    /// Get status
    #[wasm_bindgen(getter)]
    pub fn status(&self) -> AgentStatus {
        self.status
    }

    /// Get total verifications
    #[wasm_bindgen(getter, js_name = totalVerifications)]
    pub fn total_verifications(&self) -> usize {
        self.total_verifications
    }

    /// Get successful verifications
    #[wasm_bindgen(getter, js_name = successfulVerifications)]
    pub fn successful_verifications(&self) -> usize {
        self.successful_verifications
    }

    /// Get failed verifications
    #[wasm_bindgen(getter, js_name = failedVerifications)]
    pub fn failed_verifications(&self) -> usize {
        self.failed_verifications
    }

    /// Get average response time
    #[wasm_bindgen(getter, js_name = avgResponseTimeMs)]
    pub fn avg_response_time_ms(&self) -> f64 {
        self.avg_response_time_ms
    }

    /// Get success rate
    #[wasm_bindgen(getter, js_name = successRate)]
    pub fn success_rate(&self) -> f64 {
        self.success_rate
    }
}