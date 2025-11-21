#!/bin/bash
# AP2 Implementation Verification Script

set -e

echo "🔍 Verifying AP2 Implementation"
echo "================================"
echo

# Check directory structure
echo "📁 Checking directory structure..."
if [ -d "src/ap2" ]; then
    echo "  ✅ src/ap2/ directory exists"
else
    echo "  ❌ src/ap2/ directory missing"
    exit 1
fi

# Check required files
echo
echo "📄 Checking required files..."
files=(
    "src/ap2/mod.rs"
    "src/ap2/credentials.rs"
    "src/ap2/mandates.rs"
    "src/ap2/did.rs"
    "src/ap2/verification.rs"
    "tests/ap2_integration_test.rs"
    "examples/ap2_payment_flow.rs"
    "examples/ap2_mandate_management.rs"
    "docs/AP2_IMPLEMENTATION.md"
    "docs/AP2_SUMMARY.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        echo "  ✅ $file ($lines lines)"
    else
        echo "  ❌ $file missing"
        exit 1
    fi
done

# Check Cargo.toml dependencies
echo
echo "📦 Checking dependencies..."
if grep -q "base64-url" Cargo.toml; then
    echo "  ✅ base64-url dependency added"
else
    echo "  ❌ base64-url dependency missing"
    exit 1
fi

# Count total lines
echo
echo "📊 Code Statistics..."
core_lines=$(find src/ap2 -name "*.rs" -exec wc -l {} + | tail -1 | awk '{print $1}')
test_lines=$(wc -l < tests/ap2_integration_test.rs)
example_lines=$(wc -l < examples/ap2_payment_flow.rs)
example_lines=$((example_lines + $(wc -l < examples/ap2_mandate_management.rs)))
doc_lines=$(wc -l < docs/AP2_IMPLEMENTATION.md)
doc_lines=$((doc_lines + $(wc -l < docs/AP2_SUMMARY.md)))

echo "  Core Implementation: $core_lines lines"
echo "  Integration Tests:   $test_lines lines"
echo "  Examples:            $example_lines lines"
echo "  Documentation:       $doc_lines lines"
echo "  ─────────────────────────────────"
echo "  Total:               $((core_lines + test_lines + example_lines + doc_lines)) lines"

# Check for key types and functions
echo
echo "🔎 Checking key implementations..."
key_items=(
    "pub struct Ap2Protocol"
    "pub struct VerifiableCredential"
    "pub struct IntentMandate"
    "pub struct CartMandate"
    "pub struct PaymentMandate"
    "pub struct DidDocument"
    "pub struct DidManager"
    "pub struct VerificationWorkflow"
    "pub fn verify"
    "pub fn verify_chain"
)

missing_count=0
for item in "${key_items[@]}"; do
    if grep -rq "$item" src/ap2/; then
        echo "  ✅ Found: $item"
    else
        echo "  ❌ Missing: $item"
        missing_count=$((missing_count + 1))
    fi
done

if [ $missing_count -gt 0 ]; then
    echo
    echo "❌ Verification failed: $missing_count key items missing"
    exit 1
fi

echo
echo "✨ AP2 Implementation Verification Complete!"
echo "   All required files and implementations present"
echo "   Ready for compilation and testing"
echo
echo "Next steps:"
echo "  1. cargo build --package agentic-payments"
echo "  2. cargo test --package agentic-payments ap2"
echo "  3. cargo run --example ap2_payment_flow"
echo "  4. cargo doc --package agentic-payments --open"
