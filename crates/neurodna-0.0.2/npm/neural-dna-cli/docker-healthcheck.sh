#!/bin/bash

# Health check script for neural-dna-cli Docker container

set -e

echo "Running neural-dna CLI health check..."

# Check if neural-dna command is available
if ! command -v neural-dna &> /dev/null; then
    echo "ERROR: neural-dna command not found"
    exit 1
fi

# Test basic CLI functionality
echo "Testing CLI help command..."
if ! neural-dna --help &> /dev/null; then
    echo "ERROR: neural-dna --help failed"
    exit 1
fi

# Test DNA generation
echo "Testing DNA generation..."
TEMP_DIR=$(mktemp -d)
if ! neural-dna spawn -t "2,3,1" -c 1 -o "$TEMP_DIR" --random &> /dev/null; then
    echo "ERROR: DNA generation failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check if DNA file was created
if [ ! -f "$TEMP_DIR/dna_000.json" ]; then
    echo "ERROR: DNA file was not created"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Test DNA scoring
echo "Testing DNA scoring..."
if ! neural-dna score "$TEMP_DIR/dna_000.json" --metric mse &> /dev/null; then
    echo "ERROR: DNA scoring failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Clean up
rm -rf "$TEMP_DIR"

echo "Health check passed successfully!"
exit 0