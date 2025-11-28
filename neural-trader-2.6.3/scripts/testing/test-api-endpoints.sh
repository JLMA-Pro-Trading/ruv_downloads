#!/bin/bash

# Test script for Neural Trader API endpoints
API_URL="https://neural-trader.ruv.io"

echo "🧪 Testing Neural Trader by rUv API Endpoints"
echo "============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X $method -H "Content-Type: application/json" -d "$data" "$API_URL$endpoint")
    fi
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    if [ "$http_status" = "200" ]; then
        echo -e "${GREEN}✓ Success (HTTP $http_status)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Failed (HTTP $http_status)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    echo ""
}

# Test GET endpoints
echo "📍 GET Endpoints"
echo "----------------"
test_endpoint "GET" "/" "{}" "Root endpoint"
test_endpoint "GET" "/health" "{}" "Health check"
test_endpoint "GET" "/gpu-status" "{}" "GPU status"
test_endpoint "GET" "/trading/status" "{}" "Trading status"
test_endpoint "GET" "/portfolio/status?include_analytics=true" "{}" "Portfolio status with analytics"
test_endpoint "GET" "/metrics" "{}" "Prometheus metrics"

# Test enhanced POST endpoints
echo "📍 POST Endpoints (Enhanced)"
echo "----------------------------"

# Test /trading/start with advanced parameters
echo -e "${YELLOW}Testing: Start trading with advanced configuration${NC}"
trading_start_data='{
  "strategies": ["momentum_trader", "enhanced_momentum"],
  "symbols": ["SPY", "QQQ", "AAPL"],
  "risk_level": "medium",
  "max_position_size": 25000,
  "use_gpu": false,
  "enable_news_trading": true,
  "enable_sentiment_analysis": true,
  "stop_loss_percentage": 2.5,
  "take_profit_percentage": 7.5,
  "time_frame": "5m"
}'
test_endpoint "POST" "/trading/start" "$trading_start_data" "Start trading with configuration"

# Test /trading/stop with selective stopping
echo -e "${YELLOW}Testing: Stop specific strategies${NC}"
trading_stop_data='{
  "strategies": ["momentum_trader"],
  "close_positions": true,
  "cancel_orders": true
}'
test_endpoint "POST" "/trading/stop" "$trading_stop_data" "Stop specific strategies"

# Test backtest endpoint
echo -e "${YELLOW}Testing: Run backtest${NC}"
backtest_data='{
  "strategy": "momentum_trader",
  "symbols": ["SPY", "QQQ"],
  "start_date": "2024-01-01",
  "end_date": "2024-06-30",
  "initial_capital": 100000,
  "use_gpu": true
}'
test_endpoint "POST" "/trading/backtest" "$backtest_data" "Historical backtest"

# Test optimization endpoint
echo -e "${YELLOW}Testing: Optimize strategy${NC}"
optimize_data='{
  "strategy": "momentum_trader",
  "symbols": ["SPY"],
  "optimization_metric": "sharpe_ratio",
  "max_iterations": 50
}'
test_endpoint "POST" "/trading/optimize" "$optimize_data" "Strategy optimization"

# Test news analysis endpoint
echo -e "${YELLOW}Testing: Analyze news sentiment${NC}"
news_data='{
  "symbols": ["AAPL", "MSFT"],
  "lookback_hours": 48,
  "sentiment_threshold": 0.7,
  "use_gpu": false
}'
test_endpoint "POST" "/trading/analyze-news" "$news_data" "News sentiment analysis"

# Test trade execution endpoint
echo -e "${YELLOW}Testing: Execute trade${NC}"
trade_data='{
  "symbol": "SPY",
  "action": "buy",
  "quantity": 10,
  "order_type": "limit",
  "limit_price": 450.50
}'
test_endpoint "POST" "/trading/execute-trade" "$trade_data" "Execute trade order"

# Test risk analysis endpoint
echo -e "${YELLOW}Testing: Portfolio risk analysis${NC}"
risk_data='{
  "portfolio": [
    {"symbol": "SPY", "quantity": 100, "value": 45000},
    {"symbol": "QQQ", "quantity": 50, "value": 20000},
    {"symbol": "AAPL", "quantity": 200, "value": 35000}
  ],
  "var_confidence": 0.95,
  "use_monte_carlo": true,
  "use_gpu": true
}'
test_endpoint "POST" "/risk/analysis" "$risk_data" "Portfolio risk analysis"

echo "============================================="
echo -e "${GREEN}✅ API Endpoint Testing Complete!${NC}"
echo ""

# Summary of available endpoints
echo "📊 Available Endpoints Summary:"
echo "------------------------------"
echo "GET Endpoints:"
echo "  / - Root endpoint with app info"
echo "  /health - Health check"
echo "  /gpu-status - GPU availability status"
echo "  /trading/status - Current trading status"
echo "  /portfolio/status - Portfolio status with analytics"
echo "  /metrics - Prometheus metrics"
echo "  /docs - Swagger UI documentation"
echo "  /redoc - ReDoc documentation"
echo ""
echo "POST Endpoints (Enhanced):"
echo "  /trading/start - Start trading with advanced configuration"
echo "  /trading/stop - Stop trading with position management"
echo "  /trading/backtest - Run historical backtest"
echo "  /trading/optimize - Optimize strategy parameters"
echo "  /trading/analyze-news - AI news sentiment analysis"
echo "  /trading/execute-trade - Execute trade with order management"
echo "  /risk/analysis - Portfolio risk analysis with Monte Carlo"