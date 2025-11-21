//! Utility functions for WASM

use wasm_bindgen::prelude::*;
use js_sys::Date;

/// Get current timestamp in milliseconds
pub fn now_ms() -> u64 {
    Date::now() as u64
}

/// Log to JavaScript console
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn warn(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn error(s: &str);
}

/// Log a message to the console
pub fn console_log(msg: &str) {
    log(msg);
}

/// Log a warning to the console
pub fn console_warn(msg: &str) {
    warn(msg);
}

/// Log an error to the console
pub fn console_error(msg: &str) {
    error(msg);
}

/// Convert base64 to bytes
pub fn base64_decode(input: &str) -> Result<Vec<u8>, JsValue> {
    base64::decode(input)
        .map_err(|e| JsValue::from_str(&format!("Base64 decode error: {}", e)))
}

/// Convert bytes to base64
pub fn base64_encode(input: &[u8]) -> String {
    base64::encode(input)
}

/// Convert hex string to bytes
pub fn hex_decode(input: &str) -> Result<Vec<u8>, JsValue> {
    hex::decode(input)
        .map_err(|e| JsValue::from_str(&format!("Hex decode error: {}", e)))
}

/// Convert bytes to hex string
pub fn hex_encode(input: &[u8]) -> String {
    hex::encode(input)
}