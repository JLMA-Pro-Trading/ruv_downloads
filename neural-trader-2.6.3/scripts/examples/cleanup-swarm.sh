#!/bin/bash

###############################################################################
# E2B Swarm CLI - Cleanup Script
#
# Safely destroys all sandboxes and stops monitoring processes
###############################################################################

CLI_PATH="../e2b-swarm-cli.js"
STATE_DIR="/var/lib/neural-trader"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date +%H:%M:%S)] $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

warning "This will destroy ALL sandboxes and stop monitoring!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  log "Cleanup cancelled"
  exit 0
fi

###############################################################################
# Stop Monitoring Processes
###############################################################################

log "Stopping monitoring processes..."

# Stop from PID files
if [ -f "$STATE_DIR/health-monitor.pid" ]; then
  pid=$(cat "$STATE_DIR/health-monitor.pid")
  if kill "$pid" 2>/dev/null; then
    success "Stopped health monitor (PID: $pid)"
  fi
  rm -f "$STATE_DIR/health-monitor.pid"
fi

if [ -f "$STATE_DIR/realtime-monitor.pid" ]; then
  pid=$(cat "$STATE_DIR/realtime-monitor.pid")
  if kill "$pid" 2>/dev/null; then
    success "Stopped realtime monitor (PID: $pid)"
  fi
  rm -f "$STATE_DIR/realtime-monitor.pid"
fi

if [ -f "$STATE_DIR/recovery.pid" ]; then
  pid=$(cat "$STATE_DIR/recovery.pid")
  if kill "$pid" 2>/dev/null; then
    success "Stopped recovery monitor (PID: $pid)"
  fi
  rm -f "$STATE_DIR/recovery.pid"
fi

###############################################################################
# List Sandboxes
###############################################################################

log "Listing sandboxes to destroy..."

sandbox_output=$(node "$CLI_PATH" list --json 2>&1) || {
  error "Failed to list sandboxes"
  exit 1
}

sandbox_ids=($(echo "$sandbox_output" | jq -r '.sandboxes[] | .id'))
total=${#sandbox_ids[@]}

if [ $total -eq 0 ]; then
  success "No sandboxes to destroy"
  exit 0
fi

log "Found $total sandbox(es) to destroy"

###############################################################################
# Destroy Sandboxes
###############################################################################

log "Destroying sandboxes..."

count=0
for sandbox_id in "${sandbox_ids[@]}"; do
  count=$((count + 1))
  log "  [$count/$total] Destroying $sandbox_id..."

  if node "$CLI_PATH" destroy "$sandbox_id" --force 2>&1 | grep -q "success"; then
    success "Destroyed $sandbox_id"
  else
    warning "Failed to destroy $sandbox_id"
  fi

  sleep 1
done

###############################################################################
# Clean State Files
###############################################################################

log "Cleaning state files..."

if [ -d ".swarm" ]; then
  rm -f .swarm/cli-state.json
  success "Cleaned CLI state"
fi

if [ -d "$STATE_DIR" ]; then
  rm -f "$STATE_DIR"/*.json
  rm -f "$STATE_DIR"/*.sh
  success "Cleaned state directory"
fi

###############################################################################
# Summary
###############################################################################

success "Cleanup complete!"

echo ""
echo "Summary:"
echo "  Sandboxes destroyed: $count"
echo "  Monitoring stopped: Yes"
echo "  State cleaned: Yes"
echo ""
