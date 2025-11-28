#!/usr/bin/env python3
"""
Real Market Opportunity Scanner
Identifies live trading opportunities in forex and crypto markets using Alpaca data
"""

import sys
import os
sys.path.append('/workspaces/neural-trader/src')

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Alpaca imports
from alpaca.data.historical import StockHistoricalDataClient, CryptoHistoricalDataClient
from alpaca.data.requests import (
    StockBarsRequest, StockLatestQuoteRequest,
    CryptoBarsRequest, CryptoLatestQuoteRequest,
    CryptoTradesRequest
)
from alpaca.data.timeframe import TimeFrame
from alpaca.mcp_integration_fixed import get_mcp_bridge

class MarketScanner:
    def __init__(self):
        """Initialize market scanner with Alpaca credentials"""
        self.api_key = "PKAJQDPYIZ1S8BHWU7GD"
        self.secret_key = "zJvREGAi3qQi6zdjhMuemKeUlWhDid78mPIGLkTw"

        # Initialize clients
        self.stock_client = StockHistoricalDataClient(self.api_key, self.secret_key)
        self.crypto_client = CryptoHistoricalDataClient()  # No auth needed for crypto
        self.bridge = get_mcp_bridge()

        # Symbols to analyze
        self.forex_symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'AUDUSD', 'NZDUSD', 'USDCHF']
        self.crypto_symbols = ['BTC/USD', 'ETH/USD', 'LTC/USD', 'BCH/USD', 'AAVE/USD']

        print("✅ Market Scanner initialized with live Alpaca API connection")

    def calculate_technical_indicators(self, df):
        """Calculate comprehensive technical indicators"""
        if df.empty or len(df) < 50:
            return df

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
        df['signal_line'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_histogram'] = df['macd'] - df['signal_line']

        # Bollinger Bands
        df['sma20'] = df['close'].rolling(window=20).mean()
        df['bb_std'] = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['sma20'] + (df['bb_std'] * 2)
        df['bb_lower'] = df['sma20'] - (df['bb_std'] * 2)
        df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['sma20']
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

        # Moving Averages
        df['sma50'] = df['close'].rolling(window=50).mean()
        df['ema9'] = df['close'].ewm(span=9).mean()
        df['ema21'] = df['close'].ewm(span=21).mean()

        # Volume indicators (if volume available)
        if 'volume' in df.columns:
            df['volume_sma'] = df['volume'].rolling(window=20).mean()
            df['volume_ratio'] = df['volume'] / df['volume_sma']

        # Momentum
        df['momentum'] = df['close'].pct_change(periods=14)
        df['price_change_1h'] = df['close'].pct_change(periods=60)  # For 1-min data

        # Support/Resistance
        df['resistance'] = df['high'].rolling(window=20).max()
        df['support'] = df['low'].rolling(window=20).min()

        return df

    def identify_patterns(self, df, symbol):
        """Identify trading patterns and opportunities"""
        if df.empty or len(df) < 50:
            return []

        opportunities = []
        latest = df.iloc[-1]

        # RSI Divergence Detection
        if latest['rsi'] < 30:
            opportunities.append({
                'type': 'RSI_OVERSOLD',
                'signal': 'BUY',
                'confidence': 0.7,
                'entry': latest['close'],
                'stop_loss': latest['support'],
                'take_profit': latest['sma20'],
                'description': f'RSI oversold at {latest["rsi"]:.1f}'
            })
        elif latest['rsi'] > 70:
            opportunities.append({
                'type': 'RSI_OVERBOUGHT',
                'signal': 'SELL',
                'confidence': 0.7,
                'entry': latest['close'],
                'stop_loss': latest['resistance'],
                'take_profit': latest['sma20'],
                'description': f'RSI overbought at {latest["rsi"]:.1f}'
            })

        # MACD Signal
        if latest['macd'] > latest['signal_line'] and df.iloc[-2]['macd'] <= df.iloc[-2]['signal_line']:
            opportunities.append({
                'type': 'MACD_BULLISH_CROSS',
                'signal': 'BUY',
                'confidence': 0.8,
                'entry': latest['close'],
                'stop_loss': latest['support'],
                'take_profit': latest['close'] * 1.02,
                'description': 'MACD bullish crossover'
            })
        elif latest['macd'] < latest['signal_line'] and df.iloc[-2]['macd'] >= df.iloc[-2]['signal_line']:
            opportunities.append({
                'type': 'MACD_BEARISH_CROSS',
                'signal': 'SELL',
                'confidence': 0.8,
                'entry': latest['close'],
                'stop_loss': latest['resistance'],
                'take_profit': latest['close'] * 0.98,
                'description': 'MACD bearish crossover'
            })

        # Bollinger Band Squeeze/Breakout
        if latest['bb_width'] < df['bb_width'].rolling(20).mean() * 0.5:
            opportunities.append({
                'type': 'BB_SQUEEZE',
                'signal': 'WAIT',
                'confidence': 0.6,
                'entry': latest['close'],
                'description': 'Bollinger Band squeeze - expect breakout'
            })

        # Bollinger Band Bounce
        if latest['bb_position'] < 0.1:  # Near lower band
            opportunities.append({
                'type': 'BB_BOUNCE_BUY',
                'signal': 'BUY',
                'confidence': 0.75,
                'entry': latest['close'],
                'stop_loss': latest['bb_lower'] * 0.995,
                'take_profit': latest['sma20'],
                'description': 'Bollinger Band lower bounce'
            })
        elif latest['bb_position'] > 0.9:  # Near upper band
            opportunities.append({
                'type': 'BB_BOUNCE_SELL',
                'signal': 'SELL',
                'confidence': 0.75,
                'entry': latest['close'],
                'stop_loss': latest['bb_upper'] * 1.005,
                'take_profit': latest['sma20'],
                'description': 'Bollinger Band upper bounce'
            })

        # Volume Anomaly
        if 'volume_ratio' in df.columns and latest['volume_ratio'] > 2:
            opportunities.append({
                'type': 'VOLUME_SPIKE',
                'signal': 'MOMENTUM',
                'confidence': 0.6,
                'entry': latest['close'],
                'description': f'Volume spike: {latest["volume_ratio"]:.1f}x average'
            })

        # Moving Average Crossover
        if latest['ema9'] > latest['ema21'] and df.iloc[-2]['ema9'] <= df.iloc[-2]['ema21']:
            opportunities.append({
                'type': 'MA_GOLDEN_CROSS',
                'signal': 'BUY',
                'confidence': 0.8,
                'entry': latest['close'],
                'stop_loss': latest['ema21'] * 0.99,
                'take_profit': latest['close'] * 1.03,
                'description': 'Golden cross: EMA9 > EMA21'
            })
        elif latest['ema9'] < latest['ema21'] and df.iloc[-2]['ema9'] >= df.iloc[-2]['ema21']:
            opportunities.append({
                'type': 'MA_DEATH_CROSS',
                'signal': 'SELL',
                'confidence': 0.8,
                'entry': latest['close'],
                'stop_loss': latest['ema21'] * 1.01,
                'take_profit': latest['close'] * 0.97,
                'description': 'Death cross: EMA9 < EMA21'
            })

        return opportunities

    def get_forex_data(self, symbol):
        """Get forex data from Alpaca"""
        try:
            # Get 1-hour bars for the last 7 days
            end_time = datetime.now()
            start_time = end_time - timedelta(days=7)

            request = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Hour,
                start=start_time,
                end=end_time
            )

            bars = self.stock_client.get_stock_bars(request)
            df = bars.df

            if not df.empty and symbol in df.index.get_level_values(0):
                df = df.xs(symbol, level=0)
                df = self.calculate_technical_indicators(df)
                return df
            return pd.DataFrame()

        except Exception as e:
            print(f"Error getting forex data for {symbol}: {e}")
            return pd.DataFrame()

    def get_crypto_data(self, symbol):
        """Get crypto data from Alpaca"""
        try:
            # Get 15-minute bars for the last 3 days
            end_time = datetime.now()
            start_time = end_time - timedelta(days=3)

            request = CryptoBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Minute15,
                start=start_time,
                end=end_time
            )

            bars = self.crypto_client.get_crypto_bars(request)
            df = bars.df

            if not df.empty:
                if symbol in df.index.get_level_values(0):
                    df = df.xs(symbol, level=0)
                df = self.calculate_technical_indicators(df)
                return df
            return pd.DataFrame()

        except Exception as e:
            print(f"Error getting crypto data for {symbol}: {e}")
            return pd.DataFrame()

    def calculate_risk_reward(self, opportunity):
        """Calculate risk/reward ratio"""
        if 'stop_loss' not in opportunity or 'take_profit' not in opportunity:
            return None

        entry = opportunity['entry']
        stop = opportunity['stop_loss']
        target = opportunity['take_profit']

        risk = abs(entry - stop)
        reward = abs(target - entry)

        if risk > 0:
            return reward / risk
        return None

    def scan_all_markets(self):
        """Scan all forex and crypto markets for opportunities"""
        print("\n🔍 SCANNING LIVE MARKETS FOR OPPORTUNITIES...")
        print("=" * 60)

        all_opportunities = []

        # Scan Forex
        print("\n📈 FOREX ANALYSIS:")
        for symbol in self.forex_symbols:
            print(f"\nAnalyzing {symbol}...")
            df = self.get_forex_data(symbol)

            if not df.empty:
                opportunities = self.identify_patterns(df, symbol)
                for opp in opportunities:
                    opp['symbol'] = symbol
                    opp['market'] = 'FOREX'
                    opp['current_price'] = df.iloc[-1]['close']
                    opp['rr_ratio'] = self.calculate_risk_reward(opp)
                    all_opportunities.append(opp)

                # Print latest data
                latest = df.iloc[-1]
                print(f"  Current: ${latest['close']:.5f}")
                print(f"  RSI: {latest['rsi']:.1f}, MACD: {latest['macd']:.4f}")
                print(f"  Opportunities found: {len(opportunities)}")
            else:
                print(f"  No data available for {symbol}")

        # Scan Crypto
        print("\n₿ CRYPTO ANALYSIS:")
        for symbol in self.crypto_symbols:
            print(f"\nAnalyzing {symbol}...")
            df = self.get_crypto_data(symbol)

            if not df.empty:
                opportunities = self.identify_patterns(df, symbol)
                for opp in opportunities:
                    opp['symbol'] = symbol
                    opp['market'] = 'CRYPTO'
                    opp['current_price'] = df.iloc[-1]['close']
                    opp['rr_ratio'] = self.calculate_risk_reward(opp)
                    all_opportunities.append(opp)

                # Print latest data
                latest = df.iloc[-1]
                print(f"  Current: ${latest['close']:,.2f}")
                print(f"  RSI: {latest['rsi']:.1f}, MACD: {latest['macd']:.2f}")
                print(f"  Opportunities found: {len(opportunities)}")
            else:
                print(f"  No data available for {symbol}")

        return all_opportunities

    def rank_opportunities(self, opportunities):
        """Rank opportunities by quality score"""
        for opp in opportunities:
            score = opp['confidence']

            # Bonus for good risk/reward
            if opp['rr_ratio'] and opp['rr_ratio'] > 2:
                score += 0.2
            elif opp['rr_ratio'] and opp['rr_ratio'] > 1.5:
                score += 0.1

            # Bonus for high-conviction signals
            if opp['type'] in ['MACD_BULLISH_CROSS', 'MACD_BEARISH_CROSS', 'MA_GOLDEN_CROSS']:
                score += 0.15

            opp['quality_score'] = min(score, 1.0)

        return sorted(opportunities, key=lambda x: x['quality_score'], reverse=True)

def main():
    """Main execution function"""
    scanner = MarketScanner()

    # Test portfolio connection
    portfolio = scanner.bridge.get_portfolio_status()
    print(f"\n📊 ALPACA ACCOUNT STATUS:")
    print(f"  Status: {portfolio.get('status', 'unknown')}")
    print(f"  Demo Mode: {portfolio.get('demo_mode', 'unknown')}")
    if portfolio.get('status') == 'success':
        print(f"  Portfolio Value: ${portfolio.get('portfolio_value', 0):,.2f}")
        print(f"  Cash: ${portfolio.get('cash', 0):,.2f}")
        print(f"  Buying Power: ${portfolio.get('buying_power', 0):,.2f}")

    # Scan for opportunities
    opportunities = scanner.scan_all_markets()

    if opportunities:
        ranked_opps = scanner.rank_opportunities(opportunities)

        print("\n🎯 TOP TRADING OPPORTUNITIES:")
        print("=" * 80)

        for i, opp in enumerate(ranked_opps[:10], 1):
            print(f"\n#{i} {opp['symbol']} ({opp['market']})")
            print(f"   Signal: {opp['signal']} | Type: {opp['type']}")
            print(f"   Description: {opp['description']}")
            print(f"   Current Price: ${opp['current_price']:,.4f}")
            print(f"   Quality Score: {opp['quality_score']:.2f}")

            if 'stop_loss' in opp and 'take_profit' in opp:
                print(f"   Entry: ${opp['entry']:,.4f}")
                print(f"   Stop Loss: ${opp['stop_loss']:,.4f}")
                print(f"   Take Profit: ${opp['take_profit']:,.4f}")
                if opp['rr_ratio']:
                    print(f"   Risk/Reward: 1:{opp['rr_ratio']:.2f}")

            print(f"   Confidence: {opp['confidence']:.0%}")
    else:
        print("\n❌ No significant opportunities found at this time.")

    print(f"\n⏰ Analysis completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("📊 All data sourced from live Alpaca Markets API")

if __name__ == "__main__":
    main()