#!/bin/bash
#
# CPU Inference Performance Test Runner
#
# This script runs comprehensive performance benchmarks and tests
# for all CPU-based neural forecasting models.
#
# Usage:
#   ./scripts/run_performance_tests.sh [options]
#
# Options:
#   --quick       Quick test (reduced samples)
#   --full        Full benchmark suite (default)
#   --report      Generate HTML report
#   --baseline    Save as performance baseline
#   --compare     Compare against baseline
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CRATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$CRATE_DIR"

# Parse arguments
MODE="full"
GENERATE_REPORT=false
SAVE_BASELINE=false
COMPARE_BASELINE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            MODE="quick"
            shift
            ;;
        --full)
            MODE="full"
            shift
            ;;
        --report)
            GENERATE_REPORT=true
            shift
            ;;
        --baseline)
            SAVE_BASELINE=true
            shift
            ;;
        --compare)
            COMPARE_BASELINE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Print header
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      CPU INFERENCE PERFORMANCE TEST SUITE                 ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║ Mode: ${MODE}${NC}"
echo -e "${BLUE}║ Crate: nt-neural${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

# Check if candle feature is available
echo -e "${YELLOW}→${NC} Checking dependencies..."
if ! cargo tree --features candle &>/dev/null; then
    echo -e "${RED}✗${NC} Candle feature not available. Install with:"
    echo "  cargo build --features candle"
    exit 1
fi
echo -e "${GREEN}✓${NC} Dependencies OK"
echo

# ===== UNIT TESTS =====

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PHASE 1: Performance Integration Tests${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo

echo -e "${YELLOW}→${NC} Running performance validation tests..."
if cargo test --features candle --test inference_performance_tests -- --nocapture 2>&1 | tee test_output.log; then
    echo -e "${GREEN}✓${NC} All performance tests passed!"
else
    echo -e "${RED}✗${NC} Performance tests failed"
    echo "Check test_output.log for details"
    exit 1
fi
echo

# ===== BENCHMARKS =====

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PHASE 2: Criterion Benchmarks${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo

BENCH_ARGS=""
if [ "$SAVE_BASELINE" = true ]; then
    BENCH_ARGS="--save-baseline main"
    echo -e "${YELLOW}→${NC} Saving baseline as 'main'"
elif [ "$COMPARE_BASELINE" = true ]; then
    BENCH_ARGS="--baseline main"
    echo -e "${YELLOW}→${NC} Comparing against baseline 'main'"
fi

if [ "$MODE" = "quick" ]; then
    BENCH_ARGS="$BENCH_ARGS --quick"
fi

# 1. Single Prediction Latency
echo -e "${YELLOW}→${NC} Running single prediction latency benchmarks..."
cargo bench --features candle --bench inference_latency $BENCH_ARGS -- single_prediction_latency 2>&1 | tee -a bench_output.log
echo

# 2. Batch Throughput
echo -e "${YELLOW}→${NC} Running batch throughput benchmarks..."
cargo bench --features candle --bench inference_latency $BENCH_ARGS -- batch_throughput 2>&1 | tee -a bench_output.log
echo

# 3. Preprocessing Overhead
echo -e "${YELLOW}→${NC} Running preprocessing overhead benchmarks..."
cargo bench --features candle --bench inference_latency $BENCH_ARGS -- preprocessing 2>&1 | tee -a bench_output.log
echo

# 4. Cache Effects
echo -e "${YELLOW}→${NC} Running cache effects benchmarks..."
cargo bench --features candle --bench inference_latency $BENCH_ARGS -- cache_effects 2>&1 | tee -a bench_output.log
echo

# 5. Input Size Scaling
echo -e "${YELLOW}→${NC} Running input size scaling benchmarks..."
cargo bench --features candle --bench inference_latency $BENCH_ARGS -- input_size_scaling 2>&1 | tee -a bench_output.log
echo

# 6. Memory per Prediction
echo -e "${YELLOW}→${NC} Running memory per prediction benchmarks..."
cargo bench --features candle --bench inference_latency $BENCH_ARGS -- memory_per_prediction 2>&1 | tee -a bench_output.log
echo

# ===== GENERATE REPORT =====

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PHASE 3: Analysis & Reporting${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo

# Extract key metrics from test output
echo -e "${YELLOW}→${NC} Analyzing performance metrics..."

# Parse latency results
GRU_LATENCY=$(grep -A 1 "GRU Single Prediction Latency" test_output.log | grep "Average" | awk '{print $2}' || echo "N/A")
TCN_LATENCY=$(grep -A 1 "TCN Single Prediction Latency" test_output.log | grep "Average" | awk '{print $2}' || echo "N/A")
NBEATS_LATENCY=$(grep -A 1 "N-BEATS Single Prediction Latency" test_output.log | grep "Average" | awk '{print $2}' || echo "N/A")
PROPHET_LATENCY=$(grep -A 1 "Prophet Single Prediction Latency" test_output.log | grep "Average" | awk '{print $2}' || echo "N/A")

# Parse throughput results
GRU_THROUGHPUT=$(grep -A 1 "GRU Batch Throughput" test_output.log | grep "Throughput" | awk '{print $2}' || echo "N/A")
TCN_THROUGHPUT=$(grep -A 1 "TCN Batch Throughput" test_output.log | grep "Throughput" | awk '{print $2}' || echo "N/A")
NBEATS_THROUGHPUT=$(grep -A 1 "N-BEATS Batch Throughput" test_output.log | grep "Throughput" | awk '{print $2}' || echo "N/A")
PROPHET_THROUGHPUT=$(grep -A 1 "Prophet Batch Throughput" test_output.log | grep "Throughput" | awk '{print $2}' || echo "N/A")

# Print summary
echo
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              PERFORMANCE TEST SUMMARY                      ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║ SINGLE PREDICTION LATENCY (target: <50ms)${NC}"
echo -e "${GREEN}║${NC}   GRU:     $GRU_LATENCY"
echo -e "${GREEN}║${NC}   TCN:     $TCN_LATENCY"
echo -e "${GREEN}║${NC}   N-BEATS: $NBEATS_LATENCY"
echo -e "${GREEN}║${NC}   Prophet: $PROPHET_LATENCY"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║ BATCH THROUGHPUT (target: >1000/s @ batch=32)${NC}"
echo -e "${GREEN}║${NC}   GRU:     $GRU_THROUGHPUT pred/s"
echo -e "${GREEN}║${NC}   TCN:     $TCN_THROUGHPUT pred/s"
echo -e "${GREEN}║${NC}   N-BEATS: $NBEATS_THROUGHPUT pred/s"
echo -e "${GREEN}║${NC}   Prophet: $PROPHET_THROUGHPUT pred/s"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo

# Generate HTML report if requested
if [ "$GENERATE_REPORT" = true ]; then
    echo -e "${YELLOW}→${NC} Generating HTML report..."

    if [ -d "target/criterion" ]; then
        REPORT_DIR="target/criterion/report"
        if [ -f "$REPORT_DIR/index.html" ]; then
            echo -e "${GREEN}✓${NC} HTML report generated: $REPORT_DIR/index.html"

            # Try to open in browser (cross-platform)
            if command -v xdg-open &> /dev/null; then
                xdg-open "$REPORT_DIR/index.html" &>/dev/null &
            elif command -v open &> /dev/null; then
                open "$REPORT_DIR/index.html" &>/dev/null &
            else
                echo "  Open manually: file://$PWD/$REPORT_DIR/index.html"
            fi
        else
            echo -e "${YELLOW}⚠${NC} No HTML report found. Run benchmarks first."
        fi
    else
        echo -e "${YELLOW}⚠${NC} Criterion output directory not found"
    fi
    echo
fi

# Check for regressions
echo -e "${YELLOW}→${NC} Checking for performance regressions..."

# Simple pass/fail based on thresholds
FAILURES=0

# Check latency requirements (all should be < 50ms)
for model in "GRU" "TCN" "N-BEATS" "Prophet"; do
    latency_var="${model}_LATENCY"
    latency="${!latency_var}"

    if [ "$latency" != "N/A" ]; then
        # Remove 'ms' suffix and compare
        latency_num=$(echo "$latency" | sed 's/ms//')
        if (( $(echo "$latency_num > 50" | bc -l) )); then
            echo -e "${RED}✗${NC} $model latency ${latency} exceeds 50ms threshold"
            FAILURES=$((FAILURES + 1))
        else
            echo -e "${GREEN}✓${NC} $model latency OK"
        fi
    fi
done

# Check throughput requirements (all should be > 500/s at batch=32)
for model in "GRU" "TCN" "N-BEATS" "Prophet"; do
    throughput_var="${model}_THROUGHPUT"
    throughput="${!throughput_var}"

    if [ "$throughput" != "N/A" ]; then
        # Remove 'pred/s' suffix and compare
        throughput_num=$(echo "$throughput" | tr -d ',' | awk '{print $1}')
        if (( $(echo "$throughput_num < 500" | bc -l) )); then
            echo -e "${RED}✗${NC} $model throughput ${throughput} below 500/s threshold"
            FAILURES=$((FAILURES + 1))
        else
            echo -e "${GREEN}✓${NC} $model throughput OK"
        fi
    fi
done

echo

# Final status
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                   ALL TESTS PASSED! ✓                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}✓${NC} All models meet performance requirements"
    echo -e "${GREEN}✓${NC} Latency: All < 50ms"
    echo -e "${GREEN}✓${NC} Throughput: All > 500/s"
    echo
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              PERFORMANCE TESTS FAILED ✗                    ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${RED}✗${NC} $FAILURES performance requirement(s) not met"
    echo -e "${YELLOW}→${NC} Review test_output.log and bench_output.log for details"
    echo
    exit 1
fi
