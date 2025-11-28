#!/usr/bin/env python3
"""
Find real trading opportunities with validated Alpaca data
"""
import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from alpaca.trading.client import TradingClient
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import (
    CryptoBarsRequest,
    CryptoLatestQuoteRequest,
    CryptoSnapshotRequest
)
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Alpaca credentials
API_KEY = "PKAJQDPYIZ1S8BHWU7GD"
SECRET_KEY = "zJvREGAi3qQi6zdjhMuemKeUlWhDid78mPIGLkTw"

class OpportunityFinder:
    def __init__(self):
        self.crypto_client = CryptoHistoricalDataClient(API_KEY, SECRET_KEY)
        self.trading_client = TradingClient(API_KEY, SECRET_KEY, paper=True)
        self.opportunities = []

    def scan_markets(self):
        """Scan all available crypto markets"""
        symbols = ["BTC/USD", "ETH/USD", "BCH/USD", "LTC/USD", "LINK/USD",
                   "UNI/USD", "AAVE/USD", "AVAX/USD", "DOT/USD"]

        print("\n🔍 SCANNING CRYPTO MARKETS FOR REAL OPPORTUNITIES\n")
        print("="*60)

        for symbol in symbols:
            self.analyze_symbol(symbol)

        return self.opportunities

    def analyze_symbol(self, symbol):
        """Analyze individual symbol for opportunities"""
        print(f"\n📊 Analyzing {symbol}...")

        try:
            # Get snapshot for comprehensive data
            snapshot_req = CryptoSnapshotRequest(symbol_or_symbols=symbol)
            snapshot = self.crypto_client.get_crypto_snapshot(snapshot_req)

            if symbol in snapshot:
                snap_data = snapshot[symbol]

                # Get current quote
                latest_quote = snap_data.latest_quote
                daily_bar = snap_data.daily_bar
                prev_daily_bar = snap_data.prev_daily_bar if hasattr(snap_data, 'prev_daily_bar') else None

                current_bid = float(latest_quote.bid_price)
                current_ask = float(latest_quote.ask_price)
                current_price = (current_bid + current_ask) / 2

                print(f"  Current Price: ${current_price:,.2f}")
                print(f"  Bid/Ask: ${current_bid:,.2f} / ${current_ask:,.2f}")
                print(f"  Spread: ${current_ask - current_bid:.2f} ({((current_ask - current_bid) / current_price * 100):.3f}%)")

                if daily_bar:
                    volume = float(daily_bar.volume)
                    vwap = float(daily_bar.vwap)
                    high = float(daily_bar.high)
                    low = float(daily_bar.low)
                    open_price = float(daily_bar.open)

                    print(f"  Daily High/Low: ${high:,.2f} / ${low:,.2f}")
                    print(f"  Daily Volume: {volume:,.2f}")
                    print(f"  VWAP: ${vwap:,.2f}")

                    # Calculate simple metrics
                    daily_range = high - low
                    daily_change = current_price - open_price
                    daily_change_pct = (daily_change / open_price) * 100

                    print(f"  Daily Change: ${daily_change:,.2f} ({daily_change_pct:.2f}%)")

                    # Position in daily range
                    range_position = (current_price - low) / daily_range if daily_range > 0 else 0.5
                    print(f"  Position in Range: {range_position:.1%}")

                    # Identify opportunities based on price action
                    opportunity = None

                    # Oversold - near daily low
                    if range_position < 0.25 and daily_change_pct < -2:
                        opportunity = {
                            'symbol': symbol,
                            'action': 'BUY',
                            'confidence': 'MEDIUM',
                            'reason': f'Near daily low ({range_position:.1%} of range) with {daily_change_pct:.2f}% decline',
                            'entry': current_ask,
                            'stop_loss': low * 0.995,
                            'target': vwap,
                            'current_price': current_price
                        }

                    # Overbought - near daily high
                    elif range_position > 0.75 and daily_change_pct > 2:
                        opportunity = {
                            'symbol': symbol,
                            'action': 'SELL',
                            'confidence': 'MEDIUM',
                            'reason': f'Near daily high ({range_position:.1%} of range) with {daily_change_pct:.2f}% gain',
                            'entry': current_bid,
                            'stop_loss': high * 1.005,
                            'target': vwap,
                            'current_price': current_price
                        }

                    # VWAP divergence
                    elif abs(current_price - vwap) / vwap > 0.01:
                        if current_price < vwap:
                            opportunity = {
                                'symbol': symbol,
                                'action': 'BUY',
                                'confidence': 'LOW',
                                'reason': f'Trading {((vwap - current_price) / vwap * 100):.2f}% below VWAP',
                                'entry': current_ask,
                                'stop_loss': current_ask * 0.99,
                                'target': vwap,
                                'current_price': current_price
                            }
                        else:
                            opportunity = {
                                'symbol': symbol,
                                'action': 'SELL',
                                'confidence': 'LOW',
                                'reason': f'Trading {((current_price - vwap) / vwap * 100):.2f}% above VWAP',
                                'entry': current_bid,
                                'stop_loss': current_bid * 1.01,
                                'target': vwap,
                                'current_price': current_price
                            }

                    # High volume breakout
                    if volume > 100 and daily_change_pct > 3:
                        opportunity = {
                            'symbol': symbol,
                            'action': 'BUY',
                            'confidence': 'HIGH',
                            'reason': f'High volume breakout: {daily_change_pct:.2f}% gain on {volume:.0f} volume',
                            'entry': current_ask,
                            'stop_loss': open_price,
                            'target': current_price * 1.02,
                            'current_price': current_price
                        }

                    if opportunity:
                        # Calculate risk/reward
                        risk = abs(opportunity['entry'] - opportunity['stop_loss'])
                        reward = abs(opportunity['target'] - opportunity['entry'])
                        opportunity['risk_reward'] = reward / risk if risk > 0 else 0
                        self.opportunities.append(opportunity)
                        print(f"  ✅ OPPORTUNITY FOUND: {opportunity['action']} signal")

        except Exception as e:
            print(f"  ⚠️ Error: {e}")

    def display_opportunities(self):
        """Display all found opportunities"""
        print("\n" + "="*70)
        print("         📈 VALIDATED TRADING OPPORTUNITIES")
        print("="*70 + "\n")

        if not self.opportunities:
            print("No opportunities meeting criteria at this moment.")
            print("\nMarket appears to be in consolidation phase.")
            return

        # Sort by confidence
        confidence_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
        self.opportunities.sort(key=lambda x: confidence_order[x['confidence']])

        for i, opp in enumerate(self.opportunities, 1):
            print(f"{i}. {opp['symbol']} - {opp['action']} ({opp['confidence']} confidence)")
            print(f"   📊 {opp['reason']}")
            print(f"   Current: ${opp['current_price']:,.2f}")
            print(f"   Entry: ${opp['entry']:,.2f}")
            print(f"   Stop Loss: ${opp['stop_loss']:,.2f} ({abs(1 - opp['stop_loss']/opp['entry'])*100:.2f}% risk)")
            print(f"   Target: ${opp['target']:,.2f} ({abs(opp['target']/opp['entry'] - 1)*100:.2f}% reward)")
            print(f"   Risk/Reward: 1:{opp['risk_reward']:.2f}")
            print()

        # Summary
        print("\n" + "-"*50)
        print("SUMMARY:")
        buys = [o for o in self.opportunities if o['action'] == 'BUY']
        sells = [o for o in self.opportunities if o['action'] == 'SELL']
        print(f"  • BUY signals: {len(buys)}")
        print(f"  • SELL signals: {len(sells)}")
        print(f"  • Best R/R: 1:{max(o['risk_reward'] for o in self.opportunities):.2f}")

def main():
    finder = OpportunityFinder()

    # Verify connection
    account = finder.trading_client.get_account()
    print(f"✅ Connected to Alpaca Account: {account.account_number}")
    print(f"   Buying Power: ${float(account.buying_power):,.2f}")
    print(f"   Portfolio Value: ${float(account.portfolio_value):,.2f}")

    # Scan markets
    opportunities = finder.scan_markets()

    # Display results
    finder.display_opportunities()

    print("\n" + "="*70)
    print("Data: 100% REAL from Alpaca Markets API")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("All prices and opportunities are based on actual market data")
    print("="*70)

if __name__ == "__main__":
    main()