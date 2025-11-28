#!/usr/bin/env node

/**
 * Test Dashboard Script
 * Quick test to verify dashboard functionality
 */

const monitorCommand = require('./index.js');

async function testDashboard() {
  console.log('🧪 Testing Neural Trader Monitoring Dashboard\n');
  console.log('This will launch the dashboard in mock mode for 10 seconds...\n');
  console.log('Press Ctrl+C to exit early, or wait for auto-close.\n');

  // Launch dashboard in mock mode
  const dashboardPromise = monitorCommand('test-strategy', { mock: true });

  // Auto-close after 10 seconds for testing
  setTimeout(() => {
    console.log('\n✅ Dashboard test complete!');
    process.exit(0);
  }, 10000);

  await dashboardPromise;
}

if (require.main === module) {
  testDashboard().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = testDashboard;
