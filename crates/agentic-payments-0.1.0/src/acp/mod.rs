//! Agentic Commerce Protocol (ACP) implementation
//!
//! ACP provides Stripe-compatible payment processing with autonomous agent verification.
//! This module maintains backward compatibility with AP2 (Agent Payments Protocol) while
//! enabling modern checkout flows.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                     Protocol Router                         │
//! │  (Automatic AP2/ACP detection based on request patterns)    │
//! └────────────────┬───────────────────────────┬────────────────┘
//!                  │                           │
//!          ┌───────▼────────┐         ┌────────▼──────────┐
//!          │   AP2 Flow     │         │    ACP Flow       │
//!          │  (DID/VC auth) │         │ (Stripe checkout) │
//!          └────────────────┘         └───────────────────┘
//! ```
//!
//! # Modules
//!
//! - **router**: Protocol detection and routing layer (zero breaking changes to AP2)
//! - **bridge**: AP2 ↔ ACP data model bridge adapters
//! - **models**: Core ACP data types (CheckoutSession, CheckoutItem)
//!
//! # Feature Flags
//!
//! - `acp`: Enable ACP functionality (default: off to avoid breaking changes)

pub mod router;
pub mod bridge;
pub mod models;

pub use router::{ProtocolRouter, ProtocolType};
pub use bridge::{
    cart_mandate_to_checkout,
    checkout_to_cart_mandate,
    intent_to_allowance,
    payment_mandate_to_delegate,
};
pub use models::{CheckoutSession, CheckoutItem, CheckoutStatus};