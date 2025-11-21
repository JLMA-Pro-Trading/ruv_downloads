# Dual-Protocol Architecture: AP2 + ACP Integration

**Version:** 1.0.0
**Date:** 2025-09-29
**Status:** Architecture Design Document

## Executive Summary

This document defines the comprehensive architecture for integrating **AP2 (Agent Payments Protocol)** and **ACP (Agentic Commerce Protocol)** within the `agentic-payments` crate. The design ensures zero breaking changes to the existing production-ready AP2 implementation while adding full ACP REST API support with shared cryptographic infrastructure.

### Key Objectives

1. **Zero Breaking Changes**: Preserve all existing AP2 functionality (112/112 tests passing)
2. **Seamless Interoperability**: Both protocols share Ed25519, BFT consensus, and agent infrastructure
3. **WASM Compatibility**: Full browser and Node.js support using wasm-bindgen
4. **Production Ready**: Enterprise-grade error handling, idempotency, and fault tolerance
5. **Standards Compliant**: W3C DID/VC for AP2, OpenAPI 3.1 for ACP

---

## 1. Protocol Overview

### 1.1 AP2 (Agent Payments Protocol)

**Purpose**: Cryptographic authorization framework for autonomous agent transactions

**Core Components**:
- **Intent Mandates**: User authorizes agent spending with constraints ($500/month groceries)
- **Cart Mandates**: Pre-purchase approval with itemized authorization
- **Payment Mandates**: Final payment network signaling
- **W3C DIDs/VCs**: Decentralized identity and verifiable credentials
- **Multi-Agent BFT**: Byzantine fault tolerant consensus (⅔+ quorum)

**Current State**: 100% production-ready, 112/112 tests passing

### 1.2 ACP (Agentic Commerce Protocol)

**Purpose**: REST API for merchant-implemented checkout sessions and delegated payments

**Core Endpoints**:
1. `POST /checkout_sessions` - Create checkout session
2. `GET /checkout_sessions/{id}` - Retrieve session state
3. `POST /checkout_sessions/{id}` - Update session (items, fulfillment, options)
4. `POST /checkout_sessions/{id}/complete` - Finalize with payment
5. `POST /checkout_sessions/{id}/cancel` - Cancel session
6. `POST /agentic_commerce/delegate_payment` - Tokenize payment with allowances

**Requirements**: OpenAPI 3.1 compliant, idempotent operations, Ed25519 signatures

---

## 2. Architecture Design

### 2.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Agentic Payments Crate                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │           Protocol Router (trait-based dispatch)           │      │
│  │  - Route by protocol identifier (AP2 vs ACP)              │      │
│  │  - Shared authentication layer (Ed25519 + BFT)            │      │
│  │  - Unified error handling and observability              │      │
│  └─────────────────┬──────────────────┬──────────────────────┘      │
│                    │                  │                              │
│         ┌──────────▼─────────┐  ┌────▼─────────────────┐           │
│         │   AP2 Protocol     │  │   ACP Protocol       │           │
│         │   (Existing)       │  │   (New REST API)     │           │
│         ├────────────────────┤  ├──────────────────────┤           │
│         │ - DIDs/VCs         │  │ - Checkout Sessions  │           │
│         │ - Intent Mandates  │  │ - Payment Delegates  │           │
│         │ - Cart Mandates    │  │ - REST Handlers      │           │
│         │ - Payment Mandates │  │ - OpenAPI Schemas    │           │
│         └──────────┬─────────┘  └────┬─────────────────┘           │
│                    │                  │                              │
│                    └──────────┬───────┘                              │
│                               │                                      │
│  ┌────────────────────────────▼──────────────────────────────┐      │
│  │           Shared Infrastructure Layer                      │      │
│  ├────────────────────────────────────────────────────────────┤      │
│  │  ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐  │      │
│  │  │ Crypto Core  │  │ BFT Agents  │  │ Agent Pool Mgmt │  │      │
│  │  │ - Ed25519    │  │ - Consensus │  │ - Health Checks │  │      │
│  │  │ - Signatures │  │ - Voting    │  │ - Recovery      │  │      │
│  │  │ - Key Mgmt   │  │ - Quorum    │  │ - Scaling       │  │      │
│  │  └──────────────┘  └─────────────┘  └─────────────────┘  │      │
│  │                                                            │      │
│  │  ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐  │      │
│  │  │ Trust Chain  │  │ Anomaly Det │  │ Workflow Engine │  │      │
│  │  │ - Validators │  │ - Fraud Det │  │ - Verification  │  │      │
│  │  │ - DFS        │  │ - Statistics│  │ - Batch Ops     │  │      │
│  │  └──────────────┘  └─────────────┘  └─────────────────┘  │      │
│  └────────────────────────────────────────────────────────────┘      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │                 WASM Bindings Layer                        │      │
│  │  - wasm-bindgen for JS interop                            │      │
│  │  - serde-wasm-bindgen for serialization                   │      │
│  │  - web-sys for browser APIs                               │      │
│  │  - Both AP2 and ACP exposed to JavaScript                 │      │
│  └────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
crates/agentic-payments/
├── src/
│   ├── lib.rs                          # Re-export both protocols
│   │
│   ├── router/                         # NEW: Protocol routing layer
│   │   ├── mod.rs                      # Trait definitions + dispatcher
│   │   ├── protocol.rs                 # ProtocolHandler trait
│   │   ├── auth.rs                     # Shared Ed25519 auth middleware
│   │   └── metrics.rs                  # Cross-protocol observability
│   │
│   ├── ap2/                            # EXISTING: No changes
│   │   ├── mod.rs
│   │   ├── credentials.rs
│   │   ├── did.rs
│   │   ├── mandates.rs
│   │   └── verification.rs
│   │
│   ├── acp/                            # NEW: ACP implementation
│   │   ├── mod.rs                      # Public API exports
│   │   │
│   │   ├── handlers/                   # REST endpoint handlers
│   │   │   ├── mod.rs
│   │   │   ├── checkout.rs             # Checkout session CRUD
│   │   │   ├── delegate_payment.rs     # Payment tokenization
│   │   │   └── middleware.rs           # Idempotency, signatures
│   │   │
│   │   ├── models/                     # OpenAPI schema types
│   │   │   ├── mod.rs
│   │   │   ├── checkout.rs             # CheckoutSession, LineItem, etc.
│   │   │   ├── payment.rs              # PaymentMethod, Allowance, etc.
│   │   │   ├── address.rs              # Address, Buyer, etc.
│   │   │   └── error.rs                # ACP error types
│   │   │
│   │   ├── services/                   # Business logic layer
│   │   │   ├── mod.rs
│   │   │   ├── checkout_service.rs     # Session management
│   │   │   ├── payment_service.rs      # Payment delegation
│   │   │   └── validation.rs           # Input validation
│   │   │
│   │   ├── storage/                    # State persistence
│   │   │   ├── mod.rs
│   │   │   ├── session_store.rs        # CheckoutSession storage
│   │   │   ├── idempotency.rs          # Idempotency key tracking
│   │   │   └── delegate_store.rs       # Payment token vault
│   │   │
│   │   └── bridge/                     # AP2 ↔ ACP interop
│   │       ├── mod.rs
│   │       ├── mandate_adapter.rs      # CartMandate ↔ CheckoutSession
│   │       ├── payment_adapter.rs      # PaymentMandate ↔ DelegatePayment
│   │       └── identity_bridge.rs      # DID ↔ Agent authentication
│   │
│   ├── agents/                         # EXISTING: Shared by both protocols
│   │   ├── verification.rs
│   │   ├── trust_chain.rs
│   │   ├── authority.rs
│   │   ├── key_manager.rs
│   │   ├── anomaly.rs
│   │   └── recovery.rs
│   │
│   ├── consensus/                      # EXISTING: Shared BFT consensus
│   ├── crypto/                         # EXISTING: Shared Ed25519 core
│   ├── workflows/                      # EXISTING: Shared verification flows
│   ├── system/                         # EXISTING: Agent pool management
│   ├── error/                          # EXISTING: Extended for ACP errors
│   │
│   └── wasm/                           # EXISTING: Extended for ACP
│       ├── bindings.rs                 # Add ACP bindings
│       ├── types.rs                    # Add ACP WASM types
│       └── utils.rs
│
├── tests/
│   ├── ap2_integration_tests.rs        # EXISTING: Unchanged
│   ├── acp_integration_tests.rs        # NEW: ACP REST API tests
│   └── bridge_integration_tests.rs     # NEW: AP2 ↔ ACP interop tests
│
└── benches/
    └── dual_protocol_benchmark.rs      # NEW: Compare AP2 vs ACP perf
```

---

## 3. Protocol Routing Layer

### 3.1 Protocol Handler Trait

```rust
// src/router/protocol.rs
use crate::error::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Universal protocol handler trait
#[async_trait]
pub trait ProtocolHandler: Send + Sync {
    /// Protocol identifier (e.g., "ap2", "acp")
    fn protocol_id(&self) -> &'static str;

    /// Protocol version
    fn protocol_version(&self) -> &'static str;

    /// Handle incoming request
    async fn handle_request(
        &self,
        request: ProtocolRequest,
        context: ProtocolContext,
    ) -> Result<ProtocolResponse>;

    /// Verify request authentication
    async fn verify_auth(
        &self,
        request: &ProtocolRequest,
        context: &ProtocolContext,
    ) -> Result<AuthResult>;

    /// Health check
    async fn health_check(&self) -> Result<HealthStatus>;
}

/// Universal request wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolRequest {
    pub id: String,
    pub method: String,
    pub path: String,
    pub headers: HashMap<String, String>,
    pub body: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

/// Request execution context
#[derive(Debug, Clone)]
pub struct ProtocolContext {
    pub agent_pool: Arc<AgentPool>,
    pub crypto_provider: Arc<CryptoProvider>,
    pub consensus_config: ConsensusConfig,
    pub request_id: String,
    pub idempotency_key: Option<String>,
}

/// Universal response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolResponse {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: serde_json::Value,
    pub metadata: ResponseMetadata,
}

/// Authentication result
#[derive(Debug, Clone)]
pub struct AuthResult {
    pub valid: bool,
    pub agent_did: Option<String>,
    pub public_key: Option<Vec<u8>>,
    pub consensus_result: Option<ConsensusVerification>,
}

/// Health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub protocol_id: String,
    pub active_agents: usize,
    pub error_rate: f64,
}
```

### 3.2 Protocol Router

```rust
// src/router/mod.rs
use std::collections::HashMap;
use std::sync::Arc;

pub struct ProtocolRouter {
    handlers: HashMap<String, Arc<dyn ProtocolHandler>>,
    auth_middleware: Arc<AuthMiddleware>,
    metrics: Arc<MetricsCollector>,
}

impl ProtocolRouter {
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
            auth_middleware: Arc::new(AuthMiddleware::new()),
            metrics: Arc::new(MetricsCollector::new()),
        }
    }

    /// Register a protocol handler
    pub fn register_handler(&mut self, handler: Arc<dyn ProtocolHandler>) {
        self.handlers.insert(
            handler.protocol_id().to_string(),
            handler,
        );
    }

    /// Route request to appropriate protocol handler
    pub async fn route(&self, request: ProtocolRequest) -> Result<ProtocolResponse> {
        // Determine protocol from request path or headers
        let protocol_id = self.detect_protocol(&request)?;

        // Get handler
        let handler = self.handlers.get(protocol_id)
            .ok_or_else(|| Error::UnsupportedProtocol(protocol_id.to_string()))?;

        // Create context
        let context = ProtocolContext {
            agent_pool: self.agent_pool.clone(),
            crypto_provider: self.crypto_provider.clone(),
            consensus_config: self.consensus_config.clone(),
            request_id: request.id.clone(),
            idempotency_key: request.headers.get("Idempotency-Key").cloned(),
        };

        // Verify authentication (shared layer)
        let auth_result = self.auth_middleware
            .verify(&request, &context, handler.as_ref())
            .await?;

        if !auth_result.valid {
            return Err(Error::AuthenticationFailed);
        }

        // Record metrics
        self.metrics.record_request(protocol_id, &request);

        // Dispatch to handler
        let response = handler.handle_request(request, context).await?;

        // Record response metrics
        self.metrics.record_response(protocol_id, &response);

        Ok(response)
    }

    fn detect_protocol(&self, request: &ProtocolRequest) -> Result<&str> {
        // ACP: REST paths start with /checkout_sessions or /agentic_commerce
        if request.path.starts_with("/checkout_sessions")
            || request.path.starts_with("/agentic_commerce") {
            return Ok("acp");
        }

        // AP2: Check for AP2-specific headers or DID-based auth
        if request.headers.contains_key("X-AP2-Version")
            || request.body.get("did").is_some() {
            return Ok("ap2");
        }

        // Default to AP2 for backward compatibility
        Ok("ap2")
    }
}
```

---

## 4. Shared Infrastructure

### 4.1 Unified Cryptography Layer

Both protocols use the **same Ed25519 implementation**:

```rust
// src/crypto/mod.rs (EXISTING - No changes)
// Already provides:
// - ed25519_dalek for signatures
// - Batch verification
// - Key management
// - WASM-compatible random generation

// Extension for ACP signature headers:
// src/router/auth.rs
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

impl AuthMiddleware {
    /// Verify Ed25519 signature from HTTP header
    pub async fn verify_http_signature(
        &self,
        request: &ProtocolRequest,
    ) -> Result<AuthResult> {
        // Extract signature from "Signature" header
        let sig_header = request.headers
            .get("Signature")
            .ok_or(Error::MissingSignature)?;

        let signature_bytes = base64::decode(sig_header)?;
        let signature = Signature::from_bytes(&signature_bytes)?;

        // Extract public key from DID or registration
        let public_key = self.resolve_public_key(request).await?;
        let verifying_key = VerifyingKey::from_bytes(&public_key)?;

        // Create canonical request body for signing
        let canonical = self.canonicalize_request(request)?;

        // Verify signature using existing crypto infrastructure
        match verifying_key.verify(&canonical, &signature) {
            Ok(_) => Ok(AuthResult {
                valid: true,
                agent_did: Some(self.extract_did(request)?),
                public_key: Some(public_key),
                consensus_result: None, // HTTP doesn't use BFT
            }),
            Err(_) => Ok(AuthResult {
                valid: false,
                agent_did: None,
                public_key: None,
                consensus_result: None,
            }),
        }
    }

    /// For AP2: Use existing BFT consensus verification
    pub async fn verify_ap2_consensus(
        &self,
        request: &ProtocolRequest,
        context: &ProtocolContext,
    ) -> Result<AuthResult> {
        // Delegate to existing AP2 verification workflow
        let credential: VerifiableCredential = serde_json::from_value(
            request.body.clone()
        )?;

        let verification = context.verification_workflow
            .verify_with_consensus(
                &credential,
                context.agent_pool.active_agents(),
                context.crypto_provider.did_resolver(),
            )
            .await?;

        Ok(AuthResult {
            valid: verification.is_valid(),
            agent_did: Some(credential.issuer.clone()),
            public_key: None,
            consensus_result: Some(verification),
        })
    }
}
```

### 4.2 Shared Agent Pool

Both protocols use the **same agent infrastructure**:

```rust
// src/agents/mod.rs (EXISTING - No changes)
// Already provides:
// - VerificationAgent (parallel Ed25519 validation)
// - TrustChainValidator (certificate chain traversal)
// - AuthorityCoordinator (multi-issuer quorum)
// - KeyManagementAgent (secure key lifecycle)
// - AnomalyDetectionAgent (statistical threat detection)
// - RecoveryAgent (self-healing with respawning)

// ACP uses the same agents for:
// - Signature verification of HTTP requests
// - Multi-merchant trust validation
// - Fraud detection on checkout sessions
// - Automatic recovery from agent failures
```

### 4.3 Shared BFT Consensus

```rust
// src/consensus/mod.rs (EXISTING - No changes)
// Already provides:
// - Byzantine fault tolerance (⅔+ quorum)
// - Weighted voting by agent reputation
// - Automatic Byzantine detection
// - Parallel consensus execution

// AP2 usage: Verifiable Credential consensus
// ACP usage: Optional for high-value checkout sessions

impl CheckoutService {
    /// For high-value transactions, use BFT consensus
    pub async fn complete_with_consensus(
        &self,
        session_id: &str,
        payment_data: PaymentData,
        context: &ProtocolContext,
    ) -> Result<CheckoutSessionWithOrder> {
        let session = self.get_session(session_id)?;

        // Threshold: Use consensus for transactions > $10,000
        if session.total_amount() > 1_000_000 { // cents
            // Convert ACP session to AP2 mandate for BFT validation
            let payment_mandate = self.bridge.to_payment_mandate(&session, &payment_data)?;

            // Use existing AP2 BFT consensus
            let verification = context.verification_workflow
                .verify_with_consensus(
                    &payment_mandate,
                    context.agent_pool.active_agents(),
                    context.crypto_provider.did_resolver(),
                )
                .await?;

            if !verification.is_valid() {
                return Err(AcpError::ConsensusRejected(verification));
            }
        }

        // Proceed with payment processing
        self.finalize_payment(session_id, payment_data).await
    }
}
```

---

## 5. ACP Implementation

### 5.1 Core Models

```rust
// src/acp/models/checkout.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutSession {
    pub id: String, // Format: csn_...
    pub buyer: Option<Buyer>,
    pub payment_provider: Option<PaymentProvider>,
    pub status: CheckoutStatus,
    pub currency: String, // ISO-4217
    pub line_items: Vec<LineItem>,
    pub fulfillment_address: Option<Address>,
    pub fulfillment_options: Vec<FulfillmentOption>,
    pub fulfillment_option_id: Option<String>,
    pub totals: Vec<Total>,
    pub messages: Vec<Message>,
    pub links: Vec<Link>,
    #[serde(skip)]
    pub created_at: DateTime<Utc>,
    #[serde(skip)]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckoutStatus {
    NotReadyForPayment,
    ReadyForPayment,
    InProgress,
    Completed,
    Canceled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineItem {
    pub id: String,
    pub item: Item,
    pub base_amount: i64, // Minor units (cents)
    pub discount: i64,
    pub subtotal: i64,
    pub tax: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub quantity: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Total {
    pub r#type: TotalType,
    pub display_text: String,
    pub amount: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TotalType {
    ItemsBaseAmount,
    ItemsDiscount,
    Subtotal,
    Discount,
    Fulfillment,
    Tax,
    Fee,
    Total,
}

// Additional types: Buyer, Address, FulfillmentOption, Message, Link...
```

### 5.2 REST Handlers with WASM Support

```rust
// src/acp/handlers/checkout.rs
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};

// For WASM: Use axum-wasm instead of axum
#[cfg(target_arch = "wasm32")]
use axum_wasm as axum;

pub struct CheckoutHandler {
    service: Arc<CheckoutService>,
}

impl CheckoutHandler {
    /// POST /checkout_sessions
    pub async fn create_session(
        State(handler): State<Arc<Self>>,
        headers: HeaderMap,
        Json(request): Json<CheckoutSessionCreateRequest>,
    ) -> Result<(StatusCode, Json<CheckoutSession>), AcpError> {
        // Extract idempotency key
        let idempotency_key = headers
            .get("Idempotency-Key")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        // Check idempotency cache
        if let Some(key) = &idempotency_key {
            if let Some(cached) = handler.service.get_cached_response(key).await? {
                return Ok((StatusCode::OK, Json(cached)));
            }
        }

        // Create new session
        let session = handler.service.create_session(request).await?;

        // Cache response
        if let Some(key) = idempotency_key {
            handler.service.cache_response(&key, &session).await?;
        }

        Ok((StatusCode::CREATED, Json(session)))
    }

    /// GET /checkout_sessions/{id}
    pub async fn get_session(
        State(handler): State<Arc<Self>>,
        Path(session_id): Path<String>,
    ) -> Result<Json<CheckoutSession>, AcpError> {
        let session = handler.service.get_session(&session_id).await?;
        Ok(Json(session))
    }

    /// POST /checkout_sessions/{id}
    pub async fn update_session(
        State(handler): State<Arc<Self>>,
        Path(session_id): Path<String>,
        Json(request): Json<CheckoutSessionUpdateRequest>,
    ) -> Result<Json<CheckoutSession>, AcpError> {
        let session = handler.service.update_session(&session_id, request).await?;
        Ok(Json(session))
    }

    /// POST /checkout_sessions/{id}/complete
    pub async fn complete_session(
        State(handler): State<Arc<Self>>,
        Path(session_id): Path<String>,
        Json(request): Json<CheckoutSessionCompleteRequest>,
    ) -> Result<Json<CheckoutSessionWithOrder>, AcpError> {
        let result = handler.service.complete_session(&session_id, request).await?;
        Ok(Json(result))
    }

    /// POST /checkout_sessions/{id}/cancel
    pub async fn cancel_session(
        State(handler): State<Arc<Self>>,
        Path(session_id): Path<String>,
    ) -> Result<Json<CheckoutSession>, AcpError> {
        let session = handler.service.cancel_session(&session_id).await?;
        Ok(Json(session))
    }
}
```

### 5.3 Delegate Payment Handler

```rust
// src/acp/handlers/delegate_payment.rs
use crate::acp::models::payment::*;

pub struct DelegatePaymentHandler {
    service: Arc<PaymentDelegationService>,
}

impl DelegatePaymentHandler {
    /// POST /agentic_commerce/delegate_payment
    pub async fn delegate_payment(
        State(handler): State<Arc<Self>>,
        headers: HeaderMap,
        Json(request): Json<DelegatePaymentRequest>,
    ) -> Result<(StatusCode, Json<DelegatePaymentResponse>), AcpError> {
        // Validate request
        handler.service.validate_request(&request)?;

        // Check fraud signals
        handler.service.assess_risk(&request.risk_signals)?;

        // Tokenize payment method
        let vault_token = handler.service
            .tokenize_payment(
                request.payment_method,
                request.allowance,
                request.billing_address,
            )
            .await?;

        // Create response
        let response = DelegatePaymentResponse {
            id: vault_token.id,
            created: Utc::now(),
            metadata: request.metadata,
        };

        Ok((StatusCode::CREATED, Json(response)))
    }
}
```

---

## 6. AP2 ↔ ACP Bridge

### 6.1 Mandate Adapter

```rust
// src/acp/bridge/mandate_adapter.rs
use crate::ap2::{CartMandate, CartItem as Ap2CartItem};
use crate::acp::models::{CheckoutSession, LineItem};

pub struct MandateAdapter;

impl MandateAdapter {
    /// Convert ACP CheckoutSession to AP2 CartMandate
    pub fn to_cart_mandate(
        &self,
        session: &CheckoutSession,
        issuer_did: &str,
    ) -> Result<CartMandate> {
        // Convert ACP line items to AP2 cart items
        let items: Vec<Ap2CartItem> = session.line_items
            .iter()
            .map(|line_item| Ap2CartItem {
                id: line_item.item.id.clone(),
                name: line_item.id.clone(),
                quantity: line_item.item.quantity,
                unit_price: line_item.base_amount as u64,
                total_price: line_item.total as u64,
                metadata: HashMap::new(),
            })
            .collect();

        // Calculate total from ACP totals
        let total_amount = session.totals
            .iter()
            .find(|t| matches!(t.r#type, TotalType::Total))
            .map(|t| t.amount as u64)
            .unwrap_or(0);

        // Create AP2 mandate
        let mut mandate = CartMandate::new(
            issuer_did.to_string(),
            items,
            total_amount,
            session.currency.clone(),
        );

        // Add ACP-specific metadata
        mandate.metadata.insert(
            "acp_session_id".to_string(),
            session.id.clone(),
        );

        // Map fulfillment address
        if let Some(addr) = &session.fulfillment_address {
            mandate.metadata.insert(
                "fulfillment_address".to_string(),
                serde_json::to_string(addr)?,
            );
        }

        Ok(mandate)
    }

    /// Convert AP2 CartMandate to ACP CheckoutSession
    pub fn to_checkout_session(
        &self,
        mandate: &CartMandate,
    ) -> Result<CheckoutSession> {
        // Convert AP2 cart items to ACP line items
        let line_items: Vec<LineItem> = mandate.items
            .iter()
            .map(|item| {
                LineItem {
                    id: format!("li_{}", Uuid::new_v4()),
                    item: Item {
                        id: item.id.clone(),
                        quantity: item.quantity,
                    },
                    base_amount: item.unit_price as i64,
                    discount: 0,
                    subtotal: item.total_price as i64,
                    tax: 0,
                    total: item.total_price as i64,
                }
            })
            .collect();

        // Create ACP session
        let session = CheckoutSession {
            id: format!("csn_{}", Uuid::new_v4()),
            buyer: None,
            payment_provider: None,
            status: CheckoutStatus::NotReadyForPayment,
            currency: mandate.currency.clone(),
            line_items,
            fulfillment_address: None, // Parse from mandate.metadata if present
            fulfillment_options: vec![],
            fulfillment_option_id: None,
            totals: vec![
                Total {
                    r#type: TotalType::Total,
                    display_text: "Total".to_string(),
                    amount: mandate.total_amount as i64,
                }
            ],
            messages: vec![],
            links: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        Ok(session)
    }
}
```

### 6.2 Identity Bridge

```rust
// src/acp/bridge/identity_bridge.rs
use crate::ap2::{AgentIdentity, DidResolver};

pub struct IdentityBridge {
    did_resolver: Arc<DidResolver>,
}

impl IdentityBridge {
    /// Resolve HTTP Bearer token to AP2 DID
    pub async fn resolve_bearer_to_did(
        &self,
        bearer_token: &str,
    ) -> Result<AgentIdentity> {
        // Look up token in agent registry
        let agent_record = self.token_registry
            .get_agent_by_token(bearer_token)
            .await?;

        // Return AP2 identity
        Ok(AgentIdentity::new(
            agent_record.did,
            agent_record.public_key,
        ))
    }

    /// Create HTTP Bearer token from AP2 DID
    pub async fn create_bearer_from_did(
        &self,
        agent_identity: &AgentIdentity,
    ) -> Result<String> {
        // Generate secure token
        let token = self.token_generator.generate()?;

        // Store mapping
        self.token_registry
            .register_token(
                &token,
                &agent_identity.did,
                &agent_identity.public_key,
            )
            .await?;

        Ok(format!("Bearer {}", token))
    }

    /// Verify that ACP request is from authorized AP2 agent
    pub async fn verify_cross_protocol_auth(
        &self,
        bearer_token: &str,
        required_did: &str,
    ) -> Result<bool> {
        let agent = self.resolve_bearer_to_did(bearer_token).await?;
        Ok(agent.did == required_did)
    }
}
```

---

## 7. WASM Implementation

### 7.1 Recommended Crates

```toml
[dependencies]
# Web framework with WASM support
axum-wasm = { version = "0.1", optional = true }  # axum fork for WASM

# Async runtime (WASM-compatible)
wasm-bindgen = { version = "0.2", optional = true }
wasm-bindgen-futures = { version = "0.4", optional = true }
js-sys = { version = "0.3", optional = true }
web-sys = { version = "0.3", features = ["Window", "Request", "Response", "Headers"], optional = true }

# Serialization for WASM
serde-wasm-bindgen = { version = "0.6", optional = true }

# Random number generation (WASM)
getrandom = { version = "0.2", features = ["js"] }

# HTTP client for WASM
reqwest = { version = "0.12", features = ["json", "wasm"], optional = true }

# WASM utilities
console_error_panic_hook = { version = "0.1", optional = true }
console_log = { version = "1.0", optional = true }
wasm-logger = { version = "0.2", optional = true }

[features]
wasm = [
    "dep:axum-wasm",
    "dep:wasm-bindgen",
    "dep:wasm-bindgen-futures",
    "dep:js-sys",
    "dep:web-sys",
    "dep:serde-wasm-bindgen",
    "dep:reqwest",
    "dep:console_error_panic_hook",
    "dep:console_log",
    "dep:wasm-logger",
]
```

### 7.2 WASM Bindings

```rust
// src/wasm/bindings.rs (Extended)
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

// Existing AP2 WASM exports (unchanged)
#[wasm_bindgen]
pub struct WasmAgentIdentity { /* ... */ }

#[wasm_bindgen]
pub async fn verify_signature(
    signature: &[u8],
    message: &[u8],
    public_key: &[u8],
) -> Result<bool, JsValue> {
    // Existing implementation
}

// NEW: ACP WASM exports
#[wasm_bindgen]
pub struct WasmCheckoutSession {
    inner: CheckoutSession,
}

#[wasm_bindgen]
impl WasmCheckoutSession {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: CheckoutSession::default(),
        }
    }

    #[wasm_bindgen(js_name = addLineItem)]
    pub fn add_line_item(&mut self, item_id: String, quantity: u32, price: i64) {
        let line_item = LineItem {
            id: format!("li_{}", Uuid::new_v4()),
            item: Item { id: item_id, quantity },
            base_amount: price,
            discount: 0,
            subtotal: price * quantity as i64,
            tax: 0,
            total: price * quantity as i64,
        };
        self.inner.line_items.push(line_item);
    }

    #[wasm_bindgen(js_name = getTotal)]
    pub fn get_total(&self) -> i64 {
        self.inner.line_items.iter().map(|li| li.total).sum()
    }

    #[wasm_bindgen(js_name = toJson)]
    pub fn to_json(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.inner)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

#[wasm_bindgen(js_name = createCheckoutSession)]
pub async fn create_checkout_session(
    api_url: String,
    bearer_token: String,
    items_json: JsValue,
) -> Result<JsValue, JsValue> {
    use wasm_bindgen_futures::JsFuture;

    // Deserialize items
    let items: Vec<Item> = serde_wasm_bindgen::from_value(items_json)?;

    // Create request
    let request = CheckoutSessionCreateRequest {
        buyer: None,
        items,
        fulfillment_address: None,
    };

    // Make HTTP request using web-sys
    let mut opts = web_sys::RequestInit::new();
    opts.method("POST");
    opts.mode(web_sys::RequestMode::Cors);

    let url = format!("{}/checkout_sessions", api_url);
    let request_obj = web_sys::Request::new_with_str_and_init(&url, &opts)?;

    // Add headers
    request_obj.headers().set("Authorization", &format!("Bearer {}", bearer_token))?;
    request_obj.headers().set("Content-Type", "application/json")?;

    // Fetch
    let window = web_sys::window().unwrap();
    let resp_value = JsFuture::from(window.fetch_with_request(&request_obj)).await?;

    // Parse response
    let resp: web_sys::Response = resp_value.dyn_into()?;
    let json = JsFuture::from(resp.json()?).await?;

    Ok(json)
}

#[wasm_bindgen(js_name = delegatePayment)]
pub async fn delegate_payment(
    api_url: String,
    bearer_token: String,
    payment_method_json: JsValue,
    allowance_json: JsValue,
) -> Result<JsValue, JsValue> {
    // Similar implementation for delegate_payment endpoint
    // ...
}
```

### 7.3 JavaScript Usage Example

```javascript
// Browser usage
import init, {
    WasmAgentIdentity,
    WasmCheckoutSession,
    createCheckoutSession,
    delegatePayment,
    verify_signature
} from './pkg/agentic_payments.js';

await init();

// AP2: Agent identity and signatures
const agent = new WasmAgentIdentity();
const message = new TextEncoder().encode("Purchase approved");
const signature = agent.sign(message);
const valid = await verify_signature(signature, message, agent.publicKey());
console.log("AP2 Signature valid:", valid);

// ACP: Create checkout session
const session = new WasmCheckoutSession();
session.addLineItem("item_123", 2, 1999); // 2x $19.99
session.addLineItem("item_456", 1, 4999); // 1x $49.99
console.log("Total:", session.getTotal() / 100, "USD");

// ACP: REST API call
const response = await createCheckoutSession(
    "https://merchant.example.com",
    "api_key_abc123",
    [
        { id: "item_123", quantity: 2 },
        { id: "item_456", quantity: 1 },
    ]
);
console.log("Checkout session created:", response.id);

// ACP: Delegate payment
const paymentToken = await delegatePayment(
    "https://merchant.example.com",
    "api_key_abc123",
    {
        type: "card",
        card_number_type: "fpan",
        number: "4242424242424242",
        exp_month: "12",
        exp_year: "2025",
        cvc: "123",
        display_card_funding_type: "credit",
        display_brand: "visa",
        display_last4: "4242",
        metadata: {}
    },
    {
        reason: "one_time",
        max_amount: 10000,
        currency: "usd",
        checkout_session_id: response.id,
        merchant_id: "merchant_123",
        expires_at: "2025-10-01T00:00:00Z"
    }
);
console.log("Payment token:", paymentToken.id);
```

---

## 8. Data Model Mapping

### 8.1 AP2 → ACP Mappings

| AP2 Concept | ACP Equivalent | Transformation |
|-------------|----------------|----------------|
| `IntentMandate` | Not directly mapped | AP2-specific user authorization |
| `CartMandate` | `CheckoutSession` | Bridge via `MandateAdapter::to_checkout_session()` |
| `CartItem` | `LineItem` | Convert price formats (u64 → i64) |
| `PaymentMandate` | `DelegatePaymentRequest` | Bridge via `PaymentAdapter::to_delegate_payment()` |
| `AgentIdentity.did` | HTTP `Bearer` token | Bridge via `IdentityBridge::create_bearer_from_did()` |
| `VerifiableCredential` | HTTP `Signature` header | Ed25519 signature in base64 |
| BFT `ConsensusVerification` | Optional for high-value ACP transactions | Use for amounts > $10k |

### 8.2 Shared Concepts

| Concept | AP2 Implementation | ACP Usage |
|---------|-------------------|-----------|
| **Ed25519 Signatures** | `VerifiableCredential.proof` | HTTP `Signature` header |
| **Agent Pool** | `AgentPool` with 6 agent types | Same agents verify ACP requests |
| **BFT Consensus** | Mandatory for all AP2 operations | Optional for high-value ACP checkouts |
| **Trust Chain** | `TrustChainValidator` DFS traversal | Merchant certificate validation |
| **Fraud Detection** | `AnomalyDetectionAgent` statistics | Risk signals in `DelegatePaymentRequest` |
| **Recovery** | `RecoveryAgent` auto-respawn | Same self-healing for ACP handlers |

---

## 9. Error Handling

### 9.1 Unified Error Types

```rust
// src/error/mod.rs (Extended)
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    // Existing AP2 errors (unchanged)
    #[error("AP2: {0}")]
    Ap2(#[from] Ap2Error),

    // NEW: ACP errors
    #[error("ACP: {0}")]
    Acp(#[from] AcpError),

    // Shared errors
    #[error("Authentication failed")]
    AuthenticationFailed,

    #[error("Consensus verification failed")]
    ConsensusRejected(ConsensusVerification),

    #[error("Unsupported protocol: {0}")]
    UnsupportedProtocol(String),

    #[error("Protocol routing error: {0}")]
    RoutingError(String),

    // WASM-specific errors
    #[cfg(target_arch = "wasm32")]
    #[error("WASM error: {0}")]
    WasmError(String),
}

// src/acp/models/error.rs
#[derive(Debug, Error, Serialize, Deserialize)]
pub enum AcpError {
    #[error("Invalid request: {message}")]
    InvalidRequest {
        code: String,
        message: String,
        param: Option<String>,
    },

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session already completed")]
    SessionCompleted,

    #[error("Session not ready for payment")]
    NotReadyForPayment,

    #[error("Payment declined: {0}")]
    PaymentDeclined(String),

    #[error("Idempotency conflict")]
    IdempotencyConflict,

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Service unavailable")]
    ServiceUnavailable,
}

impl AcpError {
    /// Convert to OpenAPI error response
    pub fn to_error_response(&self) -> ErrorResponse {
        match self {
            Self::InvalidRequest { code, message, param } => ErrorResponse {
                r#type: "invalid_request".to_string(),
                code: code.clone(),
                message: message.clone(),
                param: param.clone(),
            },
            Self::SessionNotFound(id) => ErrorResponse {
                r#type: "invalid_request".to_string(),
                code: "session_not_found".to_string(),
                message: format!("Checkout session not found: {}", id),
                param: Some("checkout_session_id".to_string()),
            },
            // ... other mappings
        }
    }

    /// HTTP status code for this error
    pub fn status_code(&self) -> StatusCode {
        match self {
            Self::InvalidRequest { .. } => StatusCode::BAD_REQUEST,
            Self::SessionNotFound(_) => StatusCode::NOT_FOUND,
            Self::SessionCompleted => StatusCode::METHOD_NOT_ALLOWED,
            Self::IdempotencyConflict => StatusCode::CONFLICT,
            Self::RateLimitExceeded => StatusCode::TOO_MANY_REQUESTS,
            Self::ServiceUnavailable => StatusCode::SERVICE_UNAVAILABLE,
            _ => StatusCode::BAD_REQUEST,
        }
    }
}
```

---

## 10. Testing Strategy

### 10.1 AP2 Tests (Existing - Unchanged)

**Status**: 112/112 tests passing

**Coverage**:
- Unit tests for all agent types
- Integration tests for BFT consensus
- End-to-end AP2 workflow tests
- WASM binding tests

**No changes required** - all existing tests continue to pass.

### 10.2 ACP Tests (New)

```rust
// tests/acp_integration_tests.rs
#[cfg(test)]
mod acp_tests {
    use super::*;

    #[tokio::test]
    async fn test_create_checkout_session() {
        let handler = setup_checkout_handler().await;

        let request = CheckoutSessionCreateRequest {
            buyer: None,
            items: vec![
                Item { id: "item_123".to_string(), quantity: 2 }
            ],
            fulfillment_address: None,
        };

        let response = handler.create_session(request).await.unwrap();

        assert_eq!(response.status, CheckoutStatus::NotReadyForPayment);
        assert_eq!(response.line_items.len(), 1);
    }

    #[tokio::test]
    async fn test_complete_session_with_payment() {
        // Test full checkout flow
    }

    #[tokio::test]
    async fn test_delegate_payment_with_allowance() {
        // Test payment tokenization
    }

    #[tokio::test]
    async fn test_idempotency_key_handling() {
        // Test idempotent POST requests
    }

    #[tokio::test]
    async fn test_signature_verification() {
        // Test Ed25519 signature in HTTP header
    }
}
```

### 10.3 Bridge Tests (New)

```rust
// tests/bridge_integration_tests.rs
#[cfg(test)]
mod bridge_tests {
    use super::*;

    #[tokio::test]
    async fn test_cart_mandate_to_checkout_session() {
        let adapter = MandateAdapter::new();

        // Create AP2 CartMandate
        let items = vec![
            Ap2CartItem::new("item_123".to_string(), "Product A".to_string(), 2, 1999)
        ];
        let mandate = CartMandate::new(
            "did:example:user123".to_string(),
            items,
            3998,
            "USD".to_string(),
        );

        // Convert to ACP CheckoutSession
        let session = adapter.to_checkout_session(&mandate).unwrap();

        assert_eq!(session.line_items.len(), 1);
        assert_eq!(session.currency, "USD");
        assert_eq!(session.line_items[0].total, 3998);
    }

    #[tokio::test]
    async fn test_checkout_session_to_cart_mandate() {
        // Test reverse conversion
    }

    #[tokio::test]
    async fn test_bearer_token_to_did_resolution() {
        let bridge = IdentityBridge::new();

        // Create AP2 identity
        let agent = AgentIdentity::generate().unwrap();

        // Get bearer token
        let token = bridge.create_bearer_from_did(&agent).await.unwrap();

        // Resolve back to DID
        let resolved = bridge.resolve_bearer_to_did(&token).await.unwrap();

        assert_eq!(resolved.did, agent.did);
    }

    #[tokio::test]
    async fn test_high_value_checkout_uses_bft() {
        // Test that $10k+ checkouts trigger BFT consensus
        let service = setup_checkout_service().await;

        let session = create_high_value_session(15_000_00).await; // $15,000

        // Should use BFT consensus
        let result = service.complete_with_consensus(
            &session.id,
            mock_payment_data(),
            &mock_context(),
        ).await;

        assert!(result.is_ok());
        // Verify consensus was actually executed
    }
}
```

### 10.4 WASM Tests

```rust
// tests/wasm_tests.rs
#[cfg(target_arch = "wasm32")]
#[cfg(test)]
mod wasm_tests {
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    async fn test_wasm_checkout_session_creation() {
        let session = WasmCheckoutSession::new();
        session.add_line_item("item_123".to_string(), 2, 1999);

        assert_eq!(session.get_total(), 3998);
    }

    #[wasm_bindgen_test]
    async fn test_wasm_create_checkout_api_call() {
        // Test REST API call from WASM
        let response = create_checkout_session(
            "https://test-merchant.example.com".to_string(),
            "test_token".to_string(),
            serde_wasm_bindgen::to_value(&vec![
                Item { id: "item_123".to_string(), quantity: 1 }
            ]).unwrap(),
        ).await;

        assert!(response.is_ok());
    }
}
```

---

## 11. Example Usage Patterns

### 11.1 Pure AP2 Usage (Unchanged)

```rust
use agentic_payments::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize AP2 system
    let system = AgenticVerificationSystem::builder()
        .pool_size(5)
        .consensus_threshold(0.67)
        .build()
        .await?;

    // Create agent identity
    let agent = AgentIdentity::generate()?;

    // Sign message
    let message = b"Autonomous payment authorization";
    let signature = agent.sign(message)?;

    // Verify with BFT consensus
    let result = system.verify_with_consensus(
        signature,
        message,
        agent.verifying_key()
    ).await?;

    assert!(result.is_valid());
    Ok(())
}
```

### 11.2 Pure ACP Usage

```rust
use agentic_payments::acp::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize ACP router
    let router = AcpRouter::new()
        .with_checkout_handler(CheckoutHandler::new())
        .with_payment_handler(DelegatePaymentHandler::new())
        .build();

    // Create checkout session
    let request = CheckoutSessionCreateRequest {
        buyer: Some(Buyer {
            first_name: "Jane".to_string(),
            last_name: "Doe".to_string(),
            email: "jane@example.com".to_string(),
            phone_number: None,
        }),
        items: vec![
            Item { id: "prod_123".to_string(), quantity: 2 }
        ],
        fulfillment_address: None,
    };

    let session = router.create_checkout_session(request).await?;
    println!("Session created: {}", session.id);

    // Complete checkout
    let payment_data = PaymentData {
        token: "vt_abc123".to_string(),
        provider: "stripe".to_string(),
        billing_address: None,
    };

    let result = router.complete_checkout_session(
        &session.id,
        payment_data,
    ).await?;

    println!("Order created: {}", result.order.id);
    Ok(())
}
```

### 11.3 Hybrid AP2 + ACP Usage

```rust
use agentic_payments::{ap2::prelude::*, acp::prelude::*};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize dual-protocol router
    let router = ProtocolRouter::new()
        .register_handler(Arc::new(Ap2Handler::new()))
        .register_handler(Arc::new(AcpHandler::new()))
        .build();

    // Scenario: User creates AP2 mandate, agent uses ACP for checkout

    // 1. User creates intent mandate (AP2)
    let user = AgentIdentity::generate()?;
    let shopping_agent = AgentIdentity::generate()?;

    let intent_mandate = IntentMandate::new(
        user.did().to_string(),
        shopping_agent.did().to_string(),
        "Weekly grocery shopping up to $200".to_string(),
    )
    .with_constraint("max_amount", json!(20000)) // cents
    .with_constraint("category", json!("groceries"));

    // 2. Shopping agent builds cart (ACP)
    let checkout_request = CheckoutSessionCreateRequest {
        buyer: None,
        items: vec![
            Item { id: "groceries_001".to_string(), quantity: 1 },
            Item { id: "groceries_002".to_string(), quantity: 2 },
        ],
        fulfillment_address: Some(Address {
            name: "Jane Doe".to_string(),
            line_one: "123 Main St".to_string(),
            line_two: None,
            city: "San Francisco".to_string(),
            state: "CA".to_string(),
            country: "US".to_string(),
            postal_code: "94102".to_string(),
        }),
    };

    let session = router.create_checkout_session(checkout_request).await?;

    // 3. Bridge: Convert ACP session to AP2 cart mandate for validation
    let bridge = MandateAdapter::new();
    let cart_mandate = bridge.to_cart_mandate(&session, user.did())?;

    // 4. Validate cart against intent mandate (AP2 BFT consensus)
    let system = AgenticVerificationSystem::builder()
        .pool_size(5)
        .build()
        .await?;

    let validation = system.verify_cart_against_intent(
        &intent_mandate,
        &cart_mandate,
        user.verifying_key(),
    ).await?;

    if !validation.is_valid() {
        return Err(Error::MandateViolation("Cart exceeds spending limit".to_string()));
    }

    // 5. Complete checkout (ACP)
    let payment_data = PaymentData {
        token: "vt_delegated_payment_token".to_string(),
        provider: "stripe".to_string(),
        billing_address: None,
    };

    let result = router.complete_checkout_session(
        &session.id,
        payment_data,
    ).await?;

    println!("Purchase complete! Order: {}", result.order.id);
    println!("Verified by {} agents", validation.total_votes);

    Ok(())
}
```

---

## 12. Migration Path

### Phase 1: Foundation (Week 1)

**Goal**: Add ACP infrastructure without breaking AP2

**Tasks**:
1. Create `src/router/` module with protocol dispatcher
2. Create `src/acp/` module structure (handlers, models, services)
3. Add axum-wasm and WASM dependencies to Cargo.toml
4. Implement `ProtocolHandler` trait for AP2 (wrapper around existing code)
5. **Test**: All 112 AP2 tests still pass

**Success Criteria**: No breaking changes, AP2 fully functional

### Phase 2: ACP Core (Week 2)

**Goal**: Implement ACP REST endpoints

**Tasks**:
1. Implement ACP models (CheckoutSession, LineItem, etc.) from OpenAPI spec
2. Implement CheckoutHandler with 5 endpoints
3. Implement DelegatePaymentHandler
4. Add idempotency middleware
5. Add Ed25519 signature verification for HTTP headers
6. Write 50+ ACP integration tests

**Success Criteria**: ACP endpoints functional, 50+ tests passing

### Phase 3: Bridge Layer (Week 3)

**Goal**: Enable AP2 ↔ ACP interoperability

**Tasks**:
1. Implement MandateAdapter (CartMandate ↔ CheckoutSession)
2. Implement PaymentAdapter (PaymentMandate ↔ DelegatePayment)
3. Implement IdentityBridge (DID ↔ Bearer tokens)
4. Add BFT consensus for high-value ACP checkouts
5. Write 30+ bridge integration tests

**Success Criteria**: Both protocols work together seamlessly

### Phase 4: WASM Support (Week 4)

**Goal**: Full browser and Node.js support

**Tasks**:
1. Extend WASM bindings for ACP types
2. Implement `createCheckoutSession()` and `delegatePayment()` WASM exports
3. Test in browser with web-sys fetch
4. Test in Node.js with wasm-pack target nodejs
5. Write comprehensive WASM examples

**Success Criteria**: Both protocols fully functional in WASM

### Phase 5: Documentation & Release (Week 5)

**Goal**: Production-ready release

**Tasks**:
1. Complete API documentation
2. Write migration guide for existing AP2 users
3. Create example applications (pure AP2, pure ACP, hybrid)
4. Performance benchmarks (AP2 vs ACP vs hybrid)
5. Security audit of bridge layer

**Success Criteria**: Production-ready, documented, benchmarked

---

## 13. Performance Considerations

### 13.1 Latency Targets

| Operation | AP2 Latency | ACP Latency | Notes |
|-----------|-------------|-------------|-------|
| Single signature verification | <1ms | <1ms | Same Ed25519 implementation |
| BFT consensus (5 agents) | <30ms | Optional | ACP only for high-value |
| REST endpoint (create session) | N/A | <50ms | Includes validation |
| REST endpoint (complete) | N/A | <100ms | Includes payment processing |
| Bridge conversion | N/A | <5ms | Pure data transformation |

### 13.2 Throughput Targets

| Metric | Target | Configuration |
|--------|--------|---------------|
| AP2 verifications/sec | 10,000+ | 100-agent pool |
| ACP sessions/sec | 5,000+ | 50-agent pool |
| Hybrid operations/sec | 3,000+ | BFT + REST overhead |

### 13.3 Optimization Strategies

1. **Shared Agent Pool**: Both protocols use the same agent infrastructure
2. **Lazy BFT**: ACP only uses consensus for high-value transactions
3. **Caching**: Idempotency cache for ACP, DID cache for AP2
4. **Batch Operations**: Process multiple ACP sessions in parallel
5. **WASM SIMD**: Use WebAssembly SIMD for Ed25519 operations

---

## 14. Security Considerations

### 14.1 Shared Security Model

Both protocols share:
- **Ed25519 cryptography** - Same signature verification
- **BFT consensus** - Byzantine fault tolerance
- **Key management** - Unified key lifecycle
- **Anomaly detection** - Statistical fraud detection

### 14.2 ACP-Specific Security

1. **Idempotency Keys**: Prevent duplicate transactions
2. **Rate Limiting**: Protect against DoS attacks
3. **Signature Headers**: Ed25519 signatures in HTTP headers
4. **Allowance Constraints**: Enforce spending limits in payment delegation
5. **Risk Signals**: Fraud detection in delegate_payment

### 14.3 Bridge Security

1. **Token Registry**: Secure mapping between DIDs and Bearer tokens
2. **Cross-Protocol Auth**: Verify that ACP requests come from authorized AP2 agents
3. **Mandate Validation**: Ensure ACP sessions comply with AP2 intent mandates
4. **Audit Trail**: Log all bridge operations for compliance

---

## 15. Monitoring & Observability

### 15.1 Metrics

```rust
// src/router/metrics.rs
pub struct MetricsCollector {
    // Protocol-specific counters
    ap2_requests: Counter,
    acp_requests: Counter,
    bridge_operations: Counter,

    // Latency histograms
    ap2_latency: Histogram,
    acp_latency: Histogram,
    bridge_latency: Histogram,

    // Error rates
    ap2_errors: Counter,
    acp_errors: Counter,

    // Consensus metrics
    bft_consensus_requests: Counter,
    bft_consensus_latency: Histogram,
}

impl MetricsCollector {
    pub fn record_request(&self, protocol_id: &str, request: &ProtocolRequest) {
        match protocol_id {
            "ap2" => self.ap2_requests.inc(),
            "acp" => self.acp_requests.inc(),
            _ => {}
        }
    }

    pub fn record_response(&self, protocol_id: &str, response: &ProtocolResponse) {
        let latency = response.metadata.duration_ms;

        match protocol_id {
            "ap2" => self.ap2_latency.observe(latency),
            "acp" => self.acp_latency.observe(latency),
            _ => {}
        }
    }

    pub fn record_bridge_operation(&self, operation: &str, duration_ms: f64) {
        self.bridge_operations.inc();
        self.bridge_latency.observe(duration_ms);
    }
}
```

### 15.2 Logging

```rust
use tracing::{info, warn, error, instrument};

#[instrument(skip(self, request))]
pub async fn route(&self, request: ProtocolRequest) -> Result<ProtocolResponse> {
    info!(
        protocol = %self.detect_protocol(&request)?,
        request_id = %request.id,
        "Routing protocol request"
    );

    // ... routing logic ...

    if let Err(e) = &result {
        error!(
            error = %e,
            protocol = %protocol_id,
            "Protocol request failed"
        );
    }

    result
}
```

---

## 16. Recommended Rust Crates

### 16.1 Core Dependencies

| Crate | Version | Purpose | WASM Compatible |
|-------|---------|---------|-----------------|
| `ed25519-dalek` | 2.1 | Ed25519 signatures | ✅ Yes |
| `tokio` | 1.35 | Async runtime | ❌ No (use wasm-bindgen-futures) |
| `serde` | 1.0 | Serialization | ✅ Yes |
| `serde_json` | 1.0 | JSON handling | ✅ Yes |
| `uuid` | 1.6 | ID generation | ✅ Yes (with "js" feature) |
| `chrono` | 0.4 | Date/time | ✅ Yes |

### 16.2 Web Framework

| Crate | Version | Purpose | WASM Compatible |
|-------|---------|---------|-----------------|
| `axum-wasm` | 0.1 | REST framework for WASM | ✅ Yes |
| `tower` | 0.4 | Middleware | ✅ Yes |
| `tower-http` | 0.5 | HTTP middleware | ✅ Yes |

### 16.3 WASM Bindings

| Crate | Version | Purpose | Required Feature |
|-------|---------|---------|------------------|
| `wasm-bindgen` | 0.2 | JS interop | "wasm" |
| `wasm-bindgen-futures` | 0.4 | Async JS interop | "wasm" |
| `js-sys` | 0.3 | JavaScript types | "wasm" |
| `web-sys` | 0.3 | Web APIs | "wasm" |
| `serde-wasm-bindgen` | 0.6 | Serde ↔ JS | "wasm" |

### 16.4 Storage & Caching

| Crate | Version | Purpose | WASM Compatible |
|-------|---------|---------|-----------------|
| `dashmap` | 5.5 | Concurrent HashMap | ✅ Yes |
| `parking_lot` | 0.12 | Faster locks | ✅ Yes |
| `lru` | 0.12 | LRU cache | ✅ Yes |

### 16.5 Observability

| Crate | Version | Purpose | WASM Compatible |
|-------|---------|---------|-----------------|
| `tracing` | 0.1 | Structured logging | ✅ Yes |
| `metrics` | 0.21 | Metrics collection | ✅ Yes |
| `wasm-logger` | 0.2 | WASM console logging | ✅ Yes |

---

## 17. Deployment Architectures

### 17.1 Native Server Deployment

```
┌─────────────────────────────────────────┐
│         Load Balancer (nginx)           │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐      ┌───────▼───┐
│ AP2    │      │ ACP       │
│ Server │      │ Server    │
│ (Rust) │      │ (Rust)    │
└───┬────┘      └───────┬───┘
    │                   │
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  Agent Pool (5-100)│
    │  - Verification    │
    │  - Trust Chain     │
    │  - Anomaly Det     │
    │  - Recovery        │
    └────────────────────┘
```

### 17.2 WASM Browser Deployment

```
┌─────────────────────────────────────────┐
│        Browser (Chrome/Safari)          │
├─────────────────────────────────────────┤
│  JavaScript Runtime                     │
│  ┌──────────────────────────────────┐   │
│  │  agentic-payments.wasm           │   │
│  │  - AP2 bindings (signatures)     │   │
│  │  - ACP bindings (REST calls)     │   │
│  │  - Shared crypto (Ed25519)       │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────▼───────────────────┐   │
│  │  Web APIs (fetch, crypto)        │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
                  │
                  │ HTTPS
                  ▼
        ┌─────────────────┐
        │  Merchant API   │
        │  (ACP endpoints)│
        └─────────────────┘
```

### 17.3 Hybrid Deployment (Edge Functions)

```
┌─────────────────────────────────────────┐
│     Cloudflare Workers / Vercel Edge    │
├─────────────────────────────────────────┤
│  WASM Runtime                           │
│  ┌──────────────────────────────────┐   │
│  │  agentic-payments.wasm           │   │
│  │  - Lightweight signature checks  │   │
│  │  - Basic ACP validation          │   │
│  └──────────────┬───────────────────┘   │
└─────────────────┼───────────────────────┘
                  │
                  │ Proxy to backend for BFT
                  ▼
        ┌─────────────────┐
        │  Backend Server │
        │  - Full AP2/ACP │
        │  - BFT Consensus│
        │  - Agent Pool   │
        └─────────────────┘
```

---

## 18. Conclusion

This architecture enables **seamless integration** of AP2 and ACP protocols while maintaining:

1. **Zero Breaking Changes**: All 112 AP2 tests continue to pass
2. **Shared Infrastructure**: Both protocols use the same Ed25519, BFT, and agent pool
3. **WASM Compatibility**: Full browser and Node.js support
4. **Production Readiness**: Enterprise-grade error handling, idempotency, and observability
5. **Performance**: 10,000+ tx/sec with sub-50ms latency
6. **Security**: Byzantine fault tolerance, fraud detection, audit trails

### Next Steps

1. Review this architecture with stakeholders
2. Begin Phase 1 implementation (Protocol Router)
3. Set up CI/CD pipeline for dual-protocol testing
4. Coordinate with agentic-catalog SDK team for integration

---

**Document Status**: ✅ READY FOR IMPLEMENTATION
**Estimated Effort**: 5 weeks (1 week per phase)
**Risk Level**: LOW (zero breaking changes, incremental approach)