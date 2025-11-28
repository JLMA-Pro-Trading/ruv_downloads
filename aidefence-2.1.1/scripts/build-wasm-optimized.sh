#!/bin/bash
# Optimized WASM Build Script for AIMDS
# This script builds all AIMDS crates for WASM with maximum optimization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TARGET="wasm32-unknown-unknown"
PROFILE="wasm-release"
BUILD_DIR="target/${TARGET}/${PROFILE}"
OUTPUT_DIR="wasm-output"
CRATES=("aimds-core" "aimds-detection" "aimds-analysis" "aimds-response")

echo -e "${GREEN}AIMDS WASM Optimization Build${NC}"
echo "================================"

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v rustc &> /dev/null; then
    echo -e "${RED}Error: Rust is not installed${NC}"
    exit 1
fi

if ! rustup target list | grep -q "${TARGET} (installed)"; then
    echo "Installing WASM target..."
    rustup target add ${TARGET}
fi

WASM_OPT=""
if command -v wasm-opt &> /dev/null; then
    WASM_OPT="wasm-opt"
elif command -v npx &> /dev/null; then
    echo "wasm-opt not found, using npx fallback"
    WASM_OPT="npx wasm-opt@latest"
else
    echo -e "${YELLOW}Warning: wasm-opt not found. Install with: cargo install wasm-opt${NC}"
    echo -e "${YELLOW}Continuing without post-build optimization...${NC}"
fi

# Create output directory
mkdir -p ${OUTPUT_DIR}

# Build each crate
echo -e "\n${GREEN}Building WASM crates...${NC}"
for crate in "${CRATES[@]}"; do
    echo -e "\n${YELLOW}Building ${crate}...${NC}"

    # Convert crate name to library name (replace - with _)
    lib_name="${crate//-/_}"

    # Build with Cargo
    cargo build \
        --package ${crate} \
        --target ${TARGET} \
        --features wasm \
        --profile ${PROFILE} \
        --no-default-features

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${crate} built successfully${NC}"

        # Get original size
        wasm_file="${BUILD_DIR}/${lib_name}.wasm"
        if [ -f "${wasm_file}" ]; then
            original_size=$(du -h "${wasm_file}" | cut -f1)
            echo "  Original size: ${original_size}"

            # Optimize with wasm-opt if available
            if [ -n "${WASM_OPT}" ]; then
                echo "  Running wasm-opt..."
                opt_file="${OUTPUT_DIR}/${lib_name}_optimized.wasm"

                ${WASM_OPT} -Oz --enable-bulk-memory \
                    "${wasm_file}" \
                    -o "${opt_file}" 2>/dev/null

                if [ $? -eq 0 ]; then
                    opt_size=$(du -h "${opt_file}" | cut -f1)
                    echo -e "  ${GREEN}✓ Optimized size: ${opt_size}${NC}"

                    # Calculate reduction percentage
                    original_bytes=$(stat -f%z "${wasm_file}" 2>/dev/null || stat -c%s "${wasm_file}")
                    opt_bytes=$(stat -f%z "${opt_file}" 2>/dev/null || stat -c%s "${opt_file}")
                    reduction=$(awk "BEGIN {printf \"%.1f\", (1 - ${opt_bytes}/${original_bytes}) * 100}")
                    echo "  Size reduction: ${reduction}%"
                else
                    echo -e "${YELLOW}  Warning: wasm-opt failed for ${crate}${NC}"
                    cp "${wasm_file}" "${OUTPUT_DIR}/${lib_name}.wasm"
                fi
            else
                # Copy unoptimized if wasm-opt not available
                cp "${wasm_file}" "${OUTPUT_DIR}/${lib_name}.wasm"
            fi
        else
            echo -e "${RED}  Error: WASM file not found: ${wasm_file}${NC}"
        fi
    else
        echo -e "${RED}✗ Failed to build ${crate}${NC}"
        exit 1
    fi
done

# Generate summary report
echo -e "\n${GREEN}Build Summary${NC}"
echo "================================"
echo "Build profile: ${PROFILE}"
echo "Target: ${TARGET}"
echo "Output directory: ${OUTPUT_DIR}"
echo ""
echo "Bundle sizes:"

total_original=0
total_optimized=0

for crate in "${CRATES[@]}"; do
    lib_name="${crate//-/_}"
    wasm_file="${BUILD_DIR}/${lib_name}.wasm"
    opt_file="${OUTPUT_DIR}/${lib_name}_optimized.wasm"

    if [ -f "${opt_file}" ]; then
        size=$(du -h "${opt_file}" | cut -f1)
        echo "  ${crate}: ${size}"

        opt_bytes=$(stat -f%z "${opt_file}" 2>/dev/null || stat -c%s "${opt_file}")
        total_optimized=$((total_optimized + opt_bytes))
    elif [ -f "${OUTPUT_DIR}/${lib_name}.wasm" ]; then
        size=$(du -h "${OUTPUT_DIR}/${lib_name}.wasm" | cut -f1)
        echo "  ${crate}: ${size} (not optimized)"
    fi

    if [ -f "${wasm_file}" ]; then
        original_bytes=$(stat -f%z "${wasm_file}" 2>/dev/null || stat -c%s "${wasm_file}")
        total_original=$((total_original + original_bytes))
    fi
done

if [ ${total_original} -gt 0 ] && [ ${total_optimized} -gt 0 ]; then
    echo ""
    total_reduction=$(awk "BEGIN {printf \"%.1f\", (1 - ${total_optimized}/${total_original}) * 100}")
    echo -e "${GREEN}Total size reduction: ${total_reduction}%${NC}"
fi

# Generate usage instructions
cat > ${OUTPUT_DIR}/README.md << 'EOF'
# AIMDS WASM Binaries

This directory contains optimized WASM binaries for all AIMDS crates.

## Files

- `aimds_core_optimized.wasm` - Core types and abstractions
- `aimds_detection_optimized.wasm` - Fast-path detection layer
- `aimds_analysis_optimized.wasm` - Deep behavioral analysis
- `aimds_response_optimized.wasm` - Adaptive response layer

## Usage

### In Browser (JavaScript)

```javascript
// Load WASM module
const response = await fetch('aimds_detection_optimized.wasm');
const buffer = await response.arrayBuffer();
const module = await WebAssembly.instantiate(buffer);

// Use exported functions
const result = module.instance.exports.detect_threat(data);
```

### With wasm-bindgen

```bash
# Generate JavaScript bindings
wasm-bindgen aimds_detection_optimized.wasm \
  --out-dir ./pkg \
  --target web \
  --typescript
```

Then in your JavaScript:

```javascript
import init, { detect_threat } from './pkg/aimds_detection.js';

await init();
const result = detect_threat(data);
```

### With wasm-pack

```bash
# Build and generate npm package
wasm-pack build --target web --features wasm --release
cd pkg
npm publish
```

## Optimization Details

These binaries have been optimized with:
- Cargo profile: `wasm-release` with `opt-level = "z"`
- Link-time optimization (LTO): enabled
- Code generation units: 1
- Panic strategy: abort
- Post-build optimization: wasm-opt -Oz

Expected performance characteristics:
- 60-70% smaller than default builds
- Optimized for size over speed
- Single-threaded execution
- Panic = abort (no unwinding)

## Further Optimization

For even smaller bundles, consider:

```bash
# Brotli compression
brotli -9 aimds_detection_optimized.wasm

# Gzip compression
gzip -9 aimds_detection_optimized.wasm

# Serve with compression
# Set Content-Encoding: br or gzip headers
```

## Rebuilding

To rebuild these binaries:

```bash
cd ..
./scripts/build-wasm-optimized.sh
```

## Documentation

See `docs/WASM_OPTIMIZATION.md` for complete optimization guide.
EOF

echo -e "\n${GREEN}✓ Build complete!${NC}"
echo "Output files available in: ${OUTPUT_DIR}/"
echo ""
echo "Next steps:"
echo "  1. Generate JavaScript bindings with wasm-bindgen"
echo "  2. Test in browser environment"
echo "  3. Deploy with compression enabled"
echo ""
echo "For usage instructions, see: ${OUTPUT_DIR}/README.md"
