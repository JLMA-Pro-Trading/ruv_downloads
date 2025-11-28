#!/bin/bash
# Neural Trader v2.1.0 - Publication Verification Script

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       Neural Trader v2.1.0 Publication Verification          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Check documentation files
echo "📚 Checking Documentation Files..."
FILES=(
    "CHANGELOG.md"
    "docs/RELEASE_NOTES_v2.1.0.md"
    "docs/API_REFERENCE.md"
    "docs/ARCHITECTURE.md"
    "docs/PUBLICATION_READY_v2.1.0.md"
    "PUBLISHING_READY_v2.1.0.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        SIZE=$(wc -c < "$file")
        echo "  ✅ $file ($SIZE bytes)"
    else
        echo "  ❌ Missing: $file"
        ((ERRORS++))
    fi
done
echo ""

# Check package configuration
echo "📦 Checking Package Configuration..."
if [ -f "package.json" ]; then
    VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
    echo "  ✅ package.json exists"
    echo "     Version: $VERSION"
else
    echo "  ❌ Missing package.json"
    ((ERRORS++))
fi
echo ""

# Check Rust workspace
echo "🦀 Checking Rust Workspace..."
if [ -f "neural-trader-rust/Cargo.toml" ]; then
    echo "  ✅ Rust workspace exists"
    if [ -d "neural-trader-rust/crates/backend-rs" ]; then
        echo "  ✅ backend-rs crate found"
    else
        echo "  ⚠️  backend-rs crate not found"
        ((WARNINGS++))
    fi
    if [ -d "neural-trader-rust/crates/napi-bindings" ]; then
        echo "  ✅ napi-bindings crate found"
    else
        echo "  ❌ napi-bindings crate missing"
        ((ERRORS++))
    fi
else
    echo "  ⚠️  Rust workspace not found"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    VERIFICATION SUMMARY                       ║"
echo "╠════════════════════════════════════════════════════════════════╣"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "║  Status: ✅ ALL CHECKS PASSED                                ║"
    echo "║                                                               ║"
    echo "║  🎉 READY FOR PUBLICATION                                    ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "║  Status: ⚠️  PASSED WITH WARNINGS                            ║"
    echo "║  Warnings: $WARNINGS                                               ║"
    echo "║                                                               ║"
    echo "║  ✅ Can proceed with publication                             ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    exit 0
else
    echo "║  Status: ❌ VERIFICATION FAILED                              ║"
    echo "║  Errors: $ERRORS                                                  ║"
    echo "║  Warnings: $WARNINGS                                               ║"
    echo "║                                                               ║"
    echo "║  ⛔ Cannot proceed with publication                          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    exit 1
fi
