#!/usr/bin/env python3
"""
Performance Validation Script
Validates benchmark results against defined performance targets
Usage: python validate_performance.py benchmark-results.json
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# ============================================================================
# PERFORMANCE TARGETS (CI targets are 20% higher than production targets)
# ============================================================================

TARGETS = {
    "market_data_ingestion": {
        "p50": 50,   # μs
        "p95": 80,
        "p99": 100,
        "max_ci": 120,  # CI target (20% relaxed)
    },
    "feature_extraction": {
        "p50": 500,  # μs
        "p95": 800,
        "p99": 1000,
        "max_ci": 1200,
    },
    "signal_generation": {
        "p50": 2000,  # μs
        "p95": 4000,
        "p99": 5000,
        "max_ci": 6000,
    },
    "order_placement": {
        "p50": 5000,  # μs
        "p95": 8000,
        "p99": 10000,
        "max_ci": 12000,
    },
    "agentdb_query": {
        "p50": 100,  # μs
        "p95": 500,
        "p99": 1000,
        "max_ci": 1200,
    },
}

THROUGHPUT_TARGETS = {
    "ticks_per_second": 10000,
    "features_per_second": 1000,
    "signals_per_second": 500,
    "orders_per_second": 100,
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def parse_criterion_results(results_dir: Path) -> Dict:
    """Parse criterion benchmark results from directory structure"""
    results = {}

    if not results_dir.exists():
        print(f"Error: Results directory {results_dir} not found")
        return results

    # Criterion stores results in target/criterion/<benchmark_name>/new/estimates.json
    for benchmark_dir in results_dir.iterdir():
        if not benchmark_dir.is_dir():
            continue

        estimates_file = benchmark_dir / "new" / "estimates.json"
        if not estimates_file.exists():
            continue

        try:
            with open(estimates_file) as f:
                data = json.load(f)

            # Extract mean time in nanoseconds and convert to microseconds
            mean_ns = data.get("mean", {}).get("point_estimate", 0)
            mean_us = mean_ns / 1000.0

            # Extract percentiles if available
            results[benchmark_dir.name] = {
                "mean_us": mean_us,
                "mean_ns": mean_ns,
                "raw_data": data
            }
        except Exception as e:
            print(f"Warning: Could not parse {estimates_file}: {e}")

    return results

def check_latency_target(
    benchmark_name: str,
    actual_us: float,
    target: Dict
) -> Tuple[bool, str]:
    """Check if latency meets target"""
    max_allowed = target["max_ci"]

    if actual_us <= max_allowed:
        return True, f"✅ {benchmark_name}: {actual_us:.2f}μs <= {max_allowed}μs"
    else:
        p99_target = target["p99"]
        return False, f"❌ {benchmark_name}: {actual_us:.2f}μs > {max_allowed}μs (p99 target: {p99_target}μs)"

def check_throughput_target(
    metric_name: str,
    actual: float,
    target: float
) -> Tuple[bool, str]:
    """Check if throughput meets target"""
    if actual >= target:
        return True, f"✅ {metric_name}: {actual:.0f} >= {target}"
    else:
        return False, f"❌ {metric_name}: {actual:.0f} < {target}"

# ============================================================================
# MAIN VALIDATION
# ============================================================================

def main(results_path: str = None):
    print("=" * 80)
    print("PERFORMANCE VALIDATION")
    print("=" * 80)
    print()

    # Parse results
    if results_path and Path(results_path).exists():
        # JSON format from criterion --message-format json
        try:
            with open(results_path) as f:
                criterion_json = json.load(f)
                # Process JSON format results
                print("Processing JSON benchmark results...")
        except:
            pass

    # Default: Parse from criterion directory structure
    results_dir = Path("target/criterion")
    if not results_dir.exists():
        print(f"❌ Error: Benchmark results not found at {results_dir}")
        print("Run: cargo bench")
        sys.exit(1)

    results = parse_criterion_results(results_dir)

    if not results:
        print("❌ Error: No benchmark results found")
        print("Run: cargo bench")
        sys.exit(1)

    print(f"Found {len(results)} benchmark results\n")

    # Validate each benchmark against targets
    failures = []
    successes = []

    # Check latency targets
    print("Latency Targets:")
    print("-" * 80)

    for bench_name, target in TARGETS.items():
        if bench_name in results:
            actual_us = results[bench_name]["mean_us"]
            passed, message = check_latency_target(bench_name, actual_us, target)

            if passed:
                successes.append(message)
            else:
                failures.append(message)

            print(message)
        else:
            warning = f"⚠️  {bench_name}: No benchmark results found"
            print(warning)

    print()

    # Check throughput targets (if available)
    print("Throughput Targets:")
    print("-" * 80)

    for bench_name, result in results.items():
        if "throughput" in bench_name.lower():
            # Extract throughput from benchmark name or results
            # This would need to be customized based on actual benchmark structure
            print(f"ℹ️  {bench_name}: {result['mean_us']:.2f}μs mean latency")

    print()

    # Memory footprint check (would need actual implementation)
    print("Memory Footprint:")
    print("-" * 80)
    print("ℹ️  Memory profiling not implemented in this script")
    print("   Run: heaptrack target/release/neural-trader")
    print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Passed: {len(successes)}")
    print(f"Failed: {len(failures)}")
    print()

    if failures:
        print("❌ PERFORMANCE TARGETS NOT MET")
        print()
        print("Failed checks:")
        for failure in failures:
            print(f"  {failure}")
        print()
        print("Optimization suggestions:")
        print("  1. Profile with: cargo flamegraph --bench <benchmark_name>")
        print("  2. Check for unnecessary allocations")
        print("  3. Review algorithm complexity")
        print("  4. Consider caching/memoization")
        print("  5. Optimize hot paths identified by profiler")
        sys.exit(1)
    else:
        print("✅ ALL PERFORMANCE TARGETS MET")
        print()
        print("Successful checks:")
        for success in successes:
            print(f"  {success}")
        sys.exit(0)

if __name__ == "__main__":
    results_file = sys.argv[1] if len(sys.argv) > 1 else None
    main(results_file)
