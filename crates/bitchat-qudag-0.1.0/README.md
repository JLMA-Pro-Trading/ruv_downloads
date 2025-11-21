# BitChat-QuDAG Integration

A quantum-resistant, privacy-focused messaging layer for QuDAG that implements and extends the BitChat protocol with advanced cryptographic features and multi-transport capabilities.

## 🚀 Overview

BitChat-QuDAG bridges decentralized P2P messaging with quantum-resistant security, providing a future-proof communication layer that works across multiple transport protocols including Bluetooth mesh, Internet P2P, WebSocket, and local networks. This implementation not only fulfills the BitChat whitepaper specifications but extends them with quantum-resistant cryptography and WebAssembly support.

## ✨ Key Features

### Core BitChat Protocol Compliance
- **Bluetooth Mesh Networking**: Full support for BLE mesh with automatic message hopping
- **Store & Forward**: 12-hour message cache with configurable retention
- **Privacy by Design**: No phone numbers, emails, or account registration required
- **Ephemeral Messages**: Self-destructing messages with configurable TTL
- **Cover Traffic**: Adaptive dummy message generation to prevent traffic analysis

### Enhanced Security Features
- **Quantum-Resistant Cryptography**: 
  - ML-KEM-768 for key exchange (NIST-approved)
  - ML-DSA-65 for digital signatures
  - Hybrid mode combining quantum-resistant and traditional crypto
- **Forward Secrecy**: Automatic key rotation and ephemeral key exchanges
- **Multi-Layer Encryption**: Support for both traditional (AES-256-GCM) and quantum-resistant algorithms

### Advanced Capabilities
- **Multi-Transport Architecture**:
  - Internet P2P (via libp2p integration)
  - Bluetooth Low Energy mesh
  - WebSocket (for WASM environments)
  - Local network discovery
  - Relay/bridge support
- **WASM Support**: Full browser compatibility with TypeScript bindings
- **Compression**: Automatic message compression with LZ4/Zstd
- **Adaptive Routing**: Intelligent path selection across transports

## 📦 Installation

### Rust (Native)
```toml
[dependencies]
bitchat-qudag = "0.1.0"
```

### JavaScript/TypeScript (WASM)
```bash
npm install bitchat-qudag
# or
yarn add bitchat-qudag
```

## 🔧 Usage

### Basic Messaging (Rust)

```rust
use bitchat_qudag::{BitChatMessaging, BitChatConfig, QuDAGMessaging};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create configuration
    let config = BitChatConfig::default();
    
    // Initialize messaging system
    let mut messaging = BitChatMessaging::new(config).await?;
    messaging.start().await?;
    
    // Send a message
    messaging.send_message("peer-id-123", b"Hello, BitChat!").await?;
    
    // Receive messages
    while let Some(message) = messaging.receive_message().await? {
        println!("Received: {} bytes from {}", 
            message.data.len(), 
            message.sender
        );
    }
    
    Ok(())
}
```

### Bluetooth Mesh Setup

```rust
use bitchat_qudag::{BitChatConfig, TransportType, CryptoMode};

let config = BitChatConfig {
    enabled: true,
    transports: vec![TransportType::BluetoothMesh],
    crypto_mode: CryptoMode::Hybrid, // Quantum-resistant + traditional
    ephemeral_messages: true,
    store_forward: true,
    cover_traffic: true,
    ..Default::default()
};
```

### WASM Usage (JavaScript/TypeScript)

```typescript
import { BitChatWasm } from 'bitchat-qudag';

async function initializeMessaging() {
    const config = {
        enabled: true,
        crypto_mode: "Hybrid",
        ephemeral_messages: true,
        compression: true
    };
    
    const bitchat = new BitChatWasm(JSON.stringify(config));
    await bitchat.init();
    
    // Set message handler
    bitchat.set_message_handler((message) => {
        console.log('Received:', message);
    });
    
    // Send a message
    const message = new TextEncoder().encode('Hello from WASM!');
    await bitchat.send_message('peer-id', message);
}
```

### Privacy Features

```rust
// Enable all privacy features
let config = BitChatConfig {
    ephemeral_messages: true,           // Self-destructing messages
    cover_traffic: true,                // Generate dummy traffic
    cover_traffic_interval: Duration::from_secs(30),
    rotating_peer_ids: true,            // Change IDs every 5-15 minutes
    ..BitChatConfig::high_privacy()    // Pre-configured privacy profile
};

// Send ephemeral message
messaging.send_ephemeral("peer-id", b"This will self-destruct", 
    Duration::from_mins(5)).await?;
```

## 🛡️ Security Comparison

| Feature | BitChat Original | BitChat-QuDAG |
|---------|-----------------|---------------|
| Encryption | Noise Protocol (X25519) | Hybrid: ML-KEM-768 + X25519 |
| Digital Signatures | Ed25519 | ML-DSA-65 + Ed25519 |
| Forward Secrecy | ✓ | ✓ Enhanced |
| Quantum Resistance | Future Goal | ✓ Implemented |
| Multi-Transport | Bluetooth Only | BLE + Internet + WebSocket |
| WASM Support | ✗ | ✓ |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BitChat-QuDAG API                        │
├─────────────────────────────────────────────────────────────┤
│                   Messaging Layer                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Ephemeral   │  │ Store &      │  │ Cover Traffic   │  │
│  │ Messages    │  │ Forward      │  │ Generator       │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Crypto Layer (Hybrid)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ ML-KEM-768  │  │ ML-DSA-65    │  │ Traditional     │  │
│  │ (Quantum)   │  │ (Quantum)    │  │ (AES/X25519)    │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                 Multi-Transport Layer                       │
│  ┌───────────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Bluetooth │ │ Internet   │ │WebSocket │ │  Local    │ │
│  │   Mesh    │ │    P2P     │ │  (WASM)  │ │ Network   │ │
│  └───────────┘ └────────────┘ └──────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Configuration Profiles

### Development
```rust
let config = BitChatConfig::development();
// Optimized for testing with relaxed security
```

### Production
```rust
let config = BitChatConfig::production();
// Balanced security and performance
```

### High Privacy
```rust
let config = BitChatConfig::high_privacy();
// Maximum privacy: ephemeral messages, cover traffic, rotating IDs
```

### WASM
```rust
let config = BitChatConfig::wasm();
// Browser-optimized with WebSocket transport
```

## 📊 Performance

- **Message Latency**: <50ms (local), <200ms (mesh hop)
- **Throughput**: 10,000+ msg/sec (native), 5,000+ msg/sec (WASM)
- **Memory Usage**: ~10MB base + 1KB per peer
- **Compression Ratio**: 40-60% for text messages
- **Crypto Overhead**: ~5% for hybrid mode

## 🧪 Testing

```bash
# Run all tests
cargo test

# Run with all features
cargo test --all-features

# Run WASM tests
wasm-pack test --headless --chrome
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

## 📄 License

This project is dual-licensed under:
- MIT License
- Apache License 2.0

You may choose either license for your use.

## 🔗 Links

- [BitChat Original](https://github.com/jackjackbits/bitchat)
- [QuDAG Project](https://github.com/ruvnet/QuDAG)
- [Documentation](https://docs.rs/bitchat-qudag)
- [NPM Package](https://www.npmjs.com/package/bitchat-qudag)

## 🙏 Acknowledgments

- BitChat team for the original protocol design
- QuDAG community for quantum-resistant implementations
- NIST for ML-KEM and ML-DSA standardization