#!/usr/bin/env python3
"""
Startup script for real-time news-driven trading system
Runs as a background process with proper daemon management
"""

import os
import sys
import asyncio
import argparse
import signal
import logging
from datetime import datetime
from pathlib import Path
import psutil
import json
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src'))

from trading.real_time_trader import RealTimeTrader

# Load environment
load_dotenv()

# Configure logging
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / f"trader_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Global trader instance
trader = None
pid_file = Path("real_time_trader.pid")
status_file = Path("trader_status.json")


def save_pid():
    """Save process ID to file"""
    with open(pid_file, 'w') as f:
        f.write(str(os.getpid()))
    logger.info(f"📝 PID saved to {pid_file}")


def cleanup_pid():
    """Remove PID file"""
    if pid_file.exists():
        pid_file.unlink()
        logger.info("🗑️ PID file removed")


def update_status(status: str, message: str = ""):
    """Update trader status file"""
    status_data = {
        'status': status,
        'message': message,
        'timestamp': datetime.now().isoformat(),
        'pid': os.getpid()
    }
    
    with open(status_file, 'w') as f:
        json.dump(status_data, f, indent=2)


async def signal_handler(signum, frame):
    """Handle shutdown signals"""
    global trader
    
    logger.info(f"🛑 Received signal {signum}, shutting down...")
    update_status("stopping", "Shutdown signal received")
    
    if trader:
        await trader.shutdown()
    
    cleanup_pid()
    update_status("stopped", "Graceful shutdown completed")
    sys.exit(0)


def check_existing_process():
    """Check if trading process is already running"""
    if not pid_file.exists():
        return False
    
    try:
        with open(pid_file, 'r') as f:
            pid = int(f.read().strip())
        
        # Check if process exists
        if psutil.pid_exists(pid):
            proc = psutil.Process(pid)
            if 'python' in proc.name().lower() and 'trading' in ' '.join(proc.cmdline()):
                logger.warning(f"⚠️ Trading process already running (PID: {pid})")
                return True
        
        # Stale PID file
        logger.info("🗑️ Removing stale PID file")
        pid_file.unlink()
        return False
        
    except Exception as e:
        logger.error(f"❌ Error checking existing process: {e}")
        return False


async def start_trading(symbols=None, max_position=1000.0):
    """Start the trading system"""
    global trader
    
    logger.info("🚀 REAL-TIME NEWS-DRIVEN TRADING SYSTEM")
    logger.info("=" * 60)
    
    # Check credentials
    api_key = os.getenv('ALPACA_API_KEY')
    api_secret = os.getenv('ALPACA_API_SECRET')
    
    if not api_key or not api_secret:
        logger.error("❌ Alpaca credentials not found!")
        logger.error("Please set ALPACA_API_KEY and ALPACA_API_SECRET in .env")
        return False
    
    # Check if already running
    if check_existing_process():
        return False
    
    # Save PID
    save_pid()
    update_status("starting", "Initializing trading system")
    
    try:
        # Create trader instance
        trader = RealTimeTrader()
        
        # Override symbols if provided
        if symbols:
            trader.symbols = symbols
            
        # Override position size if provided
        if max_position:
            trader.trading_engine.max_position_size = max_position
        
        # Set up signal handlers
        signal.signal(signal.SIGINT, lambda s, f: asyncio.create_task(signal_handler(s, f)))
        signal.signal(signal.SIGTERM, lambda s, f: asyncio.create_task(signal_handler(s, f)))
        
        update_status("running", f"Trading {len(trader.symbols)} symbols")
        logger.info(f"💰 Max position size: ${max_position}")
        logger.info(f"📈 Symbols: {', '.join(trader.symbols)}")
        logger.info("=" * 60)
        
        # Start trading
        await trader.start()
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Trading system error: {e}")
        update_status("error", str(e))
        cleanup_pid()
        return False


def stop_trading():
    """Stop existing trading process"""
    if not pid_file.exists():
        logger.info("ℹ️ No trading process running")
        return True
    
    try:
        with open(pid_file, 'r') as f:
            pid = int(f.read().strip())
        
        if psutil.pid_exists(pid):
            logger.info(f"🛑 Stopping trading process (PID: {pid})")
            
            proc = psutil.Process(pid)
            proc.terminate()  # Send SIGTERM
            
            # Wait for graceful shutdown
            try:
                proc.wait(timeout=10)
                logger.info("✅ Trading process stopped gracefully")
            except psutil.TimeoutExpired:
                logger.warning("⚠️ Forcing process termination")
                proc.kill()
                proc.wait(timeout=5)
                logger.info("✅ Trading process terminated")
        else:
            logger.info("ℹ️ Process not found, cleaning up PID file")
        
        cleanup_pid()
        update_status("stopped", "Manual shutdown")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error stopping process: {e}")
        return False


def get_status():
    """Get trading system status"""
    if not status_file.exists():
        print("📊 Status: No status file found")
        return
    
    try:
        with open(status_file, 'r') as f:
            status = json.load(f)
        
        print("📊 TRADING SYSTEM STATUS")
        print("=" * 40)
        print(f"Status: {status.get('status', 'unknown').upper()}")
        print(f"Message: {status.get('message', 'N/A')}")
        print(f"Last Update: {status.get('timestamp', 'N/A')}")
        print(f"PID: {status.get('pid', 'N/A')}")
        
        # Check if process is actually running
        pid = status.get('pid')
        if pid and psutil.pid_exists(int(pid)):
            proc = psutil.Process(int(pid))
            print(f"CPU Usage: {proc.cpu_percent():.1f}%")
            print(f"Memory: {proc.memory_info().rss / 1024 / 1024:.1f} MB")
            print(f"Runtime: {datetime.now() - datetime.fromisoformat(status.get('timestamp', datetime.now().isoformat()))}")
        
    except Exception as e:
        print(f"❌ Error reading status: {e}")


def show_logs(lines=50):
    """Show recent log entries"""
    log_files = sorted(LOG_DIR.glob("trader_*.log"), key=os.path.getmtime, reverse=True)
    
    if not log_files:
        print("📋 No log files found")
        return
    
    latest_log = log_files[0]
    print(f"📋 Recent logs from {latest_log.name}:")
    print("=" * 60)
    
    try:
        with open(latest_log, 'r') as f:
            log_lines = f.readlines()
            for line in log_lines[-lines:]:
                print(line.rstrip())
    except Exception as e:
        print(f"❌ Error reading logs: {e}")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Real-Time News-Driven Trading System")
    parser.add_argument('command', choices=['start', 'stop', 'restart', 'status', 'logs'], 
                       help='Command to execute')
    parser.add_argument('--symbols', nargs='+', 
                       default=['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'],
                       help='Symbols to trade')
    parser.add_argument('--max-position', type=float, default=1000.0,
                       help='Maximum position size in dollars')
    parser.add_argument('--log-lines', type=int, default=50,
                       help='Number of log lines to show')
    parser.add_argument('--daemon', action='store_true',
                       help='Run as daemon process')
    
    args = parser.parse_args()
    
    if args.command == 'start':
        if args.daemon:
            # TODO: Implement proper daemonization
            logger.info("🔧 Daemon mode not yet implemented, running in foreground")
        
        success = await start_trading(args.symbols, args.max_position)
        sys.exit(0 if success else 1)
        
    elif args.command == 'stop':
        success = stop_trading()
        sys.exit(0 if success else 1)
        
    elif args.command == 'restart':
        logger.info("🔄 Restarting trading system...")
        stop_trading()
        await asyncio.sleep(2)
        success = await start_trading(args.symbols, args.max_position)
        sys.exit(0 if success else 1)
        
    elif args.command == 'status':
        get_status()
        
    elif args.command == 'logs':
        show_logs(args.log_lines)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("⏹️ Interrupted by user")
        if trader:
            asyncio.run(trader.shutdown())
        cleanup_pid()
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        sys.exit(1)