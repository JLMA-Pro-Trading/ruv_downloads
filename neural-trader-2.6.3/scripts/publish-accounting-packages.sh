#!/bin/bash
set -e

echo "🚀 Publishing Agentic Accounting Packages to npm"
echo "=================================================="
echo ""

# Function to publish with OTP prompt
publish_package() {
    local package_dir=$1
    local package_name=$2

    echo "📦 Publishing $package_name..."
    cd "$package_dir"

    if [ -n "$NPM_OTP" ]; then
        npm publish --access public --otp="$NPM_OTP"
    else
        npm publish --access public
    fi

    if [ $? -eq 0 ]; then
        echo "✅ $package_name published successfully"
    else
        echo "❌ Failed to publish $package_name"
        exit 1
    fi

    cd - > /dev/null
    echo ""
}

# Check if logged in
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to npm. Run 'npm login' first."
    exit 1
fi

echo "✅ Logged in as: $(npm whoami)"
echo ""

# Optional: Set OTP if 2FA is enabled
read -p "Enter npm OTP code (or press Enter to skip if 2FA not enabled): " NPM_OTP
echo ""

# Build all packages first
echo "🔨 Building all packages..."
cd /home/user/neural-trader

# Build each package in dependency order
echo "  Building types..."
cd packages/agentic-accounting-types && npm run build && cd ../..

echo "  Rust core already built (535KB binary)"

echo "  Building core..."
cd packages/agentic-accounting-core && npm run build && cd ../..

echo "  Building agents..."
cd packages/agentic-accounting-agents && npm run build && cd ../..

echo "  Building MCP..."
cd packages/agentic-accounting-mcp && npm run build && cd ../..

echo "  Building CLI..."
cd packages/agentic-accounting-cli && npm run build && cd ../..

echo "✅ All packages built successfully"
echo ""

# Confirm before publishing
read -p "Ready to publish 6 packages to npm. Continue? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "❌ Publishing cancelled"
    exit 0
fi
echo ""

# Publish in dependency order
publish_package "packages/agentic-accounting-types" "@neural-trader/agentic-accounting-types"
sleep 10

publish_package "packages/agentic-accounting-rust-core" "@neural-trader/agentic-accounting-rust-core"
sleep 10

echo "⏳ Waiting 60s for packages to be available on npm registry..."
sleep 60

publish_package "packages/agentic-accounting-core" "@neural-trader/agentic-accounting-core"
sleep 10

echo "⏳ Waiting 60s for core to be available..."
sleep 60

# Publish agents and CLI in parallel (both depend on core only)
publish_package "packages/agentic-accounting-agents" "@neural-trader/agentic-accounting-agents"
publish_package "packages/agentic-accounting-cli" "@neural-trader/agentic-accounting-cli"
sleep 10

# MCP depends on both core and agents, so wait and publish last
publish_package "packages/agentic-accounting-mcp" "@neural-trader/agentic-accounting-mcp"

echo ""
echo "🎉 All 6 packages published successfully to npm!"
echo ""
echo "Published packages:"
echo "  ✅ @neural-trader/agentic-accounting-types@0.1.0"
echo "  ✅ @neural-trader/agentic-accounting-rust-core@0.1.0"
echo "  ✅ @neural-trader/agentic-accounting-core@0.1.0"
echo "  ✅ @neural-trader/agentic-accounting-agents@0.1.0"
echo "  ✅ @neural-trader/agentic-accounting-mcp@0.1.0"
echo "  ✅ @neural-trader/agentic-accounting-cli@0.1.0"
echo ""
echo "Verify publication:"
echo "  npm view @neural-trader/agentic-accounting-core"
echo ""
echo "Test installation:"
echo "  npm install @neural-trader/agentic-accounting-core"
echo "  npm install -g @neural-trader/agentic-accounting-cli"
echo ""
echo "Next steps:"
echo "  1. Update main README.md to mark packages as Published"
echo "  2. Create GitHub release with tag v0.1.0"
echo "  3. Announce release on social media"
echo "  4. Monitor npm download stats and GitHub issues"
