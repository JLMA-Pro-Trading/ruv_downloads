# AIMDS Test Infrastructure Quick Reference

**Last Updated**: 2025-10-29

---

## 🚨 Critical Blocker

**Issue**: `panic` configuration error in `/workspaces/midstream/AIMDS/Cargo.toml`

**Fix Required** (Line 96):
```toml
# ❌ REMOVE from [profile.release.package."*"]
panic = "abort"

# ✅ ADD to [profile.release] instead
[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
strip = true
panic = "abort"  # Move here
```

**Impact**: Blocks ALL test execution across workspace.

---

## 📊 Current State

| Metric | Current | Target |
|--------|---------|--------|
| Test Files | 8 | - |
| Total Tests | 35 | 100+ |
| Benchmark Suites | 4 | 6 |
| Source LOC | 4,822 | - |
| Test LOC | 745 (15.4%) | 3,600+ (75%) |
| Test Execution | ❌ Blocked | ✅ < 30s |
| CI/CD | ❌ None | ✅ < 10min |

---

## 🎯 Priority Actions

### 🔴 P0 - Immediate (Hours)
1. Fix Cargo.toml `panic` configuration
2. Validate tests run: `cargo test --workspace --lib`

### 🟡 P1 - High (Week 1)
3. Create `aimds-test-utils` shared crate
4. Add cross-crate integration tests
5. Consolidate workspace dev-dependencies

### 🟢 P2 - Medium (Week 2)
6. Implement CI/CD pipeline (GitHub Actions)
7. Add code coverage reporting (target: 75%)
8. Create E2E benchmark suite

---

## 🧪 Test Organization

```
aimds-detection (11 tests)
├─ Pattern matching
├─ PII detection
├─ Concurrent operations
└─ Performance (<100ms)

aimds-analysis (12 tests)
├─ Behavioral analysis (<100ms)
├─ Policy verification (<500ms)
├─ LTL temporal logic
└─ Threat level calculation

aimds-response (12 tests)
├─ Mitigation execution (<100ms)
├─ Meta-learning (25 iterations)
├─ Strategy optimization
└─ Concurrent operations (5 parallel)

Benchmarks (19 total)
├─ detection_bench (5 scenarios)
├─ analysis_bench (4 scenarios)
├─ meta_learning_bench (4 scenarios)
└─ mitigation_bench (6 scenarios)
```

---

## ⚡ Quick Commands

### Fix & Validate
```bash
# 1. Fix Cargo.toml (manual edit required)
# 2. Run tests
cd /workspaces/midstream/AIMDS
cargo test --workspace --lib
```

### Local Development
```bash
# Fast check (< 5s)
cargo check --workspace

# Unit tests (< 30s after fix)
cargo test --workspace --lib

# Integration tests (< 2min)
cargo test --workspace --test '*'

# Benchmarks (< 5min)
cargo bench --workspace

# Coverage (requires tarpaulin)
cargo tarpaulin --workspace --out html
```

### CI/CD Setup
```bash
# Create workflow file
mkdir -p .github/workflows
# Copy from CI_CD_OPTIMIZATION_GUIDE.md

# Add Makefile
make check       # Quick validation
make test-all    # Full tests
make ci          # CI simulation
```

---

## 🔧 Shared Test Utils

**Once created**, use these patterns:

```rust
use aimds_test_utils::prelude::*;

#[tokio::test]
async fn test_detection() {
    // Builder pattern
    let threat = threat()
        .severity(8)
        .confidence(0.95)
        .build();

    // Performance assertion
    let result = assert_fast!(
        service.detect(&input).await.unwrap(),
        100  // max 100ms
    );

    // Threat assertion
    assert_threat_detected(&result);
}
```

---

## 📈 Expected Improvements

| Area | Before | After | Gain |
|------|--------|-------|------|
| Test Duplication | ~25% | 0% | -187 LOC |
| Test Execution | ❌ Blocked | ✅ 15-20s | ∞ |
| CI Pipeline | ❌ None | ✅ 20-30min | ∞ |
| Coverage | 15.4% | 75%+ | +388% |
| Flaky Tests | Unknown | 0% | 100% |

---

## 📚 Documentation

Detailed guides:
- **Full Analysis**: [TEST_INFRASTRUCTURE_ANALYSIS.md](./TEST_INFRASTRUCTURE_ANALYSIS.md)
- **Shared Utils**: [SHARED_TEST_INFRASTRUCTURE_DESIGN.md](./SHARED_TEST_INFRASTRUCTURE_DESIGN.md)
- **CI/CD**: [CI_CD_OPTIMIZATION_GUIDE.md](./CI_CD_OPTIMIZATION_GUIDE.md)

---

## ✅ Success Metrics

After implementation:
- ✅ All 35 tests pass consistently
- ✅ Test execution < 30 seconds
- ✅ CI pipeline < 10 minutes
- ✅ Code coverage > 75%
- ✅ Zero flaky tests
- ✅ Parallel test execution
- ✅ Automated quality gates

---

## 🚀 Next Steps

1. **Today**: Fix Cargo.toml, validate tests run
2. **Week 1**: Implement shared test utils
3. **Week 2**: Add CI/CD pipeline
4. **Week 3**: Achieve 75% coverage target

**Total Effort**: ~40 hours over 3 weeks
**ROI**: High - prevents regressions, enables confident development
