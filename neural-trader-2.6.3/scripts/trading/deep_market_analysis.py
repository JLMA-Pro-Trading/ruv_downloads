#!/usr/bin/env python3
"""
Deep market analysis to find hidden opportunities using Alpaca real data
"""
import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from alpaca.trading.client import TradingClient
from alpaca.data.historical import CryptoHistoricalDataClient, StockHistoricalDataClient
from alpaca.data.requests import (
    CryptoBarsRequest,
    CryptoLatestQuoteRequest,
    CryptoLatestBarRequest,
    StockBarsRequest,
    StockLatestQuoteRequest
)
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Alpaca credentials
API_KEY = "PKAJQDPYIZ1S8BHWU7GD"
SECRET_KEY = "zJvREGAi3qQi6zdjhMuemKeUlWhDid78mPIGLkTw"

class DeepMarketAnalyzer:
    def __init__(self):
        self.crypto_client = CryptoHistoricalDataClient(API_KEY, SECRET_KEY)
        self.stock_client = StockHistoricalDataClient(API_KEY, SECRET_KEY)
        self.trading_client = TradingClient(API_KEY, SECRET_KEY, paper=True)

    def analyze_crypto_market(self):
        """Deep analysis of crypto markets"""
        print("\n🔍 DEEP CRYPTO MARKET ANALYSIS\n")

        symbols = ["BTC/USD", "ETH/USD", "BCH/USD", "LTC/USD", "LINK/USD",
                   "UNI/USD", "AAVE/USD", "AVAX/USD", "DOT/USD"]

        analysis_results = []

        for symbol in symbols:
            print(f"Analyzing {symbol}...")

            try:
                # Get current quote
                quote_req = CryptoLatestQuoteRequest(symbol_or_symbols=symbol)
                quote = self.crypto_client.get_crypto_latest_quote(quote_req)

                # Get 1-hour bars for last 7 days
                bars_1h = CryptoBarsRequest(
                    symbol_or_symbols=symbol,
                    timeframe=TimeFrame.Hour,
                    start=datetime.now() - timedelta(days=7),
                    end=datetime.now()
                )
                hourly_bars = self.crypto_client.get_crypto_bars(bars_1h)

                # Get 5-minute bars for last 24 hours
                bars_5m = CryptoBarsRequest(
                    symbol_or_symbols=symbol,
                    timeframe=TimeFrame.Minute,
                    start=datetime.now() - timedelta(hours=24),
                    end=datetime.now()
                )
                minute_bars = self.crypto_client.get_crypto_bars(bars_5m)

                if symbol in quote and symbol in hourly_bars:
                    q = quote[symbol]
                    df_hourly = hourly_bars[symbol].df
                    df_minute = minute_bars[symbol].df if symbol in minute_bars else pd.DataFrame()

                    # Calculate comprehensive indicators
                    analysis = self.comprehensive_analysis(df_hourly, df_minute, q, symbol)

                    if analysis:
                        analysis_results.append(analysis)

            except Exception as e:
                print(f"  Error analyzing {symbol}: {e}")
                continue

        return analysis_results

    def comprehensive_analysis(self, df_hourly, df_minute, quote, symbol):
        """Perform comprehensive technical analysis"""

        if df_hourly.empty or len(df_hourly) < 20:
            return None

        current_bid = float(quote.bid_price)
        current_ask = float(quote.ask_price)
        current_price = (current_bid + current_ask) / 2

        # Calculate all indicators
        indicators = {}

        # Price action analysis
        indicators['current_price'] = current_price
        indicators['bid'] = current_bid
        indicators['ask'] = current_ask
        indicators['spread'] = current_ask - current_bid
        indicators['spread_percent'] = (indicators['spread'] / current_price) * 100

        # Trend indicators
        df_hourly['SMA_20'] = df_hourly['close'].rolling(20).mean()
        df_hourly['SMA_50'] = df_hourly['close'].rolling(50).mean() if len(df_hourly) >= 50 else None
        df_hourly['EMA_12'] = df_hourly['close'].ewm(span=12).mean()
        df_hourly['EMA_26'] = df_hourly['close'].ewm(span=26).mean()

        # RSI
        delta = df_hourly['close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        df_hourly['RSI'] = 100 - (100 / (1 + rs))

        # MACD
        df_hourly['MACD'] = df_hourly['EMA_12'] - df_hourly['EMA_26']
        df_hourly['Signal'] = df_hourly['MACD'].ewm(span=9).mean()
        df_hourly['MACD_Histogram'] = df_hourly['MACD'] - df_hourly['Signal']

        # Bollinger Bands
        df_hourly['BB_Middle'] = df_hourly['close'].rolling(20).mean()
        bb_std = df_hourly['close'].rolling(20).std()
        df_hourly['BB_Upper'] = df_hourly['BB_Middle'] + (bb_std * 2)
        df_hourly['BB_Lower'] = df_hourly['BB_Middle'] - (bb_std * 2)
        df_hourly['BB_Width'] = df_hourly['BB_Upper'] - df_hourly['BB_Lower']
        df_hourly['BB_Position'] = (df_hourly['close'] - df_hourly['BB_Lower']) / df_hourly['BB_Width']

        # Stochastic
        low_14 = df_hourly['low'].rolling(14).min()
        high_14 = df_hourly['high'].rolling(14).max()
        df_hourly['Stoch_K'] = 100 * ((df_hourly['close'] - low_14) / (high_14 - low_14))
        df_hourly['Stoch_D'] = df_hourly['Stoch_K'].rolling(3).mean()

        # Volume analysis
        df_hourly['Volume_SMA'] = df_hourly['volume'].rolling(20).mean()
        df_hourly['Volume_Ratio'] = df_hourly['volume'] / df_hourly['Volume_SMA']

        # ATR (Average True Range)
        high_low = df_hourly['high'] - df_hourly['low']
        high_close = abs(df_hourly['high'] - df_hourly['close'].shift())
        low_close = abs(df_hourly['low'] - df_hourly['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        df_hourly['ATR'] = true_range.rolling(14).mean()

        # Get latest values
        latest = df_hourly.iloc[-1]
        prev = df_hourly.iloc[-2] if len(df_hourly) > 1 else latest

        indicators['rsi'] = latest['RSI']
        indicators['macd'] = latest['MACD']
        indicators['signal'] = latest['Signal']
        indicators['macd_histogram'] = latest['MACD_Histogram']
        indicators['bb_position'] = latest['BB_Position']
        indicators['stoch_k'] = latest['Stoch_K']
        indicators['stoch_d'] = latest['Stoch_D']
        indicators['atr'] = latest['ATR']
        indicators['volume_ratio'] = latest['Volume_Ratio']

        # Price changes
        indicators['change_1h'] = ((current_price - df_hourly['close'].iloc[-2]) / df_hourly['close'].iloc[-2]) * 100 if len(df_hourly) > 1 else 0
        indicators['change_24h'] = ((current_price - df_hourly['close'].iloc[-24]) / df_hourly['close'].iloc[-24]) * 100 if len(df_hourly) >= 24 else 0
        indicators['change_7d'] = ((current_price - df_hourly['close'].iloc[0]) / df_hourly['close'].iloc[0]) * 100

        # Identify opportunities
        opportunities = []
        confidence = 0
        reasons = []

        # RSI signals
        if indicators['rsi'] < 30:
            confidence += 30
            reasons.append(f"RSI oversold at {indicators['rsi']:.1f}")
            if indicators['rsi'] < 25:
                confidence += 10
                reasons.append("Extreme oversold")

        elif indicators['rsi'] > 70:
            confidence -= 30
            reasons.append(f"RSI overbought at {indicators['rsi']:.1f}")
            if indicators['rsi'] > 75:
                confidence -= 10
                reasons.append("Extreme overbought")

        # MACD signals
        if indicators['macd'] > indicators['signal'] and prev['MACD'] <= prev['Signal']:
            confidence += 20
            reasons.append("MACD bullish crossover")
        elif indicators['macd'] < indicators['signal'] and prev['MACD'] >= prev['Signal']:
            confidence -= 20
            reasons.append("MACD bearish crossover")

        # Bollinger Band signals
        if indicators['bb_position'] < 0.2:
            confidence += 15
            reasons.append("Near lower Bollinger Band")
        elif indicators['bb_position'] > 0.8:
            confidence -= 15
            reasons.append("Near upper Bollinger Band")

        # Stochastic signals
        if indicators['stoch_k'] < 20:
            confidence += 10
            reasons.append(f"Stochastic oversold at {indicators['stoch_k']:.1f}")
        elif indicators['stoch_k'] > 80:
            confidence -= 10
            reasons.append(f"Stochastic overbought at {indicators['stoch_k']:.1f}")

        # Volume signal
        if indicators['volume_ratio'] > 1.5:
            reasons.append(f"High volume ratio: {indicators['volume_ratio']:.2f}x")
            if confidence > 0:
                confidence += 10
            else:
                confidence -= 10

        # Determine action
        if confidence >= 30:
            action = "BUY"
            entry = current_ask
            stop_loss = entry * (1 - indicators['atr'] / entry * 2)
            target = entry * (1 + indicators['atr'] / entry * 3)
        elif confidence <= -30:
            action = "SELL"
            entry = current_bid
            stop_loss = entry * (1 + indicators['atr'] / entry * 2)
            target = entry * (1 - indicators['atr'] / entry * 3)
        else:
            action = "HOLD"
            entry = current_price
            stop_loss = None
            target = None

        return {
            'symbol': symbol,
            'action': action,
            'confidence': abs(confidence),
            'reasons': reasons,
            'entry': entry,
            'stop_loss': stop_loss,
            'target': target,
            'risk_reward': (abs(target - entry) / abs(entry - stop_loss)) if stop_loss and target else None,
            'indicators': indicators
        }

    def analyze_forex_alternatives(self):
        """Analyze forex-related ETFs"""
        print("\n💱 FOREX ALTERNATIVES ANALYSIS\n")

        forex_etfs = {
            "FXE": "Euro ETF",
            "FXB": "British Pound ETF",
            "FXY": "Japanese Yen ETF",
            "FXC": "Canadian Dollar ETF",
            "FXA": "Australian Dollar ETF",
            "UUP": "US Dollar Index"
        }

        opportunities = []

        for symbol, name in forex_etfs.items():
            try:
                # Get latest quote
                quote_req = StockLatestQuoteRequest(symbol_or_symbols=symbol)
                quote = self.stock_client.get_stock_latest_quote(quote_req)

                # Get daily bars
                bars_req = StockBarsRequest(
                    symbol_or_symbols=symbol,
                    timeframe=TimeFrame.Day,
                    start=datetime.now() - timedelta(days=30),
                    end=datetime.now()
                )
                bars = self.stock_client.get_stock_bars(bars_req)

                if symbol in quote and symbol in bars:
                    q = quote[symbol]
                    df = bars[symbol].df

                    if len(df) >= 14:
                        # Calculate simple RSI
                        delta = df['close'].diff()
                        gain = delta.where(delta > 0, 0).rolling(14).mean()
                        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
                        rs = gain / loss
                        rsi = 100 - (100 / (1 + rs))

                        current_rsi = rsi.iloc[-1]
                        current_price = float(q.ask_price)

                        if current_rsi < 35:
                            opportunities.append({
                                'symbol': symbol,
                                'name': name,
                                'action': 'BUY',
                                'reason': f'RSI oversold at {current_rsi:.1f}',
                                'price': current_price
                            })
                        elif current_rsi > 65:
                            opportunities.append({
                                'symbol': symbol,
                                'name': name,
                                'action': 'SELL',
                                'reason': f'RSI overbought at {current_rsi:.1f}',
                                'price': current_price
                            })

            except Exception as e:
                print(f"Error analyzing {symbol}: {e}")

        return opportunities

    def display_results(self, crypto_analysis, forex_opportunities):
        """Display comprehensive results"""
        print("\n" + "="*70)
        print("       🎯 REAL TRADING OPPORTUNITIES FROM ALPACA DATA")
        print("="*70 + "\n")

        # Filter for actionable signals
        actionable = [a for a in crypto_analysis if a['action'] in ['BUY', 'SELL']]

        if actionable:
            # Sort by confidence
            actionable.sort(key=lambda x: x['confidence'], reverse=True)

            print("📊 CRYPTO OPPORTUNITIES:\n")
            for i, opp in enumerate(actionable[:5], 1):  # Top 5
                print(f"{i}. {opp['symbol']} - {opp['action']} ({opp['confidence']}% confidence)")
                for reason in opp['reasons'][:3]:  # Top 3 reasons
                    print(f"   • {reason}")
                print(f"   Entry: ${opp['entry']:,.2f}")
                if opp['stop_loss'] and opp['target']:
                    print(f"   Stop Loss: ${opp['stop_loss']:,.2f}")
                    print(f"   Target: ${opp['target']:,.2f}")
                    print(f"   Risk/Reward: 1:{opp['risk_reward']:.2f}")
                print(f"   Current Indicators:")
                print(f"     RSI: {opp['indicators']['rsi']:.1f}")
                print(f"     24h Change: {opp['indicators']['change_24h']:.2f}%")
                print()

        if forex_opportunities:
            print("💱 FOREX ETF OPPORTUNITIES:\n")
            for opp in forex_opportunities:
                print(f"• {opp['symbol']} ({opp['name']}): {opp['action']}")
                print(f"  {opp['reason']}")
                print(f"  Current Price: ${opp['price']:.2f}\n")

        if not actionable and not forex_opportunities:
            print("No strong opportunities at this moment.")
            print("\nMarket Conditions:")
            for analysis in crypto_analysis[:3]:
                print(f"• {analysis['symbol']}: {analysis['action']}")
                print(f"  RSI: {analysis['indicators']['rsi']:.1f}, 24h: {analysis['indicators']['change_24h']:.2f}%")

def main():
    analyzer = DeepMarketAnalyzer()

    # Verify connection
    account = analyzer.trading_client.get_account()
    print(f"✅ Connected to Alpaca Account: {account.account_number}")
    print(f"   Buying Power: ${float(account.buying_power):,.2f}")

    # Deep crypto analysis
    crypto_analysis = analyzer.analyze_crypto_market()

    # Forex alternatives
    forex_opportunities = analyzer.analyze_forex_alternatives()

    # Display results
    analyzer.display_results(crypto_analysis, forex_opportunities)

    print("\n" + "="*70)
    print("Data Source: 100% REAL Alpaca Markets API")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*70)

if __name__ == "__main__":
    main()