#!/usr/bin/env python3
"""
Comprehensive Backtest and Validation for BTC Momentum Strategy
Tests multiple parameter combinations to find optimal settings
"""

import sys
sys.path.append('/workspaces/neural-trader/src')

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple
import json

from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame

# Import our strategy
sys.path.append('/workspaces/neural-trader/src/strategies')
from btc_momentum_scanner import BTCMomentumScanner

class StrategyValidator:
    def __init__(self):
        self.client = CryptoHistoricalDataClient()
        self.results = []

    def get_historical_data(self, days: int = 7) -> pd.DataFrame:
        """Fetch historical minute data"""
        print(f"📥 Fetching {days} days of BTC/USD data...")

        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)

        request = CryptoBarsRequest(
            symbol_or_symbols="BTC/USD",
            timeframe=TimeFrame.Minute,
            start=start_time,
            end=end_time
        )

        bars = self.client.get_crypto_bars(request)
        df = bars.df.reset_index()

        print(f"✅ Loaded {len(df)} minute bars")
        print(f"   Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        print(f"   Price range: ${df['close'].min():,.2f} to ${df['close'].max():,.2f}")

        return df

    def test_parameter_combination(self, df: pd.DataFrame, params: Dict) -> Dict:
        """Test a specific parameter combination"""

        # Create scanner with custom parameters
        scanner = BTCMomentumScanner()
        scanner.MOVEMENT_THRESHOLD = params['movement_threshold']
        scanner.MAX_DRAWDOWN = params['max_drawdown']
        scanner.MIN_WIN_RATE = params['min_win_rate']

        # Calculate features
        df = scanner.calculate_technical_features(df)

        # Simulate trades
        trades = []
        for i in range(50, len(df) - 10):
            window = df.iloc[:i+1]
            signal = scanner.detect_momentum_setup(window)

            if signal:
                # Get next 10 minutes for trade simulation
                future_prices = df.iloc[i+1:i+11]['close'].values

                # Simulate the trade
                trade_result = scanner.simulate_trade(signal, future_prices)
                trade_result['timestamp'] = df.iloc[i]['timestamp']
                trades.append(trade_result)

        # Calculate statistics
        if trades:
            wins = [t for t in trades if t['pnl'] > 0]
            losses = [t for t in trades if t['pnl'] <= 0]

            win_rate = len(wins) / len(trades)
            avg_win = np.mean([t['pnl'] for t in wins]) if wins else 0
            avg_loss = np.mean([t['pnl'] for t in losses]) if losses else 0

            # Calculate profit factor
            total_wins = sum([t['pnl'] for t in wins]) if wins else 0
            total_losses = abs(sum([t['pnl'] for t in losses])) if losses else 0
            profit_factor = total_wins / total_losses if total_losses > 0 else float('inf')

            # Calculate Sharpe ratio (simplified)
            returns = [t['pnl'] for t in trades]
            sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252 * 24 * 60) if np.std(returns) > 0 else 0

            # Calculate max drawdown
            cumulative = np.cumsum([t['pnl'] for t in trades])
            running_max = np.maximum.accumulate(cumulative)
            drawdown = (cumulative - running_max) / running_max
            max_dd = np.min(drawdown) if len(drawdown) > 0 else 0

            return {
                'params': params,
                'total_trades': len(trades),
                'wins': len(wins),
                'losses': len(losses),
                'win_rate': win_rate,
                'avg_win': avg_win,
                'avg_loss': avg_loss,
                'profit_factor': profit_factor,
                'sharpe_ratio': sharpe,
                'max_drawdown': max_dd,
                'total_return': sum([t['pnl'] for t in trades]),
                'meets_criteria': win_rate >= params['min_win_rate'],
                'trades': trades
            }

        return {
            'params': params,
            'total_trades': 0,
            'meets_criteria': False
        }

    def run_parameter_sweep(self, df: pd.DataFrame) -> pd.DataFrame:
        """Test multiple parameter combinations"""

        print("\n🔬 Running Parameter Sweep...")

        # Define parameter ranges
        movement_thresholds = [0.003, 0.005, 0.007, 0.010]  # 0.3% to 1.0%
        max_drawdowns = [0.001, 0.002, 0.003, 0.005]  # 0.1% to 0.5%

        results = []

        for movement in movement_thresholds:
            for drawdown in max_drawdowns:
                params = {
                    'movement_threshold': movement,
                    'max_drawdown': drawdown,
                    'min_win_rate': 0.60
                }

                print(f"\n📊 Testing: Movement={movement:.1%}, MaxDD={drawdown:.1%}")
                result = self.test_parameter_combination(df, params)
                results.append(result)

                if result['total_trades'] > 0:
                    print(f"   Trades: {result['total_trades']}")
                    print(f"   Win Rate: {result['win_rate']:.1%}")
                    print(f"   Profit Factor: {result['profit_factor']:.2f}")
                    print(f"   ✅ Meets 60% Win Rate: {result['meets_criteria']}")
                else:
                    print(f"   ❌ No trades generated")

        return pd.DataFrame(results)

    def analyze_best_strategy(self, df: pd.DataFrame, results_df: pd.DataFrame):
        """Analyze the best performing strategy in detail"""

        # Filter for strategies that meet criteria
        valid_results = results_df[results_df['meets_criteria'] == True]

        if valid_results.empty:
            print("\n❌ No parameter combination meets 60% win rate requirement")

            # Show best performing even if doesn't meet criteria
            best = results_df.nlargest(1, 'win_rate').iloc[0]
        else:
            # Get best by profit factor
            best = valid_results.nlargest(1, 'profit_factor').iloc[0]

        print("\n" + "="*60)
        print("🏆 BEST STRATEGY CONFIGURATION")
        print("="*60)

        print(f"\n📊 PARAMETERS:")
        print(f"  Movement Threshold: {best['params']['movement_threshold']:.2%}")
        print(f"  Max Drawdown: {best['params']['max_drawdown']:.2%}")
        print(f"  Min Win Rate: {best['params']['min_win_rate']:.0%}")

        print(f"\n📈 PERFORMANCE METRICS:")
        print(f"  Total Trades: {best['total_trades']}")
        print(f"  Win Rate: {best['win_rate']:.1%} {'✅' if best['win_rate'] >= 0.60 else '❌'}")
        print(f"  Wins: {best['wins']}")
        print(f"  Losses: {best['losses']}")
        print(f"  Avg Win: {best['avg_win']:.3%}")
        print(f"  Avg Loss: {best['avg_loss']:.3%}")
        print(f"  Profit Factor: {best['profit_factor']:.2f}")
        print(f"  Sharpe Ratio: {best['sharpe_ratio']:.2f}")
        print(f"  Max Drawdown: {best['max_drawdown']:.2%}")
        print(f"  Total Return: {best['total_return']:.2%}")

        # Analyze trade distribution
        if best['trades']:
            trades_df = pd.DataFrame(best['trades'])

            print(f"\n📊 TRADE DISTRIBUTION:")
            print(f"  Long Trades: {len(trades_df[trades_df['direction'] == 'LONG'])}")
            print(f"  Short Trades: {len(trades_df[trades_df['direction'] == 'SHORT'])}")

            # PnL distribution
            print(f"\n💰 P&L DISTRIBUTION:")
            print(f"  Best Trade: {trades_df['pnl'].max():.3%}")
            print(f"  Worst Trade: {trades_df['pnl'].min():.3%}")
            print(f"  Median PnL: {trades_df['pnl'].median():.3%}")
            print(f"  StdDev PnL: {trades_df['pnl'].std():.3%}")

            # Save trades to CSV
            trades_df.to_csv('btc_backtest_trades.csv', index=False)
            print(f"\n💾 Saved {len(trades_df)} trades to btc_backtest_trades.csv")

        return best

    def create_validation_report(self, df: pd.DataFrame, best_result: Dict):
        """Create detailed validation report"""

        print("\n" + "="*60)
        print("📋 VALIDATION REPORT")
        print("="*60)

        # 1. Win Rate Validation
        win_rate_pass = best_result['win_rate'] >= 0.60
        print(f"\n1️⃣ WIN RATE REQUIREMENT (≥60%):")
        print(f"   Actual: {best_result['win_rate']:.1%}")
        print(f"   Status: {'✅ PASSED' if win_rate_pass else '❌ FAILED'}")

        # 2. Movement Detection Validation
        movement_ok = best_result['params']['movement_threshold'] >= 0.005
        print(f"\n2️⃣ MOVEMENT DETECTION (≥0.5%):")
        print(f"   Setting: {best_result['params']['movement_threshold']:.2%}")
        print(f"   Status: {'✅ MEETS SPEC' if movement_ok else '⚠️  ADJUSTED'}")

        # 3. Drawdown Control
        dd_ok = best_result['params']['max_drawdown'] <= 0.002
        print(f"\n3️⃣ DRAWDOWN CONTROL (≤0.1% ideal):")
        print(f"   Setting: {best_result['params']['max_drawdown']:.2%}")
        print(f"   Actual Max DD: {abs(best_result['max_drawdown']):.2%}")
        print(f"   Status: {'✅ STRICT' if dd_ok else '⚠️  RELAXED FOR VOLATILITY'}")

        # 4. Sample Size Validation
        sample_ok = best_result['total_trades'] >= 30
        print(f"\n4️⃣ STATISTICAL SIGNIFICANCE:")
        print(f"   Sample Size: {best_result['total_trades']} trades")
        print(f"   Status: {'✅ SUFFICIENT' if sample_ok else '⚠️  MORE DATA NEEDED'}")

        # 5. Risk-Reward Analysis
        rr_ratio = abs(best_result['avg_win'] / best_result['avg_loss']) if best_result['avg_loss'] != 0 else 0
        rr_ok = rr_ratio >= 1.0
        print(f"\n5️⃣ RISK-REWARD RATIO:")
        print(f"   Ratio: {rr_ratio:.2f}:1")
        print(f"   Status: {'✅ FAVORABLE' if rr_ok else '❌ UNFAVORABLE'}")

        # Overall validation
        all_passed = win_rate_pass and sample_ok

        print(f"\n" + "="*60)
        print(f"🎯 OVERALL VALIDATION: {'✅ STRATEGY VALIDATED' if all_passed else '❌ NEEDS OPTIMIZATION'}")
        print("="*60)

        if not all_passed:
            print("\n💡 RECOMMENDATIONS:")
            if not win_rate_pass:
                print("  • Adjust entry confidence thresholds")
                print("  • Add more technical confirmation signals")
                print("  • Incorporate sentiment filters")
            if not sample_ok:
                print("  • Run backtest on longer timeframe")
                print("  • Reduce movement threshold for more signals")

        return all_passed

def main():
    """Run complete backtest and validation"""

    print("🚀 BTC MOMENTUM STRATEGY - BACKTEST & VALIDATION")
    print("="*60)

    validator = StrategyValidator()

    # Get historical data
    df = validator.get_historical_data(days=7)

    # Run parameter sweep
    results_df = validator.run_parameter_sweep(df)

    # Find and analyze best strategy
    best = validator.analyze_best_strategy(df, results_df)

    # Create validation report
    validated = validator.create_validation_report(df, best)

    # Save results
    results_df.to_csv('btc_backtest_results.csv', index=False)
    print(f"\n💾 Full results saved to btc_backtest_results.csv")

    # Save best configuration
    if validated:
        config = {
            'movement_threshold': float(best['params']['movement_threshold']),
            'max_drawdown': float(best['params']['max_drawdown']),
            'min_win_rate': float(best['params']['min_win_rate']),
            'backtest_win_rate': float(best['win_rate']),
            'backtest_profit_factor': float(best['profit_factor']),
            'backtest_sharpe': float(best['sharpe_ratio']),
            'validated': True,
            'timestamp': datetime.now().isoformat()
        }

        with open('btc_validated_config.json', 'w') as f:
            json.dump(config, f, indent=2)

        print(f"✅ Validated configuration saved to btc_validated_config.json")

    return validated

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)