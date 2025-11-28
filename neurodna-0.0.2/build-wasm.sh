#!/bin/bash

# Build script for Neural DNA WASM

echo "Building Neural DNA WASM module..."

# Install wasm-pack if not available
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build the WASM module
echo "Building WASM..."
wasm-pack build \
    --target web \
    --out-dir pkg \
    --release \
    -- --lib

# Optimize the WASM file if wasm-opt is available
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing WASM with wasm-opt..."
    wasm-opt -Oz \
        -o pkg/neural_dna_bg_optimized.wasm \
        pkg/neural_dna_bg.wasm
    mv pkg/neural_dna_bg_optimized.wasm pkg/neural_dna_bg.wasm
else
    echo "wasm-opt not found. Skipping optimization."
    echo "Install with: npm install -g wasm-opt"
fi

# Create a simple package.json for the generated package
cat > pkg/package.json << EOF
{
  "name": "neural-dna-wasm",
  "version": "0.1.0",
  "description": "Neural DNA WASM bindings",
  "main": "neural_dna.js",
  "types": "neural_dna.d.ts",
  "files": [
    "neural_dna_bg.wasm",
    "neural_dna.js",
    "neural_dna.d.ts"
  ],
  "module": "neural_dna.js",
  "sideEffects": false
}
EOF

echo "WASM build complete! Output in ./pkg/"
echo "File sizes:"
ls -lh pkg/*.wasm 2>/dev/null || echo "No WASM files found"

# Check if we should also build for Node.js
if [ "$1" == "--node" ]; then
    echo "Building for Node.js..."
    wasm-pack build \
        --target nodejs \
        --out-dir pkg-node \
        --release \
        -- --lib
    echo "Node.js build complete! Output in ./pkg-node/"
fi