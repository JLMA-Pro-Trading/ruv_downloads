#!/usr/bin/env python3
"""
Update MCP configuration to use the integrated server
Allows switching between original (27 tools) and integrated (40+ tools) versions
"""

import json
import sys
from pathlib import Path
import shutil
from datetime import datetime

def backup_config(config_path: Path):
    """Create backup of current configuration"""
    if config_path.exists():
        backup_path = config_path.with_suffix(f'.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        shutil.copy2(config_path, backup_path)
        print(f"✅ Backed up current config to: {backup_path}")
        return backup_path
    return None

def update_mcp_config(use_integrated: bool = True):
    """Update MCP configuration file"""
    # Find .roo/mcp.json
    config_path = Path(".roo/mcp.json")
    
    if not config_path.parent.exists():
        config_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"✅ Created directory: {config_path.parent}")
    
    # Backup existing config
    backup_path = backup_config(config_path)
    
    # Determine which server to use
    if use_integrated:
        server_script = "src/mcp/mcp_server_integrated.py"
        description = "Integrated MCP server with 40+ tools"
    else:
        server_script = "src/mcp/mcp_server_enhanced.py"
        description = "Original MCP server with 27 tools"
    
    # Create new configuration
    config = {
        "servers": {
            "ai-news-trader": {
                "type": "stdio",
                "command": "python",
                "args": [server_script],
                "env": {
                    "PYTHONPATH": "${PWD}",
                    "MCP_MODE": "integrated" if use_integrated else "original"
                },
                "description": description
            }
        }
    }
    
    # Write configuration
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"✅ Updated MCP configuration to use: {server_script}")
    print(f"   Description: {description}")
    
    # Verify the server file exists
    server_path = Path(server_script)
    if server_path.exists():
        print(f"✅ Server file verified: {server_path}")
    else:
        print(f"❌ WARNING: Server file not found: {server_path}")
        print("   Please ensure the file exists before starting Claude Code")
    
    return config_path

def show_current_config():
    """Display current MCP configuration"""
    config_path = Path(".roo/mcp.json")
    
    if not config_path.exists():
        print("❌ No MCP configuration found")
        return
    
    with open(config_path) as f:
        config = json.load(f)
    
    print("\n📋 Current MCP Configuration:")
    print("="*60)
    
    for server_name, server_config in config.get("servers", {}).items():
        print(f"Server: {server_name}")
        print(f"  Type: {server_config.get('type', 'unknown')}")
        print(f"  Command: {server_config.get('command', 'unknown')}")
        args = server_config.get('args', [])
        if args:
            print(f"  Script: {args[0] if args else 'none'}")
        print(f"  Description: {server_config.get('description', 'none')}")
        
        # Check which version is active
        if args and 'integrated' in args[0]:
            print(f"  ✨ Version: INTEGRATED (40+ tools)")
        elif args and 'enhanced' in args[0]:
            print(f"  📦 Version: ORIGINAL (27 tools)")
    
    print("="*60)

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Update MCP configuration for AI News Trading Platform"
    )
    parser.add_argument(
        "--mode",
        choices=["integrated", "original"],
        default="integrated",
        help="Which MCP server version to use (default: integrated)"
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Show current configuration and exit"
    )
    
    args = parser.parse_args()
    
    # Change to project root
    project_root = Path(__file__).parent.parent
    import os
    os.chdir(project_root)
    print(f"📁 Working directory: {Path.cwd()}")
    
    if args.show:
        show_current_config()
        return
    
    # Update configuration
    use_integrated = args.mode == "integrated"
    config_path = update_mcp_config(use_integrated)
    
    print("\n✨ Configuration updated successfully!")
    print("\n📝 Next steps:")
    print("1. Restart Claude Code to load the new configuration")
    print("2. The MCP server will start automatically")
    print("3. All tools will be available with the prefix: mcp__ai-news-trader__")
    
    if use_integrated:
        print("\n🚀 Integrated server features:")
        print("   - 40+ tools (original 27 + 13 new integration tools)")
        print("   - News aggregation from multiple sources")
        print("   - Adaptive strategy selection")
        print("   - Advanced portfolio management")
        print("   - System performance monitoring")
        print("   - Multi-asset trading capabilities")
    else:
        print("\n📦 Original server features:")
        print("   - 27 core trading and analysis tools")
        print("   - Neural forecasting")
        print("   - Polymarket integration")
        print("   - GPU acceleration")
    
    # Show current config
    print("")
    show_current_config()

if __name__ == "__main__":
    main()