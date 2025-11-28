# Ultrathink CLI Documentation

## Overview

The Ultrathink CLI provides a comprehensive command-line interface for generating MCP wrappers, managing configurations, and running MCP servers.

## Installation

```bash
cd /home/iris/code/experimental/agent-learning-core/packages/ultrathink
npm install
npm run build
npm link  # Install globally for development
```

## Architecture

### Directory Structure

```
packages/ultrathink/
├── src/
│   └── cli/
│       ├── index.ts           # Main CLI entry point
│       └── commands/          # Command implementations
│           ├── generate.ts    # Wrapper generation
│           ├── server.ts      # MCP server
│           ├── init.ts        # Project initialization
│           ├── import.ts      # Import from Claude
│           ├── sync.ts        # Configuration sync
│           └── health.ts      # Health checks
├── bin/
│   └── ultrathink.js         # Executable entry
├── scripts/
│   └── build.ts              # Build automation
├── tsup.config.ts            # Build configuration
└── package.json              # Package manifest
```

### Build System

The CLI uses **tsup** for fast, modern builds with:
- ESM output format
- TypeScript declaration files
- Source maps for debugging
- Tree-shaking for optimal bundle size
- External dependencies (not bundled)

## Commands Reference

### 1. `ultrathink init`

Initialize a new ultrathink project with configuration.

**Usage:**
```bash
ultrathink init [options]
```

**Options:**
- `-f, --force` - Overwrite existing configuration
- `--skip-prompts` - Use defaults, skip interactive prompts

**Interactive Prompts:**
- Project name
- Output directory
- TypeScript types generation (yes/no)
- Input validation (yes/no)
- Default transport (stdio/http/sse)

**Output Files:**
- `ultrathink.config.json` - Main configuration
- `.env.example` - Environment variables template
- `.gitignore` - Git ignore rules (if not exists)

**Example:**
```bash
# Interactive mode
ultrathink init

# Non-interactive with defaults
ultrathink init --skip-prompts

# Force overwrite existing config
ultrathink init --force
```

### 2. `ultrathink generate`

Generate MCP wrapper from OpenAPI spec or MCP server configuration.

**Usage:**
```bash
ultrathink generate [source] [options]
```

**Arguments:**
- `source` - Path to OpenAPI spec file or MCP server URL

**Options:**
- `-o, --output <path>` - Output directory (default: `./src/generated`)
- `-n, --name <name>` - Custom wrapper name
- `-t, --type <type>` - Source type: `openapi`, `mcp`, or `auto` (default: `auto`)
- `--no-types` - Skip TypeScript type generation
- `--no-validation` - Skip input validation
- `--experimental` - Enable experimental features

**Generated Files:**
- `{name}.ts` - Main wrapper implementation
- `{name}.types.ts` - TypeScript type definitions (if enabled)
- `index.ts` - Barrel export file

**Example:**
```bash
# Generate from OpenAPI spec
ultrathink generate ./api-spec.json

# Generate with custom name and output
ultrathink generate ./api.yaml -n my-api -o ./src/wrappers

# Skip types generation
ultrathink generate ./spec.json --no-types

# Enable experimental features
ultrathink generate ./spec.json --experimental
```

### 3. `ultrathink server`

Start an MCP server with generated wrappers.

**Usage:**
```bash
ultrathink server [options]
```

**Options:**
- `-p, --port <port>` - Server port (default: `3000`)
- `-h, --host <host>` - Server host (default: `localhost`)
- `-c, --config <path>` - Configuration file path
- `-w, --watch` - Enable watch mode (auto-restart on changes)
- `--stdio` - Use stdio transport (default for MCP)
- `--sse` - Use Server-Sent Events transport

**Transports:**
1. **STDIO** - Standard input/output, used by Claude Desktop
2. **HTTP** - HTTP server for web-based clients
3. **SSE** - Server-Sent Events for real-time updates

**Example:**
```bash
# Start with default settings (stdio)
ultrathink server

# Start HTTP server
ultrathink server -p 3001

# Development mode with auto-restart
ultrathink server --watch

# Use custom configuration
ultrathink server -c ./custom-config.json
```

### 4. `ultrathink import`

Import MCP server configurations from Claude Desktop settings.

**Usage:**
```bash
ultrathink import [options]
```

**Options:**
- `-s, --source <path>` - Path to Claude Desktop config (auto-detected by default)
- `-o, --output <path>` - Output config file (default: `./ultrathink.config.json`)
- `--merge` - Merge with existing configuration instead of overwriting

**Claude Desktop Config Locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Example:**
```bash
# Import from default Claude Desktop location
ultrathink import

# Import from custom location
ultrathink import -s ~/custom/claude_config.json

# Merge with existing config
ultrathink import --merge

# Import to custom output location
ultrathink import -o ./configs/ultrathink.json
```

### 5. `ultrathink sync`

Synchronize configurations between ultrathink and Claude Desktop.

**Usage:**
```bash
ultrathink sync [options]
```

**Options:**
- `-d, --direction <direction>` - Sync direction: `to-claude` or `from-claude` (default: `to-claude`)
- `-c, --config <path>` - Ultrathink config file (default: `./ultrathink.config.json`)
- `--claude-config <path>` - Claude Desktop config path (auto-detected by default)
- `--dry-run` - Preview changes without applying them

**Sync Directions:**
1. **to-claude** - Update Claude Desktop with ultrathink wrappers
2. **from-claude** - Update ultrathink with Claude Desktop servers

**Example:**
```bash
# Sync to Claude Desktop
ultrathink sync

# Sync from Claude Desktop
ultrathink sync -d from-claude

# Dry run to preview changes
ultrathink sync --dry-run

# Sync with custom configs
ultrathink sync -c ./custom-config.json --claude-config ~/claude.json
```

### 6. `ultrathink health`

Check health of MCP servers and configuration.

**Usage:**
```bash
ultrathink health [options]
```

**Options:**
- `-c, --config <path>` - Configuration file (default: `./ultrathink.config.json`)
- `--verbose` - Show detailed health information

**Health Checks:**
1. **Configuration** - Validates config file structure and wrappers
2. **Node.js Version** - Ensures Node.js >= 18.0.0
3. **Dependencies** - Checks package.json and installed packages
4. **MCP Servers** - Tests connectivity to configured servers

**Example:**
```bash
# Basic health check
ultrathink health

# Detailed health check
ultrathink health --verbose

# Check specific config
ultrathink health -c ./configs/production.json
```

## Configuration File Format

### ultrathink.config.json

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

### Configuration Fields

- **name** - Project name
- **version** - Project version
- **output** - Directory for generated wrappers
- **generation** - Code generation settings
  - **types** - Generate TypeScript types
  - **validation** - Enable input validation
  - **experimental** - Enable experimental features
- **server** - Server settings
  - **transport** - Default transport (stdio/http/sse)
  - **port** - HTTP server port
  - **host** - HTTP server host
- **wrappers** - Array of MCP server configurations
  - **name** - Wrapper name (unique)
  - **type** - Wrapper type (mcp/openapi)
  - **command** - Command to execute
  - **args** - Command arguments
  - **env** - Environment variables
  - **enabled** - Enable/disable wrapper

## Global Options

All commands support these global options:

- `-v, --verbose` - Enable verbose logging
- `--debug` - Enable debug mode with stack traces

**Example:**
```bash
ultrathink generate ./spec.json --debug
ultrathink server --verbose
```

## Development Workflow

### 1. Initialize Project
```bash
ultrathink init
```

### 2. Import Existing MCP Servers
```bash
ultrathink import --merge
```

### 3. Generate Wrappers
```bash
ultrathink generate ./openapi.json -n my-api
```

### 4. Test Server
```bash
ultrathink health --verbose
ultrathink server --watch
```

### 5. Sync with Claude Desktop
```bash
ultrathink sync
```

## Error Handling

The CLI provides clear error messages with:
- Colored output (red for errors, yellow for warnings, green for success)
- Spinners for long-running operations
- Stack traces in debug mode
- Exit codes (0 = success, 1 = error)

**Example Error Output:**
```
⠹ Generating MCP wrapper...
✖ Generation failed
Error: OpenAPI spec file not found: ./missing.json

Use --debug for more details
```

## Build & Development

### Building the CLI

```bash
# Production build
npm run build

# Watch mode for development
npm run build:watch

# Build with automation script
npm run build:script

# Type check without building
npm run typecheck
```

### Testing the CLI

```bash
# Run from source (development)
npm run dev -- init

# Run built version
node ./bin/ultrathink.js init

# Run globally installed
ultrathink init
```

### Publishing

```bash
# Build and test before publishing
npm run prepublishOnly

# Publish to npm
npm publish
```

## Troubleshooting

### CLI Not Found
```bash
# Link for local development
npm link

# Or run directly
./bin/ultrathink.js
```

### Permission Errors
```bash
# Make executable
chmod +x ./bin/ultrathink.js
```

### Import Issues
```bash
# Check Claude Desktop config location
ultrathink import --verbose

# Use custom path
ultrathink import -s ~/path/to/claude_config.json
```

### Server Won't Start
```bash
# Check configuration
ultrathink health --verbose

# Try different port
ultrathink server -p 3001

# Use stdio transport
ultrathink server --stdio
```

## Best Practices

1. **Always run `ultrathink init`** before using other commands
2. **Use `--dry-run`** with sync to preview changes
3. **Enable `--watch`** during development
4. **Run `ultrathink health`** before deployment
5. **Keep configs in version control** (except `.env`)
6. **Use environment variables** for sensitive data
7. **Test wrappers locally** before syncing to Claude Desktop

## Integration with Claude Desktop

1. Generate wrappers with ultrathink
2. Configure in `ultrathink.config.json`
3. Sync to Claude Desktop: `ultrathink sync`
4. Restart Claude Desktop to load new servers
5. Verify with: `ultrathink health --verbose`

## Next Steps

- Read the [Architecture Guide](./ARCHITECTURE.md)
- Check the [API Documentation](./API.md)
- See [Examples](../examples/)
- Join the community discussions
