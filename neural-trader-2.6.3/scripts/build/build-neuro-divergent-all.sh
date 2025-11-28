#!/bin/bash
set -e

# Build Neuro-Divergent NAPI Binaries for All Platforms
# This script builds .node binaries for all 6 supported platforms

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$PROJECT_ROOT/neural-trader-rust/crates/neuro-divergent"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/neuro-divergent"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Building Neuro-Divergent NAPI Binaries${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Target platforms
declare -A TARGETS=(
    ["x86_64-unknown-linux-gnu"]="linux-x64-gnu"
    ["x86_64-unknown-linux-musl"]="linux-x64-musl"
    ["aarch64-unknown-linux-gnu"]="linux-arm64-gnu"
    ["x86_64-apple-darwin"]="darwin-x64"
    ["aarch64-apple-darwin"]="darwin-arm64"
    ["x86_64-pc-windows-msvc"]="win32-x64-msvc"
)

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"

    if ! command -v rustc &> /dev/null; then
        echo -e "${RED}✗ Rust is not installed${NC}"
        echo "Install from: https://rustup.rs/"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm is not installed${NC}"
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js is not installed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Prerequisites satisfied${NC}"
    echo ""
}

# Install Rust targets
install_targets() {
    echo -e "${YELLOW}Installing Rust targets...${NC}"

    for target in "${!TARGETS[@]}"; do
        echo "  Installing $target..."
        rustup target add "$target" 2>/dev/null || echo "  Already installed"
    done

    echo -e "${GREEN}✓ All targets installed${NC}"
    echo ""
}

# Install npm dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    cd "$PACKAGE_DIR"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
}

# Build for a specific target
build_target() {
    local target=$1
    local platform=${TARGETS[$target]}

    echo -e "${BLUE}Building for $target ($platform)...${NC}"

    cd "$PACKAGE_DIR"

    # Build the binary
    if npm run build -- --target "$target" --release --strip; then
        echo -e "${GREEN}✓ Build successful for $target${NC}"

        # Find and copy the binary
        BINARY=$(find . -name "*.node" -path "*/target/$target/release/*" -type f | head -n 1)

        if [ -f "$BINARY" ]; then
            # Get binary size
            SIZE=$(stat -c%s "$BINARY" 2>/dev/null || stat -f%z "$BINARY")
            SIZE_MB=$((SIZE / 1024 / 1024))

            echo "  Binary size: ${SIZE_MB}MB"

            if [ $SIZE_MB -gt 20 ]; then
                echo -e "${YELLOW}  ⚠️  Warning: Binary size exceeds 20MB${NC}"
            fi

            # Copy to artifacts
            mkdir -p "$ARTIFACTS_DIR/$platform/native"
            cp "$BINARY" "$ARTIFACTS_DIR/$platform/native/neuro-divergent.$platform.node"

            echo -e "${GREEN}  ✓ Binary copied to artifacts${NC}"
        else
            echo -e "${RED}  ✗ Binary not found!${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Build failed for $target${NC}"
        return 1
    fi

    echo ""
}

# Build all targets
build_all() {
    local failed=0
    local success=0

    for target in "${!TARGETS[@]}"; do
        if build_target "$target"; then
            ((success++))
        else
            ((failed++))
        fi
    done

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Build Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}Successful builds: $success${NC}"
    echo -e "${RED}Failed builds: $failed${NC}"
    echo ""

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ All builds completed successfully!${NC}"
        list_artifacts
        return 0
    else
        echo -e "${RED}✗ Some builds failed${NC}"
        return 1
    fi
}

# List all built artifacts
list_artifacts() {
    echo ""
    echo -e "${BLUE}Built Artifacts:${NC}"
    echo ""

    if [ -d "$ARTIFACTS_DIR" ]; then
        for dir in "$ARTIFACTS_DIR"/*; do
            if [ -d "$dir" ]; then
                for binary in "$dir"/native/*.node; do
                    if [ -f "$binary" ]; then
                        SIZE=$(stat -c%s "$binary" 2>/dev/null || stat -f%z "$binary")
                        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
                        echo "  $(basename "$binary"): ${SIZE_MB}MB"
                    fi
                done
            fi
        done
    else
        echo -e "${YELLOW}No artifacts found${NC}"
    fi

    echo ""
}

# Verify binaries
verify_binaries() {
    echo -e "${YELLOW}Verifying binaries...${NC}"

    local current_platform=""
    case "$(uname -s)" in
        Linux*)     current_platform="linux";;
        Darwin*)    current_platform="darwin";;
        MINGW*|MSYS*|CYGWIN*) current_platform="win32";;
    esac

    if [ -z "$current_platform" ]; then
        echo -e "${YELLOW}Cannot determine current platform for testing${NC}"
        return
    fi

    # Test the binary for the current platform
    for dir in "$ARTIFACTS_DIR"/*; do
        if [[ "$(basename "$dir")" == *"$current_platform"* ]]; then
            for binary in "$dir"/native/*.node; do
                if [ -f "$binary" ]; then
                    echo "  Testing $(basename "$binary")..."
                    cd "$PACKAGE_DIR"

                    if node -e "try { require('$binary'); console.log('  ✓ Binary loads successfully'); } catch(e) { console.error('  ✗ Failed:', e.message); process.exit(1); }"; then
                        echo -e "${GREEN}  ✓ Verification passed${NC}"
                    else
                        echo -e "${RED}  ✗ Verification failed${NC}"
                    fi
                fi
            done
        fi
    done

    echo ""
}

# Main execution
main() {
    check_prerequisites
    install_targets
    install_dependencies

    if build_all; then
        verify_binaries
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}Build process completed successfully!${NC}"
        echo -e "${GREEN}========================================${NC}"
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"
