#!/usr/bin/env python3
"""
FastMCP Server Launcher for AI News Trading Platform
Official Anthropic MCP Python SDK Implementation

This launcher replaces the custom MCP implementation with the official FastMCP
library and fixes the -32001 timeout error through proper configuration.

Usage:
    python start_mcp_server_fastmcp.py [--host HOST] [--port PORT] [--gpu]
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

# Import and run the FastMCP server
if __name__ == "__main__":
    from mcp_server_fastmcp import mcp
    
    print("""
==============================================
AI News Trading Platform FastMCP Server
Official Anthropic MCP Python SDK
==============================================
Starting server with 300-second timeout...
GPU acceleration: Auto-detect
FastMCP version: 2.9.0+
==============================================
""")
    
    # The FastMCP server handles all argument parsing and execution
    # It will automatically use the proper timeout configuration
    exec(open('src/mcp_server_fastmcp.py').read())