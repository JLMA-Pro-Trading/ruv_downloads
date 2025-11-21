# Agentic Commerce Protocol (ACP) Integration Plan

## Executive Summary

This document outlines the integration plan for migrating the agentic-payments crate from Google's Agent Payments Protocol (AP2) to support both AP2 and OpenAI/Stripe's Agentic Commerce Protocol (ACP). The goal is to create a unified payment infrastructure that supports both protocols while maintaining backward compatibility with existing AP2 implementations.

### Current State
- **Implementation**: Full AP2 protocol with Ed25519 signatures, verifiable credentials, mandates (Intent, Cart, Payment), DID management, and multi-agent consensus
- **Codebase**: 4,000+ lines of production-ready Rust code
- **Architecture**: Multi-agent Byzantine fault-tolerant verification system
- **Standards Compliance**: W3C VC/DID, RFC 8032 (Ed25519)
- **Performance**: 10,000+ verifications/second with <5ms authorization chains

### Target State
- **Dual Protocol Support**: Both AP2 and ACP with protocol abstraction layer
- **ACP Core Features**: Checkout API, Delegated Payment Spec, Shared Payment Tokens
- **Enhanced Security**: SPT (Shared Payment Token) integration with existing Ed25519 infrastructure
- **OpenAPI Integration**: RESTful endpoints following ACP specification
- **Merchant Compatibility**: Support for Stripe and non-Stripe payment processors
- **Agent Interoperability**: Cross-protocol agent communication

## Protocol Comparison

### Google Agent Payments Protocol (AP2) - Current
**Focus**: Agent-to-agent secure transactions with mandate-based authorization
**Key Features**:
- Three-tier mandate system (Intent → Cart → Payment)
- Ed25519 cryptographic signatures
- W3C Verifiable Credentials and DID
- Multi-agent consensus with BFT
- Payment-agnostic (supports cards, crypto via x402 extension)
- Self-contained cryptographic verification

**Strengths**:
- Comprehensive agent identity and trust management
- Byzantine fault tolerance
- Flexible payment method support (including crypto)
- Industry-wide backing (60+ companies, Mastercard, Amex, PayPal)

**Current Status**: Specification released, not yet in consumer products

### Agentic Commerce Protocol (ACP) - Target
**Focus**: AI agent checkout flows with merchant/buyer interaction
**Key Features**:
- Checkout API with RESTful endpoints
- Delegated Payment Specification
- Shared Payment Tokens (SPT)
- Product feed integration
- Webhook-based order events
- Rich checkout state management

**Strengths**:
- Live in ChatGPT for U.S. shoppers (Etsy, Shopify)
- Co-developed by OpenAI and Stripe
- Immediate merchant adoption path
- Works across payment processors
- Focused on practical e-commerce flows

**Current Status**: Production deployment in ChatGPT

## Integration Strategy

### Phase 1: Protocol Abstraction Layer
Create a unified interface that supports both AP2 and ACP protocols:

```rust
pub enum PaymentProtocol {
    AP2,
    ACP,
}

pub trait PaymentProtocolHandler {
    async fn authorize_payment(&self, request: PaymentRequest) -> Result<Authorization>;
    async fn verify_credentials(&self, credentials: Credentials) -> Result<VerificationResult>;
    async fn process_checkout(&self, checkout: CheckoutRequest) -> Result<CheckoutResponse>;
}

pub struct UnifiedPaymentSystem {
    ap2_handler: Ap2Handler,
    acp_handler: AcpHandler,
    protocol_router: ProtocolRouter,
}
```

### Phase 2: ACP Core Implementation
Implement ACP-specific components:

1. **Checkout API**
   - RESTful endpoint implementations
   - Order state management
   - Webhook integration
   - Product feed support

2. **Shared Payment Token (SPT) Integration**
   - SPT structure and lifecycle management
   - Token scoping and time constraints
   - Integration with existing Ed25519 infrastructure
   - Credential delegation patterns

3. **Delegated Payment Specification**
   - Payment provider abstraction
   - Stripe SPT API integration
   - Support for non-Stripe processors
   - Payment method negotiation

### Phase 3: Cross-Protocol Interoperability
Enable agents to work across both protocols:

1. **Protocol Detection**
   - Automatic protocol identification
   - Graceful fallback mechanisms
   - Protocol capability negotiation

2. **Credential Translation**
   - AP2 mandate → ACP checkout mapping
   - Verifiable Credential → SPT conversion
   - DID → merchant identity mapping

3. **Unified Agent Interface**
   - Single API for agent developers
   - Protocol-agnostic payment flows
   - Transparent protocol selection

### Phase 4: OpenAPI and Standards Compliance
Implement ACP OpenAPI specifications:

1. **OpenAPI Schema Integration**
   - Generate Rust types from OpenAPI YAML
   - Implement required endpoints
   - Validate request/response schemas

2. **Webhook System**
   - Event-driven order notifications
   - Reliable delivery guarantees
   - Event replay and debugging

3. **Conformance Testing**
   - OpenAI conformance checks
   - Protocol validation suite
   - Certification requirements

## Technical Architecture

### Module Structure
```
crates/agentic-payments/src/
├── ap2/              # Existing AP2 implementation (keep as-is)
│   ├── credentials.rs
│   ├── mandates.rs
│   ├── did.rs
│   ├── verification.rs
│   └── mod.rs
├── acp/              # New ACP implementation
│   ├── checkout.rs       # Checkout API endpoints
│   ├── spt.rs           # Shared Payment Token
│   ├── delegate.rs      # Delegated Payment Spec
│   ├── webhooks.rs      # Webhook handlers
│   ├── product_feed.rs  # Product catalog
│   └── mod.rs
├── protocol/         # Protocol abstraction layer
│   ├── router.rs        # Protocol detection and routing
│   ├── translator.rs    # Cross-protocol translation
│   ├── unified.rs       # Unified API
│   └── mod.rs
├── openapi/          # OpenAPI integration
│   ├── schema.rs        # Generated types
│   ├── validation.rs    # Schema validation
│   └── mod.rs
└── lib.rs
```

### Data Flow

**AP2 Flow (Existing)**:
```
Agent Identity → Intent Mandate → Cart Mandate → Payment Mandate →
Multi-Agent Consensus → Ed25519 Verification → Authorization
```

**ACP Flow (New)**:
```
Product Feed → AI Agent Discovery → Checkout API Request →
Shared Payment Token → Delegated Payment → Order Webhooks → Completion
```

**Unified Flow**:
```
Agent Request → Protocol Detection → Route to Handler →
Execute Protocol-Specific Logic → Return Unified Response
```

## Key Design Decisions

### 1. Backward Compatibility
**Decision**: Keep AP2 implementation unchanged, add ACP as separate module
**Rationale**: Existing AP2 users continue to work, no breaking changes
**Impact**: Slightly larger codebase but safer migration path

### 2. Protocol Coexistence
**Decision**: Support both protocols simultaneously, not force migration
**Rationale**: Different use cases benefit from different protocols
- AP2: Agent-to-agent transactions, crypto payments, multi-issuer trust
- ACP: Merchant checkout, traditional e-commerce, ChatGPT integration

### 3. Shared Infrastructure
**Decision**: Reuse crypto, consensus, and agent infrastructure for both
**Rationale**: Both protocols use Ed25519 signatures and agent verification
**Shared Components**:
- Ed25519 signature verification
- Multi-agent consensus system
- Agent pool management
- Byzantine fault tolerance
- DID infrastructure (with ACP extensions)

### 4. OpenAPI-First for ACP
**Decision**: Generate Rust types from official ACP OpenAPI schemas
**Rationale**: Ensures specification compliance and automatic updates
**Tools**: `openapiv3`, `utoipa`, code generation tools

### 5. WASM Compatibility
**Decision**: Maintain full WASM support for both protocols
**Rationale**: Enable browser-based agents and lightweight deployments
**Considerations**:
- No tokio async runtime in WASM
- Use wasm-bindgen for JavaScript interop
- Browser-compatible crypto libraries

## Security Considerations

### Shared Payment Tokens (SPT)
1. **Time-Constrained Tokens**: Implement TTL with automatic expiration
2. **Scoped Authorization**: Limit SPT to specific merchants and amounts
3. **No Credential Exposure**: Never expose underlying payment credentials
4. **Ed25519 Integration**: Use existing signature infrastructure for SPT signing

### Cross-Protocol Security
1. **Protocol Isolation**: Prevent cross-protocol attacks
2. **Credential Translation Security**: Validate during AP2 ↔ ACP conversions
3. **Audit Trail**: Log all protocol transitions and translations
4. **Rate Limiting**: Per-protocol rate limits to prevent abuse

### Webhook Security
1. **Signature Verification**: Validate all webhook signatures
2. **Replay Protection**: Use nonces and timestamps
3. **HTTPS Only**: Enforce TLS for all webhook endpoints
4. **IP Allowlisting**: Optional IP-based restrictions

## Performance Requirements

### Latency Targets
- **Protocol Detection**: <1ms
- **AP2 Authorization**: <5ms (existing performance)
- **ACP Checkout API**: <50ms (network-bound)
- **SPT Generation**: <2ms
- **Protocol Translation**: <3ms

### Throughput Targets
- **AP2 Verifications**: 10,000+ ops/sec (existing)
- **ACP Checkout Requests**: 5,000+ ops/sec
- **Webhook Processing**: 10,000+ events/sec
- **Concurrent Protocols**: No degradation with both active

### Resource Utilization
- **Memory Overhead**: <50MB for ACP module
- **CPU Overhead**: <10% for protocol routing
- **WASM Bundle Size**: <500KB additional for ACP

## Testing Strategy

### Unit Tests
- [ ] ACP checkout API endpoint handlers
- [ ] SPT generation and validation
- [ ] Delegated payment processing
- [ ] Protocol detection and routing
- [ ] Cross-protocol translation
- [ ] Webhook signature verification

### Integration Tests
- [ ] Full AP2 → ACP translation flows
- [ ] End-to-end checkout with SPT
- [ ] Multi-protocol agent scenarios
- [ ] Webhook delivery and processing
- [ ] Protocol fallback mechanisms

### Conformance Tests
- [ ] OpenAI ACP conformance suite
- [ ] OpenAPI schema validation
- [ ] Stripe SPT integration tests
- [ ] Protocol specification compliance

### Performance Tests
- [ ] Protocol routing overhead benchmarks
- [ ] ACP checkout API latency tests
- [ ] Concurrent multi-protocol scenarios
- [ ] WASM bundle size and performance

### Security Tests
- [ ] SPT security properties
- [ ] Cross-protocol isolation
- [ ] Webhook signature validation
- [ ] Credential translation security
- [ ] Rate limiting effectiveness

## Migration Path for Existing Users

### For Current AP2 Users
1. **No Changes Required**: Existing AP2 code continues to work
2. **Opt-In ACP**: Enable ACP via feature flags
3. **Gradual Adoption**: Use unified API for new code
4. **Protocol Selection**: Choose protocol per-transaction

### For New Users
1. **Start with Unified API**: Protocol abstraction from day one
2. **Automatic Selection**: Let system choose optimal protocol
3. **Override When Needed**: Manual protocol selection available

## Success Metrics

### Technical Metrics
- ✅ All existing AP2 tests pass
- ✅ 90%+ ACP OpenAPI conformance
- ✅ <5% performance overhead for protocol abstraction
- ✅ Full WASM compatibility maintained
- ✅ Zero breaking changes to public API

### Business Metrics
- 🎯 Support ChatGPT Instant Checkout integration
- 🎯 Enable merchant adoption (Etsy, Shopify compatibility)
- 🎯 Maintain AP2 ecosystem support
- 🎯 Enable cross-protocol agent development

## Timeline and Milestones

See `implementation-roadmap.md` for detailed milestone breakdown.

**High-Level Timeline**:
- **Phase 1**: Protocol Abstraction (2-3 weeks)
- **Phase 2**: ACP Core Implementation (4-6 weeks)
- **Phase 3**: Cross-Protocol Interop (2-3 weeks)
- **Phase 4**: OpenAPI & Certification (2-3 weeks)
- **Total**: 10-15 weeks for full integration

## Risk Assessment

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAPI spec changes | High | Pin to spec version, automated testing |
| Protocol conflicts | Medium | Strict isolation, comprehensive testing |
| Performance degradation | Medium | Benchmarking, optimization passes |
| WASM incompatibility | Low | Early WASM testing, feature flags |

### Business Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| ACP adoption delays | Low | Maintain AP2 as fallback |
| Spec fragmentation | Medium | Support both protocols long-term |
| Breaking changes | High | Backward compatibility guarantee |

## Next Steps

1. **Review and Approve**: Stakeholder sign-off on integration plan
2. **Prototype**: Build protocol abstraction layer POC
3. **OpenAPI Integration**: Generate types from ACP schemas
4. **Iterative Development**: Implement in phases with continuous testing
5. **Documentation**: Maintain both protocol documentation
6. **Community Engagement**: Contribute to ACP and AP2 specifications

## References

- [Agentic Commerce Protocol (GitHub)](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [OpenAI Commerce Docs](https://developers.openai.com/commerce)
- [Stripe Agentic Commerce](https://docs.stripe.com/agentic-commerce)
- [Google AP2 Protocol](https://github.com/google-agentic-commerce/AP2)
- [Current AP2 Implementation](../AP2_IMPLEMENTATION.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-09-29
**Status**: Draft - Pending Review