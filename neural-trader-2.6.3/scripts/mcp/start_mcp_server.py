#!/usr/bin/env python3
"""
MCP Server Launcher for AI News Trading Platform

Usage:
    python start_mcp_server.py [--host HOST] [--http-port PORT] [--ws-port PORT] [--gpu]
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from mcp import MCPServer


def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Start MCP Server for AI News Trading Platform'
    )
    parser.add_argument(
        '--host',
        default='0.0.0.0',
        help='Host to bind to (default: 0.0.0.0)'
    )
    parser.add_argument(
        '--http-port',
        type=int,
        default=8080,
        help='HTTP port (default: 8080)'
    )
    parser.add_argument(
        '--ws-port',
        type=int,
        default=8081,
        help='WebSocket port (default: 8081)'
    )
    parser.add_argument(
        '--gpu',
        action='store_true',
        help='Enable GPU acceleration if available'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.verbose)
    
    # Create and start server
    server = MCPServer(
        host=args.host,
        http_port=args.http_port,
        ws_port=args.ws_port
    )
    
    # Enable GPU if requested
    if args.gpu:
        logging.info("GPU acceleration requested")
        server.gpu_available = True
    
    logging.info(f"""
==============================================
    AI News Trading Platform MCP Server
==============================================
HTTP API: http://{args.host}:{args.http_port}/mcp
WebSocket: ws://{args.host}:{args.ws_port}
Health Check: http://{args.host}:{args.http_port}/health
Capabilities: http://{args.host}:{args.http_port}/capabilities
GPU Acceleration: {'Enabled' if server.gpu_available else 'Disabled'}
==============================================
""")
    
    try:
        await server.start()
    except KeyboardInterrupt:
        logging.info("Shutting down MCP server...")
    except Exception as e:
        logging.error(f"Server error: {str(e)}")
        raise


if __name__ == "__main__":
    asyncio.run(main())