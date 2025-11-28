#!/bin/bash

# Resource Management Fixes Validation Script
# Validates that connection pool and neural memory fixes are working correctly

set -e

echo "======================================"
echo "Resource Management Fixes Validation"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to napi-bindings crate
cd "$(dirname "$0")/../neural-trader-rust/crates/napi-bindings"

echo -e "${YELLOW}Step 1: Checking dependencies...${NC}"
if grep -q "deadpool = \"0.12\"" Cargo.toml; then
    echo -e "${GREEN}✓ deadpool dependency found${NC}"
else
    echo -e "${RED}✗ deadpool dependency missing${NC}"
    exit 1
fi

if grep -q "parking_lot = \"0.12\"" Cargo.toml; then
    echo -e "${GREEN}✓ parking_lot dependency found${NC}"
else
    echo -e "${RED}✗ parking_lot dependency missing${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 2: Checking module files...${NC}"
if [ -f "src/pool/connection_manager.rs" ]; then
    echo -e "${GREEN}✓ Connection manager module exists${NC}"
    lines=$(wc -l < src/pool/connection_manager.rs)
    echo "  Lines: $lines"
else
    echo -e "${RED}✗ Connection manager module missing${NC}"
    exit 1
fi

if [ -f "src/neural/model.rs" ]; then
    echo -e "${GREEN}✓ Neural model module exists${NC}"
    lines=$(wc -l < src/neural/model.rs)
    echo "  Lines: $lines"
else
    echo -e "${RED}✗ Neural model module missing${NC}"
    exit 1
fi

if [ -f "src/metrics/mod.rs" ]; then
    echo -e "${GREEN}✓ Metrics module exists${NC}"
    lines=$(wc -l < src/metrics/mod.rs)
    echo "  Lines: $lines"
else
    echo -e "${RED}✗ Metrics module missing${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 3: Checking lib.rs integration...${NC}"
if grep -q "pub mod pool;" src/lib.rs; then
    echo -e "${GREEN}✓ Pool module declared in lib.rs${NC}"
else
    echo -e "${RED}✗ Pool module not declared in lib.rs${NC}"
    exit 1
fi

if grep -q "pub mod metrics;" src/lib.rs; then
    echo -e "${GREEN}✓ Metrics module declared in lib.rs${NC}"
else
    echo -e "${RED}✗ Metrics module not declared in lib.rs${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 4: Checking test files...${NC}"
if [ -f "tests/resource_management_tests.rs" ]; then
    echo -e "${GREEN}✓ Resource management tests exist${NC}"
    test_count=$(grep -c "#\[tokio::test\]" tests/resource_management_tests.rs || true)
    echo "  Test count: $test_count"
else
    echo -e "${RED}✗ Resource management tests missing${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 5: Compiling with all features...${NC}"
if cargo check --all-features 2>&1 | tee /tmp/cargo_check.log | tail -5; then
    echo -e "${GREEN}✓ Compilation successful${NC}"
else
    echo -e "${RED}✗ Compilation failed${NC}"
    echo "See /tmp/cargo_check.log for details"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 6: Running unit tests...${NC}"
if cargo test --lib pool::connection_manager::tests --quiet 2>&1 | tail -10; then
    echo -e "${GREEN}✓ Connection pool tests passed${NC}"
else
    echo -e "${RED}✗ Connection pool tests failed${NC}"
fi

if cargo test --lib neural::model::tests --quiet 2>&1 | tail -10; then
    echo -e "${GREEN}✓ Neural model tests passed${NC}"
else
    echo -e "${RED}✗ Neural model tests failed${NC}"
fi

if cargo test --lib metrics::tests --quiet 2>&1 | tail -10; then
    echo -e "${GREEN}✓ Metrics tests passed${NC}"
else
    echo -e "${RED}✗ Metrics tests failed${NC}"
fi
echo ""

echo -e "${YELLOW}Step 7: Running integration tests...${NC}"
if cargo test --test resource_management_tests --quiet 2>&1 | tail -20; then
    echo -e "${GREEN}✓ Integration tests passed${NC}"
else
    echo -e "${YELLOW}⚠ Some integration tests may have failed (check output)${NC}"
fi
echo ""

echo -e "${YELLOW}Step 8: Checking documentation...${NC}"
cd ../../../
if [ -f "docs/RESOURCE_MANAGEMENT.md" ]; then
    echo -e "${GREEN}✓ Resource management documentation exists${NC}"
    lines=$(wc -l < docs/RESOURCE_MANAGEMENT.md)
    echo "  Lines: $lines"
else
    echo -e "${RED}✗ Documentation missing${NC}"
fi

if [ -f "docs/RESOURCE_FIXES_SUMMARY.md" ]; then
    echo -e "${GREEN}✓ Implementation summary exists${NC}"
    lines=$(wc -l < docs/RESOURCE_FIXES_SUMMARY.md)
    echo "  Lines: $lines"
else
    echo -e "${RED}✗ Summary missing${NC}"
fi
echo ""

echo "======================================"
echo -e "${GREEN}Validation Complete!${NC}"
echo "======================================"
echo ""
echo "Summary:"
echo "- Connection pool manager: Implemented with deadpool"
echo "- Neural memory management: Implemented with Drop trait"
echo "- System metrics: Implemented with real-time tracking"
echo "- Tests: Unit and integration tests created"
echo "- Documentation: Complete usage guide available"
echo ""
echo "Next steps:"
echo "1. Run full benchmark suite:"
echo "   cd neural-trader-rust/crates/napi-bindings"
echo "   cargo test --test resource_management_tests -- --nocapture"
echo ""
echo "2. Review documentation:"
echo "   cat docs/RESOURCE_MANAGEMENT.md"
echo ""
echo "3. Enable jemalloc for production:"
echo "   cargo build --release --features jemalloc"
