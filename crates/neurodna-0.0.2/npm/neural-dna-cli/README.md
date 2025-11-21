# neural-dna-cli

A powerful command-line interface for evolutionary neural networks with genetic encoding and WASM acceleration.

## 🧬 Features

- **Genetic Neural Networks**: Evolve neural networks using genetic algorithms
- **WASM Acceleration**: High-performance WASM bindings for fast computation
- **Multiple Commands**: Train, spawn, score, and analyze neural DNA
- **Flexible Topologies**: Support for any network architecture
- **Mutation Strategies**: Advanced mutation policies for genetic evolution
- **Docker Support**: Containerized testing and deployment
- **NPX Ready**: Run directly with `npx neural-dna-cli`

## 🚀 Quick Start

### NPX (Recommended)

```bash
# Train a neural network
npx neural-dna-cli train -p 100 -g 50 -t "4,8,4,2" -o best_dna.json

# Generate random DNA
npx neural-dna-cli spawn -t "2,4,1" -c 5 --random

# Score existing DNA
npx neural-dna-cli score my_dna.json --metric mse
```

### Global Installation

```bash
npm install -g neural-dna-cli

neural-dna train -p 50 -g 25 -t "3,6,3" 
neural-dna spawn -t "2,3,1" -c 10
neural-dna score dna.json --data training_data.json
```

## 📋 Commands

### `train` - Train Neural DNA

Evolve a population of neural networks using genetic algorithms.

```bash
neural-dna train [options]

Options:
  -p, --population <size>     Population size (default: 100)
  -g, --generations <count>   Number of generations (default: 50)
  -e, --elite <count>         Elite count (default: 10)
  -m, --mutation-rate <rate>  Mutation rate (default: 0.1)
  -t, --topology <topology>   Network topology "2,4,1" (default: "2,4,1")
  -a, --activation <function> Activation function (default: "sigmoid")
  -o, --output <file>         Output file for best DNA (default: "best_dna.json")
  --data <file>               Training data file (JSON)
  --parallel                  Use parallel processing
```

**Example:**
```bash
neural-dna train -p 200 -g 100 -t "4,8,4,2" -a sigmoid -o champion.json --data xor.json
```

### `spawn` - Generate Neural DNA

Create new neural DNA instances with specified topologies.

```bash
neural-dna spawn [options]

Options:
  -t, --topology <topology>    Network topology "2,4,1" (default: "2,4,1")
  -a, --activation <function>  Activation function (default: "sigmoid")
  -c, --count <number>         Number of DNA to generate (default: 1)
  -o, --output <directory>     Output directory (default: "./dna")
  -r, --random                 Generate random DNA
  --mutation-rate <rate>       Mutation rate (default: 0.1)
```

**Example:**
```bash
neural-dna spawn -t "3,6,3" -c 20 --random -o ./generated_dna/
```

### `score` - Calculate Fitness Score

Evaluate the fitness of neural DNA against test data.

```bash
neural-dna score <dna-file> [options]

Arguments:
  dna-file                     DNA file to score

Options:
  --data <file>                Test data file (JSON)
  --metric <metric>            Scoring metric: mse, mae, accuracy, r2 (default: "mse")
  -o, --output <file>          Output score file
```

**Example:**
```bash
neural-dna score champion.json --data test_data.json --metric accuracy
```

### `evolve` - Evolve Existing DNA

Create offspring from parent DNA through crossover and mutation.

```bash
neural-dna evolve <parent-files...> [options]

Arguments:
  parent-files                 Parent DNA files

Options:
  -g, --generations <count>    Number of generations (default: 10)
  -m, --mutation-rate <rate>   Mutation rate (default: 0.1)
  -o, --output <file>          Output file (default: "evolved_dna.json")
  --crossover-rate <rate>      Crossover rate (default: 0.7)
```

### `analyze` - Analyze Neural DNA

Examine the structure and characteristics of neural DNA.

```bash
neural-dna analyze <dna-file> [options]

Arguments:
  dna-file                     DNA file to analyze

Options:
  --verbose                    Verbose output
  --visualization              Generate visualization
```

### `benchmark` - Performance Benchmarking

Run performance benchmarks to test system capabilities.

```bash
neural-dna benchmark [options]

Options:
  -t, --topology <topology>    Network topology (default: "2,4,1")
  -p, --population <size>      Population size (default: 100)
  -g, --generations <count>    Generations to run (default: 10)
  --wasm-only                  Test WASM performance only
```

## 📊 Data Formats

### Training Data Format

Training data should be provided as JSON with `inputs` and `targets` arrays:

```json
{
  "inputs": [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1]
  ],
  "targets": [
    [0],
    [1],
    [1],
    [0]
  ]
}
```

### DNA Format

Neural DNA is stored as JSON with the following structure:

```json
{
  "topology": [2, 4, 1],
  "activation": "sigmoid",
  "weights": [0.1, -0.2, 0.3, ...],
  "biases": [0.1, -0.1, 0.05],
  "generation": 42,
  "mutation_rate": 0.1,
  "fitness_scores": [0.85, 0.87, 0.89]
}
```

## 🔧 Configuration

### Activation Functions

Supported activation functions:
- `sigmoid` - Sigmoid function (default)
- `tanh` - Hyperbolic tangent
- `relu` - Rectified Linear Unit
- `leaky_relu` - Leaky ReLU
- `linear` - Linear/Identity function

### Mutation Strategies

The CLI supports various mutation strategies:
- **Weight Mutation**: Modify connection weights
- **Bias Mutation**: Adjust neuron biases  
- **Topology Mutation**: Change network structure
- **Activation Mutation**: Switch activation functions
- **All**: Apply all mutation types

## 🐳 Docker Usage

### Build and Test in Docker

```bash
# Build the Docker image
docker build -t neural-dna-cli .

# Run tests in Docker
docker run --rm neural-dna-cli

# Interactive shell
docker run --rm -it neural-dna-cli /bin/sh

# Run specific command
docker run --rm -v $(pwd):/workspace neural-dna-cli spawn -t "2,3,1" -c 5
```

### Production Container

```bash
# Build production image
docker build --target production -t neural-dna-cli:prod .

# Use as global command
docker run --rm -v $(pwd):/workspace neural-dna-cli:prod train -p 50 -g 25
```

## 🧪 Testing

### Local Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run integration tests  
npm run test:integration

# Run all tests
npm run test:local
```

### Docker Testing

```bash
# Test in Docker environment
npm run test:docker

# Build and test WASM
npm run build:wasm
npm run test
```

## ⚡ Performance

The CLI includes WASM acceleration for high-performance computing:

- **WASM Enabled**: ~4x faster evolution and training
- **JavaScript Fallback**: Compatible when WASM unavailable
- **Parallel Processing**: Multi-core support for large populations
- **Memory Efficient**: Optimized for large-scale evolution

## 🔬 Examples

### XOR Problem

```bash
# Create XOR training data
echo '{"inputs":[[0,0],[0,1],[1,0],[1,1]],"targets":[[0],[1],[1],[0]]}' > xor.json

# Train XOR solver
neural-dna train -p 100 -g 50 -t "2,4,1" --data xor.json -o xor_solution.json

# Score the solution
neural-dna score xor_solution.json --data xor.json --metric accuracy
```

### Regression Problem

```bash
# Generate random DNA for regression
neural-dna spawn -t "3,8,4,1" -c 50 --random -o regression_population/

# Score all candidates
for dna in regression_population/*.json; do
  neural-dna score "$dna" --data regression_data.json --metric r2
done
```

### Evolution Experiment

```bash
# Create initial population
neural-dna spawn -t "4,8,4,2" -c 10 --random -o generation_0/

# Evolve best performers
neural-dna evolve generation_0/dna_000.json generation_0/dna_001.json \
  -g 20 -m 0.15 -o evolved_champion.json
```

## 🛠️ Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/ruvnet/ruv-FANN.git
cd ruv-FANN/npm/neural-dna-cli

# Install dependencies
npm install

# Build WASM module
npm run build:wasm

# Build TypeScript
npm run build

# Test locally
npm run test:local
```

### WASM Development

The WASM module is built from the Rust `neural_dna` crate:

```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM module
cd ../../neural_dna
wasm-pack build --target bundler --out-dir ../npm/neural-dna-cli/wasm

# Test WASM integration
cd ../npm/neural-dna-cli
npm run test
```

## 📈 Roadmap

- [ ] **GPU Acceleration**: CUDA/OpenCL support for massive parallelization
- [ ] **Neural Architecture Search**: Automated topology optimization
- [ ] **Distributed Training**: Multi-node evolution clusters
- [ ] **Visualization Tools**: Real-time evolution monitoring
- [ ] **Model Export**: ONNX and TensorFlow format support
- [ ] **Cloud Integration**: AWS/GCP training pipelines

## 🤝 Contributing

Contributions are welcome! Please check the [main repository](https://github.com/ruvnet/ruv-FANN) for contribution guidelines.

## 📄 License

MIT License - see the [LICENSE](https://github.com/ruvnet/ruv-FANN/blob/main/LICENSE) file for details.

## 🔗 Links

- **Main Repository**: https://github.com/ruvnet/ruv-FANN
- **Documentation**: https://github.com/ruvnet/ruv-FANN/tree/main/neural_dna
- **Issues**: https://github.com/ruvnet/ruv-FANN/issues
- **NPM Package**: https://www.npmjs.com/package/neural-dna-cli

---

Built with ❤️ using Rust, WASM, and TypeScript. Part of the ruv-FANN neural network library.