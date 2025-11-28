#!/bin/bash
set -e

# Neural Trader - Multi-platform NAPI Build Script
# Builds native bindings for all supported platforms

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAPI_DIR="$PROJECT_ROOT/neural-trader-rust/crates/napi-bindings"
PACKAGES_DIR="$PROJECT_ROOT/packages"
CARGO_TOML="$PROJECT_ROOT/neural-trader-rust/Cargo.toml"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Neural Trader - Multi-Platform NAPI Build            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}▶${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v cargo &> /dev/null; then
    print_error "Rust/Cargo not found. Install from https://rustup.rs/"
    exit 1
fi

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Install from https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "NPM not found. Install Node.js from https://nodejs.org/"
    exit 1
fi

print_success "Prerequisites check passed"
echo ""

# Platform detection
PLATFORM="$(uname -s)"
ARCH="$(uname -m)"

print_status "Detected platform: $PLATFORM $ARCH"
echo ""

# Install NAPI dependencies
print_status "Installing NAPI dependencies..."
cd "$NAPI_DIR"
npm install
print_success "Dependencies installed"
echo ""

# Build native platform
print_status "Building for native platform..."
case "$PLATFORM" in
    Linux)
        case "$ARCH" in
            x86_64)
                TARGET="x86_64-unknown-linux-gnu"
                PLATFORM_NAME="linux-x64-gnu"
                BINARY_NAME="neural-trader.linux-x64-gnu.node"
                ;;
            aarch64)
                TARGET="aarch64-unknown-linux-gnu"
                PLATFORM_NAME="linux-arm64-gnu"
                BINARY_NAME="neural-trader.linux-arm64-gnu.node"
                ;;
            *)
                print_error "Unsupported Linux architecture: $ARCH"
                exit 1
                ;;
        esac
        ;;
    Darwin)
        case "$ARCH" in
            x86_64)
                TARGET="x86_64-apple-darwin"
                PLATFORM_NAME="darwin-x64"
                BINARY_NAME="neural-trader.darwin-x64.node"
                ;;
            arm64)
                TARGET="aarch64-apple-darwin"
                PLATFORM_NAME="darwin-arm64"
                BINARY_NAME="neural-trader.darwin-arm64.node"
                ;;
            *)
                print_error "Unsupported macOS architecture: $ARCH"
                exit 1
                ;;
        esac
        ;;
    MINGW*|MSYS*|CYGWIN*)
        TARGET="x86_64-pc-windows-msvc"
        PLATFORM_NAME="win32-x64-msvc"
        BINARY_NAME="neural-trader.win32-x64-msvc.node"
        ;;
    *)
        print_error "Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

print_status "Building for $TARGET..."
cargo build --release --manifest-path="$PROJECT_ROOT/neural-trader-rust/Cargo.toml" \
    --package nt-napi-bindings \
    --target "$TARGET"

# Find built binary
BINARY_PATH="$PROJECT_ROOT/neural-trader-rust/target/$TARGET/release/$BINARY_NAME"
if [ ! -f "$BINARY_PATH" ]; then
    # Try alternative paths
    BINARY_PATH="$PROJECT_ROOT/neural-trader-rust/target/$TARGET/release/libnt_napi_bindings.so"
    if [ ! -f "$BINARY_PATH" ]; then
        BINARY_PATH="$PROJECT_ROOT/neural-trader-rust/target/$TARGET/release/nt_napi_bindings.node"
    fi
fi

if [ ! -f "$BINARY_PATH" ]; then
    print_error "Built binary not found at: $BINARY_PATH"
    echo "Searching for built binaries..."
    find "$PROJECT_ROOT/neural-trader-rust/target/$TARGET/release" -name "*.node" -o -name "*.so" -o -name "*.dylib" -o -name "*.dll"
    exit 1
fi

# Copy to packages directory
OUTPUT_DIR="$PACKAGES_DIR/$PLATFORM_NAME/native"
mkdir -p "$OUTPUT_DIR"
cp "$BINARY_PATH" "$OUTPUT_DIR/$BINARY_NAME"

print_success "Native build complete: $(ls -lh "$OUTPUT_DIR/$BINARY_NAME" | awk '{print $5}')"
echo ""

# Cross-compilation targets (Linux only)
if [ "$PLATFORM" = "Linux" ] && [ "$ARCH" = "x86_64" ]; then
    print_status "Setting up cross-compilation..."

    # Install cross-compilation toolchains
    print_status "Installing Rust targets..."
    rustup target add aarch64-unknown-linux-gnu 2>/dev/null || true

    # Check for cross-compilation tools
    if command -v cross &> /dev/null; then
        print_status "Using 'cross' for cross-compilation..."

        # ARM64 Linux
        print_status "Cross-compiling for ARM64 Linux..."
        cross build --release \
            --manifest-path="$PROJECT_ROOT/neural-trader-rust/Cargo.toml" \
            --package nt-napi-bindings \
            --target aarch64-unknown-linux-gnu

        ARM64_BINARY="$PROJECT_ROOT/neural-trader-rust/target/aarch64-unknown-linux-gnu/release/neural-trader.linux-arm64-gnu.node"
        if [ -f "$ARM64_BINARY" ]; then
            ARM64_OUTPUT="$PACKAGES_DIR/linux-arm64-gnu/native"
            mkdir -p "$ARM64_OUTPUT"
            cp "$ARM64_BINARY" "$ARM64_OUTPUT/neural-trader.linux-arm64-gnu.node"
            print_success "ARM64 Linux build complete: $(ls -lh "$ARM64_OUTPUT/neural-trader.linux-arm64-gnu.node" | awk '{print $5}')"
        fi
    else
        print_warning "Cross-compilation tool 'cross' not found"
        print_warning "Install with: cargo install cross"
        print_warning "ARM64 Linux build skipped - requires cross-compilation"
    fi

    echo ""
    print_warning "Windows and macOS builds require native CI runners"
    print_warning "Use GitHub Actions workflow for complete multi-platform builds"
fi

echo ""
print_status "Build summary:"
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
ls -lh "$PACKAGES_DIR"/*/native/*.node 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"

echo ""
print_success "Build complete!"
echo ""
echo "Next steps:"
echo "  1. Test binaries: npm run test:node"
echo "  2. Push to GitHub to trigger multi-platform CI builds"
echo "  3. Create release tag for automatic NPM publishing"
