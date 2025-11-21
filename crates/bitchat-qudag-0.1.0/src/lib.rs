//! # BitChat-QuDAG Integration
//!
//! This crate provides BitChat's decentralized messaging capabilities for QuDAG nodes,
//! with full support for Rust native environments and WebAssembly (WASM) in browsers.
//!
//! ## Features
//!
//! - **Encrypted P2P Messaging**: End-to-end encrypted communication between QuDAG nodes
//! - **Hybrid Cryptography**: Quantum-resistant + traditional cryptography
//! - **Multi-Transport Support**: Internet P2P, Bluetooth LE, WebSocket, local network
//! - **Store & Forward**: Offline message delivery for network resilience
//! - **Privacy Features**: Ephemeral messages, cover traffic, forward secrecy
//! - **WASM Support**: Full browser compatibility with JavaScript API
//!
//! ## Quick Start
//!
//! ```rust
//! use bitchat_qudag::{BitChatMessaging, QuDAGMessaging, BitChatConfig};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create configuration
//!     let config = BitChatConfig::development();
//!     
//!     // Create messaging instance
//!     let mut messaging = BitChatMessaging::new(config).await?;
//!     
//!     // Start messaging
//!     messaging.start().await?;
//!     
//!     // Send a message
//!     messaging.send_message("peer_id", b"Hello BitChat!").await?;
//!     
//!     // Receive messages
//!     if let Some(message) = messaging.receive_message().await? {
//!         println!("Received: {:?}", message);
//!     }
//!     
//!     // Stop messaging
//!     messaging.stop().await?;
//!     
//!     Ok(())
//! }
//! ```
//!
//! ## WASM Usage
//!
//! ```javascript
//! import { BitChatWasm } from 'bitchat-qudag';
//!
//! const config = {
//!     enabled: true,
//!     crypto_mode: "Hybrid",
//!     compression: true
//! };
//!
//! const bitchat = new BitChatWasm(JSON.stringify(config));
//! await bitchat.send_message("peer_id", new Uint8Array([1, 2, 3]));
//! ```

#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(missing_docs)]

// Core modules
pub mod config;
pub mod crypto;
pub mod error;
pub mod messaging;
pub mod transport;
pub mod utils;

// Real transport implementations
#[cfg(all(not(target_arch = "wasm32"), feature = "networking"))]
pub mod transports;

// WASM-specific module
#[cfg(feature = "wasm")]
#[cfg_attr(docsrs, doc(cfg(feature = "wasm")))]
pub mod wasm;

// Platform-specific modules
#[cfg(all(not(target_arch = "wasm32"), feature = "networking"))]
pub mod native;

// Re-export commonly used types
pub use config::BitChatConfig;
pub use crypto::{CryptoMode, HybridCrypto};
pub use error::{BitChatError, Result};
pub use messaging::{BitChatMessaging, MessagingStats, PeerInfo, QuDAGMessaging, ReceivedMessage};
pub use transport::{MultiTransport, TransportType};

// WASM exports
#[cfg(feature = "wasm")]
pub use wasm::BitChatWasm;

// Common re-exports
pub use async_trait::async_trait;
pub use chrono::{DateTime, Utc};
pub use uuid::Uuid;

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Library name
pub const NAME: &str = env!("CARGO_PKG_NAME");

/// Library description
pub const DESCRIPTION: &str = env!("CARGO_PKG_DESCRIPTION");

/// Initialize logging for the library
pub fn init_logging() {
    #[cfg(all(not(target_arch = "wasm32"), feature = "tracing-subscriber"))]
    {
        tracing_subscriber::fmt::init();
    }

    #[cfg(all(target_arch = "wasm32", feature = "wasm"))]
    {
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();
        #[cfg(feature = "tracing-wasm")]
        tracing_wasm::set_as_global_default();
    }
}

/// Get library information
pub fn info() -> LibraryInfo {
    LibraryInfo {
        name: NAME.to_string(),
        version: VERSION.to_string(),
        description: DESCRIPTION.to_string(),
        features: get_enabled_features(),
        platform: get_platform_info(),
    }
}

/// Library information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LibraryInfo {
    /// Library name
    pub name: String,
    /// Library version
    pub version: String,
    /// Library description
    pub description: String,
    /// Enabled features
    pub features: Vec<String>,
    /// Platform information
    pub platform: PlatformInfo,
}

/// Platform information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlatformInfo {
    /// Target architecture
    pub arch: String,
    /// Target OS
    pub os: String,
    /// Is WASM target
    pub is_wasm: bool,
}

fn get_enabled_features() -> Vec<String> {
    let mut features = Vec::new();

    #[cfg(feature = "tokio")]
    features.push("tokio".to_string());

    #[cfg(feature = "compression")]
    features.push("compression".to_string());

    #[cfg(feature = "encryption")]
    features.push("encryption".to_string());

    #[cfg(feature = "networking")]
    features.push("networking".to_string());

    #[cfg(feature = "bluetooth")]
    features.push("bluetooth".to_string());

    #[cfg(feature = "websocket")]
    features.push("websocket".to_string());

    #[cfg(feature = "wasm")]
    features.push("wasm".to_string());

    #[cfg(feature = "cover-traffic")]
    features.push("cover-traffic".to_string());

    #[cfg(feature = "store-forward")]
    features.push("store-forward".to_string());

    #[cfg(feature = "ephemeral-messages")]
    features.push("ephemeral-messages".to_string());

    features
}

fn get_platform_info() -> PlatformInfo {
    PlatformInfo {
        arch: std::env::consts::ARCH.to_string(),
        os: std::env::consts::OS.to_string(),
        is_wasm: cfg!(target_arch = "wasm32"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_library_info() {
        let info = info();
        assert_eq!(info.name, NAME);
        assert_eq!(info.version, VERSION);
        assert!(!info.features.is_empty());
    }

    #[test]
    fn test_platform_info() {
        let platform = get_platform_info();
        assert!(!platform.arch.is_empty());
        assert!(!platform.os.is_empty());

        #[cfg(target_arch = "wasm32")]
        assert!(platform.is_wasm);

        #[cfg(not(target_arch = "wasm32"))]
        assert!(!platform.is_wasm);
    }
}
