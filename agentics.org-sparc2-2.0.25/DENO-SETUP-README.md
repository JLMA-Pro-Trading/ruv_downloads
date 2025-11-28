# SPARC2 Deno Setup Improvements

This document outlines the improvements made to the SPARC2 installation and setup process, specifically focusing on Deno dependency management.

## Overview of Changes

1. **Deno Installation Script** (`install-deno.sh`)
   - Cross-platform installation support
   - Automatic detection of existing Deno installations
   - Shell profile configuration for PATH updates
   - Detailed error handling and user feedback

2. **MCP Server Wrapper** (`sparc2-mcp-wrapper.js`)
   - Checks for Deno installation before running the MCP server
   - Provides clear installation instructions if Deno is not found
   - Forwards process signals properly for clean shutdown
   - Colorized terminal output for better user experience

3. **Package.json Updates**
   - Added `postinstall` script to check for Deno installation
   - Added `install-deno` script to run the installation script
   - Added new binary entry for `sparc2-mcp` command
   - Included new files in the package distribution

4. **Documentation**
   - Created `DENO-INSTALLATION.md` with detailed installation instructions
   - Added troubleshooting information for common issues

## Files Created/Modified

- **New Files:**
  - `install-deno.sh`: Deno installation script
  - `sparc2-mcp-wrapper.js`: MCP server wrapper with Deno checks
  - `DENO-INSTALLATION.md`: Detailed Deno installation guide

- **Modified Files:**
  - `package.json`: Updated with new scripts and file entries

## Usage

### Installing Deno

```bash
# Using the npm script
npm run install-deno

# Or directly
./install-deno.sh
```

### Running the MCP Server

```bash
# Using the npm binary
npx sparc2-mcp

# Or directly
node sparc2-mcp-wrapper.js
```

## Benefits

1. **Improved User Experience**
   - Clear error messages when Deno is missing
   - Guided installation process
   - Reduced setup friction for new users

2. **Robustness**
   - Prevents cryptic errors caused by missing Deno
   - Ensures proper environment setup before running SPARC2

3. **Maintainability**
   - Centralized Deno version requirements
   - Consistent installation process across platforms
   - Better documentation for future users and contributors

## Future Improvements

- Add Deno version compatibility checking
- Implement automatic updates for Deno
- Create a unified setup script that handles all dependencies