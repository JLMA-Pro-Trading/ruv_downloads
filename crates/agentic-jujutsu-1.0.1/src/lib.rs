//! # Agentic-Jujutsu
//!
//! WASM-enabled Jujutsu VCS wrapper for AI agent collaboration and learning.
//!
//! ## Features
//!
//! - Zero-copy jj CLI operations
//! - Operation log parsing and tracking
//! - Conflict detection and resolution
//! - WASM bindings for JavaScript/TypeScript
//! - AgentDB integration

#![warn(missing_docs)]
#![deny(unsafe_code)]

pub mod agentdb_sync;
pub mod config;
pub mod error;
pub mod hooks;
pub mod operations;
pub mod types;
pub mod wrapper;

// MCP module only available on native (uses reqwest)
#[cfg(not(target_arch = "wasm32"))]
pub mod mcp;

// Native module only available on native targets
#[cfg(not(target_arch = "wasm32"))]
pub mod native;

// WASM module only available for WASM targets
#[cfg(target_arch = "wasm32")]
pub mod wasm;

// Re-exports
pub use agentdb_sync::{AgentDBEpisode, AgentDBSync, TaskStatistics};
pub use config::JJConfig;
pub use error::{JJError, Result};
pub use hooks::{HookContext, HookEventType, JJHookEvent, JJHooksIntegration};
pub use operations::{JJOperation, JJOperationLog, OperationType};
pub use types::{JJBranch, JJCommit, JJConflict, JJResult};
pub use wrapper::JJWrapper;

/// Initialize panic hook for better error messages in WASM
#[cfg(target_arch = "wasm32")]
pub fn init() {
    use wasm_bindgen::prelude::*;
    console_error_panic_hook::set_once();
}

/// Version of the agentic-jujutsu crate
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }
}
