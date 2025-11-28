#!/bin/bash
set -e

# Neural Trader - Build and Publish NAPI Package
# This script builds native binaries and publishes to npm

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/neural-trader-rust/packages/neural-trader-backend"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Neural Trader - Build & Publish to NPM               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if logged into npm
if ! npm whoami &> /dev/null; then
    echo -e "${RED}✗ Not logged into npm${NC}"
    echo "Run: npm login"
    exit 1
fi

echo -e "${GREEN}✓ Logged into npm as: $(npm whoami)${NC}"
echo ""

# Verify we're on a clean git state
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠ Warning: Git working directory is not clean${NC}"
    echo "Uncommitted changes:"
    git status -s
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get version from package.json
VERSION=$(node -p "require('$BACKEND_DIR/package.json').version")
echo -e "${BLUE}Building version: ${VERSION}${NC}"
echo ""

# Check if version already published
if npm view "@neural-trader/backend@${VERSION}" version &> /dev/null; then
    echo -e "${RED}✗ Version ${VERSION} already published${NC}"
    echo "Update version in package.json first"
    exit 1
fi

# Build all platforms via GitHub Actions
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}To build for all platforms, use GitHub Actions:${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Commit and push your changes:"
echo "   git add ."
echo "   git commit -m 'chore: prepare release v${VERSION}'"
echo "   git push origin main"
echo ""
echo "2. Create a release tag:"
echo "   git tag v${VERSION}"
echo "   git push origin v${VERSION}"
echo ""
echo "3. GitHub Actions will:"
echo "   - Build binaries for all platforms"
echo "   - Run tests on each platform"
echo "   - Create GitHub release with binaries"
echo "   - Publish to npm automatically"
echo ""

read -p "Have you pushed the release tag to GitHub? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Please create and push the release tag first${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Waiting for GitHub Actions to complete...${NC}"
echo "Check progress at: https://github.com/ruvnet/neural-trader/actions"
echo ""

read -p "Are all GitHub Actions jobs complete? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Please wait for CI to complete${NC}"
    exit 1
fi

# Download artifacts from GitHub release
echo -e "${BLUE}Downloading release artifacts...${NC}"
cd "$BACKEND_DIR"

# Create native directory structure
mkdir -p native/{linux-x64-gnu,linux-arm64-gnu,darwin-x64,darwin-arm64,win32-x64-msvc}

# Download using GitHub CLI (if available)
if command -v gh &> /dev/null; then
    echo "Using GitHub CLI to download artifacts..."
    gh release download "v${VERSION}" --pattern "*.node" --dir native/ || {
        echo -e "${YELLOW}⚠ Could not download with gh CLI${NC}"
        echo "Download manually from: https://github.com/ruvnet/neural-trader/releases/tag/v${VERSION}"
        read -p "Press enter when artifacts are downloaded to native/ directory..."
    }
else
    echo -e "${YELLOW}⚠ GitHub CLI not found${NC}"
    echo "Download artifacts manually from:"
    echo "https://github.com/ruvnet/neural-trader/releases/tag/v${VERSION}"
    echo ""
    read -p "Press enter when artifacts are downloaded to native/ directory..."
fi

# Verify all required binaries are present
echo ""
echo -e "${BLUE}Verifying binaries...${NC}"
REQUIRED_BINARIES=(
    "neural-trader.linux-x64-gnu.node"
    "neural-trader.linux-arm64-gnu.node"
    "neural-trader.darwin-x64.node"
    "neural-trader.darwin-arm64.node"
    "neural-trader.win32-x64-msvc.node"
)

MISSING_COUNT=0
for binary in "${REQUIRED_BINARIES[@]}"; do
    if [ -f "native/$binary" ]; then
        SIZE=$(ls -lh "native/$binary" | awk '{print $5}')
        echo -e "${GREEN}✓ $binary ($SIZE)${NC}"
    else
        echo -e "${RED}✗ $binary missing${NC}"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

if [ $MISSING_COUNT -gt 0 ]; then
    echo -e "${RED}✗ Missing $MISSING_COUNT binaries${NC}"
    exit 1
fi

# Create platform-specific packages
echo ""
echo -e "${BLUE}Creating platform-specific packages...${NC}"

PLATFORMS=(
    "linux-x64-gnu"
    "linux-arm64-gnu"
    "darwin-x64"
    "darwin-arm64"
    "win32-x64-msvc"
)

for platform in "${PLATFORMS[@]}"; do
    PKG_NAME="@neural-trader/backend-${platform}"
    PKG_DIR="../${platform}"

    echo -e "${BLUE}Creating ${PKG_NAME}...${NC}"

    mkdir -p "$PKG_DIR"

    # Create platform-specific package.json
    cat > "$PKG_DIR/package.json" <<EOF
{
  "name": "${PKG_NAME}",
  "version": "${VERSION}",
  "description": "Neural Trader backend native bindings for ${platform}",
  "main": "index.js",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/ruvnet/neural-trader.git"
  },
  "os": ["${platform%%-*}"],
  "cpu": ["${platform#*-}"],
  "files": [
    "index.js",
    "neural-trader.${platform}.node"
  ]
}
EOF

    # Create index.js that loads the binary
    cat > "$PKG_DIR/index.js" <<EOF
module.exports = require('./neural-trader.${platform}.node');
EOF

    # Copy binary
    cp "native/neural-trader.${platform}.node" "$PKG_DIR/"

    echo -e "${GREEN}✓ ${PKG_NAME} created${NC}"
done

# Publish platform-specific packages
echo ""
read -p "Publish platform-specific packages to npm? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    for platform in "${PLATFORMS[@]}"; do
        PKG_DIR="../${platform}"
        echo -e "${BLUE}Publishing @neural-trader/backend-${platform}...${NC}"
        (cd "$PKG_DIR" && npm publish --access public)
    done
    echo -e "${GREEN}✓ All platform packages published${NC}"
fi

# Publish main package
echo ""
read -p "Publish main package @neural-trader/backend? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Publishing @neural-trader/backend...${NC}"
    npm publish --access public
    echo -e "${GREEN}✓ Main package published${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Publishing complete!                                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Package: @neural-trader/backend@${VERSION}"
echo "View at: https://www.npmjs.com/package/@neural-trader/backend"
echo ""
echo "Install with:"
echo "  npm install @neural-trader/backend"
