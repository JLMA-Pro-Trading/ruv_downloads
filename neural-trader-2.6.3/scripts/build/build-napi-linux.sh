#!/bin/bash
set -e

# Neural Trader - Linux-specific NAPI Build Script

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAPI_DIR="$PROJECT_ROOT/neural-trader-rust/crates/napi-bindings"

echo -e "${BLUE}Building NAPI bindings for Linux...${NC}"

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)
        TARGET="x86_64-unknown-linux-gnu"
        PLATFORM="linux-x64-gnu"
        ;;
    aarch64)
        TARGET="aarch64-unknown-linux-gnu"
        PLATFORM="linux-arm64-gnu"
        ;;
    *)
        echo -e "${RED}Unsupported architecture: $ARCH${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Target: $TARGET${NC}"

# Install target
rustup target add "$TARGET"

# Build
cd "$NAPI_DIR"
npm install
CARGO_BUILD_TARGET="$TARGET" npm run build:release

# Copy binary
BINARY_NAME="neural-trader.$PLATFORM.node"
OUTPUT_DIR="$PROJECT_ROOT/packages/$PLATFORM/native"
mkdir -p "$OUTPUT_DIR"

BINARY_PATH="$PROJECT_ROOT/neural-trader-rust/target/$TARGET/release/$BINARY_NAME"
if [ -f "$BINARY_PATH" ]; then
    cp "$BINARY_PATH" "$OUTPUT_DIR/$BINARY_NAME"
    echo -e "${GREEN}✓ Binary built: $OUTPUT_DIR/$BINARY_NAME${NC}"
    ls -lh "$OUTPUT_DIR/$BINARY_NAME"
else
    echo -e "${RED}✗ Binary not found at: $BINARY_PATH${NC}"
    exit 1
fi

# Test
echo -e "${BLUE}Testing binary...${NC}"
node -e "try { require('./index.js'); console.log('✓ Binary loaded'); } catch(e) { console.error('✗ Failed:', e); process.exit(1); }"

echo -e "${GREEN}✓ Linux build complete!${NC}"
