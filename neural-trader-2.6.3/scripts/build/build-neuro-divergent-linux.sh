#!/bin/bash
set -e

# Build Neuro-Divergent NAPI Binaries for Linux Platforms
# Supports: x86_64-gnu, x86_64-musl, aarch64-gnu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$PROJECT_ROOT/neural-trader-rust/crates/neuro-divergent"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/neuro-divergent"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Building Neuro-Divergent for Linux Platforms${NC}"
echo ""

# Linux targets
TARGETS=(
    "x86_64-unknown-linux-gnu:linux-x64-gnu"
    "x86_64-unknown-linux-musl:linux-x64-musl"
    "aarch64-unknown-linux-gnu:linux-arm64-gnu"
)

# Install cross-compilation tools for ARM64
install_cross_tools() {
    if ! command -v aarch64-linux-gnu-gcc &> /dev/null; then
        echo -e "${YELLOW}Installing ARM64 cross-compilation tools...${NC}"
        sudo apt-get update
        sudo apt-get install -y gcc-aarch64-linux-gnu g++-aarch64-linux-gnu
    fi
}

# Build musl target using Docker
build_musl() {
    echo -e "${BLUE}Building x86_64-unknown-linux-musl with Docker...${NC}"

    docker run --rm \
        -v "$PROJECT_ROOT":/work \
        -w /work/neural-trader-rust/crates/neuro-divergent \
        rust:alpine \
        sh -c "
            apk add --no-cache nodejs npm musl-dev &&
            rustup target add x86_64-unknown-linux-musl &&
            npm install &&
            npm run build -- --target x86_64-unknown-linux-musl --release --strip
        "

    # Copy binary
    BINARY=$(find "$PACKAGE_DIR" -name "*.node" -path "*/x86_64-unknown-linux-musl/release/*" -type f | head -n 1)
    if [ -f "$BINARY" ]; then
        mkdir -p "$ARTIFACTS_DIR/linux-x64-musl/native"
        cp "$BINARY" "$ARTIFACTS_DIR/linux-x64-musl/native/neuro-divergent.linux-x64-musl.node"
        echo -e "${GREEN}✓ musl binary built and copied${NC}"
    fi
}

# Build standard Linux targets
build_linux_target() {
    local target_spec=$1
    IFS=':' read -r target platform <<< "$target_spec"

    echo -e "${BLUE}Building for $target...${NC}"

    # Install target
    rustup target add "$target"

    cd "$PACKAGE_DIR"

    # Set environment for ARM64 cross-compilation
    if [[ "$target" == *"aarch64"* ]]; then
        export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc
        export CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc
        export CXX_aarch64_unknown_linux_gnu=aarch64-linux-gnu-g++
    fi

    # Build
    npm run build -- --target "$target" --release --strip

    # Copy binary
    BINARY=$(find . -name "*.node" -path "*/target/$target/release/*" -type f | head -n 1)
    if [ -f "$BINARY" ]; then
        mkdir -p "$ARTIFACTS_DIR/$platform/native"
        cp "$BINARY" "$ARTIFACTS_DIR/$platform/native/neuro-divergent.$platform.node"
        echo -e "${GREEN}✓ Built and copied $platform binary${NC}"
    fi
}

# Main
main() {
    cd "$PACKAGE_DIR"
    npm install

    # Check if Docker is available for musl build
    if command -v docker &> /dev/null; then
        build_musl
    else
        echo -e "${YELLOW}⚠️  Docker not available, skipping musl build${NC}"
    fi

    # Install cross-compilation tools
    install_cross_tools

    # Build other Linux targets
    for target_spec in "${TARGETS[@]}"; do
        if [[ "$target_spec" != *"musl"* ]]; then
            build_linux_target "$target_spec"
        fi
    done

    echo -e "${GREEN}✓ Linux builds complete${NC}"
    ls -lh "$ARTIFACTS_DIR"/**/native/*.node 2>/dev/null || true
}

main "$@"
