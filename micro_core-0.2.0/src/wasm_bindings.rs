//! WASM bindings for micro_core
//! 
//! This module provides WebAssembly bindings for the micro_core crate.

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
use crate::{RootVector, MicroNet, AgentState, AgentType};

/// WASM-compatible MicroNet implementation
#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmMicroNet {
    inner: Box<dyn MicroNet>,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmMicroNet {
    /// Create a new WASM MicroNet
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmMicroNet, JsValue> {
        // Implementation would depend on concrete MicroNet type
        Err(JsValue::from_str("MicroNet implementation not available"))
    }

    /// Process input through the micro network
    #[wasm_bindgen]
    pub fn process(&self, input: &[f32]) -> Result<Vec<f32>, JsValue> {
        if input.len() != crate::ROOT_DIM {
            return Err(JsValue::from_str(&format!(
                "Input must have {} dimensions", crate::ROOT_DIM
            )));
        }

        let mut root_vector = RootVector::default();
        root_vector.data.copy_from_slice(input);

        match self.inner.process(&root_vector) {
            Ok(result) => Ok(result.data.to_vec()),
            Err(e) => Err(JsValue::from_str(&format!("Processing error: {:?}", e))),
        }
    }
}