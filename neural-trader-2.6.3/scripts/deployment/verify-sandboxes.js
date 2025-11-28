#!/usr/bin/env node

/**
 * E2B Sandbox Verification Script
 * Verifies status and health of all deployed sandboxes
 */

const fs = require('fs');

class SandboxVerifier {
  constructor(statusFile) {
    this.statusFile = statusFile;
    this.deployment = null;
  }

  async verify() {
    console.log('\n🔍 E2B SANDBOX VERIFICATION');
    console.log('='.repeat(60));

    // Load deployment status
    try {
      this.deployment = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
      console.log(`\n✅ Loaded deployment: ${this.deployment.deployment_id}`);
    } catch (error) {
      console.error(`\n❌ Failed to load status file: ${error.message}`);
      process.exit(1);
    }

    // Verify deployment
    this.verifyDeploymentInfo();
    this.verifySandboxes();
    this.verifyResources();
    this.verifyTradingCoverage();
    this.generateHealthReport();
  }

  verifyDeploymentInfo() {
    console.log('\n📋 Deployment Information');
    console.log('-'.repeat(60));
    console.log(`Deployment ID: ${this.deployment.deployment_id}`);
    console.log(`Topology: ${this.deployment.topology.toUpperCase()}`);
    console.log(`Deployed At: ${this.deployment.deployed_at}`);
    console.log(`QUIC Enabled: ${this.deployment.coordination.quic_enabled ? 'Yes' : 'No'}`);
    console.log(`Distributed Memory: ${this.deployment.coordination.distributed_memory ? 'Yes' : 'No'}`);
  }

  verifySandboxes() {
    console.log('\n📦 Sandbox Status');
    console.log('-'.repeat(60));

    const { sandboxes } = this.deployment;
    const running = sandboxes.filter(s => s.status === 'running').length;
    const failed = sandboxes.filter(s => s.status === 'failed').length;

    console.log(`Total Sandboxes: ${sandboxes.length}`);
    console.log(`Running: ${running} ✅`);
    console.log(`Failed: ${failed} ${failed > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate: ${this.deployment.summary.success_rate}`);

    console.log('\nSandbox Details:');
    sandboxes.forEach((sandbox, index) => {
      const status = sandbox.status === 'running' ? '✅' : '❌';
      console.log(`\n${index + 1}. ${sandbox.name} (${sandbox.agent_type})`);
      console.log(`   Status: ${status} ${sandbox.status.toUpperCase()}`);
      console.log(`   ID: ${sandbox.id}`);
      console.log(`   Symbols: ${sandbox.symbols.join(', ')}`);
      console.log(`   CPU: ${sandbox.resources.cpu} cores`);
      console.log(`   Memory: ${sandbox.resources.memory_mb} MB`);
      console.log(`   Timeout: ${sandbox.resources.timeout}s`);

      if (sandbox.url) {
        console.log(`   URL: ${sandbox.url}`);
      }

      if (sandbox.error) {
        console.log(`   ⚠️  Error: ${sandbox.error}`);
      }
    });
  }

  verifyResources() {
    console.log('\n💻 Resource Allocation');
    console.log('-'.repeat(60));

    const { resources_allocated } = this.deployment.summary;

    console.log(`Total CPU Cores: ${resources_allocated.total_cpu_cores}`);
    console.log(`Total Memory: ${resources_allocated.total_memory_mb} MB (${resources_allocated.total_memory_gb} GB)`);
    console.log(`Avg CPU/Sandbox: ${resources_allocated.average_cpu_per_sandbox} cores`);
    console.log(`Avg Memory/Sandbox: ${resources_allocated.average_memory_per_sandbox_mb} MB`);
  }

  verifyTradingCoverage() {
    console.log('\n📊 Trading Coverage');
    console.log('-'.repeat(60));

    const { trading_coverage } = this.deployment.summary;

    console.log(`Total Symbols: ${trading_coverage.total_symbols}`);
    console.log(`Symbols: ${trading_coverage.symbols.join(', ')}`);
    console.log(`\nStrategies Deployed:`);

    trading_coverage.strategies_deployed.forEach((strategy, index) => {
      console.log(`  ${index + 1}. ${strategy}`);
    });
  }

  generateHealthReport() {
    console.log('\n🏥 Health Summary');
    console.log('-'.repeat(60));

    const { summary } = this.deployment;
    const isHealthy = summary.failed === 0;

    console.log(`Overall Health: ${isHealthy ? '✅ HEALTHY' : '⚠️  DEGRADED'}`);
    console.log(`Deployment Status: ${summary.deployment_status.toUpperCase()}`);

    if (summary.estimated_monthly_cost) {
      console.log(`\n💰 Estimated Monthly Cost: $${summary.estimated_monthly_cost.total_estimated_monthly_usd}`);
      console.log(`   - CPU: $${summary.estimated_monthly_cost.cpu_cost}`);
      console.log(`   - Memory: $${summary.estimated_monthly_cost.memory_cost}`);
      console.log(`   ${summary.estimated_monthly_cost.note}`);
    }

    console.log('\n✅ Verification Complete');
    console.log('='.repeat(60));

    if (!isHealthy) {
      console.log('\n⚠️  WARNING: Some sandboxes are not running');
      console.log('Review the deployment report for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All sandboxes are running successfully');
      process.exit(0);
    }
  }
}

// CLI execution
if (require.main === module) {
  const statusFile = process.argv[2] || '/tmp/e2b-sandbox-status.json';

  const verifier = new SandboxVerifier(statusFile);
  verifier.verify().catch(error => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  });
}

module.exports = SandboxVerifier;
