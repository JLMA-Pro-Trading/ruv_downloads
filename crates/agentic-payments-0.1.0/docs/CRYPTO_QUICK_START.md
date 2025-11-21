# Crypto Layer Quick Start Guide

## Installation

The crypto layer is part of `agentic-payments`. All dependencies are already configured in `Cargo.toml`.

## Basic Usage

### 1. Generate an Agent Identity

```rust
use agentic_payments::crypto::AgentIdentity;

// Generate new identity with keypair and DID
let identity = AgentIdentity::generate()?;

// Get the DID (Decentralized Identifier)
println!("Agent DID: {}", identity.did());

// Get the UUID
println!("Agent ID: {}", identity.id());
```

### 2. Sign and Verify Messages

```rust
// Sign a message
let message = b"Payment authorization for $100";
let signature = identity.sign(message)?;

// Verify the signature
let is_valid = identity.verify(message, &signature)?;
assert!(is_valid);

// Verify with wrong message fails
let wrong_message = b"Different message";
assert!(!identity.verify(wrong_message, &signature)?);
```

### 3. Use Signature Manager (with caching)

```rust
use agentic_payments::crypto::SignatureManager;
use std::time::Duration;

// Create manager with 5-minute cache
let manager = SignatureManager::with_cache_ttl(Duration::from_secs(300));

// Verify signature (first time - not cached)
let result = manager.verify(
    &identity.verifying_key(),
    message,
    &signature
).await?;

println!("Valid: {}, Cached: {}", result.is_valid, result.cached);

// Second verification (cached - much faster!)
let result2 = manager.verify(
    &identity.verifying_key(),
    message,
    &signature
).await?;

println!("Cached: {}", result2.cached); // true

// Get cache statistics
let stats = manager.cache_stats().await;
println!("Cache hit rate: {:.2}%", stats.hit_rate());
```

### 4. Key Management

```rust
use agentic_payments::crypto::{KeyPair, KeyManager};

// Create key manager (in-memory)
let manager = KeyManager::new();

// Or with persistent storage
let manager = KeyManager::with_storage("./keys");

// Generate and store a keypair
let keypair = KeyPair::generate()?;
let key_id = manager.store("agent-1".to_string(), keypair).await?;

// Retrieve by ID
let keypair = manager.get(&key_id).await?;

// Or retrieve by alias
let keypair = manager.get_by_alias("agent-1").await?;

// List all keys
let key_ids = manager.list().await;
let aliases = manager.list_aliases().await;

// Remove a key
manager.remove(&key_id).await?;
```

### 5. Batch Verification

```rust
use agentic_payments::crypto::{BatchVerifier, VerificationItem};

// Create batch verifier
let verifier = BatchVerifier::new();

// Prepare items
let mut items = Vec::new();
for (msg, sig, pk) in signatures {
    items.push(VerificationItem::new(pk, msg, sig));
}

// Verify all in parallel
let result = verifier.verify_batch(items).await?;

println!("Results: {}/{} valid", result.valid, result.total);
println!("Success rate: {:.1}%", result.success_rate());
println!("Throughput: {:.0} verifications/second", result.throughput);

// Check invalid signatures
for item in result.invalid_items() {
    println!("Invalid: {:?}", item.error);
}

// For large batches (auto-chunking)
let result = verifier.verify_large_batch(large_items).await?;
```

### 6. DID Documents

```rust
// Generate DID document from identity
let did_doc = identity.to_did_document();

// Serialize to JSON
let json = serde_json::to_string_pretty(&did_doc)?;
println!("DID Document:\n{}", json);

// Validate the document
did_doc.validate()?;

// Access verification methods
for method in &did_doc.verification_method {
    println!("Key ID: {}", method.id);
    println!("Type: {}", method.type_);
    println!("Public Key: {}", method.public_key_multibase);
}
```

## Common Patterns

### Pattern 1: Agent Authentication

```rust
async fn authenticate_agent(
    identity: &AgentIdentity,
    challenge: &[u8]
) -> Result<Signature> {
    // Sign the challenge
    identity.sign(challenge)
}

async fn verify_agent(
    public_key: &VerifyingKey,
    challenge: &[u8],
    signature: &Signature,
    manager: &SignatureManager
) -> Result<bool> {
    // Verify with caching
    let result = manager.verify(public_key, challenge, signature).await?;
    Ok(result.is_valid)
}
```

### Pattern 2: Secure Key Storage

```rust
async fn setup_agent_keys(storage_path: &str) -> Result<KeyManager> {
    // Create manager with persistent storage
    let manager = KeyManager::with_storage(storage_path);

    // Load existing keys
    let count = manager.load_from_storage().await?;
    println!("Loaded {} existing keys", count);

    Ok(manager)
}

async fn create_or_load_agent(
    manager: &KeyManager,
    agent_name: &str
) -> Result<AgentIdentity> {
    // Try to load existing key
    if manager.alias_exists(agent_name).await {
        let keypair = manager.get_by_alias(agent_name).await?;
        keypair.to_identity()
    } else {
        // Create new identity
        let identity = AgentIdentity::generate()?;
        let keypair = KeyPair::from_bytes(&identity.to_bytes())?;
        manager.store(agent_name.to_string(), keypair).await?;
        Ok(identity)
    }
}
```

### Pattern 3: Batch Payment Verification

```rust
async fn verify_payment_signatures(
    payments: Vec<Payment>,
    verifier: &BatchVerifier
) -> Result<BatchResult> {
    let items: Vec<_> = payments
        .into_iter()
        .map(|p| VerificationItem::with_id(
            p.id,
            p.public_key,
            p.message,
            p.signature
        ))
        .collect();

    verifier.verify_batch(items).await
}
```

## Error Handling

All operations return `Result<T, Error>`:

```rust
use agentic_payments::error::{Error, Result};

match identity.verify(message, &signature) {
    Ok(true) => println!("Valid signature"),
    Ok(false) => println!("Invalid signature"),
    Err(Error::Crypto(msg)) => println!("Crypto error: {}", msg),
    Err(Error::KeyNotFound(id)) => println!("Key not found: {}", id),
    Err(e) => println!("Other error: {}", e),
}
```

## Performance Tips

1. **Use SignatureManager for repeated verifications** - caching provides 10x speedup
2. **Batch verification for multiple signatures** - parallel processing
3. **Reuse KeyManager instances** - avoid repeated storage I/O
4. **Configure appropriate cache TTL** - balance memory vs. speed
5. **Use `verify_large_batch` for >1000 items** - automatic chunking

## Security Best Practices

1. **Never log private keys** - they're automatically redacted in Debug output
2. **Keys are zeroized on drop** - no manual cleanup needed
3. **Use persistent storage carefully** - ensure proper file permissions
4. **Validate DID documents** - call `.validate()` before use
5. **Use unique aliases** - prevent key confusion

## Testing

```rust
#[tokio::test]
async fn test_agent_workflow() {
    let identity = AgentIdentity::generate().unwrap();
    let message = b"test";
    let signature = identity.sign(message).unwrap();
    assert!(identity.verify(message, &signature).unwrap());
}
```

## File Locations

```
/workspaces/agentic-calalog/crates/agentic-payments/src/
├── error.rs              # Error types
└── crypto/
    ├── mod.rs            # Core exports and functions
    ├── identity.rs       # AgentIdentity, DID support
    ├── signature.rs      # SignatureManager, caching
    ├── keys.rs           # KeyPair, KeyManager, storage
    └── batch.rs          # BatchVerifier, parallel verification
```

## Next Steps

1. Read the [full implementation guide](../CRYPTO_IMPLEMENTATION.md)
2. Check out the test files for more examples
3. Integrate with consensus layer
4. Implement AP2 protocol handlers
5. Add trust chain validation

## Support

For issues or questions:
- Check test files in each module
- Read inline documentation (`cargo doc --open`)
- See CRYPTO_IMPLEMENTATION.md for detailed specs