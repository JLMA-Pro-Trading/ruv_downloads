#!/usr/bin/env node

/**
 * Integration tests for neural-dna-cli
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n🧪 Running: ${testName}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

class TestRunner {
  constructor() {
    this.testCount = 0;
    this.passCount = 0;
    this.failCount = 0;
    this.tempDir = null;
  }

  async setup() {
    // Create temporary directory for tests
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neural-dna-test-'));
    log(`Test directory: ${this.tempDir}`, 'blue');
    
    // Create test data
    const testData = {
      inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
      targets: [[0], [1], [1], [0]]
    };
    
    await fs.writeJson(path.join(this.tempDir, 'test-data.json'), testData);
    logSuccess('Test environment set up');
  }

  async cleanup() {
    if (this.tempDir) {
      await fs.remove(this.tempDir);
      log(`Cleaned up test directory: ${this.tempDir}`, 'blue');
    }
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  async test(testName, testFunction) {
    logTest(testName);
    this.testCount++;
    
    try {
      await testFunction();
      this.passCount++;
      logSuccess(`PASSED: ${testName}`);
    } catch (error) {
      this.failCount++;
      logError(`FAILED: ${testName}`);
      logError(`Error: ${error.message}`);
    }
  }

  async testCliHelp() {
    await this.test('CLI Help Command', async () => {
      const result = await this.runCommand('neural-dna', ['--help']);
      
      if (result.code !== 0) {
        throw new Error(`Help command failed with exit code ${result.code}`);
      }
      
      if (!result.stdout.includes('Neural DNA CLI')) {
        throw new Error('Help output does not contain expected text');
      }
    });
  }

  async testDnaGeneration() {
    await this.test('DNA Generation', async () => {
      const outputDir = path.join(this.tempDir, 'generated');
      const result = await this.runCommand('neural-dna', [
        'spawn',
        '-t', '2,4,1',
        '-c', '3',
        '-o', outputDir,
        '--random'
      ]);
      
      if (result.code !== 0) {
        throw new Error(`DNA generation failed: ${result.stderr}`);
      }
      
      // Check if files were created
      const files = await fs.readdir(outputDir);
      const dnaFiles = files.filter(f => f.startsWith('dna_') && f.endsWith('.json'));
      
      if (dnaFiles.length !== 3) {
        throw new Error(`Expected 3 DNA files, got ${dnaFiles.length}`);
      }
      
      // Validate first DNA file
      const dnaData = await fs.readJson(path.join(outputDir, 'dna_000.json'));
      if (!dnaData.topology || !dnaData.weights || !dnaData.biases) {
        throw new Error('DNA file missing required fields');
      }
    });
  }

  async testDnaScoring() {
    await this.test('DNA Scoring', async () => {
      // First generate a DNA file
      const outputDir = path.join(this.tempDir, 'scoring');
      await this.runCommand('neural-dna', [
        'spawn',
        '-t', '2,3,1',
        '-c', '1',
        '-o', outputDir,
        '--random'
      ]);
      
      const dnaFile = path.join(outputDir, 'dna_000.json');
      const testDataFile = path.join(this.tempDir, 'test-data.json');
      
      const result = await this.runCommand('neural-dna', [
        'score',
        dnaFile,
        '--data', testDataFile,
        '--metric', 'mse'
      ]);
      
      if (result.code !== 0) {
        throw new Error(`DNA scoring failed: ${result.stderr}`);
      }
      
      if (!result.stdout.includes('Fitness Score:')) {
        throw new Error('Score output does not contain fitness score');
      }
    });
  }

  async testDnaTraining() {
    await this.test('DNA Training', async () => {
      const outputFile = path.join(this.tempDir, 'best_trained.json');
      const testDataFile = path.join(this.tempDir, 'test-data.json');
      
      const result = await this.runCommand('neural-dna', [
        'train',
        '-p', '20',
        '-g', '5',
        '-t', '2,4,1',
        '-o', outputFile,
        '--data', testDataFile
      ], { timeout: 30000 }); // 30 second timeout
      
      if (result.code !== 0) {
        throw new Error(`DNA training failed: ${result.stderr}`);
      }
      
      // Check if trained DNA file was created
      if (!await fs.pathExists(outputFile)) {
        throw new Error('Trained DNA file was not created');
      }
      
      const trainedDna = await fs.readJson(outputFile);
      if (!trainedDna.topology || !trainedDna.weights) {
        throw new Error('Trained DNA file is invalid');
      }
    });
  }

  async testAnalyzeCommand() {
    await this.test('DNA Analysis', async () => {
      // Generate a DNA file first
      const outputDir = path.join(this.tempDir, 'analysis');
      await this.runCommand('neural-dna', [
        'spawn',
        '-t', '3,5,2',
        '-c', '1',
        '-o', outputDir,
        '--random'
      ]);
      
      const dnaFile = path.join(outputDir, 'dna_000.json');
      
      const result = await this.runCommand('neural-dna', [
        'analyze',
        dnaFile,
        '--verbose'
      ]);
      
      if (result.code !== 0) {
        throw new Error(`DNA analysis failed: ${result.stderr}`);
      }
      
      if (!result.stdout.includes('DNA Analysis:')) {
        throw new Error('Analysis output missing expected content');
      }
    });
  }

  async testBenchmarkCommand() {
    await this.test('Benchmark Command', async () => {
      const result = await this.runCommand('neural-dna', [
        'benchmark',
        '-t', '2,3,1',
        '-p', '10',
        '-g', '3'
      ], { timeout: 20000 }); // 20 second timeout
      
      if (result.code !== 0) {
        throw new Error(`Benchmark failed: ${result.stderr}`);
      }
      
      if (!result.stdout.includes('benchmark')) {
        throw new Error('Benchmark output missing expected content');
      }
    });
  }

  async testInvalidCommands() {
    await this.test('Invalid Command Handling', async () => {
      // Test invalid command
      const result1 = await this.runCommand('neural-dna', ['invalid-command']);
      if (result1.code === 0) {
        throw new Error('Invalid command should have failed');
      }
      
      // Test missing required arguments
      const result2 = await this.runCommand('neural-dna', ['score']);
      if (result2.code === 0) {
        throw new Error('Command with missing arguments should have failed');
      }
    });
  }

  async testFileNotFound() {
    await this.test('File Not Found Handling', async () => {
      const result = await this.runCommand('neural-dna', [
        'score',
        'nonexistent-file.json'
      ]);
      
      if (result.code === 0) {
        throw new Error('Command with nonexistent file should have failed');
      }
    });
  }

  async runAllTests() {
    log('🧬 Neural DNA CLI Integration Tests', 'bold');
    log('=====================================', 'blue');
    
    try {
      await this.setup();
      
      // Run all tests
      await this.testCliHelp();
      await this.testDnaGeneration();
      await this.testDnaScoring();
      await this.testDnaTraining();
      await this.testAnalyzeCommand();
      await this.testBenchmarkCommand();
      await this.testInvalidCommands();
      await this.testFileNotFound();
      
    } finally {
      await this.cleanup();
    }
    
    // Print summary
    log('\n📊 Test Summary', 'bold');
    log('================', 'blue');
    log(`Total Tests: ${this.testCount}`);
    logSuccess(`Passed: ${this.passCount}`);
    
    if (this.failCount > 0) {
      logError(`Failed: ${this.failCount}`);
    } else {
      logSuccess('All tests passed! 🎉');
    }
    
    // Exit with appropriate code
    process.exit(this.failCount > 0 ? 1 : 0);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch((error) => {
    logError(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = TestRunner;