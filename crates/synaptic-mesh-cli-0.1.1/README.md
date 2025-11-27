# Synaptic Mesh CLI

Complete CLI library for the Synaptic Neural Mesh project, integrating all components including the revolutionary Synaptic Market.

## Features

- **Complete Integration**: All Synaptic Neural Mesh components in one CLI
- **Synaptic Market**: Decentralized Claude-Max marketplace with full compliance
- **P2P Operations**: Launch and manage mesh nodes
- **Neural Networks**: Train and run WASM neural networks
- **Swarm Management**: Control distributed agent swarms
- **QuDAG Networking**: Quantum-resistant DAG operations
- **Token Wallet**: Manage RUV tokens for marketplace transactions

## Installation

```bash
cargo install synaptic-mesh-cli
```

## Usage

### Core Operations
```bash
# Start a mesh node
synaptic-mesh node start

# Create a swarm
synaptic-mesh swarm create --agents 100

# Train a neural network
synaptic-mesh neural train --model mymodel.json

# Query mesh status
synaptic-mesh status
```

### Synaptic Market Operations
```bash
# Initialize market (requires own Claude subscription)
synaptic-mesh market init

# View terms and compliance requirements
synaptic-mesh market terms

# Offer Claude capacity (with explicit opt-in)
synaptic-mesh market offer --slots 5 --price 10 --opt-in

# Bid for Claude capacity
synaptic-mesh market bid --task "Analyze data" --max-price 15

# Check market status
synaptic-mesh market status --detailed
```

### Wallet Operations
```bash
# Check RUV token balance
synaptic-mesh wallet balance

# Transfer tokens
synaptic-mesh wallet transfer --to peer-123 --amount 100

# View transaction history
synaptic-mesh wallet history
```

## Library Usage

```rust
use synaptic_mesh_cli::{MeshCommand, execute_command};

// Start a node
let cmd = MeshCommand::NodeStart { port: 8080 };
execute_command(cmd).await?;

// Initialize market
let cmd = MeshCommand::MarketInit { db_path: None };
execute_command(cmd).await?;

// Check wallet balance
let cmd = MeshCommand::WalletBalance;
let result = execute_command(cmd).await?;
```

## Compliance Notice

The Synaptic Market operates as a **peer compute federation**, not a resale service:

- ✅ **NO shared API keys** - Each participant uses their own Claude subscription
- ✅ **LOCAL execution** - Tasks run locally on provider's Claude account  
- ✅ **VOLUNTARY participation** - Full user control with explicit opt-in
- ✅ **TOKEN rewards** - RUV tokens reward contribution, not access purchase

All participants must maintain individual Claude subscriptions and comply with Anthropic's Terms of Service.

## License

MIT OR Apache-2.0