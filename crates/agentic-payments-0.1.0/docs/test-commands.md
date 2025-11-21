# ACP Test Suite - Quick Reference Commands

## Running Tests

### All Tests (Full Suite)
```bash
cargo test --all-features
```

### ACP Tests Only
```bash
cargo test --features acp
```

### Specific Test File
```bash
cargo test --test acp_integration_test --features acp
```

### Specific Test Function
```bash
cargo test test_checkout_session_creation --features acp
```

### With Output
```bash
cargo test --features acp -- --nocapture
```

### Single-threaded (for debugging)
```bash
cargo test --features acp -- --test-threads=1
```

## WASM Tests

### Browser Tests (Chrome)
```bash
wasm-pack test --headless --chrome --features acp-wasm
```

### Browser Tests (Firefox)
```bash
wasm-pack test --headless --firefox --features acp-wasm
```

### Node.js Tests
```bash
wasm-pack test --node --features acp-wasm
```

### Build WASM Package
```bash
wasm-pack build --target web --features acp-wasm
wasm-pack build --target nodejs --features acp-wasm
wasm-pack build --target bundler --features acp-wasm
```

## Performance Benchmarks

### Run All Benchmarks
```bash
cargo bench --features acp
```

### Specific Benchmark
```bash
cargo bench --bench acp_benchmark --features acp
```

### Save Baseline
```bash
cargo bench --features acp -- --save-baseline initial
```

### Compare to Baseline
```bash
cargo bench --features acp -- --baseline initial
```

## Code Coverage

### Generate Coverage Report (HTML)
```bash
cargo tarpaulin --out Html --all-features
```

### Coverage to Terminal
```bash
cargo tarpaulin --all-features
```

### Coverage with XML (for CI)
```bash
cargo tarpaulin --out Xml --all-features
```

### Coverage for Specific Package
```bash
cargo tarpaulin --packages agentic-payments --all-features
```

## Test Organization

### Count Tests
```bash
# Count all test functions
grep -r "#\[test\]" tests/ | wc -l
grep -r "#\[tokio::test\]" tests/ | wc -l
grep -r "#\[wasm_bindgen_test\]" tests/ | wc -l

# Count by file
grep -c "fn test_" tests/acp_integration_test.rs
```

### List All Tests
```bash
cargo test --features acp -- --list
```

### Test Summary
```bash
cargo test --features acp 2>&1 | grep "test result:"
```

## Debugging Tests

### Run with Debug Output
```bash
RUST_LOG=debug cargo test --features acp -- --nocapture
```

### Run Specific Test with Backtraces
```bash
RUST_BACKTRACE=1 cargo test test_checkout_session_creation --features acp
```

### Show Ignored Tests
```bash
cargo test --features acp -- --ignored
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run tests
  run: cargo test --all-features

- name: Run WASM tests
  run: |
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    wasm-pack test --headless --chrome --features acp-wasm

- name: Generate coverage
  run: |
    cargo install tarpaulin
    cargo tarpaulin --out Xml --all-features

- name: Run benchmarks
  run: cargo bench --features acp
```

## Quick Validation

### Fast Check (no tests)
```bash
cargo check --all-features
```

### Build Only
```bash
cargo build --all-features
```

### Format Check
```bash
cargo fmt -- --check
```

### Clippy Lints
```bash
cargo clippy --all-features -- -D warnings
```

## Performance Testing

### Memory Usage
```bash
cargo test --features acp --release
```

### Profile Tests
```bash
cargo test --features acp --profile profiling
```

### Benchmark Comparison
```bash
# Baseline
cargo bench --features acp -- --save-baseline main

# After changes
git checkout feature-branch
cargo bench --features acp -- --baseline main
```

## Useful Combinations

### Full CI Pipeline Locally
```bash
cargo fmt -- --check && \
cargo clippy --all-features -- -D warnings && \
cargo test --all-features && \
cargo bench --features acp && \
wasm-pack test --headless --chrome --features acp-wasm
```

### Quick Development Loop
```bash
cargo test --features acp -- --nocapture && \
cargo clippy --all-features
```

### Coverage + Report
```bash
cargo tarpaulin --out Html --all-features && \
xdg-open tarpaulin-report.html  # Linux
open tarpaulin-report.html       # macOS
```

## Test Categories

### Integration Tests Only
```bash
cargo test --test acp_integration_test --features acp
```

### Unit Tests Only (in lib)
```bash
cargo test --lib --features acp
```

### Doc Tests
```bash
cargo test --doc --features acp
```

## Environment Variables

### Adjust Test Timeout
```bash
RUST_TEST_TIME_INTEGRATION=60000 cargo test --features acp
```

### Parallel Test Execution
```bash
RUST_TEST_THREADS=8 cargo test --features acp
```

### Disable Parallel (for debugging)
```bash
RUST_TEST_THREADS=1 cargo test --features acp
```

## Troubleshooting

### Clear Target Directory
```bash
cargo clean
cargo test --all-features
```

### Update Dependencies
```bash
cargo update
cargo test --all-features
```

### Check for Unused Dependencies
```bash
cargo install cargo-udeps
cargo +nightly udeps --all-features
```

### Test Specific Features
```bash
cargo test --no-default-features --features acp
cargo test --no-default-features --features wasm
```

## Expected Results

After running `cargo test --features acp`, you should see:
- ✅ 227+ tests passing
- ✅ All integration tests pass
- ✅ All unit tests pass
- ✅ No test failures
- ✅ Execution time: <30 seconds

After running `wasm-pack test --headless --chrome --features acp-wasm`:
- ✅ 10 WASM tests passing
- ✅ Browser compatibility verified
- ✅ No WASM-specific errors

After running `cargo bench --features acp`:
- ✅ Checkout creation: <1ms
- ✅ Protocol detection: <0.05ms
- ✅ HMAC signing: <0.1ms
- ✅ Throughput: >5,000 ops/sec

---

**Quick Start**: `cargo test --all-features`
**WASM Check**: `wasm-pack test --node --features acp-wasm`
**Benchmarks**: `cargo bench --features acp`