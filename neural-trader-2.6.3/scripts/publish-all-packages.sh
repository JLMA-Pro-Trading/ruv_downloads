#!/bin/bash
# Publish all Neural Trader sub-packages to npm
# Usage: ./scripts/publish-all-packages.sh

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Publishing Neural Trader Sub-Packages to npm"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if logged into npm
if ! npm whoami > /dev/null 2>&1; then
  echo "❌ Not logged into npm. Please run 'npm login' first."
  exit 1
fi

echo "✅ Logged into npm as: $(npm whoami)"
echo ""

# Run verification
echo "🔍 Running verification tests..."
if ! node tests/verify-sub-packages.js; then
  echo "❌ Verification failed. Please fix errors before publishing."
  exit 1
fi

echo ""
read -p "🚀 Ready to publish 6 packages. Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Publishing cancelled."
  exit 0
fi

PACKAGES=(
  "strategies"
  "execution"
  "backtesting"
  "portfolio"
  "risk"
  "neural"
)

FAILED_PACKAGES=()
PUBLISHED_PACKAGES=()

for pkg in "${PACKAGES[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Publishing @neural-trader/$pkg"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  cd "packages/$pkg"

  # Verify package before publishing
  echo "   Verifying package contents..."
  if ! npm pack --dry-run > /dev/null 2>&1; then
    echo "❌ Package verification failed for $pkg"
    FAILED_PACKAGES+=("$pkg")
    cd ../..
    continue
  fi

  # Publish with public access
  echo "   Publishing to npm..."
  if npm publish --access public; then
    echo "✅ @neural-trader/$pkg published successfully"
    PUBLISHED_PACKAGES+=("$pkg")
  else
    echo "❌ Failed to publish @neural-trader/$pkg"
    FAILED_PACKAGES+=("$pkg")
  fi

  cd ../..
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Publication Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ${#PUBLISHED_PACKAGES[@]} -gt 0 ]; then
  echo "✅ Successfully published (${#PUBLISHED_PACKAGES[@]}):"
  for pkg in "${PUBLISHED_PACKAGES[@]}"; do
    echo "   • @neural-trader/$pkg"
  done
  echo ""
fi

if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
  echo "❌ Failed to publish (${#FAILED_PACKAGES[@]}):"
  for pkg in "${FAILED_PACKAGES[@]}"; do
    echo "   • @neural-trader/$pkg"
  done
  echo ""
  exit 1
fi

echo "🎉 All ${#PUBLISHED_PACKAGES[@]} packages published successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Verify packages: npm info @neural-trader/strategies"
echo "   2. Test installation: npm install @neural-trader/strategies"
echo "   3. Update documentation if needed"
echo ""
