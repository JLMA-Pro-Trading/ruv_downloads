#!/usr/bin/env python3
"""
Live Crypto Opportunity Finder
Identifies real trading opportunities in crypto markets using Alpaca data
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Alpaca imports
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import (
    CryptoBarsRequest, CryptoLatestQuoteRequest,
    CryptoTradesRequest
)
from alpaca.data.timeframe import TimeFrame

class CryptoOpportunityFinder:
    def __init__(self):
        """Initialize crypto opportunity finder"""
        # No auth needed for crypto data
        self.crypto_client = CryptoHistoricalDataClient()

        # Major crypto pairs available on Alpaca
        self.crypto_symbols = [
            'BTC/USD', 'ETH/USD', 'LTC/USD', 'BCH/USD',
            'AAVE/USD', 'DOT/USD', 'LINK/USD', 'UNI/USD'
        ]

        print("✅ Crypto Opportunity Finder initialized with live Alpaca API")

    def calculate_advanced_indicators(self, df):
        """Calculate comprehensive technical indicators"""
        if df.empty or len(df) < 50:
            return df

        # Price-based indicators
        df['returns'] = df['close'].pct_change()

        # RSI with multiple periods
        for period in [14, 21]:
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            df[f'rsi_{period}'] = 100 - (100 / (1 + rs))

        # MACD with histogram
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
        for period in [9, 21, 50]:
            df[f'ema_{period}'] = df['close'].ewm(span=period).mean()
            df[f'sma_{period}'] = df['close'].rolling(window=period).mean()

        # Volume indicators
        if 'volume' in df.columns and df['volume'].sum() > 0:
            df['volume_sma'] = df['volume'].rolling(window=20).mean()
            df['volume_ratio'] = df['volume'] / df['volume_sma']
            df['vwap'] = (df['close'] * df['volume']).cumsum() / df['volume'].cumsum()
        else:
            df['volume_ratio'] = 1
            df['vwap'] = df['close']

        # Momentum indicators
        df['momentum_10'] = df['close'] / df['close'].shift(10) - 1
        df['momentum_20'] = df['close'] / df['close'].shift(20) - 1

        # Volatility
        df['volatility'] = df['returns'].rolling(window=20).std()
        df['atr'] = df[['high', 'low', 'close']].apply(
            lambda x: max(x['high'] - x['low'],
                         abs(x['high'] - x['close']),
                         abs(x['low'] - x['close'])), axis=1
        ).rolling(window=14).mean()

        # Support and Resistance
        df['resistance'] = df['high'].rolling(window=20).max()
        df['support'] = df['low'].rolling(window=20).min()
        df['pivot'] = (df['high'] + df['low'] + df['close']) / 3

        return df

    def identify_crypto_opportunities(self, df, symbol):
        """Identify specific crypto trading opportunities"""
        if df.empty or len(df) < 50:
            return []

        opportunities = []
        latest = df.iloc[-1]
        prev = df.iloc[-2]

        # 1. RSI Divergence Patterns
        if latest['rsi_14'] < 30 and latest['rsi_21'] < 35:
            opportunities.append({
                'type': 'RSI_OVERSOLD_CONFLUENCE',
                'signal': 'STRONG_BUY',
                'confidence': 0.85,
                'entry': latest['close'],
                'stop_loss': latest['support'] * 0.995,
                'take_profit': latest['sma20'],
                'time_horizon': '4-8 hours',
                'description': f'RSI oversold confluence: RSI14={latest["rsi_14"]:.1f}, RSI21={latest["rsi_21"]:.1f}'
            })

        elif latest['rsi_14'] > 70 and latest['rsi_21'] > 65:
            opportunities.append({
                'type': 'RSI_OVERBOUGHT_CONFLUENCE',
                'signal': 'STRONG_SELL',
                'confidence': 0.85,
                'entry': latest['close'],
                'stop_loss': latest['resistance'] * 1.005,
                'take_profit': latest['sma20'],
                'time_horizon': '4-8 hours',
                'description': f'RSI overbought confluence: RSI14={latest["rsi_14"]:.1f}, RSI21={latest["rsi_21"]:.1f}'
            })

        # 2. MACD Momentum Shifts
        if (latest['macd'] > latest['signal_line'] and
            prev['macd'] <= prev['signal_line'] and
            latest['macd_histogram'] > 0):

            opportunities.append({
                'type': 'MACD_BULLISH_BREAKOUT',
                'signal': 'BUY',
                'confidence': 0.8,
                'entry': latest['close'],
                'stop_loss': latest['ema_21'] * 0.98,
                'take_profit': latest['close'] * 1.025,
                'time_horizon': '2-6 hours',
                'description': 'MACD bullish crossover with positive histogram'
            })

        # 3. Bollinger Band Squeeze to Expansion
        bb_squeeze = latest['bb_width'] < df['bb_width'].rolling(50).mean() * 0.7
        price_breakout = latest['close'] > latest['bb_upper'] or latest['close'] < latest['bb_lower']

        if bb_squeeze and price_breakout:
            signal = 'BUY' if latest['close'] > latest['bb_upper'] else 'SELL'
            target_multiplier = 1.03 if signal == 'BUY' else 0.97
            stop_multiplier = 0.985 if signal == 'BUY' else 1.015

            opportunities.append({
                'type': 'BB_SQUEEZE_BREAKOUT',
                'signal': signal,
                'confidence': 0.9,
                'entry': latest['close'],
                'stop_loss': latest['close'] * stop_multiplier,
                'take_profit': latest['close'] * target_multiplier,
                'time_horizon': '1-4 hours',
                'description': f'Bollinger Band squeeze breakout {signal.lower()}'
            })

        # 4. Volume Surge with Price Action
        if latest['volume_ratio'] > 3 and abs(latest['returns']) > 0.02:
            direction = 'BUY' if latest['returns'] > 0 else 'SELL'
            opportunities.append({
                'type': 'VOLUME_PRICE_SURGE',
                'signal': direction,
                'confidence': 0.75,
                'entry': latest['close'],
                'time_horizon': '30 minutes - 2 hours',
                'description': f'Volume surge {latest["volume_ratio"]:.1f}x with {latest["returns"]*100:.1f}% price move'
            })

        # 5. Multi-Timeframe MA Alignment
        ma_bullish = (latest['ema_9'] > latest['ema_21'] > latest['ema_50'] and
                      latest['close'] > latest['ema_9'])
        ma_bearish = (latest['ema_9'] < latest['ema_21'] < latest['ema_50'] and
                      latest['close'] < latest['ema_9'])

        if ma_bullish and prev['ema_9'] <= prev['ema_21']:
            opportunities.append({
                'type': 'MA_BULLISH_ALIGNMENT',
                'signal': 'BUY',
                'confidence': 0.85,
                'entry': latest['close'],
                'stop_loss': latest['ema_21'] * 0.995,
                'take_profit': latest['close'] * 1.04,
                'time_horizon': '6-12 hours',
                'description': 'Moving average bullish alignment with fresh breakout'
            })

        elif ma_bearish and prev['ema_9'] >= prev['ema_21']:
            opportunities.append({
                'type': 'MA_BEARISH_ALIGNMENT',
                'signal': 'SELL',
                'confidence': 0.85,
                'entry': latest['close'],
                'stop_loss': latest['ema_21'] * 1.005,
                'take_profit': latest['close'] * 0.96,
                'time_horizon': '6-12 hours',
                'description': 'Moving average bearish alignment with fresh breakdown'
            })

        # 6. Mean Reversion at Key Levels
        distance_from_vwap = (latest['close'] - latest['vwap']) / latest['vwap']

        if distance_from_vwap > 0.03:  # 3% above VWAP
            opportunities.append({
                'type': 'VWAP_MEAN_REVERSION',
                'signal': 'SELL',
                'confidence': 0.7,
                'entry': latest['close'],
                'stop_loss': latest['close'] * 1.015,
                'take_profit': latest['vwap'],
                'time_horizon': '2-6 hours',
                'description': f'Mean reversion: {distance_from_vwap*100:.1f}% above VWAP'
            })

        elif distance_from_vwap < -0.03:  # 3% below VWAP
            opportunities.append({
                'type': 'VWAP_MEAN_REVERSION',
                'signal': 'BUY',
                'confidence': 0.7,
                'entry': latest['close'],
                'stop_loss': latest['close'] * 0.985,
                'take_profit': latest['vwap'],
                'time_horizon': '2-6 hours',
                'description': f'Mean reversion: {distance_from_vwap*100:.1f}% below VWAP'
            })

        return opportunities

    def get_latest_crypto_quote(self, symbol):
        """Get latest quote with spread analysis"""
        try:
            quote_request = CryptoLatestQuoteRequest(symbol_or_symbols=symbol)
            quote_data = self.crypto_client.get_crypto_latest_quote(quote_request)

            if symbol in quote_data:
                quote = quote_data[symbol]
                mid_price = (quote.ask_price + quote.bid_price) / 2
                spread = quote.ask_price - quote.bid_price
                spread_pct = (spread / mid_price) * 100

                return {
                    'ask': quote.ask_price,
                    'bid': quote.bid_price,
                    'mid': mid_price,
                    'spread': spread,
                    'spread_pct': spread_pct,
                    'timestamp': quote.timestamp
                }
        except Exception as e:
            print(f"Error getting quote for {symbol}: {e}")

        return None

    def analyze_crypto_symbol(self, symbol):
        """Comprehensive analysis of a crypto symbol"""
        print(f"\n🔍 Analyzing {symbol}...")

        # Get latest quote
        quote = self.get_latest_crypto_quote(symbol)
        if quote:
            print(f"  Current Price: ${quote['mid']:,.2f} (Spread: {quote['spread_pct']:.3f}%)")

        # Get historical data (1-hour bars for last 3 days)
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(days=3)

            bars_request = CryptoBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Hour,  # Use 1-hour timeframe for better data availability
                start=start_time,
                end=end_time
            )

            bars = self.crypto_client.get_crypto_bars(bars_request)
            df = bars.df

            if not df.empty:
                if symbol in df.index.get_level_values(0):
                    df = df.xs(symbol, level=0)

                # Calculate indicators
                df = self.calculate_advanced_indicators(df)

                if len(df) >= 50:
                    # Identify opportunities
                    opportunities = self.identify_crypto_opportunities(df, symbol)

                    # Print current metrics
                    latest = df.iloc[-1]
                    print(f"  RSI(14): {latest['rsi_14']:.1f}")
                    print(f"  MACD: {latest['macd']:.4f} (Signal: {latest['signal_line']:.4f})")
                    print(f"  BB Position: {latest['bb_position']:.2f} (0=bottom, 1=top)")
                    print(f"  Volatility: {latest['volatility']*100:.2f}%")

                    if latest['volume_ratio'] > 0:
                        print(f"  Volume Ratio: {latest['volume_ratio']:.1f}x average")

                    # 24h change
                    if len(df) >= 24:  # 24 hours of 1-hour bars
                        change_24h = (latest['close'] / df.iloc[-24]['close'] - 1) * 100
                        print(f"  24h Change: {change_24h:+.2f}%")

                    print(f"  🎯 Opportunities Found: {len(opportunities)}")

                    return opportunities, df, quote
                else:
                    print(f"  ❌ Insufficient data for analysis")
            else:
                print(f"  ❌ No data available")

        except Exception as e:
            print(f"  ❌ Error: {e}")

        return [], pd.DataFrame(), quote

    def calculate_portfolio_allocation(self, opportunities):
        """Calculate optimal portfolio allocation for opportunities"""
        if not opportunities:
            return {}

        # Score and weight opportunities
        total_score = sum(opp['confidence'] * opp.get('quality_score', 1) for opp in opportunities)

        allocations = {}
        for opp in opportunities:
            weight = (opp['confidence'] * opp.get('quality_score', 1)) / total_score
            # Cap individual positions at 10%
            weight = min(weight, 0.10)
            allocations[opp['symbol']] = {
                'allocation': weight,
                'signal': opp['signal'],
                'entry': opp['entry'],
                'confidence': opp['confidence']
            }

        return allocations

    def run_comprehensive_scan(self):
        """Run comprehensive scan across all crypto symbols"""
        print("\n🚀 LIVE CRYPTO OPPORTUNITY SCANNER")
        print("=" * 60)
        print(f"⏰ Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")

        all_opportunities = []

        for symbol in self.crypto_symbols:
            opportunities, df, quote = self.analyze_crypto_symbol(symbol)

            # Add metadata to opportunities
            for opp in opportunities:
                opp['symbol'] = symbol
                opp['current_price'] = quote['mid'] if quote else opp['entry']

                # Calculate risk/reward ratio
                if 'stop_loss' in opp and 'take_profit' in opp:
                    risk = abs(opp['entry'] - opp['stop_loss'])
                    reward = abs(opp['take_profit'] - opp['entry'])
                    opp['risk_reward'] = reward / risk if risk > 0 else None

                # Quality score based on multiple factors
                score = opp['confidence']
                if opp.get('risk_reward', 0) > 2:
                    score += 0.15
                if 'CONFLUENCE' in opp['type'] or 'ALIGNMENT' in opp['type']:
                    score += 0.1
                opp['quality_score'] = min(score, 1.0)

                all_opportunities.append(opp)

        return all_opportunities

def main():
    """Main execution"""
    finder = CryptoOpportunityFinder()

    # Run comprehensive scan
    opportunities = finder.run_comprehensive_scan()

    if opportunities:
        # Sort by quality score
        opportunities.sort(key=lambda x: x['quality_score'], reverse=True)

        print(f"\n🎯 TOP CRYPTO OPPORTUNITIES ({len(opportunities)} total)")
        print("=" * 80)

        # Show top 10 opportunities
        for i, opp in enumerate(opportunities[:10], 1):
            print(f"\n#{i} {opp['symbol']} - {opp['type']}")
            print(f"   📊 Signal: {opp['signal']} | Confidence: {opp['confidence']:.0%}")
            print(f"   💰 Current Price: ${opp['current_price']:,.2f}")
            print(f"   📝 {opp['description']}")
            print(f"   ⏱️  Time Horizon: {opp.get('time_horizon', 'Not specified')}")

            if 'stop_loss' in opp and 'take_profit' in opp:
                print(f"   🎯 Entry: ${opp['entry']:,.2f}")
                print(f"   🛑 Stop Loss: ${opp['stop_loss']:,.2f}")
                print(f"   💎 Take Profit: ${opp['take_profit']:,.2f}")
                if opp.get('risk_reward'):
                    print(f"   📈 Risk/Reward: 1:{opp['risk_reward']:.2f}")

            print(f"   ⭐ Quality Score: {opp['quality_score']:.2f}/1.00")

        # Portfolio allocation suggestion
        print(f"\n💼 SUGGESTED PORTFOLIO ALLOCATION:")
        print("-" * 40)
        allocations = finder.calculate_portfolio_allocation(opportunities[:5])

        for symbol, alloc in allocations.items():
            print(f"  {symbol}: {alloc['allocation']:.1%} ({alloc['signal']})")

        print(f"\n📊 MARKET SUMMARY:")
        buy_signals = len([o for o in opportunities if 'BUY' in o['signal']])
        sell_signals = len([o for o in opportunities if 'SELL' in o['signal']])
        print(f"  Buy Signals: {buy_signals}")
        print(f"  Sell Signals: {sell_signals}")
        print(f"  Market Bias: {'BULLISH' if buy_signals > sell_signals else 'BEARISH' if sell_signals > buy_signals else 'NEUTRAL'}")

    else:
        print("\n❌ No significant opportunities identified at this time.")
        print("   Consider checking back in 15-30 minutes for new setups.")

    print(f"\n📈 Data Source: Live Alpaca Markets API")
    print(f"⚠️  Note: This is for educational purposes. Always do your own research.")

if __name__ == "__main__":
    main()