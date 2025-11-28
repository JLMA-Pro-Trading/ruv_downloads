#!/usr/bin/env python3
"""
Fast BTC Strategy Optimizer - Reduced parameter set
"""

import sys
sys.path.append('/workspaces/neural-trader/src')

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame

print("⚡ FAST BTC OPTIMIZER - Finding 60%+ Win Rate")
print("="*60)

def calculate_features_fast(df):
    """Quick feature calculation"""
    # RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    df['rsi'] = 100 - (100 / (1 + gain/loss))

    # Bollinger
    df['sma20'] = df['close'].rolling(20).mean()
    df['std20'] = df['close'].rolling(20).std()
    df['bb_upper'] = df['sma20'] + df['std20'] * 2
    df['bb_lower'] = df['sma20'] - df['std20'] * 2

    # Volume
    df['vol_ma'] = df['volume'].rolling(20).mean()
    df['vol_ratio'] = df['volume'] / df['vol_ma']

    return df

def test_strategy(df, movement_pct, stop_pct, profit_pct):
    """Test a single parameter combination"""

    df = calculate_features_fast(df)
    trades = []

    for i in range(30, len(df) - 10):
        # Check for movement
        price_change = (df.iloc[i]['close'] - df.iloc[i-5]['close']) / df.iloc[i-5]['close']

        if abs(price_change) < movement_pct:
            continue

        # Entry conditions
        entry = df.iloc[i]['close']
        rsi = df.iloc[i]['rsi']

        # Direction based on reversal logic
        if price_change > movement_pct and rsi > 70:  # Overbought - SHORT
            direction = 'SHORT'
            stop = entry * (1 + stop_pct)
            target = entry * (1 - profit_pct)
        elif price_change < -movement_pct and rsi < 30:  # Oversold - LONG
            direction = 'LONG'
            stop = entry * (1 - stop_pct)
            target = entry * (1 + profit_pct)
        else:
            continue

        # Simulate trade
        hit_target = False
        hit_stop = False

        for j in range(i+1, min(i+11, len(df))):
            price = df.iloc[j]['close']

            if direction == 'LONG':
                if price >= target:
                    hit_target = True
                    break
                elif price <= stop:
                    hit_stop = True
                    break
            else:  # SHORT
                if price <= target:
                    hit_target = True
                    break
                elif price >= stop:
                    hit_stop = True
                    break

        if hit_target:
            trades.append({'result': 'win', 'pnl': profit_pct})
        elif hit_stop:
            trades.append({'result': 'loss', 'pnl': -stop_pct})

    if not trades:
        return None

    wins = sum(1 for t in trades if t['result'] == 'win')
    win_rate = wins / len(trades)

    return {
        'movement': movement_pct,
        'stop': stop_pct,
        'profit': profit_pct,
        'trades': len(trades),
        'wins': wins,
        'win_rate': win_rate,
        'avg_pnl': np.mean([t['pnl'] for t in trades])
    }

# Load data
client = CryptoHistoricalDataClient()
print("Loading BTC data...")

request = CryptoBarsRequest(
    symbol_or_symbols="BTC/USD",
    timeframe=TimeFrame.Minute,
    start=datetime.now() - timedelta(days=3),  # Less data for speed
    end=datetime.now()
)

bars = client.get_crypto_bars(request)
df = bars.df.reset_index()
print(f"Loaded {len(df)} bars\n")

# Test parameters
best = None
best_win_rate = 0

print("Testing parameter combinations...")
print("-"*40)

test_count = 0
for movement in [0.003, 0.004, 0.005]:  # 0.3% to 0.5%
    for stop in [0.003, 0.004, 0.005]:  # 0.3% to 0.5%
        for profit in [0.004, 0.005, 0.006]:  # 0.4% to 0.6%

            if stop >= profit:
                continue

            result = test_strategy(df, movement, stop, profit)
            test_count += 1

            if result and result['trades'] >= 10:
                print(f"Test #{test_count}: Move={movement:.1%}, Stop={stop:.1%}, Target={profit:.1%}")
                print(f"  → Win Rate: {result['win_rate']:.1%} ({result['wins']}/{result['trades']} trades)")

                if result['win_rate'] >= 0.60:
                    print(f"  ✅ MEETS 60% REQUIREMENT!")

                    if result['win_rate'] > best_win_rate:
                        best_win_rate = result['win_rate']
                        best = result

print("\n" + "="*60)

if best:
    print("🎯 OPTIMAL STRATEGY FOUND!")
    print(f"\nParameters:")
    print(f"  Movement: {best['movement']:.2%}")
    print(f"  Stop Loss: {best['stop']:.2%}")
    print(f"  Take Profit: {best['profit']:.2%}")
    print(f"\nPerformance:")
    print(f"  Win Rate: {best['win_rate']:.1%} ✅")
    print(f"  Total Trades: {best['trades']}")
    print(f"  Winning Trades: {best['wins']}")
    print(f"  Avg PnL per Trade: {best['avg_pnl']:.3%}")

    # Save config
    config = {
        'movement_threshold': best['movement'],
        'stop_loss': best['stop'],
        'take_profit': best['profit'],
        'win_rate': best['win_rate'],
        'trades': best['trades']
    }

    with open('btc_60pct_config.json', 'w') as f:
        json.dump(config, f, indent=2)

    print(f"\n✅ Configuration saved to btc_60pct_config.json")
else:
    print("❌ No configuration found with 60%+ win rate")
    print("\nTrying mean reversion strategy...")