#!/bin/bash

# ReasoningBank Learning Dashboard Validation Script
# Tests all dashboard functionality and generates sample outputs

set -e

echo "════════════════════════════════════════════════════════════"
echo "  ReasoningBank Learning Dashboard - Validation Script"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_command() {
    local description=$1
    local command=$2

    echo -n "${BLUE}Testing:${NC} $description... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${YELLOW}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# 1. Check files exist
echo "${YELLOW}1. Checking file structure...${NC}"
echo ""

test_command "Learning dashboard exists" "[ -f src/reasoningbank/learning-dashboard.js ]"
test_command "Dashboard CLI exists" "[ -f src/reasoningbank/dashboard-cli.js ]"
test_command "Demo generator exists" "[ -f src/reasoningbank/demo-data-generator.js ]"
test_command "Interactive demo exists" "[ -f examples/reasoningbank-dashboard-demo.js ]"
test_command "CLI integration exists" "grep -q 'learning' scripts/e2b-swarm-cli.js"

echo ""

# 2. Generate demo data
echo "${YELLOW}2. Generating demo data...${NC}"
echo ""

test_command "Demo data generation" "node src/reasoningbank/demo-data-generator.js docs/reasoningbank/demo-data.json"
test_command "Demo data file created" "[ -f docs/reasoningbank/demo-data.json ]"
test_command "Demo data is valid JSON" "node -e \"JSON.parse(require('fs').readFileSync('docs/reasoningbank/demo-data.json', 'utf8'))\""

echo ""

# 3. Test CLI commands
echo "${YELLOW}3. Testing CLI commands...${NC}"
echo ""

test_command "Stats command" "node scripts/e2b-swarm-cli.js learning stats -s docs/reasoningbank/demo-data.json"
test_command "Analytics command" "node scripts/e2b-swarm-cli.js learning analytics -s docs/reasoningbank/demo-data.json"
test_command "Export command" "node scripts/e2b-swarm-cli.js learning export -s docs/reasoningbank/demo-data.json -o /tmp/test-export.json"
test_command "Report generation (markdown)" "node scripts/e2b-swarm-cli.js learning report --format markdown -s docs/reasoningbank/demo-data.json -o /tmp/test-report.md"
test_command "Report generation (json)" "node scripts/e2b-swarm-cli.js learning report --format json -s docs/reasoningbank/demo-data.json -o /tmp/test-report.json"

echo ""

# 4. Test programmatic API
echo "${YELLOW}4. Testing programmatic API...${NC}"
echo ""

cat > /tmp/test-dashboard-api.js << 'EOF'
const { LearningDashboard, ASCIIChart } = require('./src/reasoningbank/learning-dashboard');
const fs = require('fs');

async function test() {
    try {
        // Test dashboard creation
        const dashboard = new LearningDashboard();

        // Load demo data
        const data = JSON.parse(fs.readFileSync('docs/reasoningbank/demo-data.json', 'utf8'));
        dashboard.updateMetrics(data);

        // Test visualizations
        await dashboard.displayLearningCurve();
        await dashboard.displayDecisionQuality();
        await dashboard.displayPatternGrowth();

        // Test analytics
        await dashboard.predictConvergence();
        await dashboard.identifyBottlenecks();
        await dashboard.recommendOptimizations();

        // Test exports
        await dashboard.exportHTML('/tmp/test-dashboard.html');
        await dashboard.exportMarkdown('/tmp/test-dashboard.md');
        await dashboard.exportJSON('/tmp/test-dashboard.json');

        console.log('API tests passed');
        process.exit(0);
    } catch (error) {
        console.error('API tests failed:', error.message);
        process.exit(1);
    }
}

test();
EOF

test_command "Dashboard API" "node /tmp/test-dashboard-api.js"
test_command "HTML export created" "[ -f /tmp/test-dashboard.html ]"
test_command "Markdown export created" "[ -f /tmp/test-dashboard.md ]"
test_command "JSON export created" "[ -f /tmp/test-dashboard.json ]"

echo ""

# 5. Test ASCII charts
echo "${YELLOW}5. Testing ASCII chart types...${NC}"
echo ""

cat > /tmp/test-ascii-charts.js << 'EOF'
const { ASCIIChart } = require('./src/reasoningbank/learning-dashboard');

try {
    // Test line chart
    const lineData = Array.from({length: 20}, (_, i) => ({label: i, value: Math.random()}));
    ASCIIChart.lineChart(lineData, {title: 'Line Chart'});

    // Test bar chart
    const barData = [{label: 'A', value: 0.8}, {label: 'B', value: 0.6}];
    ASCIIChart.barChart(barData, {title: 'Bar Chart'});

    // Test heatmap
    const heatmapData = [[0.8, 0.6], [0.5, 0.9]];
    ASCIIChart.heatmap(heatmapData, {title: 'Heatmap'});

    // Test scatter
    const scatterData = Array.from({length: 20}, () => ({x: Math.random(), y: Math.random()}));
    ASCIIChart.scatterPlot(scatterData, {title: 'Scatter'});

    console.log('ASCII chart tests passed');
    process.exit(0);
} catch (error) {
    console.error('ASCII chart tests failed:', error.message);
    process.exit(1);
}
EOF

test_command "Line chart" "node /tmp/test-ascii-charts.js"

echo ""

# 6. Verify documentation
echo "${YELLOW}6. Verifying documentation...${NC}"
echo ""

test_command "README exists" "[ -f docs/reasoningbank/README.md ]"
test_command "Quick Start exists" "[ -f docs/reasoningbank/QUICK_START.md ]"
test_command "Complete Guide exists" "[ -f docs/reasoningbank/LEARNING_DASHBOARD_GUIDE.md ]"
test_command "Implementation Summary exists" "[ -f docs/reasoningbank/IMPLEMENTATION_SUMMARY.md ]"

echo ""

# 7. Check generated outputs
echo "${YELLOW}7. Validating generated outputs...${NC}"
echo ""

test_command "HTML contains Chart.js" "grep -q 'chart.js' /tmp/test-dashboard.html"
test_command "HTML contains title" "grep -q 'ReasoningBank' /tmp/test-dashboard.html"
test_command "Markdown contains charts" "grep -q 'Learning Curve' /tmp/test-dashboard.md"
test_command "JSON contains metadata" "node -e \"const d = JSON.parse(require('fs').readFileSync('/tmp/test-dashboard.json', 'utf8')); if (!d.timestamp) process.exit(1)\""

echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo "                    Validation Summary"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Tests Passed:${NC} $TESTS_PASSED"
echo -e "${YELLOW}Tests Failed:${NC} $TESTS_FAILED"
echo -e "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validation tests passed!${NC}"
    echo ""
    echo "Generated test files:"
    echo "  - /tmp/test-dashboard.html (HTML dashboard)"
    echo "  - /tmp/test-dashboard.md (Markdown report)"
    echo "  - /tmp/test-dashboard.json (JSON export)"
    echo "  - docs/reasoningbank/demo-data.json (Demo data)"
    echo ""
    echo "Next steps:"
    echo "  1. View HTML dashboard: open /tmp/test-dashboard.html"
    echo "  2. Read quick start: cat docs/reasoningbank/QUICK_START.md"
    echo "  3. Run interactive demo: node examples/reasoningbank-dashboard-demo.js"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
