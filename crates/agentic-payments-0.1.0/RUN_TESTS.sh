#!/bin/bash
set -e

echo "🧪 ACP Webhook System Test Suite"
echo "================================="
echo ""

echo "📦 Building with ACP feature..."
cargo build --features acp --lib

echo ""
echo "✅ Build successful!"
echo ""

echo "🧪 Running HMAC tests..."
cargo test --features acp --lib acp::hmac::tests -- --nocapture

echo ""
echo "🧪 Running Webhook tests..."
cargo test --features acp --lib acp::webhook::tests -- --nocapture

echo ""
echo "📊 Test Summary:"
echo "  • HMAC Tests: 11 tests"
echo "  • Webhook Tests: 10 tests"
echo "  • Total: 21 tests"
echo ""

echo "✅ All tests passed!"
echo ""

echo "📚 Run examples with:"
echo "  cargo run --example acp_hmac_verification --features acp"
echo "  cargo run --example acp_webhook_basic --features acp"
