#!/bin/bash

# Test script for JWT-protected endpoints
# Tests both local (port 8081) and deployed (Fly.io) versions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOCAL_URL="http://localhost:8081"
DEPLOYED_URL="https://ruvtrade.fly.dev"
USERNAME="admin"
PASSWORD="NeuralTrader2024!"

# Test mode selection
if [ "$1" == "local" ]; then
    BASE_URL="$LOCAL_URL"
    echo -e "${BLUE}Testing LOCAL deployment at $BASE_URL${NC}"
elif [ "$1" == "deployed" ]; then
    BASE_URL="$DEPLOYED_URL"
    echo -e "${BLUE}Testing DEPLOYED app at $BASE_URL${NC}"
else
    BASE_URL="$DEPLOYED_URL"
    echo -e "${BLUE}Testing DEPLOYED app at $BASE_URL (use 'local' arg for local testing)${NC}"
fi

echo "================================================"
echo -e "${YELLOW}JWT Authentication Testing${NC}"
echo "================================================"

# Statistics
TOTAL=0
PASSED=0
FAILED=0
RESULTS=""

# Function to test endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local description="$3"
    local data="$4"
    local requires_auth="$5"
    
    TOTAL=$((TOTAL + 1))
    
    if [ "$requires_auth" == "true" ] && [ -z "$TOKEN" ]; then
        echo -e "${RED}✗ FAILED${NC} - $description (No token available)"
        FAILED=$((FAILED + 1))
        RESULTS="$RESULTS\n${RED}✗${NC} $endpoint - No token"
        return
    fi
    
    # Build curl command
    if [ "$requires_auth" == "true" ]; then
        AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""
    else
        AUTH_HEADER=""
    fi
    
    if [ "$method" == "GET" ]; then
        if [ "$requires_auth" == "true" ]; then
            response=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL$endpoint" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "000")
        else
            response=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL$endpoint" 2>/dev/null || echo "000")
        fi
    elif [ "$method" == "POST" ]; then
        if [ "$requires_auth" == "true" ]; then
            response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $TOKEN" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null || echo "000")
        else
            response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null || echo "000")
        fi
    fi
    
    # Check response
    if [ "$response" == "200" ] || [ "$response" == "201" ] || [ "$response" == "422" ] || [ "$response" == "400" ]; then
        echo -e "${GREEN}✓ PASSED${NC} - $description (HTTP $response)"
        PASSED=$((PASSED + 1))
        RESULTS="$RESULTS\n${GREEN}✓${NC} $endpoint"
    elif [ "$response" == "401" ] && [ "$requires_auth" == "false" ]; then
        echo -e "${YELLOW}⚠ WARNING${NC} - $description expects no auth but got 401"
        FAILED=$((FAILED + 1))
        RESULTS="$RESULTS\n${YELLOW}⚠${NC} $endpoint - Unexpected auth requirement"
    else
        echo -e "${RED}✗ FAILED${NC} - $description (HTTP $response)"
        FAILED=$((FAILED + 1))
        RESULTS="$RESULTS\n${RED}✗${NC} $endpoint - HTTP $response"
    fi
}

# Wait for service to be ready
echo -e "\n${YELLOW}Checking service availability...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Service is ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "\n${RED}✗ Service not responding after 30 seconds${NC}"
    exit 1
fi

# Test 1: Public endpoints (should work without auth)
echo -e "\n${YELLOW}Testing public endpoints...${NC}"
test_endpoint "GET" "/" "Root endpoint" "" "false"
test_endpoint "GET" "/health" "Health check" "" "false"

# Test 2: Get JWT token
echo -e "\n${YELLOW}Getting JWT token...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$USERNAME&password=$PASSWORD" 2>/dev/null)

if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
    TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Successfully obtained JWT token${NC}"
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}✗ Failed to obtain JWT token${NC}"
    echo "Response: $TOKEN_RESPONSE"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo -e "\n${RED}Cannot continue without token. Exiting.${NC}"
    exit 1
fi

# Test 3: Protected endpoints with JWT
echo -e "\n${YELLOW}Testing protected endpoints with JWT...${NC}"

# Strategy endpoints
test_endpoint "GET" "/strategies/list" "List strategies" "" "true"
test_endpoint "GET" "/strategies/info?strategy=momentum" "Strategy info" "" "true"
test_endpoint "POST" "/strategies/recommend" "Recommend strategy" '{"market_conditions": {"volatility": "high"}}' "true"
test_endpoint "POST" "/strategies/switch" "Switch strategy" '{"from_strategy": "momentum", "to_strategy": "mirror"}' "true"
test_endpoint "POST" "/strategies/compare" "Compare strategies" '{"strategies": ["momentum", "mirror"]}' "true"

# Analysis endpoints
test_endpoint "GET" "/analysis/quick?symbol=AAPL" "Quick analysis" "" "true"
test_endpoint "POST" "/analysis/simulate" "Simulate trade" '{"strategy": "momentum", "symbol": "AAPL", "action": "buy"}' "true"
test_endpoint "POST" "/analysis/backtest" "Run backtest" '{"strategy": "momentum", "symbol": "AAPL", "start_date": "2024-01-01", "end_date": "2024-12-31"}' "true"
test_endpoint "POST" "/analysis/correlation" "Correlation analysis" '{"symbols": ["AAPL", "MSFT", "GOOGL"]}' "true"

# Neural endpoints
test_endpoint "POST" "/neural/forecast" "Neural forecast" '{"symbol": "AAPL", "horizon": 5}' "true"
test_endpoint "POST" "/neural/train" "Train model" '{"data_path": "/data/train.csv", "model_type": "lstm"}' "true"
test_endpoint "GET" "/neural/model/status" "Model status" "" "true"

# Portfolio endpoints
test_endpoint "GET" "/portfolio/status" "Portfolio status" "" "true"
test_endpoint "POST" "/portfolio/rebalance" "Portfolio rebalance" '{"target_allocations": {"AAPL": 0.3, "MSFT": 0.3, "GOOGL": 0.4}}' "true"

# News endpoints
test_endpoint "POST" "/news/analyze" "Analyze news" '{"symbol": "AAPL"}' "true"
test_endpoint "GET" "/news/sentiment?symbol=AAPL" "News sentiment" "" "true"

# Prediction markets
test_endpoint "GET" "/prediction/markets" "List prediction markets" "" "true"
test_endpoint "POST" "/prediction/analyze" "Analyze market" '{"market_id": "test-market"}' "true"

# Sports betting
test_endpoint "GET" "/sports/events?sport=nfl" "Sports events" "" "true"
test_endpoint "GET" "/sports/odds?sport=nfl" "Sports odds" "" "true"

# Syndicate management
test_endpoint "POST" "/syndicate/create" "Create syndicate" '{"syndicate_id": "test-syn-002", "name": "Test Syndicate 2"}' "true"
test_endpoint "GET" "/syndicate/TEST-SYN-001/status" "Syndicate status" "" "true"

# Test 4: Test invalid token
echo -e "\n${YELLOW}Testing with invalid token...${NC}"
INVALID_TOKEN="invalid.token.here"
response=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/strategies/list" \
    -H "Authorization: Bearer $INVALID_TOKEN" 2>/dev/null || echo "000")

if [ "$response" == "401" ]; then
    echo -e "${GREEN}✓ Correctly rejected invalid token (HTTP 401)${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ Did not reject invalid token (HTTP $response)${NC}"
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))

# Test 5: Test missing token on protected endpoint
echo -e "\n${YELLOW}Testing protected endpoint without token...${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/strategies/list" 2>/dev/null || echo "000")

if [ "$response" == "401" ] || [ "$response" == "403" ]; then
    echo -e "${GREEN}✓ Correctly rejected request without token (HTTP $response)${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ Did not reject request without token (HTTP $response)${NC}"
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))

# Summary
echo -e "\n================================================"
echo -e "${BLUE}Test Summary${NC}"
echo "================================================"
echo -e "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

# Calculate success rate
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")
    if [ "$SUCCESS_RATE" != "N/A" ]; then
        echo -e "Success Rate: ${YELLOW}${SUCCESS_RATE}%${NC}"
    else
        # Fallback for systems without bc
        SUCCESS_RATE=$((PASSED * 100 / TOTAL))
        echo -e "Success Rate: ${YELLOW}${SUCCESS_RATE}%${NC}"
    fi
fi

echo -e "\n${BLUE}Detailed Results:${NC}"
echo -e "$RESULTS"

# Exit code
if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All JWT authentication tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed. Please review the results.${NC}"
    exit 1
fi