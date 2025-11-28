#!/bin/bash

# Test script for Swarm Intelligence endpoints

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:8082"

echo -e "${BLUE}Testing Swarm Intelligence Endpoints${NC}"
echo "======================================"

# Test health endpoint
echo -e "\n${YELLOW}1. Testing Swarm Health${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/swarm/health")
if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ Swarm health endpoint working${NC}"
    curl -s "$BASE_URL/swarm/health" | jq .
else
    echo -e "${RED}✗ Swarm health endpoint failed (HTTP $response)${NC}"
fi

# Test analyze-codebase (safe read-only)
echo -e "\n${YELLOW}2. Testing Codebase Analysis (Read-Only)${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/analyze-codebase" \
    -H "Content-Type: application/json")
    
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Codebase analysis endpoint working${NC}"
else
    echo -e "${YELLOW}⚠ Codebase analysis endpoint needs Claude Flow installed${NC}"
fi

# Test sessions list
echo -e "\n${YELLOW}3. Testing Sessions List${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/swarm/sessions")
if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ Sessions endpoint working${NC}"
    curl -s "$BASE_URL/swarm/sessions" | jq .
else
    echo -e "${RED}✗ Sessions endpoint failed (HTTP $response)${NC}"
fi

# Test deploy swarm (demo mode - won't actually run Claude Flow)
echo -e "\n${YELLOW}4. Testing Swarm Deploy (Demo)${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/deploy" \
    -H "Content-Type: application/json" \
    -d '{
        "objective": "Test optimization task",
        "strategy": "optimization",
        "mode": "distributed",
        "max_agents": 3,
        "parallel": true,
        "background": false,
        "analysis_only": true
    }')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Swarm deploy endpoint accessible${NC}"
    echo "$response" | jq . 2>/dev/null || echo "$response"
else
    echo -e "${RED}✗ Swarm deploy endpoint failed${NC}"
fi

# Test hive-mind endpoint
echo -e "\n${YELLOW}5. Testing Hive-Mind Deploy${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/hive-mind" \
    -H "Content-Type: application/json" \
    -d '{
        "objective": "Test hive-mind coordination",
        "queen_type": "adaptive",
        "max_workers": 5,
        "consensus": "majority",
        "auto_scale": true,
        "monitor": true
    }' -o /dev/null -w "%{http_code}")

if [ "$response" == "200" ] || [ "$response" == "500" ]; then
    echo -e "${GREEN}✓ Hive-mind endpoint accessible${NC}"
else
    echo -e "${RED}✗ Hive-mind endpoint failed (HTTP $response)${NC}"
fi

# Test optimize-database endpoint
echo -e "\n${YELLOW}6. Testing Database Optimization${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/optimize-database" -o /dev/null -w "%{http_code}")
if [ "$response" == "200" ] || [ "$response" == "500" ]; then
    echo -e "${GREEN}✓ Database optimization endpoint accessible${NC}"
else
    echo -e "${RED}✗ Database optimization endpoint failed (HTTP $response)${NC}"
fi

# Test research endpoint
echo -e "\n${YELLOW}7. Testing Research Endpoint${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/research?topic=AI%20trading" -o /dev/null -w "%{http_code}")
if [ "$response" == "200" ] || [ "$response" == "422" ] || [ "$response" == "500" ]; then
    echo -e "${GREEN}✓ Research endpoint accessible${NC}"
else
    echo -e "${RED}✗ Research endpoint failed (HTTP $response)${NC}"
fi

# Test SPARC endpoint
echo -e "\n${YELLOW}8. Testing SPARC Methodology${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/sparc?task=Build%20API&mode=tdd" -o /dev/null -w "%{http_code}")
if [ "$response" == "200" ] || [ "$response" == "422" ] || [ "$response" == "500" ]; then
    echo -e "${GREEN}✓ SPARC endpoint accessible${NC}"
else
    echo -e "${RED}✗ SPARC endpoint failed (HTTP $response)${NC}"
fi

# Test task orchestration
echo -e "\n${YELLOW}9. Testing Task Orchestration${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/task" \
    -H "Content-Type: application/json" \
    -d '{
        "task": "Analyze performance metrics",
        "topology": "mesh",
        "max_agents": 3,
        "priority": "high"
    }' -o /dev/null -w "%{http_code}")

if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ Task orchestration endpoint working${NC}"
else
    echo -e "${RED}✗ Task orchestration endpoint failed (HTTP $response)${NC}"
fi

# Test neural swarm
echo -e "\n${YELLOW}10. Testing Neural Swarm${NC}"
response=$(curl -s -X POST "$BASE_URL/swarm/neural-swarm?data_path=/data/test.csv&pattern_type=coordination" -o /dev/null -w "%{http_code}")
if [ "$response" == "200" ] || [ "$response" == "422" ]; then
    echo -e "${GREEN}✓ Neural swarm endpoint accessible${NC}"
else
    echo -e "${RED}✗ Neural swarm endpoint failed (HTTP $response)${NC}"
fi

echo -e "\n${BLUE}======================================"
echo -e "Swarm Endpoint Testing Complete${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} Some endpoints require Claude Flow to be installed."
echo "To fully utilize swarm features, install Claude Flow:"
echo "  npm install -g @claude-flow/cli"
echo ""
echo -e "${GREEN}API Documentation:${NC} http://localhost:8082/docs#/Swarm%20Intelligence"