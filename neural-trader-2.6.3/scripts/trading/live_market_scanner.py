#!/usr/bin/env python3
"""
Live Market Scanner - Real Trading Opportunities
Identifies actionable trading opportunities using live Alpaca data
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Alpaca imports
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest, CryptoLatestQuoteRequest
from alpaca.data.timeframe import TimeFrame

class LiveMarketScanner:
    def __init__(self):
        """Initialize live market scanner"""
        self.crypto_client = CryptoHistoricalDataClient()
        self.crypto_symbols = ['BTC/USD', 'ETH/USD', 'LTC/USD', 'BCH/USD', 'AAVE/USD']
        print("✅ Live Market Scanner initialized - Alpaca API connected")

    def get_crypto_data(self, symbol, days=7):
        """Get crypto historical data"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(days=days)

            request = CryptoBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Hour,
                start=start_time,
                end=end_time
            )

            bars = self.crypto_client.get_crypto_bars(request)
            df = bars.df

            if not df.empty:
                # Handle multi-index if present
                if isinstance(df.index, pd.MultiIndex):
                    df = df.reset_index()
                    df = df[df['symbol'] == symbol].copy()
                    df.set_index('timestamp', inplace=True)

                return df
            return pd.DataFrame()

        except Exception as e:
            print(f"Error getting data for {symbol}: {e}")
            return pd.DataFrame()

    def calculate_indicators(self, df):
        """Calculate key technical indicators"""
        if len(df) < 20:
            return df

        # RSI
        delta = df['close'].diff()
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))

        # Moving averages
        df['sma_20'] = df['close'].rolling(window=20).mean()
        df['ema_12'] = df['close'].ewm(span=12).mean()
        df['ema_26'] = df['close'].ewm(span=26).mean()

        # MACD
        df['macd'] = df['ema_12'] - df['ema_26']
        df['macd_signal'] = df['macd'].ewm(span=9).mean()

        # Bollinger Bands
        df['bb_std'] = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['sma_20'] + (df['bb_std'] * 2)
        df['bb_lower'] = df['sma_20'] - (df['bb_std'] * 2)

        # Price position in BB
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

        return df

    def get_latest_quote(self, symbol):
        """Get latest market quote"""
        try:
            request = CryptoLatestQuoteRequest(symbol_or_symbols=symbol)
            quotes = self.crypto_client.get_crypto_latest_quote(request)

            if symbol in quotes:
                quote = quotes[symbol]
                return {
                    'bid': float(quote.bid_price),
                    'ask': float(quote.ask_price),
                    'mid': float(quote.bid_price + quote.ask_price) / 2,
                    'spread': float(quote.ask_price - quote.bid_price),
                    'timestamp': quote.timestamp
                }
        except Exception as e:
            print(f"Error getting quote for {symbol}: {e}")

        return None

    def identify_opportunities(self, df, symbol, current_price):
        """Identify trading opportunities with clear entry/exit points"""
        if len(df) < 30:
            return []

        opportunities = []
        latest = df.iloc[-1]

        # 1. RSI Extremes
        if latest['rsi'] < 30:
            opportunities.append({
                'symbol': symbol,
                'type': 'RSI_OVERSOLD',
                'signal': 'BUY',
                'confidence': 85,
                'current_price': current_price,
                'entry_price': current_price,
                'stop_loss': current_price * 0.97,
                'take_profit': latest['sma_20'],
                'risk_pct': 3.0,
                'time_horizon': '6-24 hours',
                'description': f"RSI oversold at {latest['rsi']:.1f} - likely bounce"
            })

        elif latest['rsi'] > 70:
            opportunities.append({
                'symbol': symbol,
                'type': 'RSI_OVERBOUGHT',
                'signal': 'SELL',
                'confidence': 80,
                'current_price': current_price,
                'entry_price': current_price,
                'stop_loss': current_price * 1.03,
                'take_profit': latest['sma_20'],
                'risk_pct': 3.0,
                'time_horizon': '6-24 hours',
                'description': f"RSI overbought at {latest['rsi']:.1f} - likely pullback"
            })

        # 2. MACD Signal Changes
        if len(df) >= 2:
            prev = df.iloc[-2]

            # MACD bullish crossover
            if (latest['macd'] > latest['macd_signal'] and
                prev['macd'] <= prev['macd_signal']):
                opportunities.append({
                    'symbol': symbol,
                    'type': 'MACD_BULLISH',
                    'signal': 'BUY',
                    'confidence': 75,
                    'current_price': current_price,
                    'entry_price': current_price,
                    'stop_loss': current_price * 0.96,
                    'take_profit': current_price * 1.06,
                    'risk_pct': 4.0,
                    'time_horizon': '12-48 hours',
                    'description': "MACD bullish crossover - momentum building"
                })

            # MACD bearish crossover
            elif (latest['macd'] < latest['macd_signal'] and
                  prev['macd'] >= prev['macd_signal']):
                opportunities.append({
                    'symbol': symbol,
                    'type': 'MACD_BEARISH',
                    'signal': 'SELL',
                    'confidence': 75,
                    'current_price': current_price,
                    'entry_price': current_price,
                    'stop_loss': current_price * 1.04,
                    'take_profit': current_price * 0.94,
                    'risk_pct': 4.0,
                    'time_horizon': '12-48 hours',
                    'description': "MACD bearish crossover - momentum declining"
                })

        # 3. Bollinger Band Extremes
        if latest['bb_position'] < 0.1:  # Near lower band
            opportunities.append({
                'symbol': symbol,
                'type': 'BB_OVERSOLD',
                'signal': 'BUY',
                'confidence': 70,
                'current_price': current_price,
                'entry_price': current_price,
                'stop_loss': latest['bb_lower'] * 0.99,
                'take_profit': latest['sma_20'],
                'risk_pct': 2.5,
                'time_horizon': '4-12 hours',
                'description': f"Near Bollinger lower band - oversold bounce likely"
            })

        elif latest['bb_position'] > 0.9:  # Near upper band
            opportunities.append({
                'symbol': symbol,
                'type': 'BB_OVERBOUGHT',
                'signal': 'SELL',
                'confidence': 70,
                'current_price': current_price,
                'entry_price': current_price,
                'stop_loss': latest['bb_upper'] * 1.01,
                'take_profit': latest['sma_20'],
                'risk_pct': 2.5,
                'time_horizon': '4-12 hours',
                'description': f"Near Bollinger upper band - overbought pullback likely"
            })

        # 4. Strong Trend Following
        sma_trend = latest['close'] > latest['sma_20']
        price_momentum = (latest['close'] / df.iloc[-24]['close'] - 1) if len(df) >= 24 else 0

        if sma_trend and price_momentum > 0.05:  # Strong uptrend
            opportunities.append({
                'symbol': symbol,
                'type': 'TREND_FOLLOWING',
                'signal': 'BUY',
                'confidence': 65,
                'current_price': current_price,
                'entry_price': current_price,
                'stop_loss': latest['sma_20'] * 0.98,
                'take_profit': current_price * 1.08,
                'risk_pct': 5.0,
                'time_horizon': '1-3 days',
                'description': f"Strong uptrend continuation - {price_momentum*100:.1f}% 24h gain"
            })

        elif not sma_trend and price_momentum < -0.05:  # Strong downtrend
            opportunities.append({
                'symbol': symbol,
                'type': 'TREND_FOLLOWING',
                'signal': 'SELL',
                'confidence': 65,
                'current_price': current_price,
                'entry_price': current_price,
                'stop_loss': latest['sma_20'] * 1.02,
                'take_profit': current_price * 0.92,
                'risk_pct': 5.0,
                'time_horizon': '1-3 days',
                'description': f"Strong downtrend continuation - {price_momentum*100:.1f}% 24h decline"
            })

        return opportunities

    def calculate_metrics(self, opportunity):
        """Calculate risk/reward and other metrics"""
        entry = opportunity['entry_price']
        stop = opportunity['stop_loss']
        target = opportunity['take_profit']

        risk = abs(entry - stop)
        reward = abs(target - entry)

        opportunity['risk_amount'] = risk
        opportunity['reward_amount'] = reward
        opportunity['risk_reward_ratio'] = reward / risk if risk > 0 else 0
        opportunity['reward_pct'] = (reward / entry) * 100
        opportunity['risk_pct'] = (risk / entry) * 100

        return opportunity

    def scan_markets(self):
        """Scan all crypto markets for opportunities"""
        print(f"\n🔍 SCANNING LIVE CRYPTO MARKETS")
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print("=" * 60)

        all_opportunities = []

        for symbol in self.crypto_symbols:
            print(f"\n📊 {symbol}")

            # Get current quote
            quote = self.get_latest_quote(symbol)
            if not quote:
                print(f"  ❌ Unable to get quote")
                continue

            current_price = quote['mid']
            spread_pct = (quote['spread'] / current_price) * 100

            print(f"  💰 Price: ${current_price:,.2f}")
            print(f"  📈 Spread: {spread_pct:.3f}%")

            # Get historical data
            df = self.get_crypto_data(symbol)
            if df.empty:
                print(f"  ❌ No historical data")
                continue

            # Calculate indicators
            df = self.calculate_indicators(df)

            # Current metrics
            latest = df.iloc[-1]
            print(f"  📊 RSI: {latest['rsi']:.1f}")
            print(f"  📊 MACD: {latest['macd']:.4f}")
            print(f"  📊 vs SMA20: {((current_price/latest['sma_20']-1)*100):+.1f}%")

            # 24h change
            if len(df) >= 24:
                change_24h = (current_price / df.iloc[-24]['close'] - 1) * 100
                print(f"  📊 24h Change: {change_24h:+.2f}%")

            # Find opportunities
            opportunities = self.identify_opportunities(df, symbol, current_price)

            for opp in opportunities:
                opp = self.calculate_metrics(opp)
                all_opportunities.append(opp)

            print(f"  🎯 Opportunities: {len(opportunities)}")

        return all_opportunities

def main():
    """Main execution"""
    scanner = LiveMarketScanner()
    opportunities = scanner.scan_markets()

    if opportunities:
        # Sort by confidence
        opportunities.sort(key=lambda x: x['confidence'], reverse=True)

        print(f"\n🎯 LIVE TRADING OPPORTUNITIES ({len(opportunities)} found)")
        print("=" * 80)

        for i, opp in enumerate(opportunities, 1):
            print(f"\n#{i}. {opp['symbol']} - {opp['type']}")
            print(f"   🎯 Signal: {opp['signal']} | Confidence: {opp['confidence']}%")
            print(f"   💰 Current: ${opp['current_price']:,.2f}")
            print(f"   📝 {opp['description']}")
            print(f"   ⏱️  Horizon: {opp['time_horizon']}")

            print(f"\n   TRADING SETUP:")
            print(f"   🟢 Entry: ${opp['entry_price']:,.2f}")
            print(f"   🔴 Stop Loss: ${opp['stop_loss']:,.2f} ({opp['risk_pct']:.1f}% risk)")
            print(f"   🟦 Take Profit: ${opp['take_profit']:,.2f} ({opp['reward_pct']:.1f}% reward)")
            print(f"   📊 Risk/Reward: 1:{opp['risk_reward_ratio']:.1f}")

        # Summary
        buy_signals = len([o for o in opportunities if o['signal'] == 'BUY'])
        sell_signals = len([o for o in opportunities if o['signal'] == 'SELL'])
        avg_confidence = sum(o['confidence'] for o in opportunities) / len(opportunities)

        print(f"\n📊 MARKET SUMMARY:")
        print(f"   Buy Signals: {buy_signals}")
        print(f"   Sell Signals: {sell_signals}")
        print(f"   Average Confidence: {avg_confidence:.0f}%")

        if buy_signals > sell_signals:
            print(f"   Market Bias: BULLISH")
        elif sell_signals > buy_signals:
            print(f"   Market Bias: BEARISH")
        else:
            print(f"   Market Bias: NEUTRAL")

        # Risk management recommendations
        print(f"\n💡 POSITION SIZE RECOMMENDATIONS (1% risk per trade):")
        for opp in opportunities[:3]:  # Top 3 opportunities
            position_size = 100 / opp['risk_pct']  # $100 per 1% risk
            print(f"   {opp['symbol']}: ${position_size:.0f} position (1% portfolio risk)")

    else:
        print(f"\n❌ No clear opportunities found at this time")
        print(f"   Market may be in consolidation or low volatility period")

    print(f"\n📊 Data: Live Alpaca Markets API")
    print(f"⚠️  Always use proper risk management and do your own research")

if __name__ == "__main__":
    main()