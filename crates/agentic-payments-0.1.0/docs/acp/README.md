# Agentic Commerce Protocol (ACP) Integration Documentation

## Overview

This directory contains comprehensive documentation for integrating the Agentic Commerce Protocol (ACP) into the agentic-payments crate. ACP is an open standard co-developed by OpenAI and Stripe that enables AI agents to complete purchases seamlessly with merchants.

## What is ACP?

The **Agentic Commerce Protocol (ACP)** is a new interaction model that connects buyers, their AI agents, and businesses to complete purchases. It's currently live in ChatGPT for U.S. shoppers and is designed to work across platforms, payment processors, and business models.

### Key Features
- **Checkout API**: RESTful endpoints for AI-driven checkout flows
- **Shared Payment Tokens (SPT)**: Secure, time-constrained payment delegation
- **Delegated Payment Spec**: Works with Stripe and non-Stripe processors
- **Product Feed**: Expose product catalogs to AI agents
- **Webhooks**: Event-driven order notifications
- **OpenAPI Compliance**: Machine-readable API specification

## Documentation Structure

### 📋 Core Documents

1. **[Integration Plan](./integration-plan.md)**
   - Executive summary of ACP vs AP2
   - Integration strategy and architecture
   - Success metrics and timeline
   - Risk assessment

2. **[Gap Analysis](./gap-analysis.md)**
   - Detailed comparison of AP2 and ACP
   - What exists, what's missing, what needs changes
   - Effort estimates per component
   - Priority and risk levels

3. **[Implementation Roadmap](./implementation-roadmap.md)**
   - Phased milestone breakdown (16 weeks)
   - Detailed deliverables and success criteria
   - Code structure and testing requirements
   - Rollout strategy

4. **[WASM Considerations](./wasm-compatibility.md)** _(coming soon)_
   - Browser agent support
   - WASM-specific constraints
   - Performance considerations

5. **[Testing Strategy](./testing-strategy.md)** _(coming soon)_
   - Unit, integration, conformance tests
   - Performance benchmarks
   - Security testing

## Quick Start

### Current State: AP2 Implementation
The agentic-payments crate currently implements Google's Agent Payments Protocol (AP2):

```rust
use agentic_payments::ap2::*;

// Current AP2 flow
let protocol = Ap2Protocol::new();
let user = protocol.register_agent("user", public_key)?;
let intent = protocol.create_intent_mandate(&user, &merchant.did, "Purchase", key)?;
let cart = protocol.create_cart_mandate(&user, items, 10000, "USD", key)?;
let payment = protocol.create_payment_mandate(&user, &merchant.did, 10000, "USD", "card", key)?;

let auth = PaymentAuthorization::new(intent, cart, payment);
let result = protocol.verify_payment_authorization(&auth, verifiers).await?;
```

**Key Features**:
- ✅ Ed25519 signatures and verification
- ✅ Multi-agent Byzantine fault-tolerant consensus
- ✅ W3C Verifiable Credentials and DID
- ✅ Three-tier mandate system (Intent → Cart → Payment)
- ✅ 10,000+ verifications/second performance

### Target State: Dual Protocol Support

After ACP integration, the crate will support both protocols:

```rust
use agentic_payments::protocol::*;

// Unified protocol abstraction
let system = UnifiedPaymentSystem::builder()
    .with_ap2_handler(ap2_handler)
    .with_acp_handler(acp_handler)
    .build();

// Automatic protocol detection
let result = system.process_payment(request).await?;

// Or explicit protocol selection
let result = system.process_payment_with_protocol(
    request,
    Protocol::ACP
).await?;
```

**ACP-Specific Features** (to be added):
- 🎯 RESTful Checkout API
- 🎯 Shared Payment Tokens (SPT)
- 🎯 Product Feed integration
- 🎯 Webhook delivery system
- 🎯 OpenAPI specification
- 🎯 Merchant management

## Protocol Comparison

| Feature | AP2 (Current) | ACP (Target) | Status |
|---------|---------------|--------------|--------|
| **Authorization Model** | Three-tier mandates | Checkout sessions | New Implementation |
| **API Architecture** | Library-only | RESTful HTTP | New Implementation |
| **Payment Tokens** | Verifiable Credentials | Shared Payment Tokens | Adaptation Required |
| **Agent Identity** | W3C DID | Compatible | Mostly Compatible |
| **Cryptography** | Ed25519 | Ed25519 / PSP-specific | Compatible |
| **Consensus** | Byzantine FT (BFT) | Not required | Optional Feature |
| **Merchant Focus** | Agent-to-agent | Agent-to-merchant | New Implementation |
| **Product Discovery** | Not applicable | Product Feed | New Implementation |
| **Events** | Callbacks | Webhooks | New Implementation |
| **WASM Support** | Full support | Required | Maintained |

## Integration Timeline

**Total Duration**: 12-16 weeks

### Phase 0: Planning (Week 1-2)
- Technical architecture finalization
- Development infrastructure setup
- Protocol abstraction layer POC

### Phase 1: HTTP API (Week 3-6)
- Axum HTTP server foundation
- OpenAPI integration
- Checkout API endpoints

### Phase 2: Shared Payment Tokens (Week 7-9)
- SPT core implementation
- Stripe SPT API integration
- PSP abstraction layer

### Phase 3: Merchant Integration (Week 10-13)
- Merchant management
- Product feed
- Order management

### Phase 4: Webhooks (Week 14-15)
- Event queue and delivery
- Retry logic
- Signature verification

### Phase 5: Testing & Certification (Week 16)
- Conformance testing
- Performance benchmarks
- Security audit

## Key Architectural Decisions

### 1. Protocol Coexistence
**Decision**: Support both AP2 and ACP simultaneously
**Rationale**: Different use cases benefit from different protocols

### 2. Backward Compatibility
**Decision**: Zero breaking changes to existing AP2 API
**Rationale**: Protect existing users, enable gradual adoption

### 3. Shared Infrastructure
**Decision**: Reuse crypto, consensus, and agent infrastructure
**Rationale**: Both protocols use Ed25519 and agent verification

### 4. OpenAPI-First for ACP
**Decision**: Generate Rust types from OpenAPI schemas
**Rationale**: Ensures spec compliance, enables auto-updates

### 5. Feature Flags
**Decision**: ACP behind optional Cargo feature
**Rationale**: Minimize dependencies for AP2-only users

```toml
[features]
default = ["ap2"]
ap2 = []  # Existing AP2 features
acp = ["axum", "tower", "utoipa"]  # New ACP features
full = ["ap2", "acp"]  # Both protocols
```

## Migration Path

### For Existing AP2 Users
1. **No changes required** - AP2 continues to work identically
2. **Opt-in ACP** - Enable via `features = ["acp"]`
3. **Gradual adoption** - Use unified API for new code
4. **Protocol selection** - Choose per-transaction if needed

### For New Users
1. **Start with unified API** - Protocol abstraction from day one
2. **Automatic selection** - System chooses optimal protocol
3. **Override when needed** - Manual protocol selection available

## Development Workflow

### Setting Up Development Environment

```bash
# Clone repository
git clone https://github.com/agentic-catalog/agentic-payments
cd agentic-payments

# Build with ACP features
cargo build --features acp

# Run tests
cargo test --features acp

# Generate documentation
cargo doc --features acp --open

# Run benchmarks
cargo bench --features acp
```

### Creating a Feature Branch

```bash
# Start from clean-up branch or main
git checkout -b feature/acp-checkout-api

# Work on implementation
# ...

# Run all tests before committing
cargo test --all-features
cargo clippy --all-features
cargo fmt --check

# Commit and push
git commit -m "feat(acp): implement checkout API endpoints"
git push origin feature/acp-checkout-api
```

## Testing Strategy

### Unit Tests
- Individual component testing
- >90% code coverage target
- Mock dependencies

### Integration Tests
- End-to-end workflow testing
- Multi-protocol scenarios
- Database integration

### Conformance Tests
- OpenAI ACP conformance suite
- OpenAPI schema validation
- Protocol specification compliance

### Performance Tests
- Latency benchmarks (<50ms target)
- Throughput tests (>5,000 ops/sec target)
- Concurrent protocol handling

### Security Tests
- SPT security properties
- Webhook signature validation
- Rate limiting effectiveness
- Cross-protocol isolation

## Success Criteria

### Technical Metrics
- ✅ All existing AP2 tests pass
- ✅ 90%+ OpenAPI conformance
- ✅ <5% performance overhead
- ✅ Full WASM compatibility
- ✅ Zero breaking changes

### Business Metrics
- 🎯 ChatGPT Instant Checkout integration
- 🎯 Merchant adoption (Etsy, Shopify)
- 🎯 Cross-protocol agent development

## Resources

### Official Specifications
- [Agentic Commerce Protocol (GitHub)](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [OpenAI Commerce Documentation](https://developers.openai.com/commerce)
- [Stripe Agentic Commerce](https://docs.stripe.com/agentic-commerce)
- [Google AP2 Protocol](https://github.com/google-agentic-commerce/AP2)

### Internal Documentation
- [Current AP2 Implementation](../AP2_IMPLEMENTATION.md)
- [AP2 Summary](../AP2_SUMMARY.md)
- [Crypto Quick Start](../CRYPTO_QUICK_START.md)

### Development Tools
- [utoipa](https://github.com/juhaku/utoipa) - OpenAPI generation
- [axum](https://github.com/tokio-rs/axum) - HTTP server framework
- [sqlx](https://github.com/launchbadge/sqlx) - Database toolkit
- [reqwest](https://github.com/seanmonstar/reqwest) - HTTP client

## Contributing

We welcome contributions to the ACP integration! Please follow these guidelines:

1. **Read the documentation** - Understand the architecture and design decisions
2. **Create an issue** - Discuss significant changes before implementing
3. **Follow the roadmap** - Align with the phased implementation plan
4. **Write tests** - Comprehensive test coverage required
5. **Update documentation** - Keep docs in sync with code

### Development Priorities

**High Priority** (Critical Path):
1. HTTP API infrastructure
2. Merchant integration
3. Webhook system
4. Shared Payment Tokens
5. Checkout API model
6. OpenAPI compliance

**Medium Priority**:
7. Protocol abstraction
8. WASM HTTP client

**Low Priority** (Nice to Have):
9. SPT signing context adaptation
10. Merchant DID extensions

## FAQ

### Q: Will this break my existing AP2 code?
**A**: No. The integration maintains 100% backward compatibility. AP2 code will continue to work unchanged.

### Q: Do I need to migrate to ACP?
**A**: No. Both protocols will be supported long-term. Choose the protocol that fits your use case.

### Q: Can I use both protocols in the same application?
**A**: Yes. The unified API supports both protocols simultaneously, with automatic or manual protocol selection.

### Q: What about WASM support?
**A**: Full WASM compatibility will be maintained for both protocols.

### Q: When will ACP integration be production-ready?
**A**: Following the roadmap, production-ready release is targeted for Week 19-20 (approximately 5 months).

### Q: How does this compare to Google's AP2?
**A**: Our implementation currently uses Google's AP2. ACP (OpenAI/Stripe) is a complementary protocol focused on merchant checkout. We'll support both.

### Q: What payment processors are supported?
**A**: Initially Stripe via Shared Payment Tokens. The PSP abstraction layer will enable support for other processors implementing the Delegated Payment Spec.

## Contact and Support

- **Issues**: [GitHub Issues](https://github.com/agentic-catalog/agentic-payments/issues)
- **Discussions**: [GitHub Discussions](https://github.com/agentic-catalog/agentic-payments/discussions)
- **Email**: agentic-catalog@example.com _(update with actual contact)_

---

**Document Version**: 1.0
**Last Updated**: 2025-09-29
**Status**: Active Development

**Contributors**: Agentic Catalog Team

**License**: MIT OR Apache-2.0