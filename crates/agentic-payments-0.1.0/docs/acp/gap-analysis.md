# Gap Analysis: AP2 vs Agentic Commerce Protocol (ACP)

## Overview

This document provides a detailed gap analysis comparing the current AP2 implementation in the agentic-payments crate with the requirements of the Agentic Commerce Protocol (ACP). The analysis identifies what exists, what's missing, and what needs modification.

## Executive Summary

| Category | AP2 Status | ACP Requirements | Gap Level |
|----------|-----------|------------------|-----------|
| Core Cryptography | ✅ Complete | Mostly Compatible | Low |
| Payment Authorization | ✅ Complete (Mandates) | Different Model (Checkout) | Medium |
| API Architecture | ⚠️ Library-only | RESTful HTTP API Required | High |
| Payment Tokens | ⚠️ Credentials | Shared Payment Tokens (SPT) | Medium |
| Merchant Integration | ❌ Not Implemented | Product Feed + Checkout API | High |
| Webhooks | ❌ Not Implemented | Order Event Webhooks Required | High |
| OpenAPI Compliance | ❌ Not Implemented | OpenAPI Spec Required | High |
| Agent Identity | ✅ Complete (DID) | Compatible | Low |
| Multi-Agent Consensus | ✅ Complete (BFT) | Not Required (But Valuable) | None |
| WASM Support | ✅ Complete | Compatible | Low |

**Overall Assessment**: The current AP2 implementation provides a solid cryptographic and agent infrastructure foundation, but significant new components are needed to support ACP's merchant-focused checkout API model.

## Detailed Gap Analysis

### 1. Cryptographic Infrastructure

#### Current AP2 Implementation ✅
- **Ed25519 Signatures**: Full RFC 8032 compliance
- **Key Management**: Agent key generation, storage, rotation
- **Signature Verification**: Fast batch verification (<100μs per signature)
- **Zero-Knowledge Support**: Zeroize integration for secure memory
- **WASM Compatibility**: Browser-compatible crypto via wasm-bindgen

**Files**:
- `src/crypto/mod.rs`
- `src/crypto/signatures.rs`
- `src/crypto/keys.rs`

#### ACP Requirements
- Ed25519 or similar for SPT signing
- Credential delegation support
- Time-bound token signatures
- Merchant verification keys

#### Gap Analysis
**Status**: ✅ **No Significant Gaps**

The existing Ed25519 infrastructure is fully compatible with ACP's SPT requirements. Minor additions needed:
- [ ] SPT-specific signing contexts
- [ ] Time-bound signature validation
- [ ] Merchant key registry integration

**Effort**: 1-2 days
**Priority**: Low (can reuse existing infrastructure)

---

### 2. Payment Authorization Model

#### Current AP2 Implementation ✅
- **Three-Tier Mandates**: Intent → Cart → Payment
- **Authorization Chains**: Complete payment authorization flows
- **Permission System**: Granular agent permissions
- **Lifecycle Management**: Mandate states (pending/active/completed/cancelled)
- **Calculations**: Tax, shipping, discounts, totals

**Files**:
- `src/ap2/mandates.rs` (409 lines)
- `src/ap2/mod.rs` (authorization chains)

#### ACP Requirements
- **Checkout API**: RESTful checkout flow
- **Order Management**: Create, retrieve, update orders
- **Payment Intent**: Different from AP2 Intent Mandate
- **Checkout State**: Rich state returned on every response
- **Guest Checkout**: Support for non-authenticated buyers

#### Gap Analysis
**Status**: ⚠️ **Significant Conceptual Differences**

AP2's mandate model is comprehensive but different from ACP's checkout model:

| Feature | AP2 | ACP | Gap |
|---------|-----|-----|-----|
| Authorization Model | Three mandates with signatures | Single checkout with SPT | Medium |
| Agent Permission | Explicit permission grants | Implicit via SPT scope | Low |
| State Management | Mandate lifecycle | Order state machine | Medium |
| Item Tracking | Cart mandate items | Order line items | Low |
| Payment Completion | Payment mandate execution | Checkout completion webhook | High |

**Missing ACP Components**:
- [ ] Checkout session management
- [ ] Order state machine (different from mandate states)
- [ ] Guest checkout support
- [ ] Checkout abandonment tracking
- [ ] Order modification after creation
- [ ] Shipping method selection
- [ ] Promo code application

**Effort**: 2-3 weeks
**Priority**: High (core ACP functionality)

---

### 3. API Architecture

#### Current AP2 Implementation ⚠️
- **Library-Only**: Rust library with async functions
- **No HTTP Layer**: Direct function calls only
- **In-Process**: Single-process multi-agent architecture
- **Type-Safe**: Strong Rust type system

**Files**:
- All current implementation is library-based
- No HTTP server infrastructure

#### ACP Requirements
- **RESTful HTTP API**: Required checkout endpoints:
  - `POST /checkout/create` - Initiate checkout
  - `GET /checkout/{id}` - Retrieve checkout state
  - `POST /checkout/{id}/complete` - Complete checkout
  - `POST /checkout/{id}/cancel` - Cancel checkout
- **Webhook Endpoints**: Receive order events from AI agents
- **Product Feed**: Expose product catalog
- **OpenAPI Specification**: Machine-readable API spec
- **Authentication**: Merchant authentication (API keys, OAuth)
- **Rate Limiting**: Request throttling
- **Versioning**: API version management

#### Gap Analysis
**Status**: ❌ **Major Gap - No HTTP Infrastructure**

Current implementation has no HTTP server or API layer.

**Required Components**:
- [ ] HTTP server framework (axum, actix-web, or warp)
- [ ] RESTful endpoint implementations
- [ ] Request/response serialization
- [ ] Authentication middleware
- [ ] Rate limiting middleware
- [ ] CORS support for browser agents
- [ ] API versioning strategy
- [ ] Error response standardization
- [ ] Health check endpoints
- [ ] Metrics collection (Prometheus)

**Architecture Decision Required**:
- **Option 1**: Embedded HTTP server (e.g., axum)
- **Option 2**: Separate HTTP wrapper crate
- **Option 3**: gRPC + HTTP gateway

**Recommendation**: Option 1 (embedded axum) with feature flag

**Effort**: 3-4 weeks
**Priority**: Critical (ACP cannot function without HTTP API)

---

### 4. Shared Payment Tokens (SPT)

#### Current AP2 Implementation ⚠️
- **Verifiable Credentials**: W3C VC standard implementation
- **Proof Structure**: Ed25519 signatures on credentials
- **Expiration Handling**: Timestamp-based validity
- **No Token Delegation**: Credentials are not delegatable

**Files**:
- `src/ap2/credentials.rs` (309 lines)

#### ACP Requirements
- **SPT Structure**: Stripe-compatible Shared Payment Token
  ```json
  {
    "token_id": "spt_xxx",
    "payment_method": "pm_xxx",
    "merchant_id": "mer_xxx",
    "amount_limit": 10000,
    "currency": "USD",
    "expires_at": 1234567890,
    "scope": ["charge", "refund"],
    "metadata": {}
  }
  ```
- **Delegation Semantics**: SPT delegates payment authority
- **Scoping**: Time, amount, merchant, and operation constraints
- **Revocation**: Token invalidation before expiry
- **PSP Integration**: Stripe SPT API or custom implementation

#### Gap Analysis
**Status**: ⚠️ **Partial - Need SPT-Specific Implementation**

Existing Verifiable Credentials are similar but not compatible with SPT format:

| Feature | AP2 VC | ACP SPT | Gap |
|---------|--------|---------|-----|
| Format | W3C VC (JSON-LD) | JSON (PSP-specific) | High |
| Delegation | No | Yes | High |
| Scoping | Permission-based | Amount/time/merchant | Medium |
| Revocation | No | Yes | High |
| PSP Integration | No | Stripe API | High |
| Expiration | Timestamp | Timestamp | None |

**Required Components**:
- [ ] SPT data structure
- [ ] SPT generation from credentials
- [ ] Token scoping logic
- [ ] Revocation list/system
- [ ] Stripe SPT API client
- [ ] Non-Stripe PSP abstraction
- [ ] Token → payment authorization mapping

**Effort**: 2-3 weeks
**Priority**: High (core ACP security primitive)

---

### 5. Merchant Integration

#### Current AP2 Implementation ❌
- **No Merchant Concepts**: AP2 is agent-to-agent focused
- **No Product Catalog**: No product feed or inventory
- **No Merchant Authentication**: No merchant-specific logic
- **No Order Management**: Focus on payment authorization only

#### ACP Requirements
- **Product Feed**: Expose product catalog to AI agents
  - Product IDs, names, descriptions
  - Pricing, images, variants
  - Availability, stock levels
  - Categories and taxonomy
- **Merchant Dashboard**: Merchant configuration UI (optional)
- **Merchant Authentication**: API key or OAuth for merchants
- **Merchant Settings**: Webhook URLs, payment preferences
- **Order Management**: Track orders, fulfillment, returns

#### Gap Analysis
**Status**: ❌ **Complete Gap - No Merchant Infrastructure**

This is entirely new functionality:

**Required Components**:
- [ ] Product feed data structures
- [ ] Product feed API endpoints
- [ ] Product search and filtering
- [ ] Merchant profile management
- [ ] Merchant authentication system
- [ ] Merchant API key generation
- [ ] Order tracking system
- [ ] Fulfillment status updates
- [ ] Return/refund handling

**Design Decisions**:
- **Storage**: Database required (PostgreSQL, SQLite)
- **Product Feed Format**: Follow ACP product feed spec
- **Merchant Portal**: Separate UI or API-only?

**Effort**: 4-5 weeks
**Priority**: High (required for merchant adoption)

---

### 6. Webhook System

#### Current AP2 Implementation ❌
- **No Webhooks**: Event-driven architecture not implemented
- **Callback Support**: Limited to in-process async callbacks

#### ACP Requirements
- **Order Event Webhooks**: Notify AI agents of order events
  - `order.created`
  - `order.updated`
  - `order.completed`
  - `order.cancelled`
  - `order.refunded`
- **Webhook Delivery**: Reliable HTTP POST to agent endpoints
- **Retry Logic**: Exponential backoff for failed deliveries
- **Signature Verification**: HMAC or Ed25519 signatures
- **Event Ordering**: Handle out-of-order events
- **Webhook Management**: Subscribe/unsubscribe endpoints

#### Gap Analysis
**Status**: ❌ **Complete Gap - No Webhook Infrastructure**

**Required Components**:
- [ ] Webhook event data structures
- [ ] Event queue (in-memory or external like Redis)
- [ ] Webhook delivery worker
- [ ] Retry logic with exponential backoff
- [ ] Signature generation for webhook payloads
- [ ] Webhook subscription management
- [ ] Event log for debugging
- [ ] Dead letter queue for failed deliveries
- [ ] Webhook testing tools

**Architecture Decision**:
- **Option 1**: Simple in-memory queue (for small scale)
- **Option 2**: Redis queue (for production scale)
- **Option 3**: Message broker (RabbitMQ, Kafka)

**Recommendation**: Option 1 initially, Option 2 for production

**Effort**: 2-3 weeks
**Priority**: High (critical for asynchronous order flow)

---

### 7. OpenAPI Compliance

#### Current AP2 Implementation ❌
- **No OpenAPI Spec**: Library-only, no API documentation
- **Rust Documentation**: rustdoc comments only

#### ACP Requirements
- **OpenAPI 3.x Specification**: Complete YAML spec for all endpoints
- **Request/Response Schemas**: JSON Schema for all payloads
- **Authentication Schemes**: Documented in OpenAPI
- **Example Requests**: Included in spec
- **Code Generation**: Enable client generation from spec
- **Conformance Testing**: Validate against spec

#### Gap Analysis
**Status**: ❌ **Complete Gap - Need OpenAPI Infrastructure**

**Required Components**:
- [ ] OpenAPI YAML specification file
- [ ] Schema generation from Rust types (utoipa)
- [ ] Schema validation middleware
- [ ] OpenAPI UI (Swagger UI, ReDoc)
- [ ] Example generation
- [ ] Conformance test suite
- [ ] Documentation generation pipeline

**Tools**:
- `utoipa`: Generate OpenAPI from Rust code
- `utoipa-swagger-ui`: Embed Swagger UI
- `schemars`: JSON Schema generation
- `validator`: Request validation

**Effort**: 2-3 weeks
**Priority**: High (required for ACP certification)

---

### 8. Agent Identity and DID

#### Current AP2 Implementation ✅
- **DID Documents**: Complete W3C DID implementation
- **DID Method**: Custom `did:ap2:` method
- **DID Resolution**: Caching resolver
- **Service Endpoints**: Configurable services
- **Verification Methods**: Ed25519 key support

**Files**:
- `src/ap2/did.rs` (387 lines)

#### ACP Requirements
- **Agent Identity**: Identify AI agents in checkout
- **Merchant Identity**: DID or similar for merchants
- **Service Discovery**: Find merchant checkout endpoints

#### Gap Analysis
**Status**: ✅ **No Significant Gaps**

Existing DID infrastructure is compatible with ACP:
- [ ] Extend `did:ap2:` to support merchant identities
- [ ] Add ACP-specific service types
- [ ] Merchant DID registry

**Effort**: 1 week
**Priority**: Low (existing DID system works)

---

### 9. Multi-Agent Consensus

#### Current AP2 Implementation ✅
- **Byzantine Fault Tolerance**: 2f+1 quorum with ⅔+ consensus
- **Verification Pool**: 3-100 agents per verification
- **Weighted Voting**: Reputation-based weights
- **Parallel Verification**: Concurrent agent execution
- **Self-Healing**: Automatic agent recovery (<2s)
- **Verification Policies**: Configurable thresholds

**Files**:
- `src/ap2/verification.rs` (477 lines)
- `src/consensus/` (Byzantine consensus algorithms)
- `src/agents/pool.rs` (agent pool management)

#### ACP Requirements
- **No Consensus Required**: ACP relies on PSP for verification
- **Optional Enhancement**: Could use for merchant reputation

#### Gap Analysis
**Status**: ✅ **Bonus Feature - Not Required but Valuable**

ACP doesn't require multi-agent consensus, but it's a differentiating feature:

**Potential Use Cases in ACP**:
- [ ] Merchant reputation scoring via multi-agent analysis
- [ ] Fraud detection with consensus-based alerts
- [ ] Disputed transaction arbitration
- [ ] Decentralized SPT verification (non-Stripe PSPs)

**Effort**: None (already implemented)
**Priority**: N/A (optional enhancement)

---

### 10. WASM Compatibility

#### Current AP2 Implementation ✅
- **Full WASM Support**: Browser and Node.js compatible
- **wasm-bindgen**: JavaScript interop
- **Async Support**: wasm-bindgen-futures
- **No Tokio**: Uses browser-compatible async
- **Crypto**: wasm-compatible ed25519-dalek

**Files**:
- `src/wasm/` (complete WASM bindings)

#### ACP Requirements
- **Browser Agents**: Support browser-based AI agents
- **WASM-Compatible**: HTTP client, crypto, async

#### Gap Analysis
**Status**: ✅ **No Significant Gaps**

Existing WASM infrastructure is solid. Minor additions:
- [ ] HTTP client for WASM (reqwest with wasm feature)
- [ ] localStorage for token caching
- [ ] Browser-compatible webhook receiver (via postMessage)

**Effort**: 1 week
**Priority**: Medium (enables browser agents)

---

## Summary of Gaps

### Critical Gaps (Block ACP Adoption)
1. **HTTP API Infrastructure** (3-4 weeks)
   - No RESTful server implementation
   - Required for all ACP interactions

2. **Merchant Integration** (4-5 weeks)
   - No product feed or merchant management
   - Essential for merchant adoption

3. **Webhook System** (2-3 weeks)
   - No event notification infrastructure
   - Critical for async order flow

### High Priority Gaps (Significantly Limit Functionality)
4. **Shared Payment Tokens** (2-3 weeks)
   - Need SPT-specific implementation
   - Core security primitive

5. **Checkout API Model** (2-3 weeks)
   - Different authorization model from mandates
   - Core payment flow

6. **OpenAPI Compliance** (2-3 weeks)
   - Required for certification
   - Enables client generation

### Medium Priority Gaps (Nice to Have)
7. **Protocol Abstraction** (1-2 weeks)
   - Support both AP2 and ACP
   - Enable gradual migration

8. **WASM HTTP Client** (1 week)
   - Browser-based agent support
   - Expands deployment options

### Low Priority Gaps (Minor Enhancements)
9. **SPT Signing Context** (1-2 days)
   - Adapt existing crypto for SPT
   - Minor adaptation

10. **Merchant DID Extension** (1 week)
    - Extend existing DID system
    - Minor addition

---

## Total Effort Estimate

**Critical Path**: HTTP API + Merchant Integration + Webhooks + SPT + Checkout Model + OpenAPI
**Total Effort**: 18-24 weeks of development time

**Parallelizable Work**:
- HTTP API + OpenAPI (can develop together)
- Merchant Integration (can be parallel to checkout model)
- Webhooks + SPT (some overlap)

**Realistic Timeline**: 12-16 weeks with 2-3 developers working in parallel

---

## Risk Assessment

### High Risk
- **OpenAPI Spec Changes**: ACP spec is new and may evolve
  - **Mitigation**: Pin to spec version, automated testing against spec

### Medium Risk
- **Stripe SPT API Changes**: Dependency on Stripe's implementation
  - **Mitigation**: Abstract PSP layer, support multiple PSPs
- **Performance Degradation**: HTTP layer adds latency
  - **Mitigation**: Benchmarking, async optimization

### Low Risk
- **WASM Compatibility**: Well-understood technology
  - **Mitigation**: Early testing, feature flags
- **Backward Compatibility**: AP2 implementation is stable
  - **Mitigation**: Separate modules, no changes to AP2

---

## Recommendations

### Immediate Actions (Week 1-2)
1. ✅ Complete this gap analysis
2. Create detailed implementation roadmap
3. Prototype HTTP API with axum
4. Design protocol abstraction layer
5. Set up OpenAPI tooling

### Phase 1: Foundation (Week 3-6)
1. Implement HTTP API infrastructure
2. Build OpenAPI spec and generation
3. Create protocol abstraction layer
4. Design SPT data structures

### Phase 2: Core ACP (Week 7-12)
1. Implement checkout API endpoints
2. Build SPT generation and validation
3. Create webhook system
4. Merchant integration basics

### Phase 3: Complete Integration (Week 13-16)
1. Full merchant integration
2. Product feed implementation
3. Conformance testing
4. Documentation and examples

---

## Next Steps

1. **Review and Approve**: Stakeholder sign-off on gap analysis
2. **Prioritize Gaps**: Confirm priority and sequencing
3. **Create Roadmap**: Detailed implementation roadmap with milestones
4. **Prototype**: Build HTTP API + OpenAPI proof of concept
5. **Iterate**: Begin Phase 1 development

---

**Document Version**: 1.0
**Last Updated**: 2025-09-29
**Status**: Draft - Pending Review