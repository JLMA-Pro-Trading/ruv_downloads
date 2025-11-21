# Building for WebAssembly

## Quick Start

```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build for web (browser)
wasm-pack build --target web --features wasm --no-default-features --out-dir examples/wasm/pkg

# Build for Node.js
wasm-pack build --target nodejs --features wasm --no-default-features --out-dir examples/wasm/pkg-node

# Build for bundlers (Webpack, Vite, etc.)
wasm-pack build --target bundler --features wasm --no-default-features --out-dir examples/wasm/pkg-bundler
```

## Current Status

⚠️ **WASM build is partially implemented** - The core cryptographic functionality is ready, but full agent system support requires additional work.

### ✅ What Works
- Ed25519 signature generation
- Ed25519 signature verification
- Agent identity creation
- DID generation
- Key serialization/deserialization
- Base64/Hex encoding utilities

### ❌ What Needs Work
- Full agent pool coordination (requires async runtime)
- Byzantine fault tolerance (requires tokio)
- Consensus mechanisms (requires async runtime)
- AP2 credential verification (requires DID library without OpenSSL)

## Implementation Steps Completed

1. ✅ Created WASM module structure (`src/wasm/`)
2. ✅ Added wasm-bindgen dependencies
3. ✅ Implemented JavaScript bindings
4. ✅ Created browser and Node.js examples
5. ✅ Added WASM-friendly error handling
6. ⚠️ Configured feature flags (partial - crypto works, agents need more work)

## Next Steps

To complete WASM support:

1. **Conditional Compilation**: Add `#[cfg(not(target_arch = "wasm32"))]` to agent pool modules
2. **Async Runtime**: Replace tokio with wasm-bindgen-futures for WASM async
3. **Error Types**: Make error types WASM-compatible (remove `Instant` timestamps)
4. **AP2 Credentials**: Find alternative to `ssi` crate that compiles to WASM

## Testing

```bash
# Test in browser
cd examples/wasm
npm run build
npm run serve
# Open http://localhost:8080/browser-example.html

# Test in Node.js
npm run test:node
```

## File Structure

```
src/wasm/
├── mod.rs          # Main WASM module
├── bindings.rs     # wasm-bindgen bindings
├── error.rs        # WASM-friendly errors
├── types.rs        # JavaScript types
└── utils.rs        # Utility functions

examples/wasm/
├── package.json            # NPM scripts
├── browser-example.html    # Browser demo
├── node-example.js         # Node.js demo
└── README.md              # Usage documentation
```

## Known Issues

1. **Tokio incompatibility**: The async runtime doesn't support WASM without significant changes
2. **OpenSSL dependency**: The `ssi` crate uses OpenSSL which doesn't compile to WASM
3. **std::time::Instant**: Not available in WASM, needs replacement with web APIs
4. **Agent pools**: Require conditional compilation to work in WASM

## Workaround for Now

For immediate WASM usage, use the core crypto functions directly:

```javascript
import init, { AgentIdentity, verify } from './pkg/agentic_payments.js';

await init();

// This works!
const identity = AgentIdentity.generate();
const signature = identity.sign("message");
const valid = await verify(signature, "message", identity.publicKey());
```

The full agent system with consensus will require additional architectural changes to support WASM's single-threaded, async-only execution model.