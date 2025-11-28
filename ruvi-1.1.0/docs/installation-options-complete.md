# Complete Installation Options - npx ruvi

**All installation methods supported by the package discovery feature**

---

## 📥 10 Installation Options

When you select a package in `npx ruvi packages`, you get **10 comprehensive installation options**:

---

### 1. 🌍 **Global Install (npm)** - PERMANENT
```bash
npm install -g [package-name]
```
**When to use:**
- CLI tools you'll use frequently
- Want it available from anywhere
- Command-line utilities (claude-flow, ruvi, goalie, etc.)

**Result:** Installed globally, accessible from any directory

---

### 2. 📁 **Local Project Install (npm)** - PERMANENT
```bash
npm install [package-name]
```
**When to use:**
- Building a project that depends on it
- Want it in package.json dependencies
- Library/module for your application
- Team collaboration (reproducible builds)

**Result:** Added to node_modules/ and package.json dependencies

---

### 3. 🛠️ **Dev Dependency (npm)** - PERMANENT
```bash
npm install --save-dev [package-name]
```
**When to use:**
- Testing frameworks
- Build tools
- Development-only utilities
- Linters, formatters, type checkers

**Result:** Added to package.json devDependencies (not in production)

---

### 4. ⚡ **Run with npx** - TEMPORARY
```bash
npx [package-name]
```
**When to use:**
- Try a tool before committing to install
- One-time use
- Always want latest version
- Don't want to clutter global installs
- Quick experiments

**Result:** Downloads temporarily, runs, then removes (cached locally)

---

### 5. 🚀 **Run Latest with npx** - TEMPORARY
```bash
npx [package-name]@latest
```
**When to use:**
- Ensure you get the absolute latest version
- Package updates frequently
- Testing new features
- Bypassing local cache

**Result:** Forces download of latest version, runs, then removes

---

### 6. 🧶 **Yarn (Local)** - PERMANENT
```bash
yarn add [package-name]
```
**When to use:**
- Your project uses Yarn instead of npm
- Faster installs with offline caching
- Workspaces/monorepo setup
- Better deterministic installs (yarn.lock)

**Result:** Added to node_modules/ and package.json (Yarn style)

---

### 7. 🌐 **Yarn Global** - PERMANENT
```bash
yarn global add [package-name]
```
**When to use:**
- Global CLI tools (Yarn preference)
- Available system-wide
- Consistent with your Yarn workflow

**Result:** Installed globally via Yarn

---

### 8. 📦 **pnpm (Local)** - PERMANENT
```bash
pnpm add [package-name]
```
**When to use:**
- Efficient disk space (content-addressable storage)
- Faster installs than npm/yarn
- Strict dependency resolution
- Monorepo support

**Result:** Added via pnpm with symlinked node_modules structure

---

### 9. 🌍 **pnpm Global** - PERMANENT
```bash
pnpm add -g [package-name]
```
**When to use:**
- Global CLI tools (pnpm preference)
- Efficient global package management
- Consistent with your pnpm workflow

**Result:** Installed globally via pnpm

---

### 10. 📋 **Copy Command** - MANUAL
```bash
# Shows all commands for manual copying
```
**When to use:**
- Want to modify the command first
- Need to add flags/options
- Prefer manual control
- Copy-paste into documentation
- Script automation

**Result:** Displays npm, yarn, and pnpm commands to copy

---

## 🎯 Quick Decision Guide

### "I want to use this CLI tool regularly"
→ **Global Install** (npm, yarn, or pnpm)

### "My project needs this as a dependency"
→ **Local Install** (npm, yarn, or pnpm)

### "This is only for development/testing"
→ **Dev Dependency** (npm --save-dev)

### "I just want to try this quickly"
→ **npx** (no install)

### "I want the bleeding edge version"
→ **npx @latest**

### "I prefer Yarn"
→ **Yarn** (local or global)

### "I prefer pnpm for efficiency"
→ **pnpm** (local or global)

### "I want to see all options first"
→ **Copy Command**

---

## 📊 Comparison Table

| Method | Permanent | Global | Dev Only | Package Manager | Speed |
|--------|-----------|--------|----------|----------------|-------|
| npm global | ✅ | ✅ | ❌ | npm | ⭐⭐⭐ |
| npm local | ✅ | ❌ | ❌ | npm | ⭐⭐⭐ |
| npm dev | ✅ | ❌ | ✅ | npm | ⭐⭐⭐ |
| npx | ❌ | N/A | N/A | npm | ⭐⭐⭐⭐ |
| npx @latest | ❌ | N/A | N/A | npm | ⭐⭐⭐ |
| yarn | ✅ | ❌ | ❌ | yarn | ⭐⭐⭐⭐ |
| yarn global | ✅ | ✅ | ❌ | yarn | ⭐⭐⭐⭐ |
| pnpm | ✅ | ❌ | ❌ | pnpm | ⭐⭐⭐⭐⭐ |
| pnpm global | ✅ | ✅ | ❌ | pnpm | ⭐⭐⭐⭐⭐ |
| copy | N/A | N/A | N/A | any | N/A |

---

## 🎬 Example User Flows

### Flow 1: Installing a CLI Tool
```bash
$ npx ruvi packages

Select package:
> claude-flow

How would you like to install?
> 🌍 Global (npm install -g) - Available everywhere

⠋ Running: npm install -g claude-flow
✓ Installation complete!
✓ claude-flow is ready to use!

💡 Usage:
   claude-flow --help
```

### Flow 2: Adding a Library to Project
```bash
$ npx ruvi packages

Select package:
> agentdb

How would you like to install?
> 📁 Local project (npm install) - Add to dependencies

⠋ Running: npm install agentdb
✓ Installation complete!
✓ agentdb is ready to use!

💡 Usage in your project:
   import agentdb from 'agentdb'
```

### Flow 3: Testing with npx
```bash
$ npx ruvi packages

Select package:
> research-swarm

How would you like to install?
> ⚡ Run with npx (no install) - Try it once

⠋ Running: npx research-swarm
✓ Installation complete!
✓ research-swarm is ready to use!

💡 To run again:
   npx research-swarm
```

### Flow 4: Using Yarn
```bash
$ npx ruvi packages

Select package:
> agentic-flow

How would you like to install?
> 🧶 Yarn (yarn add) - Alternative package manager

⠋ Running: yarn add agentic-flow
✓ Installation complete!
✓ agentic-flow is ready to use!

💡 Usage in your project:
   import agenticflow from 'agentic-flow'
```

### Flow 5: Copying All Commands
```bash
$ npx ruvi packages

Select package:
> claude-flow

How would you like to install?
> 📋 Copy command - Manual install

📋 Available Installation Commands:

npm:
  npm install -g claude-flow          # Global
  npm install claude-flow             # Local
  npm install --save-dev claude-flow  # Dev dependency
  npx claude-flow                     # Run without install

yarn:
  yarn global add claude-flow         # Global
  yarn add claude-flow                # Local
  yarn add -D claude-flow             # Dev dependency

pnpm:
  pnpm add -g claude-flow             # Global
  pnpm add claude-flow                # Local
  pnpm add -D claude-flow             # Dev dependency
```

---

## 💡 Smart Features

### 1. **Usage Hints**
After installation, shows context-specific usage tips:
- Global: Shows how to run the command
- Local: Shows import statement
- npx: Shows how to run again
- Dev: Confirms devDependencies location

### 2. **Error Recovery**
If installation fails, suggests alternatives:
```bash
❌ Installation failed

💡 Try these alternatives:
   yarn add package-name    # Using Yarn
   pnpm add package-name    # Using pnpm
   npx package-name         # Run without install
```

### 3. **Warning Handling**
Distinguishes between:
- Fatal errors (installation failed)
- Warnings (completed with warnings)
- Success (clean install)

---

## 🔧 Advanced Options

### Dev Dependencies
```bash
# Specifically for development
npm install --save-dev jest
yarn add -D typescript
pnpm add -D eslint
```

**Use cases:**
- Test frameworks (jest, mocha, vitest)
- Type definitions (@types/*)
- Build tools (webpack, vite, rollup)
- Linters (eslint, prettier)
- Development servers

### Global vs Local Strategy
**Global:**
- CLIs you use across projects
- System-wide utilities
- Independent tools

**Local:**
- Project-specific dependencies
- Version-locked for reproducibility
- Team collaboration

---

## 📚 Package Manager Comparison

### npm (Default)
- **Pros**: Built into Node.js, universal, huge ecosystem
- **Cons**: Slower than alternatives, larger node_modules
- **Best for**: Standard projects, wide compatibility

### Yarn
- **Pros**: Faster installs, offline mode, workspaces
- **Cons**: Additional tool to install
- **Best for**: Large projects, monorepos

### pnpm
- **Pros**: Most efficient disk usage, fastest installs, strict
- **Cons**: Compatibility issues with some packages
- **Best for**: Disk space conscious, monorepos, speed

---

## ✅ Complete Feature List

- [x] 10 installation methods
- [x] npm (global, local, dev, npx)
- [x] yarn (global, local)
- [x] pnpm (global, local)
- [x] npx @latest variant
- [x] Copy command with all options
- [x] Usage hints after install
- [x] Error recovery suggestions
- [x] Warning vs error distinction
- [x] Context-aware help text
- [x] Import statement generation
- [x] Command display during execution

---

**Last Updated**: 2025-11-13
**Version**: 1.0.6
**Feature**: Complete installation option coverage
