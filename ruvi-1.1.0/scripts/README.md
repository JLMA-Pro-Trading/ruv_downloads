# CLI Scripts

Utility scripts for the ruvi CLI project.

## list-npm-packages.js

List all npm packages for a given author/maintainer.

### Usage

```bash
# List packages for ruvnet
node scripts/list-npm-packages.js ruvnet

# Export to JSON
node scripts/list-npm-packages.js ruvnet --json

# List packages for another user
node scripts/list-npm-packages.js someuser
```

### API Endpoints Used

- **npm Search API**: `https://registry.npmjs.org/-/v1/search`
  - No authentication required
  - Public read access
  - Rate limited to reasonable usage

### Features

- ✅ No API key required
- ✅ Lists all packages by author
- ✅ Shows version, description, last updated
- ✅ Optional JSON export
- ✅ Checks both author and maintainer fields

### Output Example

```
🔍 Fetching npm packages for author: ruvnet

📦 Found 15 packages:

────────────────────────────────────────────────────────────────────────────────

1. ruvi
   Version: 1.0.6
   Description: rUv CLI - Agentic Engineering Console with MCP integration
   Last updated: 11/12/2025
   NPM: https://www.npmjs.com/package/ruvi

2. agentdb
   Version: 2.1.0
   Description: Vector database optimized for AI agent workflows
   Last updated: 10/15/2025
   NPM: https://www.npmjs.com/package/agentdb

...
```

## Alternative Methods

### Using npm CLI

```bash
# Search for packages (less detailed)
npm search author:ruvnet

# Get user profile (limited info)
npm view ruvnet
```

### Using npms.io API

```bash
# Alternative API with more metadata
curl "https://api.npms.io/v2/search?q=author:ruvnet"
```

### Using npm Registry Directly

```bash
# Get specific package info
curl https://registry.npmjs.org/ruvi

# Get user info (limited)
curl https://registry.npmjs.org/-/user/org.couchdb.user:ruvnet
```

## npm Tokens (For Publishing/Management)

If you need to **publish** or **manage** packages, you'll need an npm token:

1. Create token: `npm token create`
2. Types of tokens:
   - **Read-only**: For CI/CD to install private packages
   - **Publish**: For publishing packages
   - **Automation**: For automated workflows

3. Use in automation:
   ```bash
   # Set token in environment
   export NPM_TOKEN=your_token_here

   # Configure .npmrc
   echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
   ```

**Note**: Tokens are NOT needed for reading public package data.

## Rate Limits

- npm Registry API: ~300 requests/minute (reasonable usage)
- No authentication required for public data
- Be respectful of rate limits

## See Also

- [npm Registry API Docs](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md)
- [npm Search API](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search)
- [npms.io API](https://api-docs.npms.io/)
