#!/usr/bin/env python3
"""
MCP Server Launcher for Neural Trader
Ensures proper environment setup and imports
"""

import os
import sys
from pathlib import Path

# Set up environment
project_root = Path(__file__).parent
src_path = project_root / 'src'

# Add src to Python path
sys.path.insert(0, str(src_path))

# Load environment variables
from dotenv import load_dotenv
env_file = project_root / '.env'
if env_file.exists():
    load_dotenv(env_file)
    print(f"Loaded .env from {env_file}", file=sys.stderr)

# Set environment variables if needed
os.environ['PYTHONPATH'] = str(src_path)

# Now import and run the MCP server
if __name__ == "__main__":
    # Import the MCP server module
    from mcp import mcp_server_enhanced

    # The server should start when imported with __main__
    # If not, we'll need to call its main function
    if hasattr(mcp_server_enhanced, 'main'):
        mcp_server_enhanced.main()
    elif hasattr(mcp_server_enhanced, 'run'):
        mcp_server_enhanced.run()
    # The server should already be running from the import