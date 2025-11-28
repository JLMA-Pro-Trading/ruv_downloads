#!/bin/bash
set -e

# Neural Trader - macOS-specific NAPI Build Script

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAPI_DIR="$PROJECT_ROOT/neural-trader-rust/crates/napi-bindings"

echo -e "${BLUE}Building NAPI bindings for macOS...${NC}"

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)
        NATIVE_TARGET="x86_64-apple-darwin"
        NATIVE_PLATFORM="darwin-x64"
        CROSS_TARGET="aarch64-apple-darwin"
        CROSS_PLATFORM="darwin-arm64"
        ;;
    arm64)
        NATIVE_TARGET="aarch64-apple-darwin"
        NATIVE_PLATFORM="darwin-arm64"
        CROSS_TARGET="x86_64-apple-darwin"
        CROSS_PLATFORM="darwin-x64"
        ;;
    *)
        echo -e "${RED}Unsupported architecture: $ARCH${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Native target: $NATIVE_TARGET${NC}"
echo -e "${YELLOW}Cross target: $CROSS_TARGET${NC}"

# Install targets
rustup target add "$NATIVE_TARGET"
rustup target add "$CROSS_TARGET"

# Build native architecture
echo -e "${BLUE}Building for $NATIVE_TARGET...${NC}"
cd "$NAPI_DIR"
npm install
CARGO_BUILD_TARGET="$NATIVE_TARGET" npm run build:release

# Copy native binary
BINARY_NAME="neural-trader.$NATIVE_PLATFORM.node"
OUTPUT_DIR="$PROJECT_ROOT/packages/$NATIVE_PLATFORM/native"
mkdir -p "$OUTPUT_DIR"

BINARY_PATH="$PROJECT_ROOT/neural-trader-rust/target/$NATIVE_TARGET/release/$BINARY_NAME"
if [ -f "$BINARY_PATH" ]; then
    cp "$BINARY_PATH" "$OUTPUT_DIR/$BINARY_NAME"
    echo -e "${GREEN}✓ Native binary built: $OUTPUT_DIR/$BINARY_NAME${NC}"
    ls -lh "$OUTPUT_DIR/$BINARY_NAME"
else
    echo -e "${RED}✗ Binary not found at: $BINARY_PATH${NC}"
    exit 1
fi

# Cross-compile for other architecture
echo -e "${BLUE}Building for $CROSS_TARGET...${NC}"
CARGO_BUILD_TARGET="$CROSS_TARGET" npm run build:release

# Copy cross-compiled binary
CROSS_BINARY_NAME="neural-trader.$CROSS_PLATFORM.node"
CROSS_OUTPUT_DIR="$PROJECT_ROOT/packages/$CROSS_PLATFORM/native"
mkdir -p "$CROSS_OUTPUT_DIR"

CROSS_BINARY_PATH="$PROJECT_ROOT/neural-trader-rust/target/$CROSS_TARGET/release/$CROSS_BINARY_NAME"
if [ -f "$CROSS_BINARY_PATH" ]; then
    cp "$CROSS_BINARY_PATH" "$CROSS_OUTPUT_DIR/$CROSS_BINARY_NAME"
    echo -e "${GREEN}✓ Cross-compiled binary built: $CROSS_OUTPUT_DIR/$CROSS_BINARY_NAME${NC}"
    ls -lh "$CROSS_OUTPUT_DIR/$CROSS_BINARY_NAME"
else
    echo -e "${YELLOW}⚠ Cross-compilation may not have produced binary${NC}"
    echo -e "${YELLOW}  This is expected on some macOS versions${NC}"
fi

# Test native binary
echo -e "${BLUE}Testing native binary...${NC}"
node -e "try { require('./index.js'); console.log('✓ Binary loaded'); } catch(e) { console.error('✗ Failed:', e); process.exit(1); }"

# Optional: Create universal binary
echo ""
echo -e "${BLUE}To create a universal binary (both architectures):${NC}"
echo -e "  cd $NAPI_DIR"
echo -e "  npm run universal"

echo -e "${GREEN}✓ macOS build complete!${NC}"
