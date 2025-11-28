#!/bin/bash

# Test JWT Authentication for Neural Trader
# This script tests both authenticated and unauthenticated access

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="https://neural-trader.ruv.io"
USERNAME="admin"
PASSWORD="changeme"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    Neural Trader - JWT Authentication Test            ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# 1. Check authentication status
echo -e "${YELLOW}1. Checking authentication status...${NC}"
AUTH_STATUS=$(curl -s "$API_URL/auth/status")
echo "$AUTH_STATUS" | jq '.'
AUTH_ENABLED=$(echo "$AUTH_STATUS" | jq -r '.enabled')

if [ "$AUTH_ENABLED" = "false" ]; then
    echo -e "${YELLOW}⚠️  Authentication is DISABLED${NC}"
    echo "All endpoints are accessible without authentication"
else
    echo -e "${GREEN}✓ Authentication is ENABLED${NC}"
fi
echo ""

# 2. Test unauthenticated access
echo -e "${YELLOW}2. Testing unauthenticated access to trading status...${NC}"
UNAUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_URL/trading/status")
HTTP_STATUS=$(echo "$UNAUTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$UNAUTH_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Accessible without auth (HTTP 200)${NC}"
    echo "$BODY" | jq -c '.' | head -c 100
    echo "..."
elif [ "$HTTP_STATUS" = "401" ]; then
    echo -e "${RED}✗ Requires authentication (HTTP 401)${NC}"
else
    echo -e "${YELLOW}Response: HTTP $HTTP_STATUS${NC}"
fi
echo ""

# 3. Login and get token (if auth is enabled)
if [ "$AUTH_ENABLED" = "true" ] || [ "$1" = "--force" ]; then
    echo -e "${YELLOW}3. Attempting login...${NC}"
    LOGIN_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
        "$API_URL/auth/login")
    
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
    
    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        echo -e "${GREEN}✓ Login successful!${NC}"
        echo "Token: ${TOKEN:0:20}..."
        echo ""
        
        # 4. Test authenticated access
        echo -e "${YELLOW}4. Testing authenticated access...${NC}"
        
        # Test auth status with token
        echo -n "   Auth Status: "
        AUTH_CHECK=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/auth/status")
        IS_AUTH=$(echo "$AUTH_CHECK" | jq -r '.authenticated')
        if [ "$IS_AUTH" = "true" ]; then
            echo -e "${GREEN}✓ Authenticated${NC}"
            echo "   Username: $(echo "$AUTH_CHECK" | jq -r '.username')"
            echo "   Auth Type: $(echo "$AUTH_CHECK" | jq -r '.auth_type')"
        else
            echo -e "${RED}✗ Not authenticated${NC}"
        fi
        
        # Test trading endpoints with token
        echo ""
        echo -e "${YELLOW}5. Testing protected endpoints with token...${NC}"
        
        # Start trading
        echo -n "   Start Trading: "
        START_RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"strategies":["momentum_trader"],"symbols":["SPY"]}' \
            "$API_URL/trading/start")
        if echo "$START_RESPONSE" | grep -qE "(started|already_running)"; then
            echo -e "${GREEN}✓ Success${NC}"
        else
            echo -e "${RED}✗ Failed${NC}"
        fi
        
        # Trading status
        echo -n "   Trading Status: "
        STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/trading/status")
        if echo "$STATUS_RESPONSE" | grep -q "strategies"; then
            echo -e "${GREEN}✓ Success${NC}"
        else
            echo -e "${RED}✗ Failed${NC}"
        fi
        
        # Backtest
        echo -n "   Run Backtest: "
        BACKTEST_RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"strategy":"momentum_trader","symbols":["SPY"],"start_date":"2024-01-01","end_date":"2024-06-30"}' \
            "$API_URL/trading/backtest")
        if echo "$BACKTEST_RESPONSE" | grep -q "sharpe_ratio"; then
            echo -e "${GREEN}✓ Success${NC}"
        else
            echo -e "${RED}✗ Failed${NC}"
        fi
        
        # Verify token
        echo ""
        echo -e "${YELLOW}6. Verifying token validity...${NC}"
        VERIFY_RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"token\":\"$TOKEN\"}" \
            "$API_URL/auth/verify")
        
        if echo "$VERIFY_RESPONSE" | grep -q "valid"; then
            echo -e "${GREEN}✓ Token is valid${NC}"
            echo "$VERIFY_RESPONSE" | jq '.'
        else
            echo -e "${RED}✗ Token verification failed${NC}"
        fi
        
    else
        echo -e "${RED}✗ Login failed${NC}"
        echo "$LOGIN_RESPONSE" | jq '.'
    fi
else
    echo -e "${YELLOW}3. Skipping login test (auth disabled)${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Authentication Test Complete!${NC}"
echo ""
echo "Configuration:"
echo "• Auth Enabled: $AUTH_ENABLED"
echo "• API URL: $API_URL"
echo ""
echo "To enable authentication, set these environment variables:"
echo "• AUTH_ENABLED=true"
echo "• JWT_SECRET_KEY=<secure-random-key>"
echo "• AUTH_USERNAME=<your-username>"
echo "• AUTH_PASSWORD=<your-password>"
echo ""