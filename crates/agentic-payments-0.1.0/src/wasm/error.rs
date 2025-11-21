//! Error handling for WASM bindings

use wasm_bindgen::prelude::*;
use std::fmt;

/// WASM-friendly error type
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct WasmError {
    message: String,
    kind: String,
}

#[wasm_bindgen]
impl WasmError {
    /// Create a new WASM error
    #[wasm_bindgen(constructor)]
    pub fn new(message: String, kind: String) -> Self {
        Self { message, kind }
    }

    /// Get error message
    #[wasm_bindgen(getter)]
    pub fn message(&self) -> String {
        self.message.clone()
    }

    /// Get error kind
    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        self.kind.clone()
    }

    /// Get full error description
    #[wasm_bindgen]
    pub fn to_string(&self) -> String {
        format!("{}: {}", self.kind, self.message)
    }
}

impl fmt::Display for WasmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.kind, self.message)
    }
}

impl From<crate::error::Error> for WasmError {
    fn from(err: crate::error::Error) -> Self {
        let kind = match err {
            crate::error::Error::Crypto(_) => "CryptoError",
            crate::error::Error::Consensus(_) => "ConsensusError",
            crate::error::Error::Agent(_) => "AgentError",
            crate::error::Error::Verification(_) => "VerificationError",
            crate::error::Error::Timeout(_) => "TimeoutError",
            crate::error::Error::Serialization(_) => "SerializationError",
            _ => "UnknownError",
        };

        Self {
            message: err.to_string(),
            kind: kind.to_string(),
        }
    }
}

impl From<WasmError> for JsValue {
    fn from(err: WasmError) -> Self {
        JsValue::from_str(&err.to_string())
    }
}

/// Result type for WASM operations
pub type WasmResult<T> = Result<T, WasmError>;

/// Convert a Rust result to a WASM result
pub fn to_wasm_result<T, E: Into<WasmError>>(result: Result<T, E>) -> WasmResult<T> {
    result.map_err(|e| e.into())
}