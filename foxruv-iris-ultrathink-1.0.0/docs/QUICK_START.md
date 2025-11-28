# Ultrathink CLI - Quick Start Guide

## Installation

### From Source (Development)

```bash
# Clone repository
cd /home/iris/code/experimental/agent-learning-core/packages/ultrathink

# Install dependencies
npm install

# Build the CLI
npm run build

# Link globally (optional)
npm link
```

### Verify Installation

```bash
# Check version
ultrathink --version

# Show help
ultrathink --help
```

## 5-Minute Tutorial

### Step 1: Initialize Project

Create a new ultrathink project:

```bash
mkdir my-mcp-project
cd my-mcp-project
ultrathink init
```

You'll be prompted for:
- Project name
- Output directory
- TypeScript types (recommended: yes)
- Input validation (recommended: yes)
- Default transport (stdio for Claude Desktop)

### Step 2: Import Existing MCP Servers

If you use Claude Desktop, import your existing MCP servers:

```bash
ultrathink import
```

This reads your Claude Desktop configuration and creates a local `ultrathink.config.json`.

### Step 3: Generate a Wrapper

Generate an MCP wrapper from an OpenAPI specification:

```bash
# Create example OpenAPI spec
cat > api-spec.json << 'EOF'
{
  "openapi": "3.0.0",
  "info": {
    "title": "Example API",
    "version": "1.0.0"
  },
  "paths": {
    "/users": {
      "get": {
        "summary": "List users",
        "responses": {
          "200": {
            "description": "Success"
          }
        }
      }
    }
  }
}
EOF

# Generate wrapper
ultrathink generate api-spec.json -n example-api
```

Generated files:
- `src/generated/example-api.ts` - Wrapper implementation
- `src/generated/example-api.types.ts` - TypeScript types
- `src/generated/index.ts` - Exports

### Step 4: Check Health

Verify everything is configured correctly:

```bash
ultrathink health --verbose
```

This checks:
- Configuration file validity
- Node.js version
- Dependencies
- MCP server connectivity

### Step 5: Start MCP Server

Start the MCP server locally:

```bash
# STDIO transport (for Claude Desktop)
ultrathink server --stdio

# Or HTTP server for testing
ultrathink server -p 3000

# Or with watch mode for development
ultrathink server --watch
```

### Step 6: Sync with Claude Desktop

Add your wrappers to Claude Desktop:

```bash
# Preview changes
ultrathink sync --dry-run

# Apply changes
ultrathink sync
```

Restart Claude Desktop to load the new servers.

## Common Workflows

### Workflow 1: New MCP Server from OpenAPI

```bash
# 1. Initialize
ultrathink init --skip-prompts

# 2. Generate wrapper
ultrathink generate api-spec.json -n my-api

# 3. Test locally
ultrathink server --watch

# 4. Add to Claude Desktop
ultrathink sync
```

### Workflow 2: Import and Manage Existing Servers

```bash
# 1. Import from Claude Desktop
ultrathink import

# 2. View configuration
cat ultrathink.config.json

# 3. Make changes in ultrathink.config.json

# 4. Sync back to Claude Desktop
ultrathink sync

# 5. Verify
ultrathink health --verbose
```

### Workflow 3: Development Mode

```bash
# Terminal 1: Watch build
npm run build:watch

# Terminal 2: Run from source
npm run dev -- init
npm run dev -- generate ./spec.json
npm run dev -- server --watch

# Terminal 3: Make changes
vim src/cli/commands/generate.ts

# Changes auto-rebuild and apply
```

### Workflow 4: Testing Before Production

```bash
# 1. Generate wrapper
ultrathink generate prod-api.json

# 2. Health check
ultrathink health --verbose

# 3. Test server locally
ultrathink server --stdio < test-input.jsonl > test-output.jsonl

# 4. Review output
cat test-output.jsonl | jq .

# 5. Deploy to Claude Desktop
ultrathink sync --dry-run
ultrathink sync
```

## Configuration Examples

### Basic Configuration

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
  "wrappers": []
}
```

### With MCP Server

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
      "name": "filesystem",
      "type": "mcp",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/home/user/documents"
      },
      "enabled": true
    }
  ]
}
```

### Multiple Wrappers

```json
{
  "name": "multi-server",
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
      "name": "filesystem",
      "type": "mcp",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/home/user/documents"
      },
      "enabled": true
    },
    {
      "name": "git",
      "type": "mcp",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"],
      "env": {},
      "enabled": true
    },
    {
      "name": "postgres",
      "type": "mcp",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://localhost/mydb"
      },
      "enabled": true
    }
  ]
}
```

## Tips & Tricks

### 1. Development with Watch Mode

```bash
# Keep server running with auto-reload
ultrathink server --watch &

# Make changes and test immediately
vim src/generated/my-api.ts
# Server auto-reloads
```

### 2. Debugging

```bash
# Enable debug mode for detailed errors
ultrathink generate ./spec.json --debug

# Verbose output for troubleshooting
ultrathink health --verbose

# Check logs
tail -f ~/.ultrathink/logs/server.log
```

### 3. Environment Variables

```bash
# Create .env file
cat > .env << EOF
API_KEY=your-api-key
DATABASE_URL=postgresql://localhost/mydb
ALLOWED_PATHS=/home/user/documents
EOF

# Reference in config
{
  "wrappers": [{
    "env": {
      "API_KEY": "${API_KEY}"
    }
  }]
}
```

### 4. Testing MCP Protocol

```bash
# Send initialize request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | ultrathink server --stdio

# Send tools/list request
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | ultrathink server --stdio
```

### 5. Quick Health Check

```bash
# One-liner health check
ultrathink health && echo "✅ All systems OK" || echo "❌ Issues detected"
```

### 6. Backup Configuration

```bash
# Backup before changes
cp ultrathink.config.json ultrathink.config.json.backup

# Restore if needed
cp ultrathink.config.json.backup ultrathink.config.json
```

### 7. Generate Multiple Wrappers

```bash
# Batch generate
for spec in specs/*.json; do
  name=$(basename "$spec" .json)
  ultrathink generate "$spec" -n "$name"
done
```

### 8. CI/CD Integration

```yaml
# .github/workflows/build.yml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install
        run: npm ci

      - name: Type Check
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Health Check
        run: ultrathink health

      - name: Test
        run: npm test
```

## Troubleshooting

### Problem: CLI not found

```bash
# Solution 1: Link globally
npm link

# Solution 2: Use npm run
npm run dev -- <command>

# Solution 3: Use full path
./bin/ultrathink.js <command>
```

### Problem: Permission denied

```bash
# Fix executable permissions
chmod +x bin/ultrathink.js
chmod +x scripts/build.ts
```

### Problem: Import can't find Claude config

```bash
# Check location
ls ~/Library/Application\ Support/Claude/  # macOS
ls ~/.config/Claude/                        # Linux
ls %APPDATA%/Claude/                       # Windows

# Specify manually
ultrathink import -s /path/to/claude_desktop_config.json
```

### Problem: Server won't start

```bash
# Check health first
ultrathink health --verbose

# Try different port
ultrathink server -p 3001

# Check if port is in use
lsof -i :3000

# Use stdio instead
ultrathink server --stdio
```

### Problem: Type errors

```bash
# Update dependencies
npm update

# Clean and rebuild
npm run clean
npm install
npm run build
```

## Next Steps

- Read [CLI Documentation](./CLI.md) for detailed command reference
- Check [Build System](./BUILD_SYSTEM.md) for development details
- Review [Examples](../examples/) for real-world usage
- See [API Documentation](./API.md) for programmatic usage

## Getting Help

- Run `ultrathink --help` for command overview
- Run `ultrathink <command> --help` for command-specific help
- Check the [documentation](./CLI.md)
- Open an issue on GitHub
- Enable debug mode: `ultrathink <command> --debug`
