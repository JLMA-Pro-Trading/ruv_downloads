# CI/CD Optimization Guide for AIMDS

**Purpose**: Provide production-ready CI/CD pipeline with optimal performance and comprehensive quality checks.

---

## Table of Contents

1. [Overview](#overview)
2. [GitHub Actions Workflows](#github-actions-workflows)
3. [Optimization Strategies](#optimization-strategies)
4. [Local Development Workflows](#local-development-workflows)
5. [Performance Metrics](#performance-metrics)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### Current State
- ❌ No CI/CD pipeline configured
- ❌ Manual testing required
- ❌ No automated quality checks
- ❌ No coverage reporting

### Target State
- ✅ Automated test execution (<10 minutes)
- ✅ Parallel job execution
- ✅ Code coverage reporting (target: 75%+)
- ✅ Benchmark regression detection
- ✅ Security scanning
- ✅ Automated release process

---

## GitHub Actions Workflows

### Main Workflow: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    # Run nightly at 2 AM UTC
    - cron: '0 2 * * *'

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1

jobs:
  # Job 1: Fast feedback - runs first
  check:
    name: Check & Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2
        with:
          cache-on-failure: true
          prefix-key: "v1-rust"

      - name: Check formatting
        run: cargo fmt --all -- --check

      - name: Run clippy
        run: cargo clippy --all-targets --all-features -- -D warnings

      - name: Check documentation
        run: cargo doc --no-deps --document-private-items
        env:
          RUSTDOCFLAGS: "-D warnings"

  # Job 2: Unit tests - fast, isolated
  test-unit:
    name: Unit Tests
    runs-on: ${{ matrix.os }}
    needs: check
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        rust: [stable, beta]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@master
        with:
          toolchain: ${{ matrix.rust }}

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2
        with:
          key: ${{ matrix.os }}-${{ matrix.rust }}

      - name: Run unit tests
        run: cargo test --lib --workspace --verbose
        env:
          RUST_LOG: debug

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.os }}-${{ matrix.rust }}
          path: target/debug/

  # Job 3: Integration tests - slower, comprehensive
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: test-unit
    timeout-minutes: 20
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2

      - name: Run integration tests
        run: |
          cargo test --workspace --test '*' --verbose

      - name: Run doc tests
        run: cargo test --doc --workspace

  # Job 4: Benchmarks - only on PRs and main
  benchmarks:
    name: Performance Benchmarks
    runs-on: ubuntu-latest
    needs: check
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    timeout-minutes: 30
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need history for baseline comparison

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2

      - name: Install criterion
        run: cargo install cargo-criterion

      - name: Run benchmarks
        run: cargo bench --workspace --no-fail-fast -- --save-baseline pr

      - name: Compare with main
        if: github.event_name == 'pull_request'
        run: |
          git checkout main
          cargo bench --workspace -- --save-baseline main
          git checkout -
          cargo criterion --baseline main --plotting-backend gnuplot

      - name: Archive benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: |
            target/criterion/
            target/criterion-baseline/

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            // Read benchmark summary and post to PR
            // Implementation details omitted for brevity

  # Job 5: Code coverage
  coverage:
    name: Code Coverage
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration]
    timeout-minutes: 20
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2

      - name: Install tarpaulin
        run: cargo install cargo-tarpaulin

      - name: Generate coverage
        run: |
          cargo tarpaulin \
            --workspace \
            --timeout 300 \
            --out xml \
            --output-dir coverage \
            --exclude-files 'target/*' 'benches/*' 'tests/*'

      - name: Upload to codecov
        uses: codecov/codecov-action@v4
        with:
          files: coverage/cobertura.xml
          fail_ci_if_error: true
          token: ${{ secrets.CODECOV_TOKEN }}

      - name: Archive coverage results
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

      - name: Check coverage threshold
        run: |
          COVERAGE=$(grep -oP 'line-rate="\K[0-9.]+' coverage/cobertura.xml | head -1)
          THRESHOLD=0.75
          if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
            echo "Coverage $COVERAGE is below threshold $THRESHOLD"
            exit 1
          fi

  # Job 6: Security audit
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    needs: check
    timeout-minutes: 10
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Install cargo-audit
        run: cargo install cargo-audit

      - name: Run security audit
        run: cargo audit --deny warnings

      - name: Install cargo-deny
        run: cargo install cargo-deny

      - name: Run cargo-deny
        run: cargo deny check

  # Job 7: WASM build verification
  wasm:
    name: WASM Build
    runs-on: ubuntu-latest
    needs: check
    timeout-minutes: 15
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2

      - name: Install wasm-pack
        run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

      - name: Build WASM
        run: |
          for crate in crates/aimds-*; do
            cd $crate
            wasm-pack build --target web
            cd ../..
          done

      - name: Test WASM
        run: wasm-pack test --node crates/aimds-core

  # Job 8: Release build (on tags)
  release:
    name: Release Build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [test-unit, test-integration, coverage, security]
    timeout-minutes: 30
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2

      - name: Build release binaries
        run: cargo build --release --workspace

      - name: Run release tests
        run: cargo test --release --workspace

      - name: Create release archive
        run: |
          mkdir -p release
          cp target/release/aimds-* release/
          tar czf aimds-${{ github.ref_name }}.tar.gz release/

      - name: Create GitHub release
        uses: softprops/action-gh-release@v1
        with:
          files: aimds-${{ github.ref_name }}.tar.gz
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # Job 9: Publish to crates.io (manual trigger)
  publish:
    name: Publish to crates.io
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    needs: release
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Publish crates
        run: |
          cargo publish --package aimds-core --token ${{ secrets.CARGO_TOKEN }}
          sleep 30
          cargo publish --package aimds-detection --token ${{ secrets.CARGO_TOKEN }}
          sleep 30
          cargo publish --package aimds-analysis --token ${{ secrets.CARGO_TOKEN }}
          sleep 30
          cargo publish --package aimds-response --token ${{ secrets.CARGO_TOKEN }}
```

---

## Optimization Strategies

### 1. Dependency Caching

**Strategy**: Use `Swatinem/rust-cache@v2` for intelligent caching.

**Benefits**:
- ✅ ~80% faster CI runs (after first run)
- ✅ Automatic cache invalidation on Cargo.toml changes
- ✅ Shared cache across jobs

**Configuration**:
```yaml
- uses: Swatinem/rust-cache@v2
  with:
    cache-on-failure: true      # Cache even if job fails
    prefix-key: "v1-rust"       # Version cache key
    key: ${{ matrix.os }}       # Per-OS caching
    workspaces: |               # Multiple workspace support
      ./AIMDS
      ./crates/*
```

### 2. Job Parallelization

**Strategy**: Run independent jobs in parallel.

```
Timeline (Sequential):
├─ Check (5min)
├─ Unit Tests (10min)
├─ Integration Tests (15min)
├─ Coverage (10min)
└─ Total: 40 minutes

Timeline (Parallel):
├─ Check (5min)
├── Unit Tests (10min) ─┐
├── Benchmarks (20min)  ├─ All parallel after check
├── Security (5min)     │
└── Coverage (10min) ───┘
Total: 25 minutes (40% faster)
```

### 3. Matrix Strategy

**Run tests across multiple configurations**:
```yaml
strategy:
  fail-fast: false  # Don't cancel other jobs on failure
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    rust: [stable, beta]
    # 6 total combinations (3 OS × 2 Rust versions)
```

### 4. Conditional Execution

**Skip expensive jobs when not needed**:
```yaml
# Only run benchmarks on PRs and main branch
if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'

# Only run release on tags
if: startsWith(github.ref, 'refs/tags/v')
```

### 5. Incremental Compilation

**Enable in CI for faster rebuilds**:
```yaml
env:
  CARGO_INCREMENTAL: 1  # Enable incremental compilation
  CARGO_NET_RETRY: 10   # Retry network failures
  RUSTFLAGS: "-C debuginfo=0"  # Skip debug info for faster builds
```

### 6. Artifact Sharing

**Share build artifacts between jobs**:
```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: target/debug/
    retention-days: 1  # Only keep for 1 day

# In dependent job:
- name: Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: build-artifacts
```

---

## Local Development Workflows

### Pre-commit Checklist

```bash
#!/bin/bash
# save as: .git/hooks/pre-commit (chmod +x)

echo "🔍 Running pre-commit checks..."

# 1. Format check (< 1 second)
echo "Checking formatting..."
cargo fmt --all -- --check || {
    echo "❌ Format check failed. Run: cargo fmt --all"
    exit 1
}

# 2. Clippy (< 10 seconds with cache)
echo "Running clippy..."
cargo clippy --all-targets --all-features -- -D warnings || {
    echo "❌ Clippy failed"
    exit 1
}

# 3. Fast unit tests (< 30 seconds)
echo "Running unit tests..."
cargo test --lib --workspace || {
    echo "❌ Unit tests failed"
    exit 1
}

echo "✅ Pre-commit checks passed!"
```

### Fast Feedback Loop

```bash
# 1. Quick check (< 5 seconds)
cargo check --workspace

# 2. Single crate test (< 10 seconds)
cargo test --package aimds-detection --lib

# 3. Full unit tests (< 30 seconds)
cargo test --workspace --lib

# 4. Integration tests (< 2 minutes)
cargo test --workspace --test '*'

# 5. Full validation (< 5 minutes)
cargo test --workspace && cargo clippy --all-targets
```

### Makefile for Common Tasks

```makefile
# AIMDS/Makefile

.PHONY: check test bench coverage clean

# Quick check
check:
	@echo "🔍 Running quick checks..."
	cargo check --workspace
	cargo fmt --all -- --check
	cargo clippy --workspace -- -D warnings

# Run tests
test:
	@echo "🧪 Running tests..."
	cargo test --workspace --lib

test-integration:
	@echo "🧪 Running integration tests..."
	cargo test --workspace --test '*'

test-all: test test-integration

# Run benchmarks
bench:
	@echo "📊 Running benchmarks..."
	cargo bench --workspace

# Generate coverage
coverage:
	@echo "📈 Generating coverage report..."
	cargo tarpaulin --workspace --out html --output-dir coverage

# Watch mode (requires cargo-watch)
watch:
	@echo "👀 Starting watch mode..."
	cargo watch -x "test --lib --workspace"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	cargo clean
	rm -rf coverage/

# Full CI simulation
ci: check test-all coverage
	@echo "✅ All CI checks passed!"

# Install development tools
install-tools:
	@echo "🔧 Installing development tools..."
	cargo install cargo-watch
	cargo install cargo-tarpaulin
	cargo install cargo-audit
	cargo install cargo-criterion
```

**Usage**:
```bash
make check          # Fast pre-commit check
make test           # Unit tests only
make test-all       # All tests
make watch          # Auto-run tests on file change
make ci             # Full CI simulation
```

---

## Performance Metrics

### Target CI Times

| Job | Target Time | Acceptable Range | Notes |
|-----|-------------|------------------|-------|
| Check & Lint | 2-3 min | < 5 min | First job, no deps |
| Unit Tests | 5-8 min | < 10 min | Parallel across 6 configs |
| Integration Tests | 10-15 min | < 20 min | Sequential dependencies |
| Benchmarks | 15-20 min | < 30 min | Only on PRs/main |
| Coverage | 8-12 min | < 20 min | Depends on unit+integration |
| Security | 2-5 min | < 10 min | Parallel with others |
| **Total Pipeline** | **20-30 min** | **< 45 min** | Main branch |

### Caching Effectiveness

**First Run** (cold cache):
```
Compilation: 15-20 minutes
Testing: 5-10 minutes
Total: 20-30 minutes
```

**Subsequent Runs** (warm cache):
```
Compilation: 2-3 minutes (85% faster)
Testing: 5-10 minutes (same)
Total: 7-13 minutes (60% faster)
```

### Resource Usage

**GitHub Actions Free Tier**:
- 2,000 minutes/month (free public repos)
- 3,000 minutes/month (free private repos)

**Estimated Monthly Usage**:
```
Average PR: 30 minutes × 3 jobs = 90 minutes
Daily commits: 10 pushes × 30 min = 300 min/day
Monthly: ~6,000 minutes
```

**Cost Optimization**:
- ✅ Skip benchmarks on non-PR pushes (save 20 min)
- ✅ Use self-hosted runners for heavy jobs
- ✅ Run nightly jobs on schedule, not every push

---

## Troubleshooting

### Common Issues

#### 1. Cache Misses

**Symptom**: CI always rebuilds from scratch
**Solution**:
```yaml
- uses: Swatinem/rust-cache@v2
  with:
    cache-on-failure: true
    # Ensure unique key per matrix config
    key: ${{ runner.os }}-${{ matrix.rust }}
```

#### 2. Flaky Tests

**Symptom**: Tests pass locally but fail in CI
**Common Causes**:
- Timing-dependent tests
- Uninitialized state
- Parallel test interference

**Solution**:
```rust
// Add timeout to prevent hangs
#[tokio::test(flavor = "multi_thread")]
async fn test_with_timeout() {
    tokio::time::timeout(
        Duration::from_secs(5),
        async { /* test logic */ }
    ).await.unwrap();
}

// Run tests sequentially if needed
cargo test -- --test-threads=1
```

#### 3. Out of Memory

**Symptom**: CI job killed due to OOM
**Solution**:
```yaml
# Reduce parallel compilation
env:
  CARGO_BUILD_JOBS: 2  # Limit to 2 cores

# Or use larger runner
runs-on: ubuntu-latest-8-cores  # GitHub hosted
```

#### 4. Benchmark Noise

**Symptom**: Benchmark results vary significantly
**Solution**:
```yaml
# Pin to specific CPU
- name: Setup CPU affinity
  run: |
    sudo cpupower frequency-set -g performance
    cargo bench -- --noplot
```

---

## Appendix: Additional Workflows

### A. Dependency Update Workflow

```yaml
# .github/workflows/dependencies.yml
name: Update Dependencies

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo update
      - run: cargo test --workspace
      - uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore: Update dependencies'
          branch: deps/auto-update
```

### B. Nightly Test Workflow

```yaml
# .github/workflows/nightly.yml
name: Nightly Tests

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

jobs:
  test-nightly:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@nightly
      - run: cargo test --workspace
      - run: cargo bench --workspace -- --test  # Compile benchmarks
```

---

## Summary

### Implementation Checklist

- [ ] Create `.github/workflows/test.yml`
- [ ] Configure repository secrets (CARGO_TOKEN, CODECOV_TOKEN)
- [ ] Add Makefile for local development
- [ ] Create pre-commit hook
- [ ] Set up branch protection rules
- [ ] Configure status checks
- [ ] Add CI badge to README
- [ ] Document CI/CD process in CONTRIBUTING.md

### Expected Results

After implementation:
- ✅ Automated testing on every push/PR
- ✅ 20-30 minute pipeline (vs manual testing)
- ✅ 75%+ code coverage with enforcement
- ✅ Benchmark regression detection
- ✅ Security vulnerability scanning
- ✅ Multi-platform validation (Linux, macOS, Windows)

### Estimated Effort

- **Initial Setup**: 4-6 hours
- **Testing & Refinement**: 2-3 hours
- **Documentation**: 1-2 hours
- **Total**: ~8-11 hours

**ROI**: High - Catches bugs early, prevents regressions, enables confident refactoring.
