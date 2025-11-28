#!/bin/bash

# Start Perpetual Neural Trading System
# Usage: ./start_perpetual_trader.sh [strategy] [symbol] [mode]

echo "════════════════════════════════════════════════════════"
echo "    NEURAL PERPETUAL TRADING SYSTEM"
echo "════════════════════════════════════════════════════════"

# Default values
STRATEGY=${1:-momentum}  # momentum, mean_reversion, breakout, scalping
SYMBOL=${2:-BTC/USD}
MODE=${3:-paper}  # paper or live

echo "Configuration:"
echo "  Strategy: $STRATEGY"
echo "  Symbol: $SYMBOL"
echo "  Mode: $MODE"
echo "════════════════════════════════════════════════════════"

# Check Python environment
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found!"
    exit 1
fi

# Install required packages if needed
echo "🔧 Checking dependencies..."
pip3 install -q alpaca-py pandas numpy scipy 2>/dev/null

# Create monitoring script
cat > /tmp/monitor_trader.py << 'EOF'
import time
import os
import signal

def monitor():
    print("\n📊 TRADING MONITOR ACTIVE")
    print("Commands:")
    print("  [q] - Quit trading")
    print("  [s] - Show stats")
    print("  [p] - Pause trading")
    print("  [r] - Resume trading")
    print("-" * 40)

    while True:
        try:
            cmd = input().lower()
            if cmd == 'q':
                print("⏹️ Stopping trader...")
                os.killpg(os.getpgid(trader_pid), signal.SIGTERM)
                break
            elif cmd == 's':
                print("📈 Fetching stats...")
            elif cmd == 'p':
                print("⏸️ Pausing...")
            elif cmd == 'r':
                print("▶️ Resuming...")
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    monitor()
EOF

# Start the trader
echo "🚀 Starting perpetual trader..."
python3 /workspaces/neural-trader/src/strategies/perpetual_neural_trader.py &
TRADER_PID=$!

# Monitor process
echo "Trading system PID: $TRADER_PID"
echo "Press Ctrl+C to stop"

# Wait for trader to finish
wait $TRADER_PID

echo "✅ Trading system stopped"