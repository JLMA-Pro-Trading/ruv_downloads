#!/bin/bash
# Script to test the installation of vscode-remote-mcp

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing vscode-remote-mcp installation...${NC}"

# Create a temporary directory for testing
TEMP_DIR=$(mktemp -d)
echo -e "${YELLOW}Created temporary directory: ${TEMP_DIR}${NC}"

# Navigate to the temporary directory
cd "$TEMP_DIR" || {
  echo -e "${RED}Error: Failed to navigate to temporary directory${NC}"
  exit 1
}

# Create a package.json file
echo -e "${YELLOW}Creating package.json...${NC}"
cat > package.json << EOF
{
  "name": "vscode-remote-mcp-test",
  "version": "1.0.0",
  "description": "Test for vscode-remote-mcp",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "ISC"
}
EOF

# Install vscode-remote-mcp
echo -e "${YELLOW}Installing vscode-remote-mcp...${NC}"
npm install -g /workspaces/vscode/vscode-remote-mcp

# Check if the installation was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Installation successful!${NC}"
else
  echo -e "${RED}Installation failed!${NC}"
  exit 1
fi

# Test the vsc-remote command
echo -e "${YELLOW}Testing vsc-remote command...${NC}"
which vsc-remote
if [ $? -eq 0 ]; then
  echo -e "${GREEN}vsc-remote command found!${NC}"
else
  echo -e "${RED}vsc-remote command not found!${NC}"
  exit 1
fi

# Test the vsc-remote help command
echo -e "${YELLOW}Testing vsc-remote help command...${NC}"
vsc-remote --help
if [ $? -eq 0 ]; then
  echo -e "${GREEN}vsc-remote help command works!${NC}"
else
  echo -e "${RED}vsc-remote help command failed!${NC}"
  exit 1
fi

# Clean up
echo -e "${YELLOW}Cleaning up...${NC}"
cd /tmp
rm -rf "$TEMP_DIR"

echo -e "${GREEN}All tests passed!${NC}"