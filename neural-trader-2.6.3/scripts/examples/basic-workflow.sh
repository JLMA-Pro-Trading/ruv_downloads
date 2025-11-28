#!/bin/bash

###############################################################################
# E2B Swarm CLI - Basic Workflow Example
#
# This script demonstrates a complete workflow for deploying and managing
# a trading swarm using the E2B CLI.
###############################################################################

set -e  # Exit on error

CLI_PATH="../e2b-swarm-cli.js"
LOG_FILE="workflow-$(date +%Y%m%d-%H%M%S).log"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
  echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
  echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

###############################################################################
# 1. Environment Check
###############################################################################

log "Step 1: Checking environment..."

if [ ! -f "../../.env" ]; then
  error "Missing .env file. Please create one from .env.example"
  exit 1
fi

# Check required environment variables
source ../../.env
required_vars=("E2B_API_KEY" "E2B_ACCESS_TOKEN" "ALPACA_API_KEY" "ALPACA_SECRET_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  error "Missing required environment variables: ${missing_vars[*]}"
  exit 1
fi

success "Environment validated"

###############################################################################
# 2. Create Sandboxes
###############################################################################

log "Step 2: Creating sandboxes..."

SANDBOX_COUNT=3
TEMPLATE="trading-bot"
NAME_PREFIX="demo-swarm"

output=$(node "$CLI_PATH" create \
  --template "$TEMPLATE" \
  --count "$SANDBOX_COUNT" \
  --name "$NAME_PREFIX" \
  --json 2>&1) || {
  error "Failed to create sandboxes"
  exit 1
}

# Save sandbox info
echo "$output" > sandboxes.json
sandbox_count=$(echo "$output" | jq '.sandboxes | length')
success "Created $sandbox_count sandboxes"

# Display sandbox IDs
echo "$output" | jq -r '.sandboxes[] | "  - \(.id): \(.name)"'

sleep 2

###############################################################################
# 3. List Sandboxes
###############################################################################

log "Step 3: Listing all sandboxes..."

node "$CLI_PATH" list
sleep 1

###############################################################################
# 4. Deploy Agents
###############################################################################

log "Step 4: Deploying trading agents..."

# Deploy momentum trader
log "  Deploying momentum trader..."
node "$CLI_PATH" deploy \
  --agent momentum \
  --symbols AAPL,MSFT,GOOGL,NVDA \
  --json > agent-momentum.json

success "Momentum trader deployed"

sleep 1

# Deploy pairs trader
log "  Deploying pairs trader..."
node "$CLI_PATH" deploy \
  --agent pairs \
  --symbols AAPL,MSFT \
  --json > agent-pairs.json

success "Pairs trader deployed"

sleep 1

# Deploy neural forecaster
log "  Deploying neural forecaster..."
node "$CLI_PATH" deploy \
  --agent neural \
  --symbols TSLA,NVDA \
  --json > agent-neural.json

success "Neural forecaster deployed"

###############################################################################
# 5. List Deployed Agents
###############################################################################

log "Step 5: Listing deployed agents..."

node "$CLI_PATH" agents
sleep 1

###############################################################################
# 6. Check Swarm Health
###############################################################################

log "Step 6: Checking swarm health..."

node "$CLI_PATH" health --detailed
sleep 2

###############################################################################
# 7. Scale Swarm (Optional)
###############################################################################

log "Step 7: Scaling swarm to 5 sandboxes..."

node "$CLI_PATH" scale --count 5
sleep 2

node "$CLI_PATH" health
sleep 1

###############################################################################
# 8. Execute Strategies
###############################################################################

log "Step 8: Executing strategies..."

# Execute momentum strategy
log "  Executing momentum strategy..."
node "$CLI_PATH" execute \
  --strategy momentum \
  --symbols AAPL,MSFT,GOOGL \
  --json > execution-momentum.json

success "Momentum strategy started"

sleep 1

###############################################################################
# 9. Run Backtests
###############################################################################

log "Step 9: Running backtests..."

# Backtest momentum strategy
log "  Backtesting momentum strategy..."
node "$CLI_PATH" backtest \
  --strategy momentum \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --symbols AAPL,MSFT,GOOGL \
  --json > backtest-momentum.json

success "Momentum backtest complete"

# Display results
backtest_return=$(jq -r '.metrics.total_return' backtest-momentum.json)
sharpe_ratio=$(jq -r '.metrics.sharpe_ratio' backtest-momentum.json)
log "  Results: Return=$backtest_return, Sharpe=$sharpe_ratio"

sleep 1

# Backtest pairs strategy
log "  Backtesting pairs strategy..."
node "$CLI_PATH" backtest \
  --strategy pairs \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --symbols AAPL,MSFT \
  --json > backtest-pairs.json

success "Pairs backtest complete"

sleep 1

###############################################################################
# 10. Monitor Swarm (Optional - runs for 30 seconds)
###############################################################################

log "Step 10: Starting real-time monitoring (30 seconds)..."

timeout 30s node "$CLI_PATH" monitor --interval 5s || true

success "Monitoring complete"

###############################################################################
# Summary
###############################################################################

log "Workflow completed successfully!"

echo ""
echo "═════════════════════════════════════════════════════════════"
echo "                    WORKFLOW SUMMARY                          "
echo "═════════════════════════════════════════════════════════════"
echo ""
echo "Created Files:"
echo "  - sandboxes.json         : Sandbox information"
echo "  - agent-*.json           : Agent deployment details"
echo "  - execution-*.json       : Strategy execution status"
echo "  - backtest-*.json        : Backtest results"
echo "  - $LOG_FILE              : Full workflow log"
echo ""
echo "Next Steps:"
echo "  1. Monitor swarm: node $CLI_PATH monitor"
echo "  2. Check health: node $CLI_PATH health --detailed"
echo "  3. View logs: cat .swarm/cli.log"
echo ""
echo "Cleanup:"
echo "  - To destroy all sandboxes, run: ./cleanup-swarm.sh"
echo ""
echo "═════════════════════════════════════════════════════════════"
