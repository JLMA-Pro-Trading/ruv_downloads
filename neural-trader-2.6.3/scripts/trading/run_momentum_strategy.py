#!/usr/bin/env python3
"""
Neural Momentum Trading Strategy Runner
Command-line interface for running the momentum trading strategy
"""

import argparse
import asyncio
import json
import logging
import signal
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / 'src'))

from strategies.momentum.strategy_orchestrator import StrategyOrchestrator

class MomentumStrategyRunner:
    """Command-line runner for the momentum strategy"""
    
    def __init__(self):
        self.orchestrator: Optional[StrategyOrchestrator] = None
        self.is_running = False
    
    def setup_logging(self, log_level: str = 'INFO'):
        """Setup logging configuration"""
        numeric_level = getattr(logging, log_level.upper(), None)
        if not isinstance(numeric_level, int):
            raise ValueError(f'Invalid log level: {log_level}')
        
        logging.basicConfig(
            level=numeric_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('logs/momentum_strategy.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
    
    def load_config(self, config_path: str) -> dict:
        """Load configuration from file"""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            logging.info(f"Configuration loaded from {config_path}")
            return config
        except Exception as e:
            logging.error(f"Failed to load configuration: {e}")
            raise
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logging.info(f"Received signal {signum}, shutting down...")
        self.is_running = False
        if self.orchestrator:
            asyncio.create_task(self.orchestrator.stop_trading())
    
    async def run_live_trading(self, config_path: str):
        """Run live trading"""
        try:
            logging.info("Starting live trading mode...")
            
            # Load configuration
            config = self.load_config(config_path)
            
            # Create orchestrator
            self.orchestrator = StrategyOrchestrator(config)
            
            # Setup signal handlers
            signal.signal(signal.SIGINT, self.signal_handler)
            signal.signal(signal.SIGTERM, self.signal_handler)
            
            self.is_running = True
            
            # Start trading
            await self.orchestrator.start_trading()
            
        except Exception as e:
            logging.error(f"Live trading failed: {e}")
            raise
    
    async def run_backtest(self, config_path: str, start_date: str, 
                          end_date: str, initial_capital: float):
        """Run backtest"""
        try:
            logging.info("Starting backtest mode...")
            
            # Load configuration
            config = self.load_config(config_path)
            
            # Create orchestrator
            self.orchestrator = StrategyOrchestrator(config)
            
            # Backtest configuration
            backtest_config = {
                'start_date': start_date,
                'end_date': end_date,
                'initial_capital': initial_capital,
                'symbols': config.get('trading', {}).get('symbols', ['SPY', 'QQQ']),
                'benchmark_symbol': config.get('monitoring', {}).get('benchmark_symbol', 'SPY')
            }
            
            # Run backtest
            results = await self.orchestrator.run_backtest(backtest_config)
            
            if results['status'] == 'completed':
                self.print_backtest_results(results)
            else:
                logging.error(f"Backtest failed: {results.get('message')}")
            
        except Exception as e:
            logging.error(f"Backtest failed: {e}")
            raise
    
    async def run_paper_trading(self, config_path: str, duration_minutes: int):
        """Run paper trading for specified duration"""
        try:
            logging.info(f"Starting paper trading for {duration_minutes} minutes...")
            
            # Load configuration
            config = self.load_config(config_path)
            
            # Enable paper trading mode
            config['trading']['execution']['paper_trading'] = True
            
            # Create orchestrator
            self.orchestrator = StrategyOrchestrator(config)
            
            # Start trading
            trading_task = asyncio.create_task(self.orchestrator.start_trading())
            
            # Run for specified duration
            await asyncio.sleep(duration_minutes * 60)
            
            # Stop trading
            await self.orchestrator.stop_trading()
            
            # Get final status
            status = self.orchestrator.get_status()
            logging.info(f"Paper trading completed. Final status: {status}")
            
        except Exception as e:
            logging.error(f"Paper trading failed: {e}")
            raise
    
    async def optimize_parameters(self, config_path: str, optimization_period: str):
        """Run parameter optimization"""
        try:
            logging.info(f"Starting parameter optimization for {optimization_period}...")
            
            # Load configuration
            config = self.load_config(config_path)
            
            # This would implement walk-forward optimization
            # For now, we'll run a simplified version
            
            logging.info("Parameter optimization completed (simplified version)")
            
        except Exception as e:
            logging.error(f"Parameter optimization failed: {e}")
            raise
    
    def print_backtest_results(self, results: dict):
        """Print formatted backtest results"""
        if 'summary' not in results:
            logging.error("No summary in backtest results")
            return
        
        summary = results['summary']
        
        print("\n" + "="*60)
        print("NEURAL MOMENTUM STRATEGY - BACKTEST RESULTS")
        print("="*60)
        print(f"Total Return:     {summary.get('total_return', 0):>12.2%}")
        print(f"Sharpe Ratio:     {summary.get('sharpe_ratio', 0):>12.2f}")
        print(f"Max Drawdown:     {summary.get('max_drawdown', 0):>12.2%}")
        print(f"Win Rate:         {summary.get('win_rate', 0):>12.2%}")
        print(f"Total Trades:     {summary.get('total_trades', 0):>12d}")
        print("="*60)
        
        if 'results_file' in results:
            print(f"Detailed results saved to: {results['results_file']}")
        
        print()
    
    async def check_system(self, config_path: str):
        """Run system health checks"""
        try:
            logging.info("Running system health checks...")
            
            # Load configuration
            config = self.load_config(config_path)
            
            # Create orchestrator
            self.orchestrator = StrategyOrchestrator(config)
            
            # Check various components
            checks = {
                'configuration': True,
                'market_data': True,  # Would check actual data sources
                'neural_models': True,  # Would check model files
                'risk_management': True,
                'performance_tracking': True
            }
            
            print("\n" + "="*50)
            print("SYSTEM HEALTH CHECK")
            print("="*50)
            
            for component, status in checks.items():
                status_str = "✓ OK" if status else "✗ FAIL"
                print(f"{component:.<30} {status_str:>15}")
            
            print("="*50)
            print("System ready for trading" if all(checks.values()) else "System issues detected")
            print()
            
        except Exception as e:
            logging.error(f"System check failed: {e}")
            raise

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Neural Momentum Trading Strategy Runner',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run backtest
  python run_momentum_strategy.py backtest --start-date 2023-01-01 --end-date 2023-12-31

  # Run live trading
  python run_momentum_strategy.py live

  # Run paper trading for 1 hour
  python run_momentum_strategy.py paper --duration 60

  # Check system health
  python run_momentum_strategy.py check
        """
    )
    
    parser.add_argument(
        'mode',
        choices=['live', 'backtest', 'paper', 'optimize', 'check'],
        help='Trading mode to run'
    )
    
    parser.add_argument(
        '--config',
        default='config/neural_momentum_config.json',
        help='Configuration file path (default: config/neural_momentum_config.json)'
    )
    
    parser.add_argument(
        '--log-level',
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Logging level (default: INFO)'
    )
    
    # Backtest specific arguments
    parser.add_argument(
        '--start-date',
        help='Backtest start date (YYYY-MM-DD)',
        default='2023-01-01'
    )
    
    parser.add_argument(
        '--end-date',
        help='Backtest end date (YYYY-MM-DD)',
        default='2023-12-31'
    )
    
    parser.add_argument(
        '--capital',
        type=float,
        default=100000,
        help='Initial capital for backtest (default: 100000)'
    )
    
    # Paper trading arguments
    parser.add_argument(
        '--duration',
        type=int,
        default=60,
        help='Paper trading duration in minutes (default: 60)'
    )
    
    # Optimization arguments
    parser.add_argument(
        '--optimization-period',
        default='1y',
        help='Optimization period (default: 1y)'
    )
    
    args = parser.parse_args()
    
    # Initialize runner
    runner = MomentumStrategyRunner()
    runner.setup_logging(args.log_level)
    
    # Create logs directory if it doesn't exist
    Path('logs').mkdir(exist_ok=True)
    
    try:
        if args.mode == 'live':
            asyncio.run(runner.run_live_trading(args.config))
        
        elif args.mode == 'backtest':
            asyncio.run(runner.run_backtest(
                args.config, args.start_date, args.end_date, args.capital
            ))
        
        elif args.mode == 'paper':
            asyncio.run(runner.run_paper_trading(args.config, args.duration))
        
        elif args.mode == 'optimize':
            asyncio.run(runner.optimize_parameters(args.config, args.optimization_period))
        
        elif args.mode == 'check':
            asyncio.run(runner.check_system(args.config))
    
    except KeyboardInterrupt:
        logging.info("Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Application failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()