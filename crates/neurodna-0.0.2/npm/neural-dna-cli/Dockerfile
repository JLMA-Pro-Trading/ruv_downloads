# Multi-stage Docker build for neural-dna-cli testing

# Stage 1: Build stage with Rust and WASM tools
FROM rust:1.75-alpine AS builder

# Install system dependencies
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    curl \
    nodejs \
    npm \
    git

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Set working directory
WORKDIR /app

# Copy Rust project
COPY ../../../neural_dna /app/neural_dna

# Build WASM module
WORKDIR /app/neural_dna
RUN wasm-pack build --target bundler --release

# Stage 2: Node.js build stage
FROM node:18-alpine AS node-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY bin/ ./bin/

# Copy WASM build from previous stage
COPY --from=builder /app/neural_dna/pkg ./wasm/

# Build TypeScript
RUN npm run build

# Stage 3: Test stage
FROM node:18-alpine AS test-stage

# Install testing dependencies
RUN apk add --no-cache \
    bash \
    curl \
    jq

WORKDIR /app

# Copy built application
COPY --from=node-builder /app .

# Install global CLI for testing
RUN npm install -g .

# Copy test files
COPY test/ ./test/

# Create test data directory
RUN mkdir -p test-data examples

# Create sample test data
RUN echo '{"inputs": [[0,0],[0,1],[1,0],[1,1]], "targets": [[0],[1],[1],[0]]}' > test-data/xor.json

# Set executable permissions
RUN chmod +x bin/neural-dna.js

# Health check script
COPY docker-healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD /usr/local/bin/healthcheck.sh

# Default command runs all tests
CMD ["npm", "test"]

# Stage 4: Production stage
FROM node:18-alpine AS production

# Install only production dependencies
RUN apk add --no-cache bash

WORKDIR /app

# Copy only necessary files for production
COPY --from=node-builder /app/lib ./lib/
COPY --from=node-builder /app/bin ./bin/
COPY --from=node-builder /app/wasm ./wasm/
COPY --from=node-builder /app/package.json ./
COPY --from=node-builder /app/node_modules ./node_modules/

# Install globally
RUN npm install -g .

# Create working directory for user files
WORKDIR /workspace

# Default entry point
ENTRYPOINT ["neural-dna"]
CMD ["--help"]