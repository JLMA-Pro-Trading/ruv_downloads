#!/bin/bash

# List all npm packages for a given author/maintainer
# Usage: ./list-npm-packages.sh [username]
# Example: ./list-npm-packages.sh ruvnet

USERNAME="${1:-ruvnet}"
SIZE="${2:-250}"
NPM_API="https://registry.npmjs.org/-/v1/search"

echo ""
echo "🔍 Fetching npm packages for author: $USERNAME"
echo ""

# Fetch packages
RESPONSE=$(curl -s "${NPM_API}?text=author:${USERNAME}&size=${SIZE}")

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq not found. Installing basic output..."
    echo "$RESPONSE"
    exit 0
fi

# Count packages
COUNT=$(echo "$RESPONSE" | jq -r '.objects | length')

echo "📦 Found $COUNT packages:"
echo ""
echo "────────────────────────────────────────────────────────────────────────────────"

# List packages with details
echo "$RESPONSE" | jq -r '.objects[] |
    "\n\(.package.name)\n" +
    "   Version: \(.package.version)\n" +
    "   Description: \(.package.description // "No description")\n" +
    "   Last updated: \(.package.date)\n" +
    "   NPM: https://www.npmjs.com/package/\(.package.name)"
'

echo ""
echo "────────────────────────────────────────────────────────────────────────────────"
echo ""
echo "✅ Total: $COUNT packages"
echo ""

# Optional: Export to JSON
if [ "$3" == "--json" ]; then
    OUTPUT_FILE="npm-packages-${USERNAME}.json"
    echo "$RESPONSE" | jq '.objects' > "$OUTPUT_FILE"
    echo "💾 Exported to $OUTPUT_FILE"
    echo ""
fi

# Also check by maintainer
echo "🔍 Checking packages where you're listed as maintainer..."
MAINTAINER_RESPONSE=$(curl -s "${NPM_API}?text=maintainer:${USERNAME}&size=${SIZE}")
MAINTAINER_COUNT=$(echo "$MAINTAINER_RESPONSE" | jq -r '.objects | length')

if [ "$MAINTAINER_COUNT" -gt "$COUNT" ]; then
    echo "📊 Found $MAINTAINER_COUNT packages as maintainer (may include collaborations)"
    echo ""
fi
