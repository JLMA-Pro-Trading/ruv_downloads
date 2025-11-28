# Neural DNA WASM Module

WebAssembly bindings for the Neural DNA system, enabling evolutionary AI in the browser.

## 🚀 Features

- **Zero-copy serialization** with `serde-wasm-bindgen`
- **Web & Node.js support** with separate build targets
- **Optimized for size** with wasm-opt and aggressive optimizations
- **Performance monitoring** with built-in timing utilities
- **Memory efficient** with optional wee_alloc allocator

## 📦 Building

### Prerequisites

```bash
# Install Rust with wasm32 target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Optional: Install wasm-opt for size optimization
npm install -g wasm-opt
```

### Build for Web

```bash
cd /workspaces/ruv-FANN/neural_dna
./build-wasm.sh
```

### Build for Node.js

```bash
./build-wasm.sh --node
```

## 🌐 Web Demo

1. Build the WASM module:
   ```bash
   ./build-wasm.sh
   ```

2. Start the demo server:
   ```bash
   cd web-demo
   ./server.py
   ```

3. Open http://localhost:8080 in your browser

## 📊 Size Optimization

The build script automatically applies several optimizations:

1. **Release profile optimizations**:
   - `opt-level = "z"` - Optimize for size
   - `lto = true` - Link Time Optimization
   - `codegen-units = 1` - Better optimization
   - `strip = true` - Remove debug symbols

2. **wasm-opt post-processing**:
   - `-Oz` flag for aggressive size optimization
   - Typically reduces size by 10-20%

3. **Optional wee_alloc**:
   - Smaller allocator for WASM
   - Saves ~10KB compared to default allocator

## 🔧 JavaScript API

### Creating DNA

```javascript
import init, { WasmNeuralDNA } from './pkg/neural_dna.js';

await init();

// Create random DNA
const dna = WasmNeuralDNA.random([4, 8, 4, 2], "sigmoid");

// Access properties
console.log(dna.topology);    // [4, 8, 4, 2]
console.log(dna.generation);  // 0
console.log(dna.weights);     // Float32Array
```

### Mutation

```javascript
// Simple mutation
dna.mutate("all");

// With custom policy
const policy = {
    weight_mutation_rate: 0.2,
    bias_mutation_rate: 0.2,
    topology_mutation_rate: 0.05,
    // ... other settings
};

dna.mutate_with_policy(JSON.stringify(policy), "all");
```

### Evolution

```javascript
import { WasmEvolutionEngine } from './pkg/neural_dna.js';

// Create evolution engine
const engine = new WasmEvolutionEngine(
    100,  // population size
    10,   // elite count
    [4, 8, 4, 2],  // topology
    "sigmoid"      // activation
);

// Run evolution
for (let i = 0; i < 100; i++) {
    engine.evolve_generation();
    
    const stats = engine.get_statistics();
    console.log(`Gen ${stats.generation}: ${stats.best_fitness}`);
}

// Get best DNA
const bestDNA = engine.get_best_dna();
```

### Performance Monitoring

```javascript
import { PerformanceTimer } from './pkg/neural_dna.js';

const timer = new PerformanceTimer();

// Do some work...
engine.evolve_generation();

console.log(`Elapsed: ${timer.elapsed()}ms`);
```

## 🎯 Bundle Size

Typical sizes after optimization:

- WASM module: ~150-200KB
- JavaScript glue: ~20-30KB
- Total gzipped: ~60-80KB

## 🔐 Security Considerations

- WASM runs in a sandboxed environment
- No file system access
- Memory isolated from JavaScript
- Safe Rust prevents buffer overflows

## 🚨 Browser Requirements

- WebAssembly support (all modern browsers)
- ES6 modules
- For SharedArrayBuffer (future): COOP/COEP headers

## 📈 Performance Tips

1. **Batch operations** - Minimize JS/WASM boundary crossings
2. **Use typed arrays** - For passing large data sets
3. **Avoid frequent serialization** - Keep data in WASM when possible
4. **Web Workers** - Run evolution in background thread

## 🐛 Debugging

Enable debug symbols in development:

```toml
[profile.dev]
debug = true
opt-level = 0
```

Use browser DevTools WASM debugging:
- Chrome: Enable "WebAssembly Debugging" in experiments
- Firefox: Built-in WASM debugging support

## 📚 Examples

See `/web-demo` for a complete example application demonstrating:
- Real-time evolution visualization
- Performance monitoring
- Interactive parameter adjustment
- Network topology visualization