//! Micro Routing - Dynamic routing for micro-neural networks
//! 
//! This crate provides dynamic routing and context management for
//! micro-neural network systems in the Semantic Cartan Matrix.

#![no_std]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

extern crate alloc;
use alloc::vec::Vec;
use alloc::string::String;

pub mod router;
pub mod context; 
pub mod gating;

// Main types are defined inline for simplicity

/// Dynamic router for micro-networks
pub struct DynamicRouter;
/// Router configuration
pub struct RouterConfig;
/// Routing decision result
pub struct RoutingDecision;
/// Context vector for routing
pub struct ContextVector;
/// Context manager
pub struct ContextManager;
/// Neural gate for filtering
pub struct NeuralGate;
/// Gating function implementation
pub struct GatingFunction;

// Default implementations
impl Default for DynamicRouter { fn default() -> Self { Self } }
impl Default for RouterConfig { fn default() -> Self { Self } }
impl Default for ContextVector { fn default() -> Self { Self } }
impl Default for ContextManager { fn default() -> Self { Self } }
impl Default for NeuralGate { fn default() -> Self { Self } }
impl Default for GatingFunction { fn default() -> Self { Self } }

// Re-export core types from micro_core
pub use micro_core::{RootVector, ROOT_DIM, Error, Result, MicroNet, AgentState, AgentType};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

// Types are now imported from micro_core