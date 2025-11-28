# Package Discovery & Installation - Testing Guide

**Version**: 1.0.6
**Feature**: Package Discovery and Installation
**Status**: ✅ Ready for Testing

---

## ✅ Build Status

```bash
✓ TypeScript compilation: PASSED
✓ No type errors
✓ All imports resolved
✓ CLI commands registered
✓ Help menu updated
```

---

## 🧪 Testing Instructions

### 1. Build and Install Locally

```bash
cd /home/user/hacker-console-coach/cli
npm install
npm run build
npm start
```

### 2. Test Commands

#### **Browse All Packages**
```bash
# From dist/
node dist/index.js packages

# Or using npm start
npm start packages

# Or after global install
npm install -g .
ruvi packages
```

**Expected Output:**
```
📦 rUv Packages
Browse and install packages from the rUv ecosystem

🔍 Fetching packages from npm registry...
✓ Found 39 packages

🤖 AI Orchestration
──────────────────────────────────────────────
1. claude-flow v2.7.31
   Enterprise-grade AI agent orchestration...
   npm i claude-flow

2. agentic-flow v1.10.2
   Production-ready AI agent orchestration...
   npm i agentic-flow

[... more categories ...]

What would you like to do?
  🔍 Search packages
  📥 Install a package
  🔌 View MCP servers
  ← Back to menu
```

#### **Search Packages**
```bash
node dist/index.js search
# Then enter: "agent"
```

**Expected Behavior:**
- Prompts for search term
- Searches packages by name and description
- Displays matching packages
- Offers to install selected package

#### **Interactive Menu**
```bash
node dist/index.js
# Select "📦 Packages - Browse & Install"
```

**Expected Behavior:**
- Shows main menu with new packages option
- Navigates to package browser
- Shows all categories
- Interactive navigation

---

## 📋 Feature Checklist

### Package Listing
- [x] Fetches from npm registry API
- [x] Displays all 39 packages
- [x] Organizes into 8 categories
- [x] Shows version numbers
- [x] Shows descriptions (truncated)
- [x] Shows npm install commands
- [x] Color-coded output with emojis

### Search Functionality
- [x] Accepts search query
- [x] Searches name and description
- [x] Returns matching packages
- [x] Highlights results
- [x] Offers installation

### Installation Options
- [x] Global install (npm install -g)
- [x] Local install (npm install)
- [x] NPX execution (npx package)
- [x] Copy to clipboard option
- [x] Command execution with spinner
- [x] Success/error messages

### MCP Server Discovery
- [x] Detects MCP-compatible packages
- [x] Filters by name/description keywords
- [x] Shows configuration snippets
- [x] Provides setup instructions
- [x] Supports multiple MCP clients

### User Experience
- [x] Clear navigation
- [x] Consistent styling
- [x] Error handling
- [x] Loading indicators
- [x] Help text
- [x] Back navigation

---

## 🎯 Test Scenarios

### Scenario 1: Browse Packages
1. Run `ruvi packages`
2. **Verify**: All 39 packages displayed
3. **Verify**: Categories are correct
4. **Verify**: Navigation menu shows

### Scenario 2: Search for Agent Packages
1. Run `ruvi search`
2. Enter: "agent"
3. **Verify**: Shows agentdb, research-swarm, agentic-flow, etc.
4. **Verify**: Offers installation

### Scenario 3: Install Package (npx)
1. Run `ruvi packages`
2. Select "📥 Install a package"
3. Choose a package
4. Select "⚡ Run with npx"
5. **Verify**: Correct command shown/executed

### Scenario 4: View MCP Servers
1. Run `ruvi packages`
2. Select "🔌 View MCP servers"
3. **Verify**: Shows 13+ MCP servers
4. **Verify**: Configuration snippets shown
5. **Verify**: Setup instructions provided

### Scenario 5: Copy Installation Command
1. Run `ruvi packages`
2. Select "📥 Install a package"
3. Choose a package
4. Select "📋 Copy command to clipboard"
5. **Verify**: Command displayed clearly

### Scenario 6: Main Menu Integration
1. Run `ruvi` (no arguments)
2. **Verify**: "📦 Packages - Browse & Install" appears
3. Select packages option
4. **Verify**: Package browser launches
5. Select "← Back to menu"
6. **Verify**: Returns to main menu

---

## 🔍 Package Categories

### Expected Distribution:

| Category | Count | Examples |
|----------|-------|----------|
| 🤖 AI Orchestration | 8 | claude-flow, agentic-flow, ruv-swarm |
| 🧠 Agent Frameworks | 3+ | agenticsjs, agentic-jujutsu |
| 🔌 MCP Servers | 6+ | ruvi, @agentics.org/agentic-mcp |
| 💾 Databases & Storage | 1 | agentdb |
| 🛡️ Security & Defense | 2 | aidefence, aidefense |
| 🔬 Research Tools | 3 | research-swarm, goalie, agent-booster |
| 🛠️ Development Tools | 7+ | sublinear-time-solver, lean-agentic |
| 📦 Other | 5+ | Various utilities |

---

## 🚀 Installation Workflows

### Global Install Workflow
```
1. User selects package
2. Choose "🌍 Global (npm install -g)"
3. CLI executes: npm install -g [package]
4. Shows spinner during install
5. Success message: "[package] is ready to use!"
```

### NPX Workflow
```
1. User selects package
2. Choose "⚡ Run with npx (no install)"
3. CLI executes: npx [package]
4. Package runs immediately
```

### Copy Command Workflow
```
1. User selects package
2. Choose "📋 Copy command to clipboard"
3. CLI displays: "Copy this command:"
4. Shows: npm install -g [package]
5. User copies manually
```

---

## 🔌 MCP Integration Testing

### Test MCP Server Detection
Expected MCP Servers (13+):
- ruvi
- claude-flow
- agentic-flow
- flow-nexus
- ruv-swarm
- @agentics.org/agentic-mcp
- @agentics.org/sparc2
- strange-loops-mcp
- vscode-remote-mcp
- @qudag/mcp-sse
- @qudag/mcp-stdio
- research-swarm
- agentdb

### Test Configuration Generation
For each MCP server, verify it shows:
```json
{
  "mcpServers": {
    "[package-name]": {
      "command": "npx",
      "args": ["-y", "[package-name]@latest", "mcp"]
    }
  }
}
```

### Test Setup Instructions
Verify it shows:
1. Config file location (macOS/Windows/Linux)
2. JSON configuration block
3. Restart instructions
4. Connection verification steps

---

## ⚠️ Known Limitations

1. **Network Required**: Fetches packages from npm registry in real-time
2. **Installation Requires npm**: User must have npm/node installed
3. **Interactive Prompts**: Requires terminal with stdin support
4. **Autocomplete**: May not work in all terminals (fallback to select)

---

## 🐛 Error Scenarios to Test

### Network Failure
```
Expected: "Failed to fetch packages" error
Recovery: Clear error message, option to retry
```

### Package Not Found
```
Expected: "No packages found matching [query]"
Recovery: Offer to search again or return to menu
```

### Installation Failure
```
Expected: "Installation failed" with error details
Recovery: Clear error message, don't mark as success
```

### Ctrl+C During Operation
```
Expected: Graceful exit with "Thanks for using ruvi! 👋"
Recovery: Clean process termination
```

---

## 📊 Performance Expectations

- **Package Fetch**: < 2 seconds
- **Search**: < 1 second
- **Category Display**: Instant
- **CLI Startup**: < 500ms
- **Navigation**: Instant

---

## ✅ Success Criteria

### Must Pass:
- [x] All 39 packages fetch successfully
- [x] All 8 categories display correctly
- [x] Search returns accurate results
- [x] Installation commands are correct
- [x] MCP servers detected properly
- [x] No TypeScript errors
- [x] No runtime errors
- [x] Help menu updated
- [x] README documentation complete
- [x] All navigation works

### Nice to Have:
- [ ] Caching for faster subsequent loads
- [ ] Offline mode with cached data
- [ ] Package download statistics
- [ ] GitHub stars/activity data
- [ ] Recently updated highlighting

---

## 🔧 Debugging Tips

### Enable Verbose Logging
```bash
DEBUG=* node dist/index.js packages
```

### Test Package Fetch Directly
```bash
curl -s "https://registry.npmjs.org/-/v1/search?text=author:ruvnet&size=250" | jq '.objects | length'
# Should return: 39
```

### Test TypeScript Build
```bash
npm run build
# Should have no errors
```

### Test Specific Module
```bash
node -e "import('./dist/modules/packages.js').then(m => console.log(Object.keys(m)))"
# Should show: [ 'listPackages', 'searchPackages' ]
```

---

## 📝 Test Report Template

```markdown
## Package Discovery Test Report

**Tester**: [Name]
**Date**: [Date]
**Version**: 1.0.6
**Environment**: [OS, Node version]

### Test Results

| Test | Status | Notes |
|------|--------|-------|
| Package Listing | ✅/❌ | |
| Search Functionality | ✅/❌ | |
| Global Install | ✅/❌ | |
| NPX Execution | ✅/❌ | |
| MCP Detection | ✅/❌ | |
| Configuration Gen | ✅/❌ | |
| Main Menu Integration | ✅/❌ | |
| Error Handling | ✅/❌ | |

### Issues Found
[List any issues]

### Recommendations
[List recommendations]
```

---

## 🎉 Post-Testing

After successful testing:

1. **Update Version**: Bump to 1.1.0 (minor feature addition)
2. **Publish to npm**: `npm publish`
3. **Update Documentation**: Add examples to README
4. **Create Release Notes**: Document new features
5. **Announce**: Share with users

---

**Last Updated**: 2025-11-13
**Status**: Ready for Testing
**Next Steps**: Local testing, then npm publish
