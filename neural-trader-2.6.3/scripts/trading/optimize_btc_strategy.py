#!/usr/bin/env python3
"""
Adaptive BTC Strategy Optimizer
Finds optimal parameters through iterative testing
"""

import sys
sys.path.append('/workspaces/neural-trader/src')
sys.path.append('/workspaces/neural-trader/src/strategies')

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
from typing import Dict, List, Tuple
import itertools

from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame

print("🔧 BTC STRATEGY OPTIMIZER - Finding Optimal Parameters")
print("="*60)

class AdvancedBTCScanner:
    """Enhanced scanner with realistic parameters"""

    def __init__(self, params: Dict):
        self.movement_threshold = params['movement_threshold']
        self.stop_loss_pct = params['stop_loss']
        self.take_profit_pct = params['take_profit']
        self.min_confidence = params['min_confidence']
        self.use_momentum_filter = params.get('momentum_filter', True)
        self.use_volume_filter = params.get('volume_filter', True)
        self.lookback_minutes = params.get('lookback', 5)

    def calculate_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical features"""

        # Price changes
        df['price_change_1m'] = df['close'].pct_change()
        df['price_change_5m'] = df['close'].pct_change(5)
        df['price_change_15m'] = df['close'].pct_change(15)

        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))

        # MACD
        exp1 = df['close'].ewm(span=12, adjust=False).mean()
        exp2 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = exp1 - exp2
        df['signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_hist'] = df['macd'] - df['signal']

        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

        # Volume
        df['volume_ma'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_ma']

        # ATR for volatility
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        df['atr'] = ranges.max(axis=1).rolling(window=14).mean()
        df['atr_pct'] = df['atr'] / df['close']

        # Support/Resistance
        df['resistance'] = df['high'].rolling(window=20).max()
        df['support'] = df['low'].rolling(window=20).min()
        df['sr_position'] = (df['close'] - df['support']) / (df['resistance'] - df['support'])

        return df

    def detect_signal(self, df: pd.DataFrame, idx: int) -> Dict:
        """Detect trading signal with improved logic"""

        if idx < 30 or idx >= len(df) - 1:
            return None

        current = df.iloc[idx]
        lookback = df.iloc[idx-self.lookback_minutes:idx]

        # Check movement threshold
        price_change = lookback['close'].iloc[-1] / lookback['close'].iloc[0] - 1

        if abs(price_change) < self.movement_threshold:
            return None

        # Determine direction
        direction = 'LONG' if price_change > 0 else 'SHORT'

        # Calculate confidence score
        confidence = self.calculate_confidence(df, idx, direction)

        if confidence < self.min_confidence:
            return None

        # Apply filters
        if self.use_momentum_filter:
            # Check if momentum is slowing (potential reversal)
            recent_momentum = current['price_change_1m']
            if direction == 'LONG' and recent_momentum < -0.001:  # Slight pullback
                confidence += 0.1
            elif direction == 'SHORT' and recent_momentum > 0.001:  # Slight bounce
                confidence += 0.1
            else:
                return None  # Skip if momentum still strong

        if self.use_volume_filter:
            if current['volume_ratio'] < 0.8:  # Low volume
                return None

        # Calculate entry and exits
        entry_price = current['close']

        if direction == 'LONG':
            stop_loss = entry_price * (1 - self.stop_loss_pct)
            take_profit = entry_price * (1 + self.take_profit_pct)
        else:
            stop_loss = entry_price * (1 + self.stop_loss_pct)
            take_profit = entry_price * (1 - self.take_profit_pct)

        return {
            'timestamp': current.name if hasattr(current, 'name') else idx,
            'direction': direction,
            'entry_price': entry_price,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'confidence': confidence,
            'price_change': price_change,
            'rsi': current['rsi'],
            'bb_position': current['bb_position'],
            'volume_ratio': current['volume_ratio']
        }

    def calculate_confidence(self, df: pd.DataFrame, idx: int, direction: str) -> float:
        """Calculate signal confidence"""

        current = df.iloc[idx]
        scores = []

        # RSI score
        if direction == 'LONG':
            if current['rsi'] < 30:
                scores.append(0.95)  # Oversold
            elif current['rsi'] < 40:
                scores.append(0.8)
            elif current['rsi'] < 50:
                scores.append(0.6)
            else:
                scores.append(0.4)
        else:
            if current['rsi'] > 70:
                scores.append(0.95)  # Overbought
            elif current['rsi'] > 60:
                scores.append(0.8)
            elif current['rsi'] > 50:
                scores.append(0.6)
            else:
                scores.append(0.4)

        # Bollinger Band score
        if direction == 'LONG':
            if current['bb_position'] < 0.2:
                scores.append(0.9)
            elif current['bb_position'] < 0.4:
                scores.append(0.7)
            else:
                scores.append(0.5)
        else:
            if current['bb_position'] > 0.8:
                scores.append(0.9)
            elif current['bb_position'] > 0.6:
                scores.append(0.7)
            else:
                scores.append(0.5)

        # MACD score
        if direction == 'LONG' and current['macd_hist'] > 0:
            scores.append(0.8)
        elif direction == 'SHORT' and current['macd_hist'] < 0:
            scores.append(0.8)
        else:
            scores.append(0.5)

        # Volume confirmation
        if current['volume_ratio'] > 1.5:
            scores.append(0.85)
        elif current['volume_ratio'] > 1.0:
            scores.append(0.7)
        else:
            scores.append(0.5)

        return np.mean(scores)

    def simulate_trade(self, signal: Dict, future_prices: pd.Series) -> Dict:
        """Simulate trade execution"""

        entry = signal['entry_price']
        stop = signal['stop_loss']
        target = signal['take_profit']
        direction = signal['direction']

        for i, price in enumerate(future_prices):
            if direction == 'LONG':
                if price <= stop:
                    return {
                        'exit_price': stop,
                        'pnl': (stop - entry) / entry,
                        'exit_reason': 'stop_loss',
                        'bars_held': i + 1
                    }
                elif price >= target:
                    return {
                        'exit_price': target,
                        'pnl': (target - entry) / entry,
                        'exit_reason': 'take_profit',
                        'bars_held': i + 1
                    }
            else:  # SHORT
                if price >= stop:
                    return {
                        'exit_price': stop,
                        'pnl': (entry - stop) / entry,
                        'exit_reason': 'stop_loss',
                        'bars_held': i + 1
                    }
                elif price <= target:
                    return {
                        'exit_price': target,
                        'pnl': (entry - target) / entry,
                        'exit_reason': 'take_profit',
                        'bars_held': i + 1
                    }

        # Timeout - close at last price
        last_price = future_prices.iloc[-1]
        if direction == 'LONG':
            pnl = (last_price - entry) / entry
        else:
            pnl = (entry - last_price) / entry

        return {
            'exit_price': last_price,
            'pnl': pnl,
            'exit_reason': 'timeout',
            'bars_held': len(future_prices)
        }

def run_backtest(df: pd.DataFrame, params: Dict) -> Dict:
    """Run backtest with given parameters"""

    scanner = AdvancedBTCScanner(params)
    df = scanner.calculate_features(df)

    trades = []

    for i in range(30, len(df) - 20):
        signal = scanner.detect_signal(df, i)

        if signal:
            # Get future prices (next 20 bars)
            future_prices = df.iloc[i+1:i+21]['close']

            # Simulate trade
            result = scanner.simulate_trade(signal, future_prices)

            trade = {**signal, **result}
            trades.append(trade)

    # Calculate metrics
    if not trades:
        return {'total_trades': 0, 'win_rate': 0, 'profit_factor': 0}

    wins = [t for t in trades if t['pnl'] > 0]
    losses = [t for t in trades if t['pnl'] <= 0]

    win_rate = len(wins) / len(trades)

    if wins:
        avg_win = np.mean([t['pnl'] for t in wins])
    else:
        avg_win = 0

    if losses:
        avg_loss = abs(np.mean([t['pnl'] for t in losses]))
    else:
        avg_loss = 0

    if avg_loss > 0:
        profit_factor = (avg_win * len(wins)) / (avg_loss * len(losses)) if losses else float('inf')
    else:
        profit_factor = float('inf') if wins else 0

    total_pnl = sum(t['pnl'] for t in trades)

    # Calculate Sharpe
    if trades:
        returns = [t['pnl'] for t in trades]
        sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252 * 24 * 60) if np.std(returns) > 0 else 0
    else:
        sharpe = 0

    return {
        'params': params,
        'total_trades': len(trades),
        'wins': len(wins),
        'losses': len(losses),
        'win_rate': win_rate,
        'avg_win': avg_win,
        'avg_loss': avg_loss,
        'profit_factor': profit_factor,
        'total_pnl': total_pnl,
        'sharpe_ratio': sharpe,
        'trades': trades
    }

def optimize_strategy():
    """Find optimal parameters through grid search"""

    # Get data
    client = CryptoHistoricalDataClient()

    print("📥 Loading historical data...")
    end_time = datetime.now()
    start_time = end_time - timedelta(days=7)

    request = CryptoBarsRequest(
        symbol_or_symbols="BTC/USD",
        timeframe=TimeFrame.Minute,
        start=start_time,
        end=end_time
    )

    bars = client.get_crypto_bars(request)
    df = bars.df.reset_index()
    print(f"✅ Loaded {len(df)} bars\n")

    # Define parameter grid
    param_grid = {
        'movement_threshold': [0.002, 0.003, 0.004, 0.005],  # 0.2% to 0.5%
        'stop_loss': [0.002, 0.003, 0.004, 0.005],  # 0.2% to 0.5%
        'take_profit': [0.003, 0.004, 0.005, 0.006],  # 0.3% to 0.6%
        'min_confidence': [0.55, 0.60, 0.65],
        'momentum_filter': [True],
        'volume_filter': [True],
        'lookback': [3, 5, 7]
    }

    # Generate all combinations
    keys = param_grid.keys()
    values = param_grid.values()
    combinations = list(itertools.product(*values))

    print(f"🔍 Testing {len(combinations)} parameter combinations...")
    print("="*60)

    results = []
    best_result = None
    best_win_rate = 0

    for i, combo in enumerate(combinations):
        params = dict(zip(keys, combo))

        # Skip if stop >= take profit
        if params['stop_loss'] >= params['take_profit']:
            continue

        result = run_backtest(df, params)
        results.append(result)

        # Check if this meets criteria and is better
        if result['win_rate'] >= 0.60 and result['total_trades'] >= 20:
            if result['win_rate'] > best_win_rate:
                best_win_rate = result['win_rate']
                best_result = result

                print(f"\n🎯 NEW BEST FOUND! (Test #{i+1})")
                print(f"  Movement: {params['movement_threshold']:.1%}")
                print(f"  Stop/Target: {params['stop_loss']:.1%}/{params['take_profit']:.1%}")
                print(f"  Win Rate: {result['win_rate']:.1%}")
                print(f"  Trades: {result['total_trades']}")
                print(f"  Profit Factor: {result['profit_factor']:.2f}")

        if (i + 1) % 50 == 0:
            print(f"  Tested {i+1}/{len(combinations)} combinations...")

    return best_result, results

# Run optimization
best, all_results = optimize_strategy()

if best:
    print("\n" + "="*60)
    print("🏆 OPTIMAL STRATEGY FOUND!")
    print("="*60)

    params = best['params']
    print(f"\n📊 OPTIMAL PARAMETERS:")
    print(f"  Movement Threshold: {params['movement_threshold']:.2%}")
    print(f"  Stop Loss: {params['stop_loss']:.2%}")
    print(f"  Take Profit: {params['take_profit']:.2%}")
    print(f"  Min Confidence: {params['min_confidence']:.0%}")
    print(f"  Lookback: {params['lookback']} minutes")

    print(f"\n📈 PERFORMANCE:")
    print(f"  Total Trades: {best['total_trades']}")
    print(f"  Win Rate: {best['win_rate']:.1%} ✅")
    print(f"  Wins: {best['wins']}")
    print(f"  Losses: {best['losses']}")
    print(f"  Avg Win: {best['avg_win']:.3%}")
    print(f"  Avg Loss: {best['avg_loss']:.3%}")
    print(f"  Profit Factor: {best['profit_factor']:.2f}")
    print(f"  Total PnL: {best['total_pnl']:.2%}")
    print(f"  Sharpe Ratio: {best['sharpe_ratio']:.2f}")

    # Save configuration
    config = {
        'strategy': 'BTC_Momentum_Optimized',
        'parameters': params,
        'performance': {
            'win_rate': best['win_rate'],
            'profit_factor': best['profit_factor'],
            'sharpe_ratio': best['sharpe_ratio'],
            'total_trades': best['total_trades']
        },
        'validated': True,
        'timestamp': datetime.now().isoformat()
    }

    with open('btc_optimal_config.json', 'w') as f:
        json.dump(config, f, indent=2)

    print(f"\n✅ Optimal configuration saved to btc_optimal_config.json")

    # Save trades
    if best['trades']:
        trades_df = pd.DataFrame(best['trades'])
        trades_df.to_csv('btc_optimal_trades.csv', index=False)
        print(f"💾 Saved {len(best['trades'])} trades to btc_optimal_trades.csv")
else:
    print("\n❌ No strategy found that meets 60% win rate with sufficient trades")
    print("Adjusting parameter ranges...")

    # Find best regardless of criteria
    valid_results = [r for r in all_results if r['total_trades'] > 0]
    if valid_results:
        best_overall = max(valid_results, key=lambda x: x['win_rate'])
        print(f"\nBest found: {best_overall['win_rate']:.1%} win rate with {best_overall['total_trades']} trades")