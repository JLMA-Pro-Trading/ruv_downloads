# AP2 + ACP Dual-Protocol Quick Start

## Overview

This quick start guide summarizes the dual-protocol architecture for integrating **AP2 (Agent Payments Protocol)** and **ACP (Agentic Commerce Protocol)** in the `agentic-payments` crate.

**Full Architecture**: See [dual-protocol-architecture.md](./dual-protocol-architecture.md) (1,973 lines)

---

## Key Principles

1. ✅ **Zero Breaking Changes** - All 112 AP2 tests continue to pass
2. 🔄 **Shared Infrastructure** - Both protocols use same Ed25519, BFT, agents
3. 🌐 **WASM Compatible** - Full browser and Node.js support
4. 🔒 **Production Ready** - Enterprise-grade security and observability
5. ⚡ **High Performance** - 10,000+ tx/sec, <50ms latency

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                   Protocol Router                           │
│              (trait-based dispatch)                         │
├──────────────────────────┬──────────────────────────────────┤
│    AP2 Protocol          │    ACP Protocol                  │
│    (Existing)            │    (New REST API)                │
│  - DIDs/VCs              │  - Checkout Sessions             │
│  - Mandates              │  - Payment Delegates             │
│  - BFT Consensus         │  - REST Handlers                 │
├──────────────────────────┴──────────────────────────────────┤
│           Shared Infrastructure Layer                       │
│  - Ed25519 Crypto  - BFT Consensus  - Agent Pool           │
│  - Trust Chain     - Fraud Detection - Recovery            │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
src/
├── router/                 # NEW: Protocol routing layer
│   ├── protocol.rs         # ProtocolHandler trait
│   ├── auth.rs             # Shared Ed25519 auth
│   └── metrics.rs          # Observability
│
├── ap2/                    # EXISTING: No changes
│   ├── credentials.rs      # W3C VCs
│   ├── did.rs              # Decentralized IDs
│   ├── mandates.rs         # Intent/Cart/Payment
│   └── verification.rs     # BFT consensus
│
├── acp/                    # NEW: ACP implementation
│   ├── handlers/           # REST endpoints
│   │   ├── checkout.rs     # 5 checkout endpoints
│   │   └── delegate_payment.rs
│   ├── models/             # OpenAPI schemas
│   ├── services/           # Business logic
│   ├── storage/            # State persistence
│   └── bridge/             # AP2 ↔ ACP interop
│
└── agents/                 # SHARED: Used by both
    ├── verification.rs     # Parallel Ed25519
    ├── trust_chain.rs      # Certificate validation
    └── anomaly.rs          # Fraud detection
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Create `router/` module
- Implement `ProtocolHandler` trait
- Wrap existing AP2 in handler
- **Verify**: All 112 AP2 tests pass

### Phase 2: ACP Core (Week 2)
- Implement ACP models from OpenAPI
- Implement 5 checkout endpoints
- Add delegate_payment endpoint
- Write 50+ ACP tests

### Phase 3: Bridge Layer (Week 3)
- CartMandate ↔ CheckoutSession adapter
- DID ↔ Bearer token bridge
- BFT consensus for high-value ACP
- Write 30+ bridge tests

### Phase 4: WASM Support (Week 4)
- Extend WASM bindings for ACP
- Test in browser and Node.js
- WASM example applications

### Phase 5: Production (Week 5)
- Documentation and examples
- Performance benchmarks
- Security audit
- Release 1.0.0

---

## Key Design Decisions

### 1. Protocol Routing

```rust
pub trait ProtocolHandler: Send + Sync {
    fn protocol_id(&self) -> &'static str;
    async fn handle_request(
        &self,
        request: ProtocolRequest,
        context: ProtocolContext,
    ) -> Result<ProtocolResponse>;
}
```

**Detection Logic**:
- ACP: Paths start with `/checkout_sessions` or `/agentic_commerce`
- AP2: Has `X-AP2-Version` header or DID-based auth

### 2. Shared Cryptography

Both protocols use **identical Ed25519 implementation**:
- AP2: Signatures in VerifiableCredential proofs
- ACP: Signatures in HTTP `Signature` header

### 3. Optional BFT for ACP

```rust
// ACP uses BFT only for high-value transactions
if session.total_amount() > 1_000_000 { // > $10k
    let verification = context.verification_workflow
        .verify_with_consensus(/* ... */)
        .await?;
}
```

### 4. Data Model Bridge

| AP2 Concept | ACP Equivalent | Transformation |
|-------------|----------------|----------------|
| `CartMandate` | `CheckoutSession` | `MandateAdapter::to_checkout_session()` |
| `AgentIdentity.did` | HTTP Bearer token | `IdentityBridge::create_bearer_from_did()` |
| BFT Consensus | Optional (high-value) | Threshold-based triggering |

---

## Code Examples

### Pure AP2 (Unchanged)

```rust
use agentic_payments::prelude::*;

let system = AgenticVerificationSystem::builder()
    .pool_size(5)
    .consensus_threshold(0.67)
    .build()
    .await?;

let agent = AgentIdentity::generate()?;
let signature = agent.sign(b"message")?;
let result = system.verify_with_consensus(
    signature, b"message", agent.verifying_key()
).await?;
```

### Pure ACP (New)

```rust
use agentic_payments::acp::prelude::*;

let router = AcpRouter::new().build();

let session = router.create_checkout_session(
    CheckoutSessionCreateRequest {
        items: vec![Item { id: "prod_123", quantity: 2 }],
        ..Default::default()
    }
).await?;

let result = router.complete_checkout_session(
    &session.id,
    PaymentData { token: "vt_abc", provider: "stripe" }
).await?;
```

### Hybrid AP2 + ACP

```rust
// 1. User creates intent mandate (AP2)
let intent = IntentMandate::new(/* ... */);

// 2. Agent creates checkout (ACP)
let session = router.create_checkout_session(/* ... */).await?;

// 3. Bridge: Validate ACP against AP2 mandate
let cart_mandate = bridge.to_cart_mandate(&session, user.did())?;
let validation = system.verify_cart_against_intent(
    &intent, &cart_mandate
).await?;

// 4. Complete checkout if valid
if validation.is_valid() {
    router.complete_checkout_session(/* ... */).await?;
}
```

---

## WASM Usage

### Browser

```javascript
import init, {
    WasmCheckoutSession,
    createCheckoutSession
} from './pkg/agentic_payments.js';

await init();

// Create session
const session = new WasmCheckoutSession();
session.addLineItem("item_123", 2, 1999);
console.log("Total:", session.getTotal());

// REST API call
const response = await createCheckoutSession(
    "https://merchant.example.com",
    "bearer_token",
    [{ id: "item_123", quantity: 2 }]
);
```

---

## ACP REST Endpoints

### 1. Create Checkout Session
```
POST /checkout_sessions
Body: { items: [{ id, quantity }], fulfillment_address?, buyer? }
Response: CheckoutSession (201)
```

### 2. Retrieve Session
```
GET /checkout_sessions/{id}
Response: CheckoutSession (200)
```

### 3. Update Session
```
POST /checkout_sessions/{id}
Body: { items?, fulfillment_address?, fulfillment_option_id? }
Response: CheckoutSession (200)
```

### 4. Complete Session
```
POST /checkout_sessions/{id}/complete
Body: { payment_data: { token, provider, billing_address? } }
Response: CheckoutSessionWithOrder (200)
```

### 5. Cancel Session
```
POST /checkout_sessions/{id}/cancel
Response: CheckoutSession (200)
```

### 6. Delegate Payment
```
POST /agentic_commerce/delegate_payment
Body: {
  payment_method: { type: "card", number, exp_month, exp_year, ... },
  allowance: { reason, max_amount, currency, expires_at },
  billing_address?,
  risk_signals: [{ type, score, action }]
}
Response: DelegatePaymentResponse (201)
```

---

## Required Rust Crates

### Core
- `ed25519-dalek` 2.1 - Ed25519 signatures
- `serde` 1.0 / `serde_json` 1.0 - Serialization
- `uuid` 1.6 - ID generation
- `chrono` 0.4 - Date/time

### Web (WASM-compatible)
- `axum-wasm` 0.1 - REST framework
- `tower` 0.4 / `tower-http` 0.5 - Middleware

### WASM Bindings
- `wasm-bindgen` 0.2 - JS interop
- `wasm-bindgen-futures` 0.4 - Async JS
- `web-sys` 0.3 - Web APIs
- `serde-wasm-bindgen` 0.6 - Serde ↔ JS

### Storage
- `dashmap` 5.5 - Concurrent HashMap
- `parking_lot` 0.12 - Locks

---

## Testing Strategy

### AP2 Tests (Existing)
- ✅ 112/112 tests passing
- No changes required

### ACP Tests (New)
- 50+ REST endpoint tests
- Idempotency verification
- Signature validation
- Error handling

### Bridge Tests (New)
- 30+ integration tests
- AP2 ↔ ACP conversion
- DID ↔ Bearer token mapping
- High-value BFT triggering

### WASM Tests
- Browser API tests
- Node.js compatibility
- Performance benchmarks

---

## Performance Targets

| Metric | Target | Configuration |
|--------|--------|---------------|
| AP2 verifications/sec | 10,000+ | 100-agent pool |
| ACP sessions/sec | 5,000+ | 50-agent pool |
| Hybrid ops/sec | 3,000+ | BFT + REST |
| AP2 latency | <30ms | 5-agent BFT |
| ACP latency | <50ms | REST endpoint |
| Bridge latency | <5ms | Data transform |

---

## Security Features

### Shared
- ✅ Ed25519 cryptographic signatures
- ✅ BFT Byzantine fault tolerance
- ✅ Multi-agent consensus
- ✅ Anomaly detection
- ✅ Self-healing recovery

### ACP-Specific
- ✅ Idempotency keys (prevent duplicates)
- ✅ Rate limiting (DoS protection)
- ✅ Signature headers (request auth)
- ✅ Allowance constraints (spending limits)
- ✅ Risk signals (fraud detection)

---

## Next Steps

1. ✅ **Review** architecture document with team
2. 🔄 **Implement** Phase 1 (Protocol Router)
3. 🔄 **Set up** CI/CD for dual-protocol testing
4. 🔄 **Coordinate** with agentic-catalog SDK team

---

## Resources

- **Full Architecture**: [dual-protocol-architecture.md](./dual-protocol-architecture.md)
- **API Specs**:
  - [openapi.agentic_checkout.yaml](./openapi.agentic_checkout.yaml)
  - [openapi.delegate_payment.yaml](./openapi.delegate_payment.yaml)
- **Testing**: [testing-strategy.md](./testing-strategy.md)
- **WASM**: [wasm-compatibility.md](./wasm-compatibility.md)
- **Implementation**: [implementation-roadmap.md](./implementation-roadmap.md)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-09-29
**Status**: ✅ READY FOR IMPLEMENTATION