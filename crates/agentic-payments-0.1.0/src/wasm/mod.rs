//! WebAssembly bindings for agentic-payments
//!
//! This module provides JavaScript/TypeScript bindings for browser and Node.js environments.
//!
//! ## Features
//!
//! - Ed25519 signature generation and verification
//! - Agent identity management
//! - AP2 credential creation
//! - Async verification workflows
//! - Browser and Node.js support
//!
//! ## Usage
//!
//! ```javascript
//! import init, { AgentIdentity, verify } from './pkg';
//!
//! await init();
//!
//! const identity = AgentIdentity.generate();
//! const signature = identity.sign("Hello, WASM!");
//! const valid = await verify(signature, "Hello, WASM!", identity.publicKey());
//! ```

pub mod bindings;
pub mod error;
pub mod types;
pub mod utils;

pub use bindings::*;
pub use error::*;
pub use types::*;

use wasm_bindgen::prelude::*;

/// Initialize the WASM module with panic hooks and console logging
#[wasm_bindgen(start)]
pub fn init_wasm() {
    // Set panic hook for better error messages
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    // Initialize console logging
    #[cfg(feature = "console_log")]
    console_log::init_with_level(log::Level::Info).expect("Failed to initialize logger");
}

/// Get library version
#[wasm_bindgen]
pub fn version() -> String {
    crate::VERSION.to_string()
}

/// Get maximum pool size
#[wasm_bindgen]
pub fn max_pool_size() -> usize {
    crate::MAX_POOL_SIZE
}

/// Get minimum pool size for BFT consensus
#[wasm_bindgen]
pub fn min_pool_size() -> usize {
    crate::MIN_POOL_SIZE
}