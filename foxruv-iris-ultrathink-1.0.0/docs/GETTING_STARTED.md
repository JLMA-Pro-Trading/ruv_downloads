# Getting Started with Ultrathink CLI

## Overview

Ultrathink CLI is a powerful tool for generating MCP (Model Context Protocol) wrappers and managing MCP servers. It provides seamless integration with Claude Desktop and supports modern development workflows.

## Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Operating System**: macOS, Linux, or Windows
- **(Optional) Claude Desktop**: For integration features

## Installation Options

### Option 1: Development Installation (Recommended)

If you're working on or testing ultrathink:

```bash
# Navigate to the package
cd /home/iris/code/experimental/agent-learning-core/packages/ultrathink

# Install dependencies
npm install

# Build the CLI
npm run build

# Link globally for system-wide access
npm link

# Verify installation
ultrathink --version
```

### Option 2: From npm (When Published)

Once published to npm registry:

```bash
# Global installation
npm install -g @foxruv/iris-ultrathink

# Or local project installation
npm install --save-dev @foxruv/iris-ultrathink
```

### Option 3: Using npx (No Installation)

Run directly without installing:

```bash
npx @foxruv/iris-ultrathink init
npx @foxruv/iris-ultrathink generate ./spec.json
```

## Project Structure

After installation, you'll have access to:

```
ultrathink/
├── bin/
│   └── ultrathink.js          # CLI executable
├── src/
│   ├── cli/                   # CLI implementation
│   │   ├── index.ts          # Main entry point
│   │   └── commands/         # Command modules
│   ├── generator/            # Wrapper generator
│   ├── server/               # MCP server
│   └── learning/             # Learning & tracking
├── docs/                     # Documentation
├── scripts/                  # Build scripts
└── package.json
```

## First Steps

### 1. Verify Installation

```bash
# Check version
ultrathink --version

# Show help
ultrathink --help

# List available commands
ultrathink --help
```

Expected output:
```
Usage: ultrathink [options] [command]

CLI tool for ultrathink MCP wrapper generation and management

Options:
  -V, --version        output the version number
  -v, --verbose        Enable verbose logging
  --debug              Enable debug mode
  -h, --help           display help for command

Commands:
  generate|gen [options] [source]  Generate MCP wrapper
  server|serve [options]           Start MCP server
  init [options]                   Initialize configuration
  import [options]                 Import from Claude Desktop
  sync [options]                   Sync configurations
  health|check [options]           Health check
  help [command]                   display help for command
```

### 2. Initialize Your First Project

```bash
# Create project directory
mkdir my-mcp-project
cd my-mcp-project

# Initialize ultrathink configuration
ultrathink init
```

You'll be prompted for:
- **Project name**: Your project identifier
- **Output directory**: Where to generate wrappers (default: `./src/generated`)
- **TypeScript types**: Generate .d.ts files (recommended: yes)
- **Input validation**: Enable Zod validation (recommended: yes)
- **Transport**: Default transport mode (stdio for Claude, HTTP for web)

### 3. Verify Setup

```bash
# Run health check
ultrathink health

# Check configuration
cat ultrathink.config.json

# Verify environment
cat .env.example
```

## Quick Examples

### Example 1: Generate from OpenAPI Spec

```bash
# Create a simple OpenAPI spec
cat > api-spec.json << 'EOF'
{
  "openapi": "3.0.0",
  "info": {
    "title": "Todo API",
    "version": "1.0.0"
  },
  "paths": {
    "/todos": {
      "get": {
        "summary": "List todos",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": { "type": "number" },
                      "title": { "type": "string" },
                      "completed": { "type": "boolean" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
EOF

# Generate wrapper
ultrathink generate api-spec.json -n todo-api

# View generated files
ls -la src/generated/
```

### Example 2: Import from Claude Desktop

```bash
# Import existing MCP servers from Claude Desktop
ultrathink import

# View imported configuration
cat ultrathink.config.json

# Test imported servers
ultrathink health --verbose
```

### Example 3: Start Development Server

```bash
# Start with watch mode
ultrathink server --watch

# In another terminal, test the server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | ultrathink server --stdio
```

## Common Workflows

### Workflow: New Project Setup

```bash
# 1. Create and navigate to project
mkdir ultrathink-project && cd ultrathink-project

# 2. Initialize
ultrathink init --skip-prompts

# 3. Create .env file
cp .env.example .env
vim .env  # Add your API keys

# 4. Test setup
ultrathink health
```

### Workflow: Add MCP Server

```bash
# 1. Generate wrapper
ultrathink generate ./my-api-spec.json -n my-api

# 2. Update configuration (if needed)
vim ultrathink.config.json

# 3. Test server
ultrathink server --stdio

# 4. Sync to Claude Desktop
ultrathink sync
```

### Workflow: Development Iteration

```bash
# Terminal 1: Watch build
cd packages/ultrathink
npm run build:watch

# Terminal 2: Run CLI from source
npm run dev -- generate ./spec.json
npm run dev -- server --watch

# Terminal 3: Make changes
vim src/cli/commands/generate.ts
# Changes auto-rebuild
```

## Configuration

### Environment Variables

Create `.env` file:

```bash
# API Keys
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Database (if using)
DATABASE_URL=postgresql://localhost/mydb

# File system access
ALLOWED_PATHS=/home/user/documents

# Server settings
PORT=3000
HOST=localhost
```

### Ultrathink Config

Edit `ultrathink.config.json`:

```json
{
  "name": "my-project",
  "version": "0.1.0",
  "output": "./src/generated",
  "generation": {
    "types": true,
    "validation": true,
    "experimental": false
  },
  "server": {
    "transport": "stdio",
    "port": 3000,
    "host": "localhost"
  },
  "wrappers": [
    {
      "name": "my-server",
      "type": "mcp",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/home/user/docs"
      },
      "enabled": true
    }
  ]
}
```

## Troubleshooting

### Problem: Command not found

```bash
# Check installation
which ultrathink

# If not found, link again
cd packages/ultrathink
npm link

# Or use npm run
npm run dev -- <command>
```

### Problem: Permission errors

```bash
# Fix executable permissions
chmod +x bin/ultrathink.js
chmod +x scripts/build.ts

# On Linux/Mac, might need sudo
sudo npm link
```

### Problem: Build failures

```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem: Import can't find Claude

```bash
# Check Claude Desktop config location
# macOS:
ls ~/Library/Application\ Support/Claude/

# Linux:
ls ~/.config/Claude/

# Windows:
dir %APPDATA%\Claude\

# Specify manually
ultrathink import -s /path/to/claude_desktop_config.json
```

## Next Steps

Now that you have ultrathink set up:

1. **Read the Guides**:
   - [Quick Start Guide](./QUICK_START.md) - 5-minute tutorial
   - [CLI Reference](./CLI.md) - Complete command documentation
   - [Build System](./BUILD_SYSTEM.md) - Development details

2. **Explore Features**:
   - Generate wrappers from OpenAPI specs
   - Import and manage Claude Desktop servers
   - Run MCP servers locally
   - Sync configurations

3. **Join the Community**:
   - Report issues on GitHub
   - Contribute to documentation
   - Share your wrappers

4. **Advanced Topics**:
   - Custom wrapper templates
   - Plugin development
   - CI/CD integration
   - Production deployment

## Support

- **Documentation**: [./docs](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/agent-learning-core/issues)
- **Discord**: [Join our community](#)
- **Email**: support@ultrathink.dev

## Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Desktop Documentation](https://docs.anthropic.com/claude-desktop)
- [OpenAPI Specification](https://swagger.io/specification/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

---

**Happy coding with Ultrathink! 🚀**
