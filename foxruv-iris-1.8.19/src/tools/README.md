# Agent Learning Core Tools

Universal tools for enhancing agent development workflows.

## MCP Wrapper Generator

A universal tool for generating TypeScript wrappers for MCP (Model Context Protocol) servers. Can be installed in any project and auto-detects your MCP servers.

### Quick Start

```bash
# Install the package
npm install @foxruv/agent-learning-core

# Generate wrappers (interactive)
npx iris-generate-wrappers

# Or non-interactive
npx iris-generate-wrappers --yes
```

### Features

- ✅ Auto-detects MCP servers from config files
- ✅ Generates TypeScript wrappers for frontend (fetch) or backend (Node.js)
- ✅ Full type safety with generated interfaces
- ✅ Interactive CLI or programmatic API
- ✅ Dry-run mode for previewing changes
- ✅ Safe file operations with backups

### Documentation

See [MCP_GENERATOR.md](../../docs/MCP_GENERATOR.md) for complete documentation.

### Usage

#### CLI

```bash
# Interactive mode
npx iris-generate-wrappers

# Generate for specific servers
npx iris-generate-wrappers -s claude-flow,ruv-swarm

# Frontend only
npx iris-generate-wrappers -t frontend -o ./src/api/mcp

# Backend only
npx iris-generate-wrappers -t backend -o ./lib/mcp

# Dry run (preview)
npx iris-generate-wrappers --dry-run
```

#### Programmatic

```typescript
import { generateMCPWrappers } from '@foxruv/agent-learning-core/tools';

const result = await generateMCPWrappers({
  outputDir: './servers',
  target: 'both',
  dryRun: false,
  servers: ['claude-flow'], // Optional: specific servers
});

console.log('Generated:', result.filesGenerated);
```

#### NPM Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "generate:mcp": "iris-generate-wrappers"
  }
}
```

### Architecture

```
┌─────────────────────────────────────────────┐
│      MCP Wrapper Generator (Universal)      │
├─────────────────────────────────────────────┤
│                                             │
│  Detector → Templates → Generator → Writer │
│                                             │
│  - Auto-detect servers from config          │
│  - Generate frontend/backend wrappers       │
│  - Create TypeScript types                  │
│  - Write files with safety checks           │
│                                             │
└─────────────────────────────────────────────┘
```

### Generated Structure

```
servers/
├── index.ts                    # Main export
├── claude-flow/
│   ├── index.ts               # Server export
│   ├── frontend.ts            # Browser wrapper
│   ├── backend.ts             # Node.js wrapper
│   ├── types.ts               # TypeScript types
│   └── README.md              # Usage guide
└── ruv-swarm/
    ├── index.ts
    ├── frontend.ts
    ├── backend.ts
    ├── types.ts
    └── README.md
```

### Examples

See [examples/mcp-generator-usage.ts](../../examples/mcp-generator-usage.ts) for complete examples.

### Testing

```bash
npm test tests/tools/mcp-generator.test.ts
```

## Future Tools

More tools coming soon:

- **Agent Orchestration**: Multi-agent coordination utilities
- **Pattern Discovery**: Automatic pattern detection and learning
- **Performance Monitoring**: Real-time agent performance tracking
- **Code Analysis**: Static analysis for agent codebases

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](../../LICENSE)
