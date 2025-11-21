# Agentic Payments Examples

This directory contains comprehensive examples demonstrating the key features of the agentic-payments library.

## Examples Overview

### 1. Basic Verification (`basic_verification.rs`)

**What it demonstrates:**
- Generating agent identities with Ed25519 keypairs
- Signing messages
- Verifying signatures
- Testing invalid signatures
- Creating W3C DID Documents

**Run with:**
```bash
cargo run --example basic_verification
```

**Key concepts:**
- Ed25519 signature verification
- Agent identity management
- DID (Decentralized Identifiers)
- Public key cryptography

---

### 2. Multi-Agent Consensus (`multi_agent_consensus.rs`)

**What it demonstrates:**
- Initializing Byzantine Fault Tolerant (BFT) system
- Multi-agent consensus voting with 5 agents
- Vote distribution across agent pool
- Byzantine fault tolerance (surviving faulty agents)
- System performance metrics

**Run with:**
```bash
cargo run --example multi_agent_consensus
```

**Key concepts:**
- BFT consensus (⅔+ quorum)
- Agent pool management
- Parallel verification
- Byzantine fault detection
- Consensus threshold
- Performance monitoring

**Expected output:**
- 5 agents participate in consensus
- ⅔+ votes required for consensus
- System survives f=1 Byzantine faults
- Average verification time < 100ms

---

### 3. AP2 Verifiable Credentials (`ap2_credentials.rs`)

**What it demonstrates:**
- Creating Intent Mandates (user → agent authorization)
- Creating Cart Mandates (explicit purchase authorization)
- Creating Payment Mandates (payment network signals)
- Building complete payment authorization chains
- Multi-agent consensus verification of credentials

**Run with:**
```bash
cargo run --example ap2_credentials
```

**Key concepts:**
- W3C Verifiable Credentials
- Intent Mandates (authorization delegation)
- Cart Mandates (purchase specifics)
- Payment Mandates (network signaling)
- Authorization chains
- Credential verification with consensus

**Flow:**
1. User authorizes shopping agent (Intent Mandate)
2. User approves specific cart ($895.98, 2 items) (Cart Mandate)
3. Shopping agent signals payment network (Payment Mandate)
4. Complete chain verified by 5 consensus nodes

---

### 4. Trust Chain Validation (`trust_chain_validation.rs`)

**What it demonstrates:**
- Creating hierarchical certificate chains (Root → Intermediate → Leaf)
- Validating trust chains with DFS traversal
- Testing chain depth limits
- Handling expired certificates
- Detecting invalid/rogue certificates
- Multi-agent consensus validation

**Run with:**
```bash
cargo run --example trust_chain_validation
```

**Key concepts:**
- Certificate hierarchies
- Trust chain validation
- Depth-first search (DFS)
- Chain depth limits
- Expiration checking
- Signature verification across chains
- Cross-issuer validation

**Tests:**
- ✅ Valid 3-level certificate hierarchy
- ✅ Deep chain rejection (>5 levels)
- ✅ Expired certificate detection
- ✅ Rogue certificate rejection (invalid signatures)
- ✅ Multi-agent consensus validation

---

### 5. Self-Healing Demo (`self_healing_demo.rs`)

**What it demonstrates:**
- Spawning agent pools (10 agents)
- Simulating agent failures and crashes
- Automatic agent recovery and respawning
- <2 second recovery time guarantee
- Maintaining system availability during failures
- Cascading failure resilience

**Run with:**
```bash
cargo run --example self_healing_demo
```

**Key concepts:**
- Auto-recovery mechanisms
- Health monitoring (100ms interval)
- Agent respawning
- Zero downtime operations
- Cascading failure tolerance
- Recovery metrics

**Recovery guarantees:**
- Recovery time: <2 seconds
- System availability: 100% during failures
- Byzantine tolerance: f=1 with 5 agents
- Cascading failures: Survives 5 sequential failures

**Performance:**
- Normal verification: ~10-50ms
- Verification during recovery: ~50-150ms
- Recovery success rate: >95%
- Average recovery time: ~500ms-1.5s

---

## Running All Examples

To run all examples sequentially:

```bash
cargo run --example basic_verification
cargo run --example multi_agent_consensus
cargo run --example ap2_credentials
cargo run --example trust_chain_validation
cargo run --example self_healing_demo
```

## Building Examples

Build all examples without running:

```bash
cargo build --examples
```

Build a specific example:

```bash
cargo build --example basic_verification
```

## Example Output Format

All examples follow a consistent format:

```
🎯 Example Title

================================================

1️⃣  Step 1: Description
   ✓ Success message
   • Details

2️⃣  Step 2: Description
   ✓ Success message
   📊 Results

...

================================================
✨ Summary:
   • Achievement 1
   • Achievement 2
   ...

🎉 Example completed successfully!

💡 Key Concepts:
   • Concept 1: Explanation
   • Concept 2: Explanation
```

## Understanding the Output

### Status Indicators

- ✅ - Success/Valid
- ❌ - Failure/Invalid
- ⚠️ - Warning
- 🔄 - Processing/In Progress
- 📊 - Statistics/Metrics
- ⏱️ - Timing Information

### Common Metrics

All examples provide timing and performance metrics:

- **Verification Time**: Time to verify a single signature
- **Consensus Time**: Time to reach multi-agent consensus
- **Recovery Time**: Time to recover from agent failure
- **Throughput**: Operations per second
- **Success Rate**: Percentage of successful operations

## Prerequisites

The examples require:

- Rust 1.70+ (2021 edition)
- Tokio async runtime
- Ed25519 cryptographic library
- No external services or network access required

All examples are self-contained and work offline.

## Error Handling

Examples demonstrate proper error handling:

```rust
#[tokio::main]
async fn main() -> Result<()> {
    // Initialize library
    agentic_payments::init()?;

    // Operations...

    Ok(())
}
```

All operations return `Result<()>` and propagate errors up the stack.

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clean and rebuild
cargo clean
cargo build

# Update dependencies
cargo update
```

### Runtime Errors

Most runtime errors are due to:

1. **Invalid Signatures**: Expected behavior in demo scenarios
2. **Timeout Errors**: Increase timeout values in system configuration
3. **Pool Exhausted**: Increase pool size in configuration

### Performance Issues

If examples run slowly:

1. Build in release mode: `cargo build --release --examples`
2. Run with release mode: `cargo run --release --example <name>`
3. Check system resources (CPU, memory)

## Next Steps

After running the examples:

1. Review the implementation in `/src`
2. Check the documentation with `cargo doc --open`
3. Run benchmarks: `cargo bench` (when available)
4. Explore the test suite: `cargo test`

## Additional Resources

- [Main Documentation](../README.md)
- [API Reference](https://docs.rs/agentic-payments)
- [GitHub Repository](https://github.com/agentic-catalog/agentic-payments)
- [AP2 Specification](https://github.com/agentic-catalog/ap2-spec)

## Contributing

To add new examples:

1. Create a new `.rs` file in this directory
2. Follow the existing example format
3. Add clear documentation and comments
4. Update this README with the new example

---

**Note**: These examples demonstrate the intended API design. Some features may still be under development. Check the main library documentation for current implementation status.