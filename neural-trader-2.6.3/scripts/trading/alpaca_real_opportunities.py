#!/usr/bin/env python3
"""
Find real trading opportunities using Alpaca market data
"""
import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from alpaca.trading.client import TradingClient
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.live import CryptoDataStream
from alpaca.data.requests import (
    CryptoBarsRequest,
    CryptoLatestQuoteRequest,
    CryptoLatestBarRequest,
    CryptoTradesRequest
)
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Alpaca credentials
API_KEY = "PKAJQDPYIZ1S8BHWU7GD"
SECRET_KEY = "zJvREGAi3qQi6zdjhMuemKeUlWhDid78mPIGLkTw"

class AlpacaMarketScanner:
    def __init__(self):
        self.crypto_client = CryptoHistoricalDataClient(API_KEY, SECRET_KEY)
        self.trading_client = TradingClient(API_KEY, SECRET_KEY, paper=True)

    def get_crypto_quotes(self):
        """Get real-time crypto quotes"""
        symbols = ["BTC/USD", "ETH/USD", "BCH/USD", "LTC/USD", "LINK/USD",
                   "UNI/USD", "AAVE/USD", "AVAX/USD", "DOT/USD", "MATIC/USD"]

        print("\n=== REAL-TIME CRYPTO QUOTES FROM ALPACA ===\n")

        quotes_data = {}

        for symbol in symbols:
            try:
                # Get latest quote
                quote_req = CryptoLatestQuoteRequest(symbol_or_symbols=symbol)
                quote = self.crypto_client.get_crypto_latest_quote(quote_req)

                # Get latest bar for additional data
                bar_req = CryptoLatestBarRequest(symbol_or_symbols=symbol)
                bar = self.crypto_client.get_crypto_latest_bar(bar_req)

                if symbol in quote and symbol in bar:
                    q = quote[symbol]
                    b = bar[symbol]

                    quotes_data[symbol] = {
                        'bid': float(q.bid_price),
                        'ask': float(q.ask_price),
                        'spread': float(q.ask_price - q.bid_price),
                        'bid_size': float(q.bid_size),
                        'ask_size': float(q.ask_size),
                        'last_close': float(b.close),
                        'volume': float(b.volume),
                        'vwap': float(b.vwap),
                        'high': float(b.high),
                        'low': float(b.low),
                        'timestamp': q.timestamp.isoformat()
                    }

                    print(f"{symbol}:")
                    print(f"  Bid: ${float(q.bid_price):,.2f} (Size: {float(q.bid_size):.4f})")
                    print(f"  Ask: ${float(q.ask_price):,.2f} (Size: {float(q.ask_size):.4f})")
                    print(f"  Spread: ${float(q.ask_price - q.bid_price):.2f}")
                    print(f"  Last Close: ${float(b.close):,.2f}")
                    print(f"  24h Volume: {float(b.volume):,.2f}")
                    print(f"  VWAP: ${float(b.vwap):,.2f}")
                    print()

            except Exception as e:
                print(f"Error fetching {symbol}: {e}")

        return quotes_data

    def get_historical_data(self, symbol, days=30):
        """Get historical data for analysis"""
        try:
            bars_req = CryptoBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Hour,
                start=datetime.now() - timedelta(days=days),
                end=datetime.now()
            )
            bars = self.crypto_client.get_crypto_bars(bars_req)

            if symbol in bars:
                df = bars[symbol].df
                return df
            return pd.DataFrame()

        except Exception as e:
            print(f"Error fetching historical data for {symbol}: {e}")
            return pd.DataFrame()

    def calculate_indicators(self, df):
        """Calculate technical indicators"""
        if df.empty or len(df) < 20:
            return {}

        # Simple Moving Averages
        df['SMA_20'] = df['close'].rolling(window=20).mean()
        df['SMA_50'] = df['close'].rolling(window=50).mean() if len(df) >= 50 else None

        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))

        # MACD
        exp1 = df['close'].ewm(span=12, adjust=False).mean()
        exp2 = df['close'].ewm(span=26, adjust=False).mean()
        df['MACD'] = exp1 - exp2
        df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

        # Bollinger Bands
        df['BB_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['BB_upper'] = df['BB_middle'] + (bb_std * 2)
        df['BB_lower'] = df['BB_middle'] - (bb_std * 2)

        # Volume indicators
        df['Volume_SMA'] = df['volume'].rolling(window=20).mean()
        df['Volume_Ratio'] = df['volume'] / df['Volume_SMA']

        return {
            'current_price': df['close'].iloc[-1],
            'sma_20': df['SMA_20'].iloc[-1],
            'sma_50': df['SMA_50'].iloc[-1] if df['SMA_50'] is not None else None,
            'rsi': df['RSI'].iloc[-1],
            'macd': df['MACD'].iloc[-1],
            'signal': df['Signal'].iloc[-1],
            'bb_upper': df['BB_upper'].iloc[-1],
            'bb_lower': df['BB_lower'].iloc[-1],
            'volume_ratio': df['Volume_Ratio'].iloc[-1],
            'price_change_24h': ((df['close'].iloc[-1] - df['close'].iloc[-24]) / df['close'].iloc[-24] * 100) if len(df) >= 24 else None
        }

    def find_opportunities(self):
        """Find trading opportunities based on real data"""
        print("\n=== SCANNING FOR OPPORTUNITIES ===\n")

        symbols = ["BTC/USD", "ETH/USD", "BCH/USD", "LTC/USD", "LINK/USD",
                   "UNI/USD", "AAVE/USD", "AVAX/USD", "DOT/USD", "MATIC/USD"]

        opportunities = []

        for symbol in symbols:
            print(f"Analyzing {symbol}...")

            # Get historical data
            df = self.get_historical_data(symbol, days=7)
            if df.empty:
                continue

            # Calculate indicators
            indicators = self.calculate_indicators(df)

            # Get current quote
            try:
                quote_req = CryptoLatestQuoteRequest(symbol_or_symbols=symbol)
                quote = self.crypto_client.get_crypto_latest_quote(quote_req)
                if symbol in quote:
                    current_quote = quote[symbol]
                    current_bid = float(current_quote.bid_price)
                    current_ask = float(current_quote.ask_price)
                else:
                    continue
            except:
                continue

            # Identify opportunities
            if indicators.get('rsi'):
                # Strong oversold
                if indicators['rsi'] < 30:
                    opportunities.append({
                        'symbol': symbol,
                        'type': 'BUY',
                        'confidence': 'HIGH' if indicators['rsi'] < 25 else 'MEDIUM',
                        'reason': f"RSI oversold at {indicators['rsi']:.2f}",
                        'entry': current_ask,
                        'stop_loss': current_ask * 0.97,
                        'target': current_ask * 1.05,
                        'indicators': indicators
                    })

                # Strong overbought
                elif indicators['rsi'] > 70:
                    opportunities.append({
                        'symbol': symbol,
                        'type': 'SELL',
                        'confidence': 'HIGH' if indicators['rsi'] > 75 else 'MEDIUM',
                        'reason': f"RSI overbought at {indicators['rsi']:.2f}",
                        'entry': current_bid,
                        'stop_loss': current_bid * 1.03,
                        'target': current_bid * 0.95,
                        'indicators': indicators
                    })

                # Bollinger Band squeeze
                if indicators.get('bb_lower') and indicators.get('bb_upper'):
                    if indicators['current_price'] < indicators['bb_lower']:
                        opportunities.append({
                            'symbol': symbol,
                            'type': 'BUY',
                            'confidence': 'MEDIUM',
                            'reason': "Price below lower Bollinger Band",
                            'entry': current_ask,
                            'stop_loss': indicators['bb_lower'] * 0.98,
                            'target': indicators['bb_upper'],
                            'indicators': indicators
                        })

                # MACD crossover
                if indicators.get('macd') and indicators.get('signal'):
                    if indicators['macd'] > indicators['signal'] and indicators['macd'] < 0:
                        opportunities.append({
                            'symbol': symbol,
                            'type': 'BUY',
                            'confidence': 'MEDIUM',
                            'reason': "MACD bullish crossover",
                            'entry': current_ask,
                            'stop_loss': current_ask * 0.97,
                            'target': current_ask * 1.04,
                            'indicators': indicators
                        })

        return opportunities

    def display_opportunities(self, opportunities):
        """Display found opportunities"""
        print("\n" + "="*60)
        print("         TRADING OPPORTUNITIES (REAL ALPACA DATA)")
        print("="*60 + "\n")

        if not opportunities:
            print("No strong opportunities found at this moment.")
            return

        # Sort by confidence
        opportunities.sort(key=lambda x: {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}[x['confidence']])

        for i, opp in enumerate(opportunities, 1):
            risk_reward = (opp['target'] - opp['entry']) / (opp['entry'] - opp['stop_loss'])

            print(f"{i}. {opp['symbol']} - {opp['type']} ({opp['confidence']} confidence)")
            print(f"   📊 {opp['reason']}")
            print(f"   Entry: ${opp['entry']:,.2f}")
            print(f"   Stop Loss: ${opp['stop_loss']:,.2f} ({abs(opp['stop_loss']/opp['entry']-1)*100:.1f}%)")
            print(f"   Target: ${opp['target']:,.2f} ({abs(opp['target']/opp['entry']-1)*100:.1f}%)")
            print(f"   Risk/Reward: 1:{risk_reward:.2f}")

            if opp['indicators'].get('price_change_24h'):
                print(f"   24h Change: {opp['indicators']['price_change_24h']:.2f}%")

            print()

def main():
    scanner = AlpacaMarketScanner()

    # Verify connection
    account = scanner.trading_client.get_account()
    print(f"✅ Connected to Alpaca Account: {account.account_number}")
    print(f"   Buying Power: ${float(account.buying_power):,.2f}")

    # Get real-time quotes
    quotes = scanner.get_crypto_quotes()

    # Find opportunities
    opportunities = scanner.find_opportunities()

    # Display results
    scanner.display_opportunities(opportunities)

    print("\n" + "="*60)
    print("Data Source: Alpaca Markets API (REAL DATA)")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*60)

if __name__ == "__main__":
    main()