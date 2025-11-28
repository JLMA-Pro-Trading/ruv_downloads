#!/usr/bin/env node

// CLI executable entry point
import('../dist/index.js').catch((error) => {
  console.error('Failed to load ultrathink CLI:', error);
  process.exit(1);
});
