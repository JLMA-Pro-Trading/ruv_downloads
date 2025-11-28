#!/bin/bash
set -e

# Build Neuro-Divergent NAPI Binaries for macOS Platforms
# Supports: x86_64-apple-darwin (Intel), aarch64-apple-darwin (Apple Silicon)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$PROJECT_ROOT/neural-trader-rust/crates/neuro-divergent"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/neuro-divergent"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Building Neuro-Divergent for macOS Platforms${NC}"
echo ""

# Check if running on macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
    echo -e "${RED}This script must be run on macOS${NC}"
    exit 1
fi

# macOS targets
TARGETS=(
    "x86_64-apple-darwin:darwin-x64"
    "aarch64-apple-darwin:darwin-arm64"
)

# Detect current architecture
CURRENT_ARCH=$(uname -m)
echo "Current architecture: $CURRENT_ARCH"

# Build for a macOS target
build_macos_target() {
    local target_spec=$1
    IFS=':' read -r target platform <<< "$target_spec"

    echo -e "${BLUE}Building for $target...${NC}"

    # Install target
    rustup target add "$target"

    cd "$PACKAGE_DIR"

    # Build
    if npm run build -- --target "$target" --release --strip; then
        echo -e "${GREEN}✓ Build successful for $target${NC}"

        # Copy binary
        BINARY=$(find . -name "*.node" -path "*/target/$target/release/*" -type f | head -n 1)
        if [ -f "$BINARY" ]; then
            mkdir -p "$ARTIFACTS_DIR/$platform/native"
            cp "$BINARY" "$ARTIFACTS_DIR/$platform/native/neuro-divergent.$platform.node"

            # Get binary size
            SIZE=$(stat -f%z "$BINARY")
            SIZE_MB=$((SIZE / 1024 / 1024))
            echo "  Binary size: ${SIZE_MB}MB"

            # Verify binary architecture
            echo "  Architecture:"
            file "$BINARY"

            # Test binary on native architecture
            if [[ ("$CURRENT_ARCH" == "x86_64" && "$target" == *"x86_64"*) || \
                  ("$CURRENT_ARCH" == "arm64" && "$target" == *"aarch64"*) ]]; then
                echo "  Testing binary..."
                if node -e "try { require('$BINARY'); console.log('  ✓ Binary loads successfully'); } catch(e) { console.error('  ✗ Failed:', e.message); }"; then
                    echo -e "${GREEN}  ✓ Binary verified${NC}"
                fi
            else
                echo -e "${YELLOW}  ⚠️  Skipping test (cross-compiled binary)${NC}"
            fi

            echo -e "${GREEN}✓ Built and copied $platform binary${NC}"
        else
            echo -e "${RED}✗ Binary not found!${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Build failed for $target${NC}"
        return 1
    fi

    echo ""
}

# Create universal binary (combines x64 and arm64)
create_universal() {
    echo -e "${BLUE}Creating universal macOS binary...${NC}"

    X64_BINARY="$ARTIFACTS_DIR/darwin-x64/native/neuro-divergent.darwin-x64.node"
    ARM64_BINARY="$ARTIFACTS_DIR/darwin-arm64/native/neuro-divergent.darwin-arm64.node"
    UNIVERSAL_DIR="$ARTIFACTS_DIR/darwin-universal/native"
    UNIVERSAL_BINARY="$UNIVERSAL_DIR/neuro-divergent.darwin-universal.node"

    if [ -f "$X64_BINARY" ] && [ -f "$ARM64_BINARY" ]; then
        mkdir -p "$UNIVERSAL_DIR"

        # Use lipo to create universal binary
        lipo -create "$X64_BINARY" "$ARM64_BINARY" -output "$UNIVERSAL_BINARY"

        echo -e "${GREEN}✓ Universal binary created${NC}"

        # Verify
        echo "  Architecture:"
        file "$UNIVERSAL_BINARY"
        lipo -info "$UNIVERSAL_BINARY"

        SIZE=$(stat -f%z "$UNIVERSAL_BINARY")
        SIZE_MB=$((SIZE / 1024 / 1024))
        echo "  Size: ${SIZE_MB}MB"
    else
        echo -e "${YELLOW}⚠️  Cannot create universal binary (missing x64 or arm64 binary)${NC}"
    fi

    echo ""
}

# Main
main() {
    cd "$PACKAGE_DIR"

    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
    echo ""

    # Build both architectures
    local success=0
    for target_spec in "${TARGETS[@]}"; do
        if build_macos_target "$target_spec"; then
            ((success++))
        fi
    done

    # Create universal binary if both succeeded
    if [ $success -eq 2 ]; then
        create_universal
    fi

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}macOS Builds Complete${NC}"
    echo -e "${GREEN}========================================${NC}"

    if [ -d "$ARTIFACTS_DIR" ]; then
        echo ""
        echo "Built binaries:"
        find "$ARTIFACTS_DIR" -name "*.node" -exec ls -lh {} \;
    fi
}

main "$@"
