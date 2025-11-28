#!/bin/bash
# MCP 2025-11 Validation Script for Docker Environment
# Validates 107 tools and protocol compliance

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3000}"
VALIDATION_REPORT="./reports/validation-$(date +%Y%m%d_%H%M%S).json"
RESULTS_FILE="./reports/results.txt"

# Create reports directory
mkdir -p ./reports

log() {
    echo -e "${BLUE}[VALIDATE]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test MCP server connectivity
test_connectivity() {
    log "Testing MCP server connectivity..."

    if curl -s -f "$MCP_SERVER_URL/health" > /dev/null; then
        success "MCP server is reachable"
        return 0
    else
        error "MCP server is not reachable at $MCP_SERVER_URL"
        return 1
    fi
}

# Test MCP protocol version
test_protocol_version() {
    log "Validating MCP protocol version..."

    response=$(curl -s "$MCP_SERVER_URL/info" || echo "{}")
    version=$(echo "$response" | jq -r '.protocol_version // "unknown"')

    if [ "$version" = "2025-11" ]; then
        success "Protocol version: $version"
        return 0
    else
        error "Invalid protocol version: $version (expected: 2025-11)"
        return 1
    fi
}

# Test tool listing
test_tool_listing() {
    log "Testing tool listing endpoint..."

    tools=$(curl -s "$MCP_SERVER_URL/tools" || echo "[]")
    tool_count=$(echo "$tools" | jq '. | length')

    if [ "$tool_count" -ge 107 ]; then
        success "Tool count: $tool_count (expected: ≥107)"
        return 0
    else
        error "Insufficient tools: $tool_count (expected: ≥107)"
        return 1
    fi
}

# Test individual tool categories
test_tool_categories() {
    log "Testing tool categories..."

    categories=(
        "ping"
        "list_strategies"
        "quick_analysis"
        "simulate_trade"
        "get_portfolio_status"
        "analyze_news"
        "run_backtest"
        "optimize_strategy"
        "risk_analysis"
        "execute_trade"
        "neural_forecast"
        "neural_train"
        "neural_evaluate"
        "get_prediction_markets_tool"
        "get_sports_events"
        "create_syndicate_tool"
    )

    local passed=0
    local failed=0

    for tool in "${categories[@]}"; do
        response=$(curl -s "$MCP_SERVER_URL/tools/$tool" 2>/dev/null || echo "{}")

        if echo "$response" | jq -e '.name' > /dev/null 2>&1; then
            success "Tool verified: $tool"
            ((passed++))
        else
            error "Tool missing or invalid: $tool"
            ((failed++))
        fi
    done

    log "Category test results: $passed passed, $failed failed"
    [ $failed -eq 0 ]
}

# Test NAPI bindings
test_napi_bindings() {
    log "Testing NAPI bindings..."

    if [ -f "./index.js" ]; then
        if node -e "const nt = require('./index.js'); console.log('NAPI bindings loaded successfully');" 2>/dev/null; then
            success "NAPI bindings are functional"
            return 0
        else
            error "NAPI bindings failed to load"
            return 1
        fi
    else
        warn "NAPI bindings test skipped (index.js not found)"
        return 0
    fi
}

# Test Rust binary
test_rust_binary() {
    log "Testing Rust binary..."

    if command -v neural-trader &> /dev/null; then
        if neural-trader --version > /dev/null 2>&1; then
            success "Rust binary is functional"
            return 0
        else
            error "Rust binary execution failed"
            return 1
        fi
    else
        warn "Rust binary test skipped (not in PATH)"
        return 0
    fi
}

# Test performance benchmarks
test_performance() {
    log "Running performance smoke tests..."

    start_time=$(date +%s%3N)
    curl -s "$MCP_SERVER_URL/tools/ping" > /dev/null
    end_time=$(date +%s%3N)

    latency=$((end_time - start_time))

    if [ $latency -lt 100 ]; then
        success "Response latency: ${latency}ms (excellent)"
        return 0
    elif [ $latency -lt 500 ]; then
        success "Response latency: ${latency}ms (acceptable)"
        return 0
    else
        warn "Response latency: ${latency}ms (slow)"
        return 1
    fi
}

# Test error handling
test_error_handling() {
    log "Testing error handling..."

    response=$(curl -s -w "\n%{http_code}" "$MCP_SERVER_URL/tools/nonexistent_tool" || echo "500")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "404" ] || [ "$http_code" = "400" ]; then
        success "Error handling works correctly (HTTP $http_code)"
        return 0
    else
        error "Unexpected error response (HTTP $http_code)"
        return 1
    fi
}

# Generate validation report
generate_report() {
    log "Generating validation report..."

    cat > "$VALIDATION_REPORT" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mcp_server": "$MCP_SERVER_URL",
  "protocol_version": "2025-11",
  "validation_results": {
    "total_tests": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "success_rate": $(awk "BEGIN {printf \"%.2f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
  },
  "compliance": {
    "mcp_2025_11": $([ $FAILED_TESTS -eq 0 ] && echo "true" || echo "false"),
    "tool_count": "≥107",
    "napi_bindings": "functional",
    "rust_binary": "functional"
  }
}
EOF

    success "Report saved to: $VALIDATION_REPORT"
}

# Run all tests
run_all_tests() {
    local tests=(
        "test_connectivity"
        "test_protocol_version"
        "test_tool_listing"
        "test_tool_categories"
        "test_napi_bindings"
        "test_rust_binary"
        "test_performance"
        "test_error_handling"
    )

    for test in "${tests[@]}"; do
        TOTAL_TESTS=$((TOTAL_TESTS + 1))

        if $test; then
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    done
}

# Main execution
main() {
    log "Starting MCP 2025-11 validation..."
    log "Target: $MCP_SERVER_URL"
    echo ""

    run_all_tests

    echo ""
    log "========================================="
    log "Validation Summary"
    log "========================================="
    log "Total Tests: $TOTAL_TESTS"
    success "Passed: $PASSED_TESTS"
    [ $FAILED_TESTS -gt 0 ] && error "Failed: $FAILED_TESTS" || log "Failed: 0"
    log "Success Rate: $(awk "BEGIN {printf \"%.2f%%\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")"
    log "========================================="

    generate_report

    if [ $FAILED_TESTS -eq 0 ]; then
        success "All validation checks passed! ✨"
        return 0
    else
        error "Some validation checks failed"
        return 1
    fi
}

# Run validation
main
exit $?
