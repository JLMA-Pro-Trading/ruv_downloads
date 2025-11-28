# Ultrathink Build System Documentation

## Overview

The Ultrathink CLI uses a modern, fast build system based on **tsup** with TypeScript, optimized for Node.js CLI applications.

## Build Tools

### Primary: tsup

**tsup** is a fast TypeScript bundler powered by esbuild:

- **Fast builds** - 10-100x faster than tsc
- **Zero config** - Works out of the box
- **ESM/CJS** - Dual format support
- **Type declarations** - Generates .d.ts files
- **Source maps** - For debugging
- **Tree-shaking** - Removes unused code

### Configuration: tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/cli/index.ts',
    'commands/generate': 'src/cli/commands/generate.ts',
    'commands/server': 'src/cli/commands/server.ts',
    'commands/init': 'src/cli/commands/init.ts',
    'commands/import': 'src/cli/commands/import.ts',
    'commands/sync': 'src/cli/commands/sync.ts',
    'commands/health': 'src/cli/commands/health.ts'
  },
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  minify: false,
  bundle: true,
  external: [
    'commander',
    'chalk',
    'ora',
    'enquirer',
    'dotenv',
    'fs-extra',
    'glob',
    'zod',
    '@modelcontextprotocol/sdk',
    'agentic-flow',
    'agentdb'
  ],
  outDir: 'dist',
  treeshake: true
});
```

## Build Configuration Explained

### Entry Points

Each command is a separate entry point:
- **index.ts** - Main CLI entry
- **commands/*.ts** - Individual command modules

This allows:
- Code splitting by command
- Faster startup (only load needed commands)
- Better tree-shaking

### Format: ESM Only

```typescript
format: ['esm']
```

Modern Node.js (18+) supports ESM natively:
- Native import/export
- Top-level await
- Better tree-shaking
- Future-proof

### Target: Node 18

```typescript
target: 'node18'
platform: 'node'
```

Targets Node.js 18 LTS:
- Modern JavaScript features
- Native fetch API
- Web Crypto API
- Test runner built-in

### External Dependencies

```typescript
external: [
  'commander',
  'chalk',
  'ora',
  // ... more
]
```

Dependencies are NOT bundled:
- Smaller bundle size
- Faster builds
- Respects package versions
- Easier debugging

### Source Maps

```typescript
sourcemap: true
```

Generates .map files for:
- Stack traces point to source
- Debugging in IDEs
- Production error tracking

### Type Declarations

```typescript
dts: true
```

Generates .d.ts files:
- TypeScript consumers get types
- Better IDE autocomplete
- API documentation

## Build Scripts

### npm run build

```bash
npm run build
```

Production build:
1. Cleans dist directory
2. Compiles TypeScript
3. Generates type declarations
4. Creates source maps
5. Outputs to dist/

**Output Structure:**
```
dist/
├── index.js
├── index.d.ts
├── index.js.map
├── commands/
│   ├── generate.js
│   ├── generate.d.ts
│   ├── generate.js.map
│   ├── server.js
│   ├── server.d.ts
│   ├── server.js.map
│   └── ... more commands
```

### npm run build:watch

```bash
npm run build:watch
```

Watch mode for development:
- Rebuilds on file changes
- Faster incremental builds
- Live feedback
- Used with `npm run dev`

### npm run build:script

```bash
npm run build:script
```

Automated build with validation:
1. Type checking
2. Building
3. Setting permissions
4. Validating output

Uses `scripts/build.ts`:
```typescript
#!/usr/bin/env tsx

async function main() {
  // Type check
  await typeCheck();

  // Build
  await build(options);

  // Make CLI executable
  await makeExecutable();

  // Validate build artifacts
  await validateBuild();
}
```

### npm run dev

```bash
npm run dev
```

Development mode:
- Runs CLI from source (no build needed)
- Uses tsx for TypeScript execution
- Fast iteration
- Full type checking

**Example:**
```bash
npm run dev -- init
npm run dev -- generate ./spec.json
npm run dev -- server --watch
```

### npm run typecheck

```bash
npm run typecheck
```

Type checking without building:
- Fast feedback
- Catches type errors
- No output files
- Used in CI/CD

### npm run clean

```bash
npm run clean
```

Removes build artifacts:
```bash
rm -rf dist coverage
```

## Development Workflow

### 1. Initial Setup

```bash
cd packages/ultrathink
npm install
```

### 2. Development Cycle

```bash
# Terminal 1: Watch mode
npm run build:watch

# Terminal 2: Run CLI
npm run dev -- <command>

# Or test built version
./bin/ultrathink.js <command>
```

### 3. Type Checking

```bash
# Check types
npm run typecheck

# Check types in watch mode
npm run typecheck -- --watch
```

### 4. Testing Build

```bash
# Full build
npm run build

# Validate
npm run build:script

# Test executable
./bin/ultrathink.js --help
```

### 5. Publishing

```bash
# Pre-publish checks (runs automatically)
npm run prepublishOnly

# Publish
npm publish
```

## Build Optimization

### Tree-Shaking

Enabled by default:
```typescript
treeshake: true
```

Removes unused code:
- Smaller bundles
- Faster startup
- Better performance

**Example:**
```typescript
// Only imports used functions
import { Command } from 'commander';
// Not the entire commander library
```

### Code Splitting

Each command is a separate module:
```typescript
entry: {
  'commands/generate': 'src/cli/commands/generate.ts',
  'commands/server': 'src/cli/commands/server.ts',
  // ...
}
```

Benefits:
- Lazy loading
- Parallel builds
- Smaller initial bundle

### Minification

Disabled for better debugging:
```typescript
minify: false
```

Enable for production:
```typescript
minify: true
```

Trade-offs:
- **Disabled**: Better stack traces, easier debugging
- **Enabled**: Smaller bundles, harder to debug

## Build Performance

### Benchmarks

Typical build times on modern hardware:

| Task | Time |
|------|------|
| Clean build | ~2-3s |
| Incremental build | ~0.5-1s |
| Type check | ~1-2s |
| Full build + validate | ~3-4s |

### Optimization Tips

1. **Use watch mode** during development
2. **Skip type checking** for faster builds: `npm run build`
3. **Use tsx** for development: `npm run dev`
4. **Cache node_modules** in CI/CD
5. **Parallel builds** with `-j` flag

### CI/CD Optimization

```yaml
# GitHub Actions example
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

- name: Install dependencies
  run: npm ci

- name: Type check
  run: npm run typecheck

- name: Build
  run: npm run build

- name: Test
  run: npm test
```

## Troubleshooting

### Build Fails

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
npm run clean
npm run build
```

### Type Errors

```bash
# Check types explicitly
npm run typecheck

# Update TypeScript
npm install -D typescript@latest
```

### Permission Errors

```bash
# Fix executable permissions
chmod +x bin/ultrathink.js
chmod +x scripts/build.ts
```

### Import Errors

```bash
# Check tsconfig.json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}

# Ensure .js extensions in imports
import { foo } from './bar.js'; // ✅ Correct
import { foo } from './bar';    // ❌ Wrong
```

## Best Practices

1. **Always run type check** before committing
2. **Use npm run dev** for development (faster iteration)
3. **Test built version** before publishing
4. **Keep external dependencies** (don't bundle)
5. **Enable source maps** for debugging
6. **Use code splitting** for large CLIs
7. **Cache builds** in CI/CD
8. **Version lock** dependencies

## Advanced Configuration

### Custom Build Targets

```typescript
// Build for multiple Node versions
export default defineConfig([
  {
    // Node 18+ build
    entry: 'src/cli/index.ts',
    target: 'node18',
    outDir: 'dist/node18'
  },
  {
    // Node 16 build
    entry: 'src/cli/index.ts',
    target: 'node16',
    outDir: 'dist/node16'
  }
]);
```

### Environment-Specific Builds

```typescript
// Development vs Production
export default defineConfig({
  // ... base config
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV === 'development',
});
```

### Plugin System

```typescript
// Add custom plugins
import { Plugin } from 'esbuild';

const customPlugin: Plugin = {
  name: 'custom',
  setup(build) {
    // Custom build logic
  }
};

export default defineConfig({
  esbuildPlugins: [customPlugin]
});
```

## Resources

- [tsup Documentation](https://tsup.egoist.dev/)
- [esbuild Documentation](https://esbuild.github.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js ESM](https://nodejs.org/api/esm.html)
