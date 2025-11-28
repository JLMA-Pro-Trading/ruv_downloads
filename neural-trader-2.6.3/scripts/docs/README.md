# Neural Trader Build Scripts

This directory contains build automation scripts for creating NAPI binaries across multiple platforms.

## Quick Reference

| Script | Purpose | Platform |
|--------|---------|----------|
| `build-napi-all.sh` | Master build script | Linux (primary) |
| `build-napi-linux.sh` | Linux-specific build | Linux |
| `build-napi-macos.sh` | macOS-specific build | macOS |
| `build-napi-windows.ps1` | Windows-specific build | Windows |

## Usage

### Local Build (Current Platform)

```bash
# From project root
./scripts/build-napi-all.sh

# Platform-specific
./scripts/build-napi-linux.sh      # Linux only
./scripts/build-napi-macos.sh      # macOS only
./scripts/build-napi-windows.ps1   # Windows only (PowerShell)
```

### CI/CD Build (All Platforms)

```bash
# Automated via GitHub Actions
git push origin main

# Or trigger manually
gh workflow run build-napi.yml

# Create release
git tag v2.0.1
git push origin v2.0.1
```

## Build Outputs

Binaries are generated in `packages/*/native/`:

```
packages/
├── linux-x64-gnu/native/neural-trader.linux-x64-gnu.node
├── linux-arm64-gnu/native/neural-trader.linux-arm64-gnu.node
├── darwin-x64/native/neural-trader.darwin-x64.node
├── darwin-arm64/native/neural-trader.darwin-arm64.node
└── win32-x64-msvc/native/neural-trader.win32-x64-msvc.node
```

## Prerequisites

### All Platforms
- Rust >= 1.70.0 (from [rustup.rs](https://rustup.rs))
- Node.js >= 16.0.0
- npm >= 7.0.0

### Platform-Specific

**Linux:**
```bash
sudo apt-get install build-essential gcc g++
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Visual Studio Build Tools 2019+ with C++ workload

## Cross-Compilation

### Linux ARM64 (from x64)

```bash
# Install tools
sudo apt-get install gcc-aarch64-linux-gnu g++-aarch64-linux-gnu
rustup target add aarch64-unknown-linux-gnu
cargo install cross

# Build
cross build --release --target aarch64-unknown-linux-gnu
```

### macOS Universal Binary

```bash
cd neural-trader-rust/crates/napi-bindings
npm run universal
```

## Troubleshooting

### Build Fails with Compilation Errors

**Issue:** Rust compilation fails with missing crate errors.

**Solution:**
```bash
# Clean build cache
cargo clean

# Update dependencies
cargo update

# Rebuild
cargo build --release
```

### Binary Not Found

**Issue:** Built binary not found after successful build.

**Solution:**
```bash
# Check all targets
find neural-trader-rust/target -name "*.node" -type f

# Verify target triple
rustc --print target-list | grep $(uname -m)
```

### GitHub Actions Build Fails

**Issue:** CI/CD workflow fails on specific platform.

**Solution:**
1. Check workflow logs in Actions tab
2. Verify Cargo.toml dependencies
3. Test locally with platform-specific script
4. Check for platform-specific compilation flags

## Performance Tips

### Faster Local Builds

```bash
# Use sccache for caching
cargo install sccache
export RUSTC_WRAPPER=sccache

# Parallel compilation
export CARGO_BUILD_JOBS=8
```

### Smaller Binaries

```bash
# Strip debug symbols
cargo build --release
strip target/release/*.node

# Enable LTO in Cargo.toml:
# [profile.release]
# lto = true
# codegen-units = 1
```

## Current Build Status

⚠️ **Note:** The NAPI bindings currently have compilation errors that need to be fixed:

1. **Missing crates**: `nt_strategies`, `nt_execution` modules not found
2. **Borrow checker errors**: Temporary value lifetime issues
3. **Unused imports/variables**: 141 warnings to clean up

**Next Steps:**
1. Fix module dependencies in `/workspaces/neural-trader/neural-trader-rust/crates/napi-bindings/src/mcp_tools.rs`
2. Resolve borrow checker errors (lines 166, 369, 385)
3. Clean up unused imports and variables
4. Re-run build scripts after fixes

## GitHub Actions Workflow

The automated workflow (`.github/workflows/build-napi.yml`) provides:

✅ **Matrix builds** for all 5 platforms
✅ **Automated testing** on native platforms
✅ **Artifact storage** with 7-day retention
✅ **NPM publishing** on version tags
✅ **GitHub Releases** with checksums
✅ **Rust caching** for faster builds

### Workflow Triggers

- Push to `main`, `develop`, `rust-port` branches
- Pull requests to `main`
- Version tags (`v*`)
- Manual dispatch

## Documentation

For detailed build instructions, see:
- [BUILDING.md](/workspaces/neural-trader/neural-trader-rust/docs/BUILDING.md)
- [GitHub Actions Workflow](/.github/workflows/build-napi.yml)

## Support

- Issues: [GitHub Issues](https://github.com/ruvnet/neural-trader/issues)
- Discussions: [GitHub Discussions](https://github.com/ruvnet/neural-trader/discussions)
