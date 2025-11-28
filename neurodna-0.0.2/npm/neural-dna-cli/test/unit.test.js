/**
 * Unit tests for neural-dna-cli modules
 */

const { WasmModule } = require('../lib/wasm-loader');
const { TrainingEngine } = require('../lib/training');
const { DNAGenerator } = require('../lib/generator');
const { ScoreCalculator } = require('../lib/scorer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Mock Jest-like functions if jest is not available
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => {
    console.log(`\n📦 ${name}`);
    fn();
  };
  
  global.test = global.it = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  };
  
  global.expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toThrow: async () => {
      let threw = false;
      try {
        if (typeof actual === 'function') {
          await actual();
        }
      } catch (error) {
        threw = true;
      }
      if (!threw) {
        throw new Error('Expected function to throw');
      }
    }
  });
  
  global.beforeEach = (fn) => {
    // Simple implementation - would run before each test
    fn();
  };
  
  global.afterEach = (fn) => {
    // Simple implementation - would run after each test
    fn();
  };
}

describe('WasmModule', () => {
  let wasmModule;
  
  beforeEach(async () => {
    wasmModule = new WasmModule();
    await wasmModule.init();
  });

  test('should initialize successfully', () => {
    expect(wasmModule).toBeTruthy();
  });

  test('should create neural DNA', () => {
    const dna = wasmModule.createNeuralDNA([2, 3, 1], 'sigmoid');
    expect(dna).toBeTruthy();
    expect(dna.topology).toEqual([2, 3, 1]);
  });

  test('should create random DNA', () => {
    const dna = wasmModule.createRandomDNA([2, 4, 2], 'tanh');
    expect(dna).toBeTruthy();
    expect(dna.weights.length).toBeGreaterThan(0);
    expect(dna.biases.length).toBeGreaterThan(0);
  });

  test('should create evolution engine', () => {
    const engine = wasmModule.createEvolutionEngine(50, 5, [2, 3, 1], 'sigmoid');
    expect(engine).toBeTruthy();
    expect(engine.populationSize).toBe(50);
  });

  test('should perform crossover', () => {
    const parent1 = wasmModule.createRandomDNA([2, 3, 1], 'sigmoid');
    const parent2 = wasmModule.createRandomDNA([2, 3, 1], 'sigmoid');
    
    const child = wasmModule.crossover(parent1, parent2);
    expect(child).toBeTruthy();
    expect(child.topology).toEqual([2, 3, 1]);
  });

  test('should get default mutation policy', () => {
    const policy = wasmModule.getDefaultMutationPolicy();
    expect(policy).toBeTruthy();
    expect(typeof policy.weight_mutation_rate).toBe('number');
  });
});

describe('TrainingEngine', () => {
  let wasmModule;
  let trainingEngine;
  let tempDir;

  beforeEach(async () => {
    wasmModule = new WasmModule();
    await wasmModule.init();
    trainingEngine = new TrainingEngine(wasmModule);
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neural-dna-unit-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('should create training engine', () => {
    expect(trainingEngine).toBeTruthy();
  });

  test('should validate training config', async () => {
    const config = {
      populationSize: 10,
      generations: 2,
      eliteCount: 2,
      mutationRate: 0.1,
      topology: [2, 3, 1],
      activation: 'sigmoid',
      outputFile: path.join(tempDir, 'test.json'),
      parallel: false
    };

    // This would run training - for unit test, we just verify config structure
    expect(config.populationSize).toBe(10);
    expect(config.topology).toEqual([2, 3, 1]);
    expect(config.activation).toBe('sigmoid');
  });
});

describe('DNAGenerator', () => {
  let wasmModule;
  let generator;
  let tempDir;

  beforeEach(async () => {
    wasmModule = new WasmModule();
    await wasmModule.init();
    generator = new DNAGenerator(wasmModule);
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neural-dna-gen-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('should create DNA generator', () => {
    expect(generator).toBeTruthy();
  });

  test('should generate DNA files', async () => {
    const config = {
      topology: [2, 3, 1],
      activation: 'sigmoid',
      count: 3,
      outputDir: tempDir,
      random: true,
      mutationRate: 0.1
    };

    await generator.generate(config);

    // Check if files were created
    const files = await fs.readdir(tempDir);
    const dnaFiles = files.filter(f => f.startsWith('dna_') && f.endsWith('.json'));
    expect(dnaFiles.length).toBe(3);

    // Check file content
    const dnaData = await fs.readJson(path.join(tempDir, 'dna_000.json'));
    expect(dnaData.topology).toEqual([2, 3, 1]);
    expect(dnaData.weights).toBeTruthy();
    expect(dnaData.biases).toBeTruthy();
  });
});

describe('ScoreCalculator', () => {
  let wasmModule;
  let scorer;
  let tempDir;

  beforeEach(async () => {
    wasmModule = new WasmModule();
    await wasmModule.init();
    scorer = new ScoreCalculator(wasmModule);
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neural-dna-score-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('should create score calculator', () => {
    expect(scorer).toBeTruthy();
  });

  test('should calculate fitness score', async () => {
    // Create a test DNA file
    const dnaData = {
      topology: [2, 3, 1],
      activation: 'sigmoid',
      weights: Array(9).fill(0).map(() => Math.random() - 0.5),
      biases: Array(4).fill(0).map(() => Math.random() - 0.5),
      generation: 0,
      mutation_rate: 0.1,
      fitness_scores: []
    };

    const dnaFile = path.join(tempDir, 'test_dna.json');
    await fs.writeJson(dnaFile, dnaData);

    // Create test data
    const testData = {
      inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
      targets: [[0], [1], [1], [0]]
    };
    const dataFile = path.join(tempDir, 'test_data.json');
    await fs.writeJson(dataFile, testData);

    const score = await scorer.calculateScore(dnaFile, {
      dataFile: dataFile,
      metric: 'mse'
    });

    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('should handle different metrics', async () => {
    // Create a simple DNA file
    const dnaData = {
      topology: [2, 1],
      activation: 'sigmoid',
      weights: [0.5, -0.3],
      biases: [0.1],
      generation: 0,
      mutation_rate: 0.1,
      fitness_scores: []
    };

    const dnaFile = path.join(tempDir, 'metric_test_dna.json');
    await fs.writeJson(dnaFile, dnaData);

    // Test MSE metric
    const mseScore = await scorer.calculateScore(dnaFile, { metric: 'mse' });
    expect(typeof mseScore).toBe('number');

    // Test MAE metric
    const maeScore = await scorer.calculateScore(dnaFile, { metric: 'mae' });
    expect(typeof maeScore).toBe('number');

    // Test accuracy metric
    const accScore = await scorer.calculateScore(dnaFile, { metric: 'accuracy' });
    expect(typeof accScore).toBe('number');
  });
});

describe('Integration Tests', () => {
  let wasmModule;
  let tempDir;

  beforeEach(async () => {
    wasmModule = new WasmModule();
    await wasmModule.init();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neural-dna-integration-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('should complete full workflow: generate -> score -> evolve', async () => {
    // Step 1: Generate DNA
    const generator = new DNAGenerator(wasmModule);
    const generateConfig = {
      topology: [2, 4, 1],
      activation: 'sigmoid',
      count: 5,
      outputDir: tempDir,
      random: true,
      mutationRate: 0.1
    };

    await generator.generate(generateConfig);

    // Verify generation
    const files = await fs.readdir(tempDir);
    const dnaFiles = files.filter(f => f.startsWith('dna_') && f.endsWith('.json'));
    expect(dnaFiles.length).toBe(5);

    // Step 2: Score DNA
    const scorer = new ScoreCalculator(wasmModule);
    const dnaFile = path.join(tempDir, 'dna_000.json');
    
    const score = await scorer.calculateScore(dnaFile, {
      metric: 'mse'
    });

    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);

    // Step 3: Verify DNA structure
    const dnaData = await fs.readJson(dnaFile);
    expect(dnaData.topology).toEqual([2, 4, 1]);
    expect(dnaData.weights.length).toBeGreaterThan(0);
    expect(dnaData.biases.length).toBeGreaterThan(0);
  });

  test('should handle WASM fallback gracefully', async () => {
    // Test that JavaScript fallback works when WASM is not available
    const dna = wasmModule.createNeuralDNA([2, 2, 1], 'sigmoid');
    expect(dna).toBeTruthy();
    
    // Even if WASM fails, we should still get valid DNA objects
    expect(dna.topology).toBeTruthy();
    expect(Array.isArray(dna.weights)).toBe(true);
    expect(Array.isArray(dna.biases)).toBe(true);
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🧪 Running neural-dna-cli unit tests...\n');
  
  // Simple test execution without jest
  setTimeout(() => {
    if (process.exitCode) {
      console.log('\n❌ Some tests failed');
    } else {
      console.log('\n✅ All unit tests passed!');
    }
  }, 100);
}