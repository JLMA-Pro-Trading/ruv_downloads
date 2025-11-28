#!/bin/bash

# Neural Trader MCP Setup Script for Alpaca Integration
# This script ensures MCP uses the correct Alpaca API keys

echo "🚀 Setting up Neural Trader MCP with Alpaca Integration"
echo "======================================================="

# Export Alpaca environment variables
echo "📋 Setting Alpaca environment variables..."

# IMPORTANT: Replace these with your real Alpaca paper trading API keys
export ALPACA_API_KEY="PKVZM47F4PZC9B4QB3KF"  # Replace with your real key
export ALPACA_SECRET_KEY="your-real-secret-key-here"  # Replace with your real secret
export ALPACA_BASE_URL="https://paper-api.alpaca.markets/v2"

# Display configuration (hide secret)
echo "✅ ALPACA_API_KEY: ${ALPACA_API_KEY}"
echo "✅ ALPACA_SECRET_KEY: ****${ALPACA_SECRET_KEY: -4}"
echo "✅ ALPACA_BASE_URL: ${ALPACA_BASE_URL}"

# Check if MCP servers are running
echo -e "\n🔍 Checking MCP server status..."

# Kill existing MCP processes if running
echo "Stopping existing MCP servers..."
pkill -f "mcp.*neural-trader" 2>/dev/null || true
pkill -f "mcp.*claude-flow" 2>/dev/null || true
pkill -f "mcp.*flow-nexus" 2>/dev/null || true
pkill -f "mcp.*ruv-swarm" 2>/dev/null || true
sleep 2

# Start MCP servers with correct environment
echo -e "\n🚀 Starting MCP servers with Alpaca configuration..."

# Start neural-trader MCP (if available)
if command -v neural-trader-mcp &> /dev/null; then
    echo "Starting neural-trader MCP..."
    nohup neural-trader-mcp start > /tmp/neural-trader-mcp.log 2>&1 &
    echo "✅ neural-trader MCP started (PID: $!)"
else
    echo "⚠️  neural-trader MCP not found"
fi

# Start claude-flow MCP (if available)
if command -v claude &> /dev/null; then
    echo "Starting claude-flow MCP..."
    claude mcp add claude-flow npx claude-flow@alpha mcp start 2>/dev/null || true
    echo "✅ claude-flow MCP configured"
fi

# Verify environment is set
echo -e "\n🔧 Verifying MCP environment..."
env | grep ALPACA

echo -e "\n✅ MCP setup complete!"
echo "======================================================="
echo "Next steps:"
echo "1. Update the ALPACA_SECRET_KEY in this script with your real key"
echo "2. Run this script: ./setup_mcp_alpaca.sh"
echo "3. Test with: python test_mcp_alpaca.py"
echo ""
echo "To check MCP logs:"
echo "  tail -f /tmp/neural-trader-mcp.log"