/**
 * Enhanced Doctor Command
 * Comprehensive system diagnostics and health checks
 * Version: 2.5.1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getNAPIStatus } = require('../lib/napi-loader');

/**
 * Color codes for output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Run a command safely
 */
function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

/**
 * Check if a module is available
 */
function checkModule(moduleName) {
  try {
    require.resolve(moduleName);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Format file size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Enhanced doctor command
 */
async function doctorCommand(options = {}) {
  const verbose = options.verbose || false;
  const json = options.json || false;

  console.log(colors.cyan + colors.bright + '🔍 Neural Trader Health Check' + colors.reset);
  console.log(colors.dim + 'Version 3.0.1 - Comprehensive Diagnostics' + colors.reset);
  console.log('');

  const results = {
    system: [],
    dependencies: [],
    configuration: [],
    packages: [],
    network: [],
    recommendations: []
  };

  // ===== SYSTEM CHECKS =====
  console.log(colors.bright + '📊 System Information' + colors.reset);
  console.log('');

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (nodeMajor >= 18) {
    results.system.push({ check: 'Node.js Version', status: 'pass', message: nodeVersion, icon: '✅' });
    console.log(`  Node.js:          ${colors.green}✅ ${nodeVersion}${colors.reset}`);
  } else {
    results.system.push({ check: 'Node.js Version', status: 'fail', message: `${nodeVersion} (requires >=18)`, icon: '❌' });
    console.log(`  Node.js:          ${colors.red}❌ ${nodeVersion} (requires >=18)${colors.reset}`);
    results.recommendations.push('Upgrade Node.js to version 18 or higher');
  }

  // npm version
  const npmVersion = runCommand('npm --version');
  if (npmVersion) {
    results.system.push({ check: 'npm Version', status: 'pass', message: npmVersion, icon: '✅' });
    console.log(`  npm:              ${colors.green}✅ ${npmVersion}${colors.reset}`);
  } else {
    results.system.push({ check: 'npm Version', status: 'warn', message: 'Not found', icon: '⚠️' });
    console.log(`  npm:              ${colors.yellow}⚠️  Not found${colors.reset}`);
  }

  // Platform info
  const platform = `${process.platform}-${process.arch}`;
  results.system.push({ check: 'Platform', status: 'info', message: platform, icon: 'ℹ️' });
  console.log(`  Platform:         ${colors.dim}${platform}${colors.reset}`);

  // Memory
  const totalMem = Math.round(require('os').totalmem() / 1024 / 1024 / 1024);
  const freeMem = Math.round(require('os').freemem() / 1024 / 1024 / 1024);
  results.system.push({ check: 'Memory', status: 'info', message: `${freeMem}GB free / ${totalMem}GB total`, icon: 'ℹ️' });
  console.log(`  Memory:           ${colors.dim}${freeMem}GB free / ${totalMem}GB total${colors.reset}`);

  if (freeMem < 2) {
    results.recommendations.push('Low memory available (<2GB). Consider closing other applications.');
  }

  console.log('');

  // ===== NAPI BINDINGS =====
  console.log(colors.bright + '🔧 NAPI Bindings' + colors.reset);
  console.log('');

  const napiStatus = getNAPIStatus();
  if (napiStatus.available) {
    results.system.push({ check: 'NAPI Bindings', status: 'pass', message: `Available (${napiStatus.functionCount} functions)`, icon: '✅' });
    console.log(`  Status:           ${colors.green}✅ Available${colors.reset}`);
    console.log(`  Functions:        ${colors.dim}${napiStatus.functionCount} exported${colors.reset}`);
    console.log(`  Mode:             ${colors.dim}${napiStatus.mode}${colors.reset}`);
  } else {
    results.system.push({ check: 'NAPI Bindings', status: 'warn', message: 'Not loaded (CLI-only mode)', icon: '⚠️' });
    console.log(`  Status:           ${colors.yellow}⚠️  Not loaded (CLI-only mode)${colors.reset}`);
    console.log(`  Mode:             ${colors.dim}${napiStatus.mode}${colors.reset}`);
    results.recommendations.push('Run "npm run build" to build NAPI bindings for full functionality');
  }

  console.log('');

  // ===== DEPENDENCIES =====
  console.log(colors.bright + '📦 Dependencies' + colors.reset);
  console.log('');

  const requiredDeps = [
    'chalk',
    'commander',
    'inquirer',
    'zod'
  ];

  const optionalDeps = [
    'e2b',
    'ioredis',
    'agentic-flow'
  ];

  let missingRequired = [];
  let missingOptional = [];

  for (const dep of requiredDeps) {
    if (checkModule(dep)) {
      results.dependencies.push({ check: dep, status: 'pass', type: 'required', icon: '✅' });
      if (verbose) console.log(`  ${dep.padEnd(20)} ${colors.green}✅${colors.reset}`);
    } else {
      results.dependencies.push({ check: dep, status: 'fail', type: 'required', icon: '❌' });
      console.log(`  ${dep.padEnd(20)} ${colors.red}❌ Missing (required)${colors.reset}`);
      missingRequired.push(dep);
    }
  }

  for (const dep of optionalDeps) {
    if (checkModule(dep)) {
      results.dependencies.push({ check: dep, status: 'pass', type: 'optional', icon: '✅' });
      if (verbose) console.log(`  ${dep.padEnd(20)} ${colors.green}✅${colors.reset}`);
    } else {
      results.dependencies.push({ check: dep, status: 'warn', type: 'optional', icon: '⚠️' });
      if (verbose) console.log(`  ${dep.padEnd(20)} ${colors.yellow}⚠️  Missing (optional)${colors.reset}`);
      missingOptional.push(dep);
    }
  }

  if (missingRequired.length > 0) {
    console.log(`  ${colors.red}❌ Missing required: ${missingRequired.join(', ')}${colors.reset}`);
    results.recommendations.push(`Install missing dependencies: npm install ${missingRequired.join(' ')}`);
  } else if (!verbose) {
    console.log(`  Required:         ${colors.green}✅ All installed${colors.reset}`);
  }

  if (missingOptional.length > 0 && verbose) {
    console.log(`  ${colors.yellow}⚠️  Optional missing: ${missingOptional.join(', ')}${colors.reset}`);
  } else if (!verbose) {
    console.log(`  Optional:         ${colors.dim}${optionalDeps.length - missingOptional.length}/${optionalDeps.length} installed${colors.reset}`);
  }

  console.log('');

  // ===== CONFIGURATION =====
  console.log(colors.bright + '⚙️  Configuration' + colors.reset);
  console.log('');

  // Check package.json
  if (fs.existsSync('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      results.configuration.push({ check: 'package.json', status: 'pass', message: `Valid (${pkg.name})`, icon: '✅' });
      console.log(`  package.json:     ${colors.green}✅ Valid${colors.reset}`);
    } catch (e) {
      results.configuration.push({ check: 'package.json', status: 'fail', message: 'Invalid JSON', icon: '❌' });
      console.log(`  package.json:     ${colors.red}❌ Invalid JSON${colors.reset}`);
      results.recommendations.push('Fix package.json syntax errors');
    }
  } else {
    results.configuration.push({ check: 'package.json', status: 'warn', message: 'Not found', icon: '⚠️' });
    console.log(`  package.json:     ${colors.yellow}⚠️  Not found${colors.reset}`);
    results.recommendations.push('Create package.json: npm init');
  }

  // Check config.json
  if (fs.existsSync('config.json')) {
    try {
      JSON.parse(fs.readFileSync('config.json', 'utf8'));
      results.configuration.push({ check: 'config.json', status: 'pass', message: 'Valid', icon: '✅' });
      console.log(`  config.json:      ${colors.green}✅ Valid${colors.reset}`);
    } catch (e) {
      results.configuration.push({ check: 'config.json', status: 'fail', message: 'Invalid JSON', icon: '❌' });
      console.log(`  config.json:      ${colors.red}❌ Invalid JSON${colors.reset}`);
      results.recommendations.push('Fix config.json syntax errors');
    }
  } else {
    results.configuration.push({ check: 'config.json', status: 'info', message: 'Not found (optional)', icon: 'ℹ️' });
    console.log(`  config.json:      ${colors.dim}ℹ️  Not found (optional)${colors.reset}`);
  }

  // Check .env file
  if (fs.existsSync('.env')) {
    results.configuration.push({ check: '.env', status: 'pass', message: 'Found', icon: '✅' });
    console.log(`  .env:             ${colors.green}✅ Found${colors.reset}`);
  } else {
    results.configuration.push({ check: '.env', status: 'info', message: 'Not found (optional)', icon: 'ℹ️' });
    if (verbose) console.log(`  .env:             ${colors.dim}ℹ️  Not found (optional)${colors.reset}`);
  }

  console.log('');

  // ===== PACKAGES & EXAMPLES =====
  console.log(colors.bright + '📚 Packages & Examples' + colors.reset);
  console.log('');

  try {
    const { getAllPackages } = require('../data/packages');
    const allPackages = getAllPackages();
    const totalPackages = Object.keys(allPackages).length;
    const examplePackages = Object.keys(allPackages).filter(k => k.startsWith('example:')).length;

    results.packages.push({ check: 'Total Packages', status: 'pass', message: totalPackages.toString(), icon: '✅' });
    results.packages.push({ check: 'Example Packages', status: 'pass', message: examplePackages.toString(), icon: '✅' });

    console.log(`  Total Packages:   ${colors.green}✅ ${totalPackages} available${colors.reset}`);
    console.log(`  Examples:         ${colors.dim}${examplePackages} examples${colors.reset}`);
  } catch (e) {
    results.packages.push({ check: 'Package Registry', status: 'fail', message: 'Failed to load', icon: '❌' });
    console.log(`  Package Registry: ${colors.red}❌ Failed to load${colors.reset}`);
    results.recommendations.push('Package registry may be corrupted. Reinstall neural-trader.');
  }

  console.log('');

  // ===== NETWORK =====
  console.log(colors.bright + '🌐 Network' + colors.reset);
  console.log('');

  // Check npm registry
  const npmPing = runCommand('npm ping --registry https://registry.npmjs.org 2>&1');
  if (npmPing && npmPing.includes('Ping success')) {
    results.network.push({ check: 'npm Registry', status: 'pass', message: 'Reachable', icon: '✅' });
    console.log(`  npm Registry:     ${colors.green}✅ Reachable${colors.reset}`);
  } else {
    results.network.push({ check: 'npm Registry', status: 'warn', message: 'Unreachable', icon: '⚠️' });
    console.log(`  npm Registry:     ${colors.yellow}⚠️  Unreachable${colors.reset}`);
    results.recommendations.push('Check your internet connection or firewall settings');
  }

  console.log('');

  // ===== SECURITY =====
  if (verbose) {
    console.log(colors.bright + '🔒 Security' + colors.reset);
    console.log('');

    const auditResult = runCommand('npm audit --json 2>/dev/null');
    if (auditResult) {
      try {
        const audit = JSON.parse(auditResult);
        const vulns = audit.metadata?.vulnerabilities;
        if (vulns) {
          const total = vulns.total || 0;
          const critical = vulns.critical || 0;
          const high = vulns.high || 0;

          if (total === 0) {
            console.log(`  Vulnerabilities:  ${colors.green}✅ None found${colors.reset}`);
          } else {
            console.log(`  Vulnerabilities:  ${colors.yellow}⚠️  ${total} found${colors.reset}`);
            if (critical > 0) console.log(`    Critical:       ${colors.red}${critical}${colors.reset}`);
            if (high > 0) console.log(`    High:           ${colors.yellow}${high}${colors.reset}`);
            results.recommendations.push('Run "npm audit fix" to fix security vulnerabilities');
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    console.log('');
  }

  // ===== RECOMMENDATIONS =====
  if (results.recommendations.length > 0) {
    console.log(colors.bright + '💡 Recommendations' + colors.reset);
    console.log('');
    results.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
    console.log('');
  }

  // ===== SUMMARY =====
  const hasErrors = results.system.some(r => r.status === 'fail') ||
                    results.dependencies.some(r => r.status === 'fail') ||
                    results.configuration.some(r => r.status === 'fail');

  const hasWarnings = results.system.some(r => r.status === 'warn') ||
                      results.dependencies.some(r => r.status === 'warn') ||
                      results.configuration.some(r => r.status === 'warn');

  if (hasErrors) {
    console.log(colors.red + colors.bright + '❌ Critical issues found. Please address them before proceeding.' + colors.reset);
  } else if (hasWarnings) {
    console.log(colors.yellow + colors.bright + '⚠️  Some warnings found. System should work but may have limited functionality.' + colors.reset);
  } else {
    console.log(colors.green + colors.bright + '✅ All systems operational! Neural Trader is ready to use.' + colors.reset);
  }
  console.log('');

  // JSON output
  if (json) {
    console.log(JSON.stringify(results, null, 2));
  }

  // Exit code
  process.exit(hasErrors ? 1 : 0);
}

module.exports = doctorCommand;
