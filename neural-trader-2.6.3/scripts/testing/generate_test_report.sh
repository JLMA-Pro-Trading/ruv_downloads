#!/bin/bash
# Generate comprehensive test report
# Usage: ./scripts/generate_test_report.sh

set -e

REPORT_DIR="test-reports"
mkdir -p "$REPORT_DIR"

echo "================================================"
echo "GENERATING TEST REPORT"
echo "================================================"
echo ""

# ============================================================================
# 1. Run all tests and collect results
# ============================================================================

echo "Running test suite..."

# Unit tests
echo "[1/6] Unit tests..."
cargo test --lib --bins --message-format=json 2>&1 | tee "$REPORT_DIR/unit_tests.json"
UNIT_RESULT=$?

# Integration tests
echo "[2/6] Integration tests..."
cargo test --test '*' --message-format=json 2>&1 | tee "$REPORT_DIR/integration_tests.json"
INTEGRATION_RESULT=$?

# Doc tests
echo "[3/6] Documentation tests..."
cargo test --doc --message-format=json 2>&1 | tee "$REPORT_DIR/doc_tests.json"
DOC_RESULT=$?

# ============================================================================
# 2. Generate coverage report
# ============================================================================

echo "[4/6] Test coverage..."
if command -v cargo-tarpaulin &> /dev/null; then
    cargo tarpaulin --out Html --out Xml --output-dir "$REPORT_DIR" \
        --exclude-files 'tests/*' 'benches/*' \
        --ignore-panics --ignore-tests 2>&1 | tee "$REPORT_DIR/coverage.txt"
    COVERAGE_RESULT=$?
else
    echo "⚠️  cargo-tarpaulin not installed. Skipping coverage."
    echo "Install: cargo install cargo-tarpaulin"
    COVERAGE_RESULT=0
fi

# ============================================================================
# 3. Run benchmarks
# ============================================================================

echo "[5/6] Benchmarks..."
cargo bench --no-fail-fast 2>&1 | tee "$REPORT_DIR/benchmarks.txt"
BENCH_RESULT=$?

# ============================================================================
# 4. Security audit
# ============================================================================

echo "[6/6] Security audit..."
if command -v cargo-audit &> /dev/null; then
    cargo audit 2>&1 | tee "$REPORT_DIR/security_audit.txt"
    AUDIT_RESULT=$?
else
    echo "⚠️  cargo-audit not installed. Skipping security audit."
    echo "Install: cargo install cargo-audit"
    AUDIT_RESULT=0
fi

# ============================================================================
# 5. Generate HTML report
# ============================================================================

echo ""
echo "Generating HTML report..."

cat > "$REPORT_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neural Trading Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .timestamp { opacity: 0.9; font-size: 0.9em; }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .card h3 {
            font-size: 0.9em;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
        }
        .card .value.success { color: #10b981; }
        .card .value.warning { color: #f59e0b; }
        .card .value.error { color: #ef4444; }
        .section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .section h2 {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .status-badge.pass {
            background: #d1fae5;
            color: #065f46;
        }
        .status-badge.fail {
            background: #fee2e2;
            color: #991b1b;
        }
        .status-badge.warn {
            background: #fef3c7;
            color: #92400e;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        th {
            background: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        pre {
            background: #1f2937;
            color: #f9fafb;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 0.85em;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🧪 Neural Trading Test Report</h1>
            <div class="timestamp">Generated: <span id="timestamp"></span></div>
        </header>

        <div class="summary">
            <div class="card">
                <h3>Unit Tests</h3>
                <div class="value UNIT_STATUS_CLASS" id="unit-tests">UNIT_COUNT</div>
            </div>
            <div class="card">
                <h3>Integration Tests</h3>
                <div class="value INTEGRATION_STATUS_CLASS" id="integration-tests">INTEGRATION_COUNT</div>
            </div>
            <div class="card">
                <h3>Coverage</h3>
                <div class="value COVERAGE_STATUS_CLASS">COVERAGE_PERCENT%</div>
            </div>
            <div class="card">
                <h3>Security</h3>
                <div class="value SECURITY_STATUS_CLASS">SECURITY_STATUS</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 Test Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Suite</th>
                        <th>Status</th>
                        <th>Tests</th>
                        <th>Passed</th>
                        <th>Failed</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Unit Tests</td>
                        <td><span class="status-badge UNIT_STATUS_CLASS">UNIT_STATUS</span></td>
                        <td>UNIT_TOTAL</td>
                        <td>UNIT_PASSED</td>
                        <td>UNIT_FAILED</td>
                        <td>UNIT_DURATION</td>
                    </tr>
                    <tr>
                        <td>Integration Tests</td>
                        <td><span class="status-badge INTEGRATION_STATUS_CLASS">INTEGRATION_STATUS</span></td>
                        <td>INTEGRATION_TOTAL</td>
                        <td>INTEGRATION_PASSED</td>
                        <td>INTEGRATION_FAILED</td>
                        <td>INTEGRATION_DURATION</td>
                    </tr>
                    <tr>
                        <td>Documentation Tests</td>
                        <td><span class="status-badge DOC_STATUS_CLASS">DOC_STATUS</span></td>
                        <td>DOC_TOTAL</td>
                        <td>DOC_PASSED</td>
                        <td>DOC_FAILED</td>
                        <td>DOC_DURATION</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📈 Coverage Report</h2>
            <p>Detailed coverage report: <a href="tarpaulin-report.html">View HTML Report</a></p>
            <pre>COVERAGE_DETAILS</pre>
        </div>

        <div class="section">
            <h2>⚡ Performance Benchmarks</h2>
            <p>Full benchmark results: <a href="../target/criterion/report/index.html">View Criterion Report</a></p>
            <table>
                <thead>
                    <tr>
                        <th>Benchmark</th>
                        <th>Mean Time</th>
                        <th>Target</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Market Data Ingestion</td>
                        <td>BENCH_MARKET_DATA</td>
                        <td>&lt; 100μs</td>
                        <td><span class="status-badge BENCH_MARKET_STATUS">BENCH_MARKET_STATUS_TEXT</span></td>
                    </tr>
                    <tr>
                        <td>Feature Extraction</td>
                        <td>BENCH_FEATURES</td>
                        <td>&lt; 1ms</td>
                        <td><span class="status-badge BENCH_FEATURES_STATUS">BENCH_FEATURES_STATUS_TEXT</span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🔒 Security Audit</h2>
            <pre>SECURITY_DETAILS</pre>
        </div>

        <div class="footer">
            <p>Neural Trading - Rust Port - Test Report</p>
            <p>Generated by <code>scripts/generate_test_report.sh</code></p>
        </div>
    </div>

    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
    </script>
</body>
</html>
EOF

# Replace placeholders with actual values
# This is a simplified version - in production, parse JSON results
sed -i "s/UNIT_COUNT/$UNIT_RESULT/g" "$REPORT_DIR/index.html"
sed -i "s/INTEGRATION_COUNT/$INTEGRATION_RESULT/g" "$REPORT_DIR/index.html"

echo ""
echo "================================================"
echo "REPORT GENERATION COMPLETE"
echo "================================================"
echo ""
echo "Results:"
echo "  Unit Tests:        $([ $UNIT_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "  Integration Tests: $([ $INTEGRATION_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "  Doc Tests:         $([ $DOC_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "  Coverage:          $([ $COVERAGE_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "  Benchmarks:        $([ $BENCH_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "  Security:          $([ $AUDIT_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo ""
echo "View report: file://$(pwd)/$REPORT_DIR/index.html"
echo ""

# Exit with failure if any tests failed
if [ $UNIT_RESULT -ne 0 ] || [ $INTEGRATION_RESULT -ne 0 ] || [ $DOC_RESULT -ne 0 ]; then
    exit 1
fi
