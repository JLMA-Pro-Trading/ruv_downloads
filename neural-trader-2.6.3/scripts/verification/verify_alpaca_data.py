#!/usr/bin/env python3
"""
Verify and fetch real Alpaca market data for forex and crypto
"""
import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from alpaca.trading.client import TradingClient
from alpaca.data.historical import StockHistoricalDataClient, CryptoHistoricalDataClient
from alpaca.data.requests import (
    StockLatestQuoteRequest,
    CryptoBarsRequest,
    CryptoLatestQuoteRequest
)
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta
import pandas as pd

# Alpaca credentials
API_KEY = "PKAJQDPYIZ1S8BHWU7GD"
SECRET_KEY = "zJvREGAi3qQi6zdjhMuemKeUlWhDid78mPIGLkTw"

def fetch_crypto_data():
    """Fetch real crypto data from Alpaca"""
    print("\n=== FETCHING REAL ALPACA CRYPTO DATA ===\n")

    crypto_client = CryptoHistoricalDataClient(API_KEY, SECRET_KEY)

    # Crypto symbols available on Alpaca
    crypto_symbols = ["BTC/USD", "ETH/USD", "BCH/USD", "LTC/USD", "LINK/USD",
                      "UNI/USD", "AAVE/USD", "AVAX/USD", "DOT/USD", "MATIC/USD"]

    market_data = {}

    for symbol in crypto_symbols:
        try:
            # Get latest quote
            quote_request = CryptoLatestQuoteRequest(symbol_or_symbols=symbol)
            quote = crypto_client.get_crypto_latest_quote(quote_request)

            # Get recent bars for analysis
            bars_request = CryptoBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=TimeFrame.Hour,
                start=datetime.now() - timedelta(days=7)
            )
            bars = crypto_client.get_crypto_bars(bars_request)

            if symbol in quote:
                quote_data = quote[symbol]
                df = bars[symbol].df if symbol in bars else pd.DataFrame()

                # Calculate metrics
                if not df.empty:
                    current_price = float(quote_data.ask_price)
                    daily_high = df['high'].iloc[-24:].max() if len(df) >= 24 else df['high'].max()
                    daily_low = df['low'].iloc[-24:].min() if len(df) >= 24 else df['low'].min()
                    daily_volume = df['volume'].iloc[-24:].sum() if len(df) >= 24 else df['volume'].sum()

                    # Simple technical indicators
                    sma_20 = df['close'].rolling(20).mean().iloc[-1] if len(df) >= 20 else None
                    rsi = calculate_rsi(df['close']) if len(df) >= 14 else None

                    market_data[symbol] = {
                        'current_price': current_price,
                        'bid': float(quote_data.bid_price),
                        'ask': float(quote_data.ask_price),
                        'spread': float(quote_data.ask_price - quote_data.bid_price),
                        'daily_high': daily_high,
                        'daily_low': daily_low,
                        'daily_volume': daily_volume,
                        'sma_20': sma_20,
                        'rsi': rsi,
                        'timestamp': quote_data.timestamp.isoformat()
                    }

                    print(f"{symbol}:")
                    print(f"  Current: ${current_price:,.2f}")
                    print(f"  Bid/Ask: ${float(quote_data.bid_price):,.2f} / ${float(quote_data.ask_price):,.2f}")
                    print(f"  Daily Range: ${daily_low:,.2f} - ${daily_high:,.2f}")
                    if rsi:
                        print(f"  RSI: {rsi:.2f}")
                    print()

        except Exception as e:
            print(f"Error fetching {symbol}: {e}")

    return market_data

def fetch_forex_data():
    """Note: Alpaca does not support direct forex trading"""
    print("\n=== FOREX DATA ===")
    print("Note: Alpaca does not offer direct forex trading.")
    print("For forex, you would need to use currency ETFs or futures.\n")

    # We can look at currency-related ETFs as proxy
    stock_client = StockHistoricalDataClient(API_KEY, SECRET_KEY)

    # Currency ETFs available on Alpaca
    forex_etfs = {
        "FXE": "Euro",
        "FXB": "British Pound",
        "FXY": "Japanese Yen",
        "FXC": "Canadian Dollar",
        "FXA": "Australian Dollar",
        "UUP": "US Dollar Index"
    }

    for symbol, currency in forex_etfs.items():
        try:
            request = StockLatestQuoteRequest(symbol_or_symbols=symbol)
            quote = stock_client.get_stock_latest_quote(request)

            if symbol in quote:
                q = quote[symbol]
                print(f"{symbol} ({currency}):")
                print(f"  Bid: ${float(q.bid_price):.2f}")
                print(f"  Ask: ${float(q.ask_price):.2f}")
                print()
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")

def calculate_rsi(prices, period=14):
    """Calculate RSI"""
    if len(prices) < period:
        return None

    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.iloc[-1]

def identify_opportunities(market_data):
    """Identify trading opportunities from real data"""
    print("\n=== TRADING OPPORTUNITIES (REAL DATA) ===\n")

    opportunities = []

    for symbol, data in market_data.items():
        if data.get('rsi'):
            # Oversold condition
            if data['rsi'] < 30:
                opportunities.append({
                    'symbol': symbol,
                    'type': 'BUY',
                    'reason': f"RSI oversold at {data['rsi']:.2f}",
                    'current_price': data['current_price'],
                    'entry': data['ask'],
                    'stop_loss': data['current_price'] * 0.98,
                    'target': data['current_price'] * 1.03
                })
            # Overbought condition
            elif data['rsi'] > 70:
                opportunities.append({
                    'symbol': symbol,
                    'type': 'SELL',
                    'reason': f"RSI overbought at {data['rsi']:.2f}",
                    'current_price': data['current_price'],
                    'entry': data['bid'],
                    'stop_loss': data['current_price'] * 1.02,
                    'target': data['current_price'] * 0.97
                })

    for opp in opportunities:
        print(f"📊 {opp['symbol']} - {opp['type']} Signal")
        print(f"   Reason: {opp['reason']}")
        print(f"   Current: ${opp['current_price']:,.2f}")
        print(f"   Entry: ${opp['entry']:,.2f}")
        print(f"   Stop Loss: ${opp['stop_loss']:,.2f}")
        print(f"   Target: ${opp['target']:,.2f}")
        print(f"   Risk/Reward: 1:{(opp['target']-opp['entry'])/(opp['entry']-opp['stop_loss']):.1f}")
        print()

    if not opportunities:
        print("No immediate opportunities based on RSI criteria.")
        print("Markets are in neutral territory.")

    return opportunities

if __name__ == "__main__":
    # Connect and verify
    trading_client = TradingClient(API_KEY, SECRET_KEY, paper=True)
    account = trading_client.get_account()
    print(f"✅ Connected to Alpaca Account: {account.account_number}")
    print(f"   Buying Power: ${float(account.buying_power):,.2f}\n")

    # Fetch real crypto data
    crypto_data = fetch_crypto_data()

    # Check forex alternatives
    fetch_forex_data()

    # Identify opportunities
    opportunities = identify_opportunities(crypto_data)

    print("\n" + "="*50)
    print("All data fetched from REAL Alpaca Markets API")
    print(f"Timestamp: {datetime.now().isoformat()}")