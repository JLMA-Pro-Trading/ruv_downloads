# micro_core - Core Mathematical Structures

[![Crates.io](https://img.shields.io/crates/v/micro_core.svg)](https://crates.io/crates/micro_core)
[![Documentation](https://docs.rs/micro_core/badge.svg)](https://docs.rs/micro_core)
[![License](https://img.shields.io/badge/license-Apache%202.0%20OR%20MIT-blue.svg)](LICENSE)

**Core mathematical structures for the Semantic Cartan Matrix system**

This crate provides the fundamental mathematical types and operations for working with 32-dimensional root vectors and Cartan matrices in the rUv-FANN Semantic Cartan Matrix architecture.

## ✅ Implemented Features

- **RootVector**: 32-dimensional SIMD-aligned vector type with basic operations
- **RootSpace**: Orthogonal vector space with Cartan normalization (⟨αᵢ, αᵢ⟩ = 2)
- **CartanMatrix**: Basic Cartan matrix representation and operations
- **SIMD Operations**: Partial SIMD support for dot products and vector operations
- **no_std Compatible**: Works in embedded and WebAssembly environments

## 📦 Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
micro_core = { path = "../micro_core" }
```

## 🏗️ Core Types

### RootVector

32-dimensional SIMD-aligned vector for semantic embeddings:

```rust
use micro_core::RootVector;

// Create vectors
let mut vector = RootVector::zero();
vector[0] = 1.0;
vector[1] = 0.5;

// Basic operations
let magnitude = vector.magnitude();
vector.normalize();

// SIMD-accelerated dot product
let other = RootVector::zero();
let similarity = vector.dot(&other);

// Vector arithmetic
let sum = vector.add(&other);
vector.add_assign(&other);
vector.scale(2.0);
```

### RootSpace

32-dimensional orthogonal vector space:

```rust
use micro_core::RootSpace;

// Create root space with orthonormal basis
let space = RootSpace::new();

// Project high-dimensional data to root space
let high_dim_data = vec![0.1, 0.2, 0.3, /* ... more values ... */];
let root_vector = space.project(&high_dim_data);

// Verify Cartan normalization: ⟨αᵢ, αᵢ⟩ = 2
for basis_vector in &space.basis {
    let norm_squared = basis_vector.dot(basis_vector);
    assert!((norm_squared - 2.0).abs() < 0.01);
}
```

### CartanMatrix

Cartan matrix representation with basic operations:

```rust
use micro_core::CartanMatrix;

// Create identity Cartan matrix
let cartan = CartanMatrix::default(); // Identity with 2's on diagonal

// Create from basis vectors
let space = RootSpace::new();
let cartan_from_basis = CartanMatrix::from_basis(&space.basis);

// Compute distance between matrices
let distance = cartan.frobenius_distance(&cartan_from_basis);
```

## 🎯 Mathematical Foundation

### Cartan Matrix Theory

The implementation follows Cartan matrix conventions from Lie algebra:

- **Root System**: {α₁, α₂, ..., α₃₂} orthogonal basis vectors
- **Cartan Matrix**: C_{ij} = 2⟨αᵢ, αⱼ⟩/⟨αⱼ, αⱼ⟩
- **Normalization**: ⟨αᵢ, αᵢ⟩ = 2 (Cartan convention)
- **Orthogonality**: ⟨αᵢ, αⱼ⟩ = 0 for i ≠ j

### SIMD Optimizations

Platform-specific vectorized operations are partially implemented:

- **x86/x86_64**: Uses wide crate for SIMD (when `simd` feature enabled)
- **WASM**: Uses WASM SIMD intrinsics (when `simd-wasm` feature enabled)
- **Fallback**: Scalar operations for other platforms

## 🔧 Configuration

### Feature Flags

```toml
[features]
default = []
std = []                    # Enable standard library features
simd = []                   # Platform-specific SIMD optimizations
wasm = ["wasm-bindgen"]     # WebAssembly support
serde = ["dep:serde"]       # Serialization support
```

### no_std Usage

The crate works in `no_std` environments:

```rust
#![no_std]
extern crate alloc;

use micro_core::{RootVector, RootSpace};
use alloc::vec::Vec;

// All core functionality available in no_std
let vector = RootVector::zero();
let space = RootSpace::new();
```

## 📊 Performance

### Benchmarks (Estimated)

| Operation | Scalar (ns) | SIMD (ns) | Speedup |
|-----------|-------------|-----------|---------|
| Dot Product (32D) | ~120 | ~35 | 3.4x |
| Vector Normalization | ~95 | ~30 | 3.2x |
| Matrix Projection | ~1,200 | ~400 | 3.0x |

### Memory Layout

- **RootVector**: 128 bytes (32 × f32), 16-byte aligned
- **RootSpace**: ~4KB for basis vectors + matrix
- **CartanMatrix**: 4KB (32×32 × f32)

## ⚠️ Current Limitations

1. **SIMD**: Only partial implementation, not all operations vectorized
2. **Error Handling**: Basic error types, not comprehensive
3. **Testing**: Limited test coverage
4. **Documentation**: Missing some API examples
5. **Performance**: Not fully optimized for production

## 🧪 Testing

```bash
# Run unit tests
cargo test

# Test with SIMD features
cargo test --features simd

# Test WASM build
wasm-pack test --node
```

## 📈 Roadmap

- [ ] Complete SIMD implementations for all operations
- [ ] Comprehensive test suite with property-based testing
- [ ] Benchmarking and performance optimization
- [ ] Better error handling and validation
- [ ] More Cartan matrix types (A_n, D_n, E_8, etc.)

## 📚 Examples

See the [`examples/`](examples/) directory for:

- **basic_usage.rs**: Basic vector and matrix operations
- More examples coming as implementation progresses

## 🤝 Contributing

This is part of a research project. Contributions welcome for:

- Completing SIMD implementations
- Adding comprehensive tests
- Performance optimizations
- Documentation improvements

## 📄 License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](../LICENSE-APACHE))
- MIT License ([LICENSE-MIT](../LICENSE-MIT))

at your option.

## 🔗 Related Crates

- [`micro_cartan_attn`](../micro_cartan_attn): Attention mechanisms using these core types
- [`micro_routing`](../micro_routing): Dynamic routing (placeholder implementation)
- [`micro_metrics`](../micro_metrics): Performance monitoring
- [`micro_swarm`](../micro_swarm): High-level orchestration

---

**Part of the rUv-FANN Semantic Cartan Matrix system** - A proof-of-concept implementation of Cartan matrix-inspired neural architectures.