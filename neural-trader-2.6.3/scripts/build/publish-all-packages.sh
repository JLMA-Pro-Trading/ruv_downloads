#!/bin/bash

# Publish all Neural Trader packages to npm
# This script publishes packages in dependency order

set -e

PACKAGES_DIR="/workspaces/neural-trader/neural-trader-rust/packages"
PUBLISHED=()
FAILED=()

echo "🚀 Publishing all @neural-trader packages to npm..."
echo ""

# Function to publish a package
publish_package() {
    local pkg_dir=$1
    local pkg_name=$2

    if [ ! -d "$PACKAGES_DIR/$pkg_dir" ]; then
        echo "⚠️  Directory not found: $pkg_dir"
        return 1
    fi

    cd "$PACKAGES_DIR/$pkg_dir"

    if [ ! -f "package.json" ]; then
        echo "⚠️  No package.json in $pkg_dir"
        return 1
    fi

    local name=$(jq -r '.name' package.json)
    local version=$(jq -r '.version' package.json)

    echo "📦 Publishing $name@$version..."

    # Check if already published
    if npm view "$name@$version" version &>/dev/null; then
        echo "✅ $name@$version already published, skipping"
        PUBLISHED+=("$name@$version (already published)")
        return 0
    fi

    # Publish
    if npm publish --access public 2>&1 | tee /tmp/publish-$pkg_dir.log; then
        echo "✅ Successfully published $name@$version"
        PUBLISHED+=("$name@$version")
    else
        echo "❌ Failed to publish $name@$version"
        FAILED+=("$name@$version")
        return 1
    fi

    echo ""
}

# Publish in dependency order (core first, then specialized)

echo "Stage 1: Core packages"
publish_package "core" "core" || true

echo "Stage 2: Backend infrastructure"
publish_package "neural-trader-backend" "backend" || true
publish_package "neural" "neural" || true

echo "Stage 3: Trading components"
publish_package "backtesting" "backtesting" || true
publish_package "brokers" "brokers" || true
publish_package "execution" "execution" || true
publish_package "features" "features" || true
publish_package "market-data" "market-data" || true
publish_package "portfolio" "portfolio" || true
publish_package "risk" "risk" || true
publish_package "strategies" "strategies" || true

echo "Stage 4: Specialized strategies"
publish_package "news-trading" "news-trading" || true
publish_package "prediction-markets" "prediction-markets" || true
publish_package "sports-betting" "sports-betting" || true
publish_package "syndicate" "syndicate" || true

echo "Stage 5: Tools and protocols"
publish_package "benchoptimizer" "benchoptimizer" || true
publish_package "mcp" "mcp" || true
publish_package "mcp-protocol" "mcp-protocol" || true
publish_package "neural-trader" "neural-trader" || true
publish_package "neuro-divergent" "neuro-divergent" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Publication Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Successfully published: ${#PUBLISHED[@]} packages"
for pkg in "${PUBLISHED[@]}"; do
    echo "   - $pkg"
done

if [ ${#FAILED[@]} -gt 0 ]; then
    echo ""
    echo "❌ Failed: ${#FAILED[@]} packages"
    for pkg in "${FAILED[@]}"; do
        echo "   - $pkg"
    done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
