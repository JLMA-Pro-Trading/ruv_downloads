#!/bin/bash
# Security Audit Script for Neural Trader Rust Port

set -e

echo "🔒 Neural Trader Security Audit"
echo "================================"
echo ""

cd "$(dirname "$0")/../neural-trader-rust"

# Install security tools if needed
echo "📦 Installing security audit tools..."
cargo install cargo-audit --quiet 2>/dev/null || true
cargo install cargo-deny --quiet 2>/dev/null || true
cargo install cargo-outdated --quiet 2>/dev/null || true

# Run cargo audit
echo ""
echo "🔍 Running cargo audit (checking for known vulnerabilities)..."
echo "----------------------------------------------------------------"
if cargo audit 2>&1; then
    echo "✅ No known vulnerabilities found"
else
    echo "⚠️  Vulnerabilities detected - review output above"
fi

# Run cargo deny
echo ""
echo "🚫 Running cargo deny (checking licenses and bans)..."
echo "----------------------------------------------------------------"
if cargo deny check 2>&1; then
    echo "✅ All dependencies passed deny checks"
else
    echo "⚠️  Deny check failed - review output above"
fi

# Check for outdated dependencies
echo ""
echo "📅 Checking for outdated dependencies..."
echo "----------------------------------------------------------------"
cargo outdated --format json > /tmp/outdated.json 2>&1 || true
if [ -f /tmp/outdated.json ]; then
    OUTDATED_COUNT=$(cat /tmp/outdated.json | grep -c '"latest"' || echo "0")
    echo "Found $OUTDATED_COUNT potentially outdated dependencies"
fi

# Check for unsafe code
echo ""
echo "⚡ Checking for unsafe code usage..."
echo "----------------------------------------------------------------"
UNSAFE_COUNT=$(grep -r "unsafe" --include="*.rs" crates/ | wc -l)
echo "Found $UNSAFE_COUNT unsafe code blocks"
if [ $UNSAFE_COUNT -gt 0 ]; then
    echo "Unsafe code locations:"
    grep -r "unsafe" --include="*.rs" crates/ | head -20
fi

# Security summary
echo ""
echo "🎯 Security Audit Summary"
echo "================================"
echo "✅ Audit complete - review findings above"
echo ""
