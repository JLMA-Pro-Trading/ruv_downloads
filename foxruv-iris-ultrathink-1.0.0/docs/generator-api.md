# MCP Wrapper Generator API

## Overview

The MCP Wrapper Generator is a standalone tool for automatically generating TypeScript wrappers for MCP (Model Context Protocol) servers. It includes full support for agentic-flow coordination and agentdb tracking.

## Installation

```bash
npm install @foxruv/ultrathink
```

## Basic Usage

### Programmatic API

```typescript
import { MCPWrapperGenerator } from '@foxruv/ultrathink/generator';

const generator = new MCPWrapperGenerator('/path/to/project');
const result = await generator.generate({
  outputDir: './servers',
  target: 'both', // 'frontend' | 'backend' | 'both'
  force: true,
  enableCoordination: true,
  enableTracking: true,
});

console.log(`Generated ${result.filesGenerated.length} files`);
```

### CLI Usage

```bash
# Generate wrappers for all configured MCP servers
npx ultrathink generate-wrappers

# Generate only backend wrappers
npx ultrathink generate-wrappers --target backend

# Dry run mode
npx ultrathink generate-wrappers --dry-run

# Force overwrite existing files
npx ultrathink generate-wrappers --force

# Generate specific servers
npx ultrathink generate-wrappers --servers claude-flow,ruv-swarm
```

## API Reference

### MCPWrapperGenerator

Main class for generating MCP wrappers.

#### Constructor

```typescript
new MCPWrapperGenerator(projectRoot?: string)
```

**Parameters:**
- `projectRoot` (string, optional): Root directory of the project. Defaults to `process.cwd()`.

#### Methods

##### generate(options)

Generate MCP wrappers with specified options.

```typescript
async generate(options?: GeneratorOptions): Promise<GeneratorResult>
```

**Parameters:**
- `options` (GeneratorOptions, optional): Configuration options

**Returns:** Promise<GeneratorResult>

### GeneratorOptions

Configuration options for wrapper generation.

```typescript
interface GeneratorOptions {
  /** Output directory for generated wrappers */
  outputDir?: string; // default: './servers'

  /** Target environment */
  target?: 'frontend' | 'backend' | 'both'; // default: 'both'

  /** Interactive mode */
  interactive?: boolean; // default: false

  /** Dry-run mode (don't write files) */
  dryRun?: boolean; // default: false

  /** Update existing wrappers */
  update?: boolean; // default: false

  /** Force overwrite existing files */
  force?: boolean; // default: false

  /** Specific servers to generate */
  servers?: string[]; // default: [] (all servers)

  /** Enable agentic-flow coordination hooks */
  enableCoordination?: boolean; // default: false

  /** Enable agentdb tracking */
  enableTracking?: boolean; // default: false

  /** Coordination namespace for memory sharing */
  coordinationNamespace?: string; // default: 'mcp-generator'

  /** Agent ID for tracking */
  agentId?: string;
}
```

### GeneratorResult

Result object returned after generation.

```typescript
interface GeneratorResult {
  success: boolean;
  filesGenerated: string[];
  filesUpdated: string[];
  errors: string[];
  warnings: string[];
  dryRun: boolean;
  tracking?: GeneratorTracking;
}
```

### MCPDetector

Detects MCP servers from project configuration.

```typescript
import { MCPDetector } from '@foxruv/ultrathink/generator';

const detector = new MCPDetector('/path/to/project', {
  enableCoordination: true,
  agentId: 'my-agent',
});

const servers = await detector.detectServers();
```

**Detection Priority:**
1. Project config (`./.mcp.json`)
2. User config (`~/.claude.json`)
3. Legacy config (`~/.config/claude/claude_desktop_config.json`)
4. Package.json (`mcp` field)
5. Environment file (`.env`)

### TemplateGenerator

Generates code templates for MCP wrappers.

```typescript
import { TemplateGenerator } from '@foxruv/ultrathink/generator';

const templateGen = new TemplateGenerator();

// Generate frontend wrapper
const frontendCode = templateGen.generateFrontendWrapper(context);

// Generate backend wrapper
const backendCode = templateGen.generateBackendWrapper(context);

// Generate types
const typesCode = templateGen.generateTypes(context);
```

### FileWriter

Safely writes generated files with backup support.

```typescript
import { FileWriter } from '@foxruv/ultrathink/generator';

const writer = new FileWriter();

await writer.writeFile(
  '/path/to/file.ts',
  'export const foo = "bar";',
  {
    dryRun: false,
    force: true,
    createBackup: true,
  }
);

const result = writer.getResult(false);
console.log(FileWriter.formatResult(result));
```

## Configuration

### Project Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "description": "Claude Flow orchestration server"
    },
    "my-custom-server": {
      "command": "node",
      "args": ["./servers/my-server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

### User Configuration (~/.claude.json)

Same format as project configuration.

### Package.json Configuration

```json
{
  "mcp": {
    "servers": {
      "my-server": {
        "command": "npx",
        "args": ["my-mcp-server"]
      }
    }
  }
}
```

## Coordination & Tracking

### Agentic-Flow Integration

Enable coordination to emit events for agentic-flow integration:

```typescript
const result = await generator.generate({
  enableCoordination: true,
  coordinationNamespace: 'my-namespace',
  agentId: 'coder-agent',
});
```

**Coordination Events:**
- `generation:start` - Generation process started
- `generation:progress` - Progress update
- `generation:complete` - Generation completed successfully
- `generation:error` - Error occurred during generation

### AgentDB Tracking

Enable tracking to record generation events in agentdb:

```typescript
const result = await generator.generate({
  enableTracking: true,
  agentId: 'coder-agent',
});

// Access tracking data
console.log(result.tracking);
// {
//   serversProcessed: 3,
//   toolsGenerated: 15,
//   duration: 1234,
//   startTime: '2025-11-20T...',
//   endTime: '2025-11-20T...',
//   agentId: 'coder-agent'
// }
```

## Advanced Usage

### Custom Event Handlers

```typescript
import { MCPDetector } from '@foxruv/ultrathink/generator';

const detector = new MCPDetector('/path/to/project', {
  enableCoordination: true,
  agentId: 'my-agent',
  onCoordinationEvent: async (event) => {
    console.log('Coordination event:', event);
    // Store in agentic-flow memory
  },
  onTrackingRecord: async (record) => {
    console.log('Tracking record:', record);
    // Store in agentdb
  },
});
```

### Batch Generation

```typescript
import { generateMCPWrappers } from '@foxruv/ultrathink/generator';

// Generate wrappers for multiple projects
const projects = ['/project1', '/project2', '/project3'];

for (const project of projects) {
  const result = await generateMCPWrappers({
    configPath: project,
    outputDir: `${project}/servers`,
    target: 'both',
    force: true,
  });

  console.log(`${project}: ${result.filesGenerated.length} files generated`);
}
```

## Examples

### Generate Frontend-Only Wrappers

```typescript
const result = await generator.generate({
  target: 'frontend',
  outputDir: './src/mcp-clients',
  force: true,
});
```

### Generate with Progress Tracking

```typescript
const result = await generator.generate({
  enableCoordination: true,
  enableTracking: true,
  agentId: 'generator-bot',
  onProgress: (current, total) => {
    console.log(`Progress: ${current}/${total}`);
  },
});

console.log(`
  Servers processed: ${result.tracking.serversProcessed}
  Tools generated: ${result.tracking.toolsGenerated}
  Duration: ${result.tracking.duration}ms
`);
```

### Dry Run Mode

```typescript
const result = await generator.generate({
  dryRun: true,
  target: 'both',
});

console.log('Files that would be generated:');
result.filesGenerated.forEach(file => console.log(`  - ${file}`));
```

## Error Handling

```typescript
try {
  const result = await generator.generate(options);

  if (!result.success) {
    console.error('Generation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn('Warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
} catch (error) {
  console.error('Fatal error:', error);
}
```

## Type Definitions

All types are exported from the main module:

```typescript
import type {
  MCPServer,
  MCPTool,
  MCPServerInfo,
  GeneratorOptions,
  GeneratorResult,
  GeneratorTracking,
  CoordinationEvent,
  TrackingRecord,
} from '@foxruv/ultrathink/generator';
```

## Contributing

See the main README for contribution guidelines.

## License

MIT
