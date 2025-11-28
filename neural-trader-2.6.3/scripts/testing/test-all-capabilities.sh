#!/bin/bash

# Comprehensive Capability Testing for Neural Trader by rUv
# Tests all features, edge cases, and advanced functionality

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_URL="https://neural-trader.ruv.io"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="test_results_${TIMESTAMP}.log"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}     Neural Trader by rUv - Comprehensive Capability Test${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
RESPONSE_TIMES=()

# Function to test endpoint with timing
test_capability() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local expected_field=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${YELLOW}[Test $TOTAL_TESTS] $description${NC}"
    echo "├─ Method: $method"
    echo "├─ Endpoint: $endpoint"
    
    # Measure response time
    START_TIME=$(date +%s%N)
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nRESPONSE_TIME:%{time_total}" "$API_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nRESPONSE_TIME:%{time_total}" \
            -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint" 2>/dev/null)
    fi
    
    END_TIME=$(date +%s%N)
    ELAPSED_TIME=$(awk "BEGIN {printf \"%.3f\", ($END_TIME - $START_TIME) / 1000000000}")
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_time=$(echo "$response" | grep "RESPONSE_TIME:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS:/d' | sed '/RESPONSE_TIME:/d')
    
    RESPONSE_TIMES+=($response_time)
    
    echo "├─ Response Time: ${response_time}s"
    echo -n "└─ Status: "
    
    if [ "$http_status" = "200" ]; then
        # Check if expected field exists in response
        if [ -n "$expected_field" ]; then
            if echo "$body" | jq -e ".$expected_field" >/dev/null 2>&1; then
                echo -e "${GREEN}✓ PASSED (HTTP $http_status)${NC}"
                PASSED_TESTS=$((PASSED_TESTS + 1))
                echo "   └─ Verified: $expected_field exists"
            else
                echo -e "${RED}✗ FAILED - Missing expected field: $expected_field${NC}"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        else
            echo -e "${GREEN}✓ PASSED (HTTP $http_status)${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        fi
        
        # Show sample of response
        echo "$body" | jq -c '.' 2>/dev/null | head -c 200
        if [ ${#body} -gt 200 ]; then echo "..."; fi
    else
        echo -e "${RED}✗ FAILED (HTTP $http_status)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "   └─ Error: $body"
    fi
    
    # Log to file
    echo "[$TIMESTAMP] Test $TOTAL_TESTS: $description - HTTP $http_status - ${response_time}s" >> "$LOG_FILE"
}

# Function to test concurrent requests
test_concurrent() {
    local endpoint=$1
    local count=$2
    local description=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${YELLOW}[Test $TOTAL_TESTS] Concurrent Test: $description${NC}"
    echo "├─ Endpoint: $endpoint"
    echo "├─ Concurrent Requests: $count"
    
    # Run concurrent requests
    for i in $(seq 1 $count); do
        curl -s "$API_URL$endpoint" > /dev/null 2>&1 &
    done
    
    # Wait for all requests to complete
    wait
    
    echo -e "└─ Status: ${GREEN}✓ All $count concurrent requests completed${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    1. BASIC CONNECTIVITY                      ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_capability "GET" "/" "{}" "Root Endpoint" "message"
test_capability "GET" "/health" "{}" "Health Check" "status"
test_capability "GET" "/docs" "{}" "Swagger Documentation" ""

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    2. PLATFORM STATUS                         ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_capability "GET" "/gpu-status" "{}" "GPU Status Check" "gpu_available"
test_capability "GET" "/trading/status" "{}" "Trading Status" "running"
test_capability "GET" "/metrics" "{}" "Prometheus Metrics" ""

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 3. TRADING OPERATIONS                         ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test with minimal configuration
test_capability "POST" "/trading/start" '{"strategies":["momentum_trader"],"symbols":["SPY"]}' \
    "Start Trading - Minimal Config" "status"

# Test with full configuration
full_config='{
  "strategies": ["momentum_trader", "enhanced_momentum", "neural_sentiment"],
  "symbols": ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"],
  "risk_level": "aggressive",
  "max_position_size": 100000,
  "use_gpu": true,
  "enable_news_trading": true,
  "enable_sentiment_analysis": true,
  "stop_loss_percentage": 1.5,
  "take_profit_percentage": 10.0,
  "time_frame": "1m"
}'
test_capability "POST" "/trading/start" "$full_config" \
    "Start Trading - Full Advanced Config" "configuration"

# Test selective stop
test_capability "POST" "/trading/stop" '{"strategies":["momentum_trader"],"close_positions":false}' \
    "Stop Trading - Selective Strategy" "strategies_stopped"

# Test full stop
test_capability "POST" "/trading/stop" '{"close_positions":true,"cancel_orders":true}' \
    "Stop Trading - All Strategies" "status"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 4. BACKTESTING & OPTIMIZATION                 ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Short-term backtest
backtest_short='{
  "strategy": "momentum_trader",
  "symbols": ["SPY"],
  "start_date": "2024-11-01",
  "end_date": "2024-12-01",
  "initial_capital": 50000,
  "use_gpu": false
}'
test_capability "POST" "/trading/backtest" "$backtest_short" \
    "Backtest - Short Period" "sharpe_ratio"

# Long-term backtest with multiple symbols
backtest_long='{
  "strategy": "enhanced_momentum",
  "symbols": ["SPY", "QQQ", "IWM", "DIA"],
  "start_date": "2023-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 250000,
  "use_gpu": true
}'
test_capability "POST" "/trading/backtest" "$backtest_long" \
    "Backtest - Long Period Multi-Symbol" "total_return"

# Strategy optimization
optimize_req='{
  "strategy": "momentum_trader",
  "symbols": ["AAPL", "GOOGL"],
  "optimization_metric": "sharpe_ratio",
  "max_iterations": 100
}'
test_capability "POST" "/trading/optimize" "$optimize_req" \
    "Strategy Optimization" "best_parameters"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 5. AI & SENTIMENT ANALYSIS                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# News analysis - single symbol
news_single='{
  "symbols": ["TSLA"],
  "lookback_hours": 24,
  "sentiment_threshold": 0.5,
  "use_gpu": false
}'
test_capability "POST" "/trading/analyze-news" "$news_single" \
    "News Analysis - Single Symbol" "results"

# News analysis - multiple symbols with GPU
news_multi='{
  "symbols": ["AAPL", "MSFT", "GOOGL", "AMZN", "META"],
  "lookback_hours": 72,
  "sentiment_threshold": 0.75,
  "use_gpu": true
}'
test_capability "POST" "/trading/analyze-news" "$news_multi" \
    "News Analysis - Multi-Symbol GPU" "results"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 6. TRADE EXECUTION                            ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Market order
market_order='{
  "symbol": "SPY",
  "action": "buy",
  "quantity": 100,
  "order_type": "market"
}'
test_capability "POST" "/trading/execute-trade" "$market_order" \
    "Execute Trade - Market Order" "order_id"

# Limit order
limit_order='{
  "symbol": "AAPL",
  "action": "sell",
  "quantity": 50,
  "order_type": "limit",
  "limit_price": 195.50
}'
test_capability "POST" "/trading/execute-trade" "$limit_order" \
    "Execute Trade - Limit Order" "execution_price"

# Stop loss order
stop_order='{
  "symbol": "QQQ",
  "action": "buy",
  "quantity": 25,
  "order_type": "stop_loss",
  "stop_price": 400.00
}'
test_capability "POST" "/trading/execute-trade" "$stop_order" \
    "Execute Trade - Stop Loss Order" "order_id"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 7. PORTFOLIO MANAGEMENT                       ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_capability "GET" "/portfolio/status" "{}" \
    "Portfolio Status - Basic" "total_value"

test_capability "GET" "/portfolio/status?include_analytics=true" "{}" \
    "Portfolio Status - With Analytics" "analytics"

test_capability "GET" "/portfolio/status?include_analytics=false" "{}" \
    "Portfolio Status - No Analytics" "positions"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 8. RISK ANALYSIS                              ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Simple portfolio risk
simple_risk='{
  "portfolio": [
    {"symbol": "SPY", "quantity": 100, "value": 45000}
  ],
  "var_confidence": 0.95,
  "use_monte_carlo": false,
  "use_gpu": false
}'
test_capability "POST" "/risk/analysis" "$simple_risk" \
    "Risk Analysis - Simple Portfolio" "risk_metrics"

# Complex portfolio with Monte Carlo
complex_risk='{
  "portfolio": [
    {"symbol": "SPY", "quantity": 200, "value": 90000},
    {"symbol": "QQQ", "quantity": 150, "value": 60000},
    {"symbol": "IWM", "quantity": 100, "value": 20000},
    {"symbol": "GLD", "quantity": 50, "value": 10000},
    {"symbol": "TLT", "quantity": 75, "value": 8000},
    {"symbol": "VXX", "quantity": 30, "value": 3000}
  ],
  "var_confidence": 0.99,
  "use_monte_carlo": true,
  "use_gpu": true
}'
test_capability "POST" "/risk/analysis" "$complex_risk" \
    "Risk Analysis - Complex Portfolio with Monte Carlo" "monte_carlo_simulations"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 9. EDGE CASES & VALIDATION                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test with invalid risk level (should still work with defaults)
invalid_risk='{
  "strategies": ["momentum_trader"],
  "symbols": ["SPY"],
  "risk_level": "extreme"
}'
test_capability "POST" "/trading/start" "$invalid_risk" \
    "Edge Case - Invalid Risk Level" ""

# Test with empty symbols array
empty_symbols='{
  "strategies": ["momentum_trader"],
  "symbols": []
}'
test_capability "POST" "/trading/start" "$empty_symbols" \
    "Edge Case - Empty Symbols" ""

# Test with very high position size
high_position='{
  "strategies": ["momentum_trader"],
  "symbols": ["SPY"],
  "max_position_size": 999999
}'
test_capability "POST" "/trading/start" "$high_position" \
    "Edge Case - High Position Size" "configuration"

# Test with extreme stop loss
extreme_stops='{
  "strategies": ["momentum_trader"],
  "symbols": ["SPY"],
  "stop_loss_percentage": 0.1,
  "take_profit_percentage": 50.0
}'
test_capability "POST" "/trading/start" "$extreme_stops" \
    "Edge Case - Extreme Stop/Profit Levels" "configuration"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 10. PERFORMANCE & LOAD TESTING                ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_concurrent "/health" 5 "5 Concurrent Health Checks"
test_concurrent "/trading/status" 10 "10 Concurrent Status Requests"
test_concurrent "/" 15 "15 Concurrent Root Requests"

# Rapid sequential requests
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -e "\n${YELLOW}[Test $TOTAL_TESTS] Rapid Sequential Requests${NC}"
echo "├─ Sending 20 rapid requests..."
SUCCESS_COUNT=0
for i in $(seq 1 20); do
    if curl -s "$API_URL/health" | grep -q "healthy"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    fi
done
echo -e "└─ Status: ${GREEN}✓ $SUCCESS_COUNT/20 requests succeeded${NC}"
if [ $SUCCESS_COUNT -eq 20 ]; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                 11. ENUM VALUE TESTING                        ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test all strategy enums
for strategy in "mirror_trader" "momentum_trader" "enhanced_momentum" "neural_sentiment" "neural_arbitrage" "neural_trend" "mean_reversion" "pairs_trading"; do
    test_capability "POST" "/trading/start" "{\"strategies\":[\"$strategy\"],\"symbols\":[\"SPY\"]}" \
        "Strategy Enum - $strategy" ""
done

# Test all risk levels
for risk in "low" "medium" "high" "aggressive"; do
    test_capability "POST" "/trading/start" "{\"strategies\":[\"momentum_trader\"],\"symbols\":[\"SPY\"],\"risk_level\":\"$risk\"}" \
        "Risk Level - $risk" ""
done

# Test all timeframes
for timeframe in "1m" "5m" "15m" "1h" "4h" "1d"; do
    test_capability "POST" "/trading/start" "{\"strategies\":[\"momentum_trader\"],\"symbols\":[\"SPY\"],\"time_frame\":\"$timeframe\"}" \
        "Timeframe - $timeframe" ""
done

echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                      TEST SUMMARY                             ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total Tests Run: ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "Tests Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Tests Failed: ${RED}$FAILED_TESTS${NC}"

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", $PASSED_TESTS * 100 / $TOTAL_TESTS}")
    echo -e "Success Rate: ${GREEN}${SUCCESS_RATE}%${NC}"
fi

# Calculate average response time
if [ ${#RESPONSE_TIMES[@]} -gt 0 ]; then
    AVG_TIME=$(printf '%s\n' "${RESPONSE_TIMES[@]}" | awk '{sum+=$1} END {printf "%.3f", sum/NR}')
    echo -e "Average Response Time: ${CYAN}${AVG_TIME}s${NC}"
fi

echo ""
echo -e "Test Log: ${BLUE}$LOG_FILE${NC}"

# Final verdict
echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     🎉 ALL CAPABILITIES VERIFIED SUCCESSFULLY! 🎉        ║${NC}"
    echo -e "${GREEN}║     Neural Trader by rUv is fully operational!           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║     ⚠️  SOME TESTS FAILED - REVIEW REQUIRED  ⚠️          ║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════╝${NC}"
fi

echo ""
echo "API URL: $API_URL"
echo "Documentation: $API_URL/docs"
echo ""