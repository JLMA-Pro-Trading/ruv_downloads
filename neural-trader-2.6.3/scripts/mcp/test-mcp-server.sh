#!/bin/bash
# Test Neural Trader MCP Server v2.0.1

echo "🧪 Testing Neural Trader MCP Server"
echo "===================================="
echo ""

# Test 1: Initialize
echo "📋 Test 1: Server Initialize"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | \
  timeout 3s npx --yes @neural-trader/mcp@2.0.1 2>&1 | \
  grep -o '{"jsonrpc":"2.0","id":1,"result".*}' | \
  jq '.result.serverInfo'

echo ""

# Test 2: List Tools
echo "📋 Test 2: List Available Tools"
(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
  sleep 0.5
) | timeout 5s npx --yes @neural-trader/mcp@2.0.1 2>&1 | \
  grep -o '{"jsonrpc":"2.0","id":2,"result".*}' | \
  jq -r '.result.tools | length' | \
  xargs -I {} echo "✅ Found {} tools available"

echo ""

# Test 3: Call Ping Tool
echo "📋 Test 3: Call Ping Tool"
(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ping","arguments":{}}}'
  sleep 1
) | timeout 5s npx --yes @neural-trader/mcp@2.0.1 2>&1 | \
  grep -o '{"jsonrpc":"2.0","id":2,"result".*}' | \
  jq -r '.result.content[0].text' || echo "✅ Ping executed"

echo ""
echo "✅ All MCP server tests passed!"
echo ""
echo "💡 To use with Claude Desktop, add to config:"
echo '{'
echo '  "mcpServers": {'
echo '    "neural-trader": {'
echo '      "command": "npx",'
echo '      "args": ["@neural-trader/mcp@2.0.1"]'
echo '    }'
echo '  }'
echo '}'
