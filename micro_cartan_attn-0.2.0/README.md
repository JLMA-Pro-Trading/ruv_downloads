# micro_cartan_attn - Cartan Matrix Attention Mechanisms

[![Crates.io](https://img.shields.io/crates/v/micro_cartan_attn.svg)](https://crates.io/crates/micro_cartan_attn)
[![Documentation](https://docs.rs/micro_cartan_attn/badge.svg)](https://docs.rs/micro_cartan_attn)
[![License](https://img.shields.io/badge/license-Apache%202.0%20OR%20MIT-blue.svg)](LICENSE)

**Cartan matrix-constrained attention mechanisms for semantic coherence**

This crate implements attention mechanisms that maintain Cartan matrix constraints for preserving orthogonal semantic relationships in neural networks. It provides structured attention patterns based on Lie algebra principles.

## ✅ Implemented Features

- **CartanAttention**: Attention mechanism enforcing Cartan matrix constraints
- **MultiHeadCartanAttention**: Multi-head attention with different Cartan matrix types
- **Compliance-based Scoring**: Attention weights based on Cartan constraint adherence
- **Orthogonalization**: Basic Gram-Schmidt orthogonalization (placeholder)
- **Regularization**: Constraint enforcement during training (placeholder)

## ❌ Not Yet Implemented

- **Complete Orthogonalizer**: Only stub implementation exists
- **Training Integration**: No actual optimization loops
- **Complex Cartan Types**: Only identity and basic types implemented
- **SIMD Attention**: No vectorized attention computations
- **Positional Encoding**: Placeholder implementation only

## 📦 Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
micro_cartan_attn = { path = "../micro_cartan_attn" }
micro_core = { path = "../micro_core" }
```

## 🏗️ Core Components

### CartanAttention

Basic Cartan-constrained attention mechanism:

```rust
use micro_cartan_attn::{CartanAttention, AttentionConfig};
use micro_core::{RootVector, CartanMatrix};

// Create Cartan matrix (identity by default)
let cartan_matrix = CartanMatrix::default();

// Configure attention
let config = AttentionConfig {
    orthogonalize_output: true,
    regularize_attention: true,
    temperature: 1.0,
    normalize_input: true,
};

// Create attention mechanism
let mut attention = CartanAttention::with_config(cartan_matrix, config)?;

// Apply attention to vector sequence
let vectors = vec![
    RootVector::from_array([1.0, 0.0, /* ... 30 more zeros ... */]),
    RootVector::from_array([0.0, 1.0, /* ... 30 more zeros ... */]),
];

let attended = attention.apply_attention(&vectors)?;
let weights = attention.attention_weights()?;
```

### MultiHeadCartanAttention

Multi-head attention with different Cartan constraint types:

```rust
use micro_cartan_attn::MultiHeadCartanAttention;

// Create different Cartan matrices for each head
let matrices = vec![
    CartanMatrix::default(),         // Identity
    CartanMatrix::default(),         // Another identity (placeholder)
];

let mut multi_head = MultiHeadCartanAttention::new(matrices)?;

// Set custom output weights
multi_head.set_output_weights(vec![0.6, 0.4])?;

// Apply multi-head attention
let output = multi_head.apply_attention(&input_vectors)?;
```

## 🧮 Mathematical Foundation

### Cartan Matrix Constraints

The attention mechanism enforces compliance with Cartan matrix relationships:

```rust
// Attention scoring based on Cartan compliance
for (i, vector) in vectors.iter().enumerate() {
    let mut score = 0.0;
    
    // Score based on inner product compliance
    for (j, other_vector) in vectors.iter().enumerate() {
        if i != j {
            let actual_inner = vector.dot(other_vector);
            let target_inner = cartan_matrix.entry(i, j);
            let compliance = (-((actual_inner - target_inner).powi(2))).exp();
            score += compliance;
        }
    }
    
    // Score based on norm compliance (Cartan normalization)
    let norm = vector.magnitude();
    let target_norm = (2.0_f32).sqrt(); // ⟨αᵢ, αᵢ⟩ = 2
    let norm_compliance = (-((norm - target_norm).powi(2))).exp();
    score += norm_compliance;
}
```

### Attention Process

1. **Input Normalization**: Optional vector normalization
2. **Compliance Scoring**: Compute how well vectors satisfy Cartan constraints
3. **Softmax Weighting**: Apply temperature scaling and softmax normalization
4. **Attention Application**: Weight vectors by attention scores
5. **Regularization**: Apply constraint enforcement (placeholder)
6. **Orthogonalization**: Maintain orthogonal relationships (placeholder)

## 🔧 Configuration

### AttentionConfig

```rust
use micro_cartan_attn::AttentionConfig;

let config = AttentionConfig {
    orthogonalize_output: true,    // Apply orthogonalization after attention
    regularize_attention: true,    // Apply regularization during attention
    temperature: 1.0,              // Temperature for softmax
    normalize_input: true,         // Normalize input vectors
};
```

### Feature Flags

```toml
[features]
default = ["gram-schmidt"]
std = ["serde?/std", "nalgebra/std"]
serde = ["dep:serde", "dep:serde_json"]
gram-schmidt = []               # Gram-Schmidt orthogonalization (placeholder)
training = []                   # Training-time features (placeholder)
simd = []                      # SIMD optimizations (not implemented)
analysis = []                  # Analysis tools (not implemented)
```

## 📊 Performance

### Current Implementation

The current implementation focuses on correctness over performance:

- **Attention Computation**: O(n²) for n vectors
- **Memory Usage**: Minimal allocation, works in no_std
- **SIMD**: Not yet implemented
- **Batching**: Not yet implemented

### Benchmarks (Estimated)

| Operation | Time (μs) | Notes |
|-----------|-----------|-------|
| CartanAttention (2 vectors) | ~5-15 | Basic compliance scoring |
| MultiHead (4 heads) | ~20-60 | 4x single head cost |
| Orthogonalization | ~10-30 | Placeholder implementation |

## ⚠️ Current Limitations

1. **Stub Implementations**: Many components are placeholders
2. **No Training Integration**: Missing optimization and backpropagation
3. **Limited Cartan Types**: Only identity matrices fully implemented
4. **No SIMD**: Performance not optimized
5. **Basic Testing**: Limited test coverage
6. **Missing Features**: Positional encoding, masking, etc.

## 🧪 Testing

```bash
# Run unit tests
cargo test

# Test with micro_core integration
cargo test --features integration-tests

# Test serialization
cargo test --features serde
```

### Test Coverage

Current tests cover:

- Basic attention mechanism creation
- Attention score computation
- Multi-head attention functionality
- Integration with micro_core types

Missing tests:

- Property-based testing for mathematical correctness
- Performance benchmarking
- Edge case handling
- Cartan constraint verification

## 📈 Roadmap

### Phase 1: Core Functionality
- [ ] Complete orthogonalization implementations
- [ ] Add more Cartan matrix types (A_n, D_n, E_8)
- [ ] Implement proper regularization
- [ ] Add comprehensive testing

### Phase 2: Performance
- [ ] SIMD-accelerated attention computation
- [ ] Batch processing support
- [ ] Memory-efficient attention for long sequences
- [ ] Performance benchmarking suite

### Phase 3: Advanced Features
- [ ] Training integration with backpropagation
- [ ] Positional encoding implementations
- [ ] Attention masking support
- [ ] Analysis and visualization tools

## 📚 Examples

Current examples demonstrate:

- Basic attention mechanism usage
- Multi-head attention configuration
- Integration with micro_core types

Planned examples:

- Training integration examples
- Performance optimization examples
- Cartan constraint analysis

## 🤝 Contributing

This is part of a research project. Contributions welcome for:

- Implementing placeholder components
- Adding comprehensive tests
- Performance optimizations
- Mathematical correctness verification
- Documentation improvements

## 📄 License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](../LICENSE-APACHE))
- MIT License ([LICENSE-MIT](../LICENSE-MIT))

at your option.

## 🔗 Related Crates

- [`micro_core`](../micro_core): Core types and mathematical structures
- [`micro_routing`](../micro_routing): Dynamic routing using attention mechanisms
- [`micro_metrics`](../micro_metrics): Performance monitoring and analysis
- [`micro_swarm`](../micro_swarm): High-level orchestration with attention-based coordination

---

**Part of the rUv-FANN Semantic Cartan Matrix system** - Research implementation of Cartan matrix-inspired attention mechanisms.