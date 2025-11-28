//! # NT-Core: Neural Trader Core Library
//!
//! This crate provides the foundational types, traits, and utilities for the Neural Trading system.
//! It has zero domain-specific dependencies and serves as the base for all other crates.
//!
//! ## Features
//!
//! - **Zero-cost abstractions**: Generic traits with no runtime overhead
//! - **Type safety**: Strong typing for financial primitives (Symbol, Price, etc.)
//! - **Async-first**: All I/O operations use `async/await`
//! - **Error handling**: Comprehensive error types with context
//! - **Serialization**: Full serde support for all types
//!
//! ## Architecture
//!
//! ```text
//! nt-core
//! ├── types     - Core financial types (Symbol, Price, Order, etc.)
//! ├── traits    - Async traits for strategies, data providers, execution
//! ├── error     - Unified error handling with thiserror
//! └── config    - Configuration management with validation
//! ```
//!
//! ## Example Usage
//!
//! ```rust
//! use nt_core::prelude::*;
//!
//! // Create a symbol
//! let symbol = Symbol::new("AAPL").unwrap();
//!
//! // Create a trading signal
//! let signal = Signal::new(
//!     "momentum_strategy",
//!     symbol.clone(),
//!     Direction::Long,
//!     0.85,
//! );
//!
//! println!("Signal: {:?}", signal);
//! ```

pub mod config;
pub mod error;
pub mod traits;
pub mod types;

/// Commonly used types and traits
pub mod prelude {
    pub use crate::config::*;
    pub use crate::error::{Result, TradingError};
    pub use crate::traits::*;
    pub use crate::types::*;
}
