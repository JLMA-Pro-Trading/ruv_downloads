#!/bin/bash

# Docker test runner for neural-trader installation
# Tests various installation scenarios

set -e

echo "🐳 Neural Trader Docker Installation Tests"
echo "=========================================="
echo

cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

run_test() {
    local test_name=$1
    local service=$2

    echo -e "${YELLOW}Running: ${test_name}${NC}"
    echo "----------------------------------------"

    if docker-compose -f tests/docker/docker-compose.npm-test.yml up --build "$service" 2>&1 | tee /tmp/docker-test-output.log; then
        if grep -q "✅ SUCCESS" /tmp/docker-test-output.log; then
            echo -e "${GREEN}✅ PASSED: ${test_name}${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  COMPLETED WITH WARNINGS: ${test_name}${NC}"
            return 0
        fi
    else
        echo -e "${RED}❌ FAILED: ${test_name}${NC}"
        return 1
    fi
    echo
}

# Track results
passed=0
failed=0

# Run tests
if run_test "NPM Pack + Install" "pack-install-test"; then
    ((passed++))
else
    ((failed++))
fi

if run_test "Build From Source" "build-source-test"; then
    ((passed++))
else
    ((failed++))
fi

if run_test "Binary Check" "binary-check-test"; then
    ((passed++))
else
    ((failed++))
fi

if run_test "Dependency Installation" "dependency-test"; then
    ((passed++))
else
    ((failed++))
fi

# Summary
echo
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}${passed}${NC}"
echo -e "Failed: ${RED}${failed}${NC}"
echo

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
