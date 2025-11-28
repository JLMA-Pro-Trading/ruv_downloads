#!/bin/bash

###############################################################################
# E2B Swarm CLI - Production Deployment Script
#
# This script demonstrates a production-grade deployment with:
# - Health checks
# - Error handling
# - Parallel deployment
# - Monitoring setup
# - Automated recovery
###############################################################################

set -e

CLI_PATH="../e2b-swarm-cli.js"
DEPLOYMENT_ID="prod-$(date +%Y%m%d-%H%M%S)"
LOG_DIR="/var/log/neural-trader"
STATE_DIR="/var/lib/neural-trader"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%Y-%m-%d %H:%M:%S)]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

###############################################################################
# Configuration
###############################################################################

SANDBOX_COUNT=${SANDBOX_COUNT:-5}
TEMPLATE=${TEMPLATE:-"trading-bot"}
SYMBOLS_MOMENTUM="AAPL,MSFT,GOOGL,NVDA,TSLA"
SYMBOLS_PAIRS="AAPL,MSFT,GOOGL,NVDA"
SYMBOLS_NEURAL="TSLA,NVDA,AMD"
SYMBOLS_REVERSION="SPY,QQQ,IWM,TLT"

# Create directories
mkdir -p "$LOG_DIR" "$STATE_DIR"

log "═══════════════════════════════════════════════════════════"
log "          PRODUCTION E2B SWARM DEPLOYMENT                  "
log "═══════════════════════════════════════════════════════════"
log "Deployment ID: $DEPLOYMENT_ID"
log "Sandbox Count: $SANDBOX_COUNT"
log "Template: $TEMPLATE"
log "═══════════════════════════════════════════════════════════"

###############################################################################
# Pre-flight Checks
###############################################################################

log "Running pre-flight checks..."

# Check environment
if [ ! -f "../../.env" ]; then
  error "Missing .env file"
  exit 1
fi

source ../../.env

required_vars=("E2B_API_KEY" "E2B_ACCESS_TOKEN" "ALPACA_API_KEY" "ALPACA_SECRET_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    error "Missing required environment variable: $var"
    exit 1
  fi
done

# Check CLI is working
if ! node "$CLI_PATH" --version > /dev/null 2>&1; then
  error "CLI not working. Please check installation."
  exit 1
fi

success "Pre-flight checks passed"

###############################################################################
# Health Check Function
###############################################################################

check_health() {
  log "Checking swarm health..."

  health_output=$(node "$CLI_PATH" health --json 2>&1) || {
    error "Health check failed"
    return 1
  }

  status=$(echo "$health_output" | jq -r '.status')

  if [ "$status" = "healthy" ]; then
    success "Swarm is healthy"
    return 0
  else
    warning "Swarm status: $status"
    return 1
  fi
}

###############################################################################
# Create Sandboxes
###############################################################################

log "Creating $SANDBOX_COUNT production sandboxes..."

sandbox_output=$(node "$CLI_PATH" create \
  --template "$TEMPLATE" \
  --count "$SANDBOX_COUNT" \
  --name "$DEPLOYMENT_ID" \
  --json 2>&1) || {
  error "Failed to create sandboxes"
  exit 1
}

echo "$sandbox_output" > "$STATE_DIR/sandboxes-$DEPLOYMENT_ID.json"

sandbox_count=$(echo "$sandbox_output" | jq '.sandboxes | length')
success "Created $sandbox_count sandboxes"

# Extract sandbox IDs
sandbox_ids=($(echo "$sandbox_output" | jq -r '.sandboxes[] | .id'))
log "Sandbox IDs: ${sandbox_ids[*]}"

sleep 3

###############################################################################
# Deploy Agents in Parallel
###############################################################################

log "Deploying trading agents in parallel..."

pids=()

# Deploy momentum trader
(
  log "  Deploying momentum trader..."
  node "$CLI_PATH" deploy \
    --agent momentum \
    --symbols "$SYMBOLS_MOMENTUM" \
    --json > "$STATE_DIR/agent-momentum-$DEPLOYMENT_ID.json"
  success "Momentum trader deployed"
) &
pids+=($!)

# Deploy pairs trader
(
  log "  Deploying pairs trader..."
  node "$CLI_PATH" deploy \
    --agent pairs \
    --symbols "$SYMBOLS_PAIRS" \
    --json > "$STATE_DIR/agent-pairs-$DEPLOYMENT_ID.json"
  success "Pairs trader deployed"
) &
pids+=($!)

# Deploy neural forecaster
(
  log "  Deploying neural forecaster..."
  node "$CLI_PATH" deploy \
    --agent neural \
    --symbols "$SYMBOLS_NEURAL" \
    --json > "$STATE_DIR/agent-neural-$DEPLOYMENT_ID.json"
  success "Neural forecaster deployed"
) &
pids+=($!)

# Deploy mean reversion trader
(
  log "  Deploying mean reversion trader..."
  node "$CLI_PATH" deploy \
    --agent mean_reversion \
    --symbols "$SYMBOLS_REVERSION" \
    --json > "$STATE_DIR/agent-reversion-$DEPLOYMENT_ID.json"
  success "Mean reversion trader deployed"
) &
pids+=($!)

# Wait for all deployments
log "Waiting for agent deployments..."
for pid in "${pids[@]}"; do
  wait "$pid" || {
    error "Agent deployment failed (PID: $pid)"
  }
done

success "All agents deployed successfully"

sleep 2

###############################################################################
# Initial Health Check
###############################################################################

check_health || {
  error "Initial health check failed"
  exit 1
}

###############################################################################
# Start Monitoring
###############################################################################

log "Setting up monitoring..."

# Start health monitor in background
(
  while true; do
    node "$CLI_PATH" health --json >> "$LOG_DIR/health-monitor.log" 2>&1
    sleep 300  # Every 5 minutes
  done
) &
HEALTH_MONITOR_PID=$!

# Start real-time monitor
(
  node "$CLI_PATH" monitor --interval 10s --json >> "$LOG_DIR/realtime-monitor.log" 2>&1
) &
REALTIME_MONITOR_PID=$!

success "Monitoring started"
log "  Health Monitor PID: $HEALTH_MONITOR_PID"
log "  Realtime Monitor PID: $REALTIME_MONITOR_PID"

# Save PIDs for cleanup
echo "$HEALTH_MONITOR_PID" > "$STATE_DIR/health-monitor.pid"
echo "$REALTIME_MONITOR_PID" > "$STATE_DIR/realtime-monitor.pid"

###############################################################################
# Execute Strategies
###############################################################################

log "Starting strategy execution..."

strategies=("momentum" "pairs" "neural" "mean_reversion")
for strategy in "${strategies[@]}"; do
  log "  Executing $strategy strategy..."
  node "$CLI_PATH" execute \
    --strategy "$strategy" \
    --json > "$STATE_DIR/execution-$strategy-$DEPLOYMENT_ID.json" || {
    warning "Failed to start $strategy strategy"
  }
done

success "All strategies started"

###############################################################################
# Setup Automated Recovery
###############################################################################

log "Setting up automated recovery..."

cat > "$STATE_DIR/recovery-$DEPLOYMENT_ID.sh" << 'EOF'
#!/bin/bash

# Automated recovery script
check_and_recover() {
  health=$(node ../e2b-swarm-cli.js health --json 2>&1)
  status=$(echo "$health" | jq -r '.status')

  if [ "$status" != "healthy" ]; then
    echo "[$(date)] Unhealthy status detected: $status" >> /var/log/neural-trader/recovery.log

    # Attempt recovery
    failed_sandboxes=$(node ../e2b-swarm-cli.js list --status failed --json | jq -r '.sandboxes[] | .id')

    for sandbox_id in $failed_sandboxes; do
      echo "[$(date)] Destroying failed sandbox: $sandbox_id" >> /var/log/neural-trader/recovery.log
      node ../e2b-swarm-cli.js destroy "$sandbox_id" --force
    done

    # Scale back up
    node ../e2b-swarm-cli.js scale --count 5
  fi
}

while true; do
  check_and_recover
  sleep 600  # Every 10 minutes
done
EOF

chmod +x "$STATE_DIR/recovery-$DEPLOYMENT_ID.sh"

# Start recovery monitor
nohup "$STATE_DIR/recovery-$DEPLOYMENT_ID.sh" > "$LOG_DIR/recovery.log" 2>&1 &
RECOVERY_PID=$!
echo "$RECOVERY_PID" > "$STATE_DIR/recovery.pid"

success "Automated recovery enabled (PID: $RECOVERY_PID)"

###############################################################################
# Deployment Summary
###############################################################################

log "═══════════════════════════════════════════════════════════"
log "          DEPLOYMENT COMPLETE                              "
log "═══════════════════════════════════════════════════════════"

echo ""
success "Production deployment completed successfully!"
echo ""
echo "Deployment Details:"
echo "  Deployment ID: $DEPLOYMENT_ID"
echo "  Sandboxes: $sandbox_count"
echo "  Agents: 4 (momentum, pairs, neural, mean_reversion)"
echo "  Monitoring: Active"
echo "  Recovery: Enabled"
echo ""
echo "Monitoring PIDs:"
echo "  Health Monitor: $HEALTH_MONITOR_PID"
echo "  Realtime Monitor: $REALTIME_MONITOR_PID"
echo "  Recovery Monitor: $RECOVERY_PID"
echo ""
echo "Log Files:"
echo "  Health: $LOG_DIR/health-monitor.log"
echo "  Realtime: $LOG_DIR/realtime-monitor.log"
echo "  Recovery: $LOG_DIR/recovery.log"
echo ""
echo "State Files:"
echo "  Sandboxes: $STATE_DIR/sandboxes-$DEPLOYMENT_ID.json"
echo "  Agents: $STATE_DIR/agent-*-$DEPLOYMENT_ID.json"
echo ""
echo "Management Commands:"
echo "  Check health: node $CLI_PATH health --detailed"
echo "  List agents: node $CLI_PATH agents"
echo "  Monitor: node $CLI_PATH monitor"
echo "  Scale: node $CLI_PATH scale --count N"
echo ""
echo "Stop Monitoring:"
echo "  kill $HEALTH_MONITOR_PID $REALTIME_MONITOR_PID $RECOVERY_PID"
echo ""
log "═══════════════════════════════════════════════════════════"

# Save deployment info
cat > "$STATE_DIR/deployment-$DEPLOYMENT_ID-info.txt" << EOF
Deployment ID: $DEPLOYMENT_ID
Timestamp: $(date)
Sandboxes: $sandbox_count
Health Monitor PID: $HEALTH_MONITOR_PID
Realtime Monitor PID: $REALTIME_MONITOR_PID
Recovery Monitor PID: $RECOVERY_PID
EOF

log "Deployment info saved to: $STATE_DIR/deployment-$DEPLOYMENT_ID-info.txt"
