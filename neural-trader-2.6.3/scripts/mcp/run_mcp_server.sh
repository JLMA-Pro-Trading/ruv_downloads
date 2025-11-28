#!/bin/bash

# Set the working directory
cd /workspaces/neural-trader

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set Python path to include src directory
export PYTHONPATH="/workspaces/neural-trader/src:$PYTHONPATH"

# Run the MCP server
exec python /workspaces/neural-trader/src/mcp/mcp_server_enhanced.py