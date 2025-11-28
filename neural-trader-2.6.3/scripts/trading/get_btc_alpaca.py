#!/usr/bin/env python3
"""
Get real-time Bitcoin data from Alpaca
"""
import sys
sys.path.append('/workspaces/neural-trader/src')
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest, CryptoLatestQuoteRequest, CryptoTradesRequest
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

def calculate_indicators(df):
    """Calculate technical indicators"""
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

    # Bollinger Bands
    df['sma20'] = df['close'].rolling(window=20).mean()
    df['bb_std'] = df['close'].rolling(window=20).std()
    df['bb_upper'] = df['sma20'] + (df['bb_std'] * 2)
    df['bb_lower'] = df['sma20'] - (df['bb_std'] * 2)

    return df

# Initialize crypto data client (no auth needed for crypto data)
crypto_client = CryptoHistoricalDataClient()

print("=== REAL-TIME BITCOIN DATA FROM ALPACA ===\n")

# Get latest quote for BTC/USD
try:
    quote_request = CryptoLatestQuoteRequest(symbol_or_symbols='BTC/USD')
    latest_quote = crypto_client.get_crypto_latest_quote(quote_request)

    print("📊 LATEST BTC/USD QUOTE:")
    for symbol, quote in latest_quote.items():
        mid_price = (quote.ask_price + quote.bid_price) / 2
        spread = quote.ask_price - quote.bid_price
        spread_pct = (spread / mid_price) * 100

        print(f"  Symbol: {symbol}")
        print(f"  Ask Price: ${quote.ask_price:,.2f}")
        print(f"  Bid Price: ${quote.bid_price:,.2f}")
        print(f"  Mid Price: ${mid_price:,.2f}")
        print(f"  Spread: ${spread:.2f} ({spread_pct:.3f}%)")
        print(f"  Ask Size: {quote.ask_size:.8f} BTC")
        print(f"  Bid Size: {quote.bid_size:.8f} BTC")
        print(f"  Exchange: {quote.ask_exchange}")
        print(f"  Timestamp: {quote.timestamp}")
except Exception as e:
    print(f"Error getting quote: {e}")

# Get 1-minute bars for the last hour
try:
    print("\n📈 1-MINUTE BARS (LAST HOUR):")

    end_time = datetime.now()
    start_time = end_time - timedelta(hours=1)

    bars_request = CryptoBarsRequest(
        symbol_or_symbols="BTC/USD",
        timeframe=TimeFrame.Minute,
        start=start_time,
        end=end_time
    )

    bars = crypto_client.get_crypto_bars(bars_request)

    # Convert to DataFrame
    df = bars.df

    if not df.empty:
        # Reset index to get timestamp as column
        df = df.reset_index()

        # Get the latest bars
        latest_bars = df.tail(5)

        print(f"\n  Last 5 minutes:")
        for idx, row in latest_bars.iterrows():
            timestamp = row['timestamp'] if 'timestamp' in row else idx
            print(f"  {timestamp}: O=${row['open']:,.2f} H=${row['high']:,.2f} L=${row['low']:,.2f} C=${row['close']:,.2f} V={row['volume']:.4f}")

        # Calculate indicators
        df = calculate_indicators(df)

        # Get latest values
        latest = df.iloc[-1]

        print(f"\n📊 TECHNICAL INDICATORS (1-min):")
        print(f"  RSI(14): {latest['rsi']:.2f}")
        print(f"  MACD: {latest['macd']:.2f}")
        print(f"  Signal: {latest['signal']:.2f}")
        print(f"  SMA(20): ${latest['sma20']:,.2f}")
        print(f"  BB Upper: ${latest['bb_upper']:,.2f}")
        print(f"  BB Lower: ${latest['bb_lower']:,.2f}")

        # Volume analysis
        print(f"\n📊 VOLUME ANALYSIS:")
        print(f"  Average Volume (1hr): {df['volume'].mean():.4f} BTC")
        print(f"  Volume Std Dev: {df['volume'].std():.4f}")
        print(f"  Last Volume: {latest['volume']:.4f} BTC")

        # Price action
        print(f"\n📊 PRICE ACTION (Last Hour):")
        print(f"  Open: ${df.iloc[0]['open']:,.2f}")
        print(f"  High: ${df['high'].max():,.2f}")
        print(f"  Low: ${df['low'].min():,.2f}")
        print(f"  Close: ${latest['close']:,.2f}")
        print(f"  Change: ${latest['close'] - df.iloc[0]['open']:,.2f} ({((latest['close'] - df.iloc[0]['open']) / df.iloc[0]['open'] * 100):.2f}%)")

        # Volatility
        returns = df['close'].pct_change()
        volatility = returns.std() * np.sqrt(60 * 24 * 365)  # Annualized from 1-min

        print(f"\n📊 VOLATILITY:")
        print(f"  1-min Return Std: {returns.std():.4%}")
        print(f"  Annualized Vol: {volatility:.2%}")

    else:
        print("  No bar data available")

except Exception as e:
    print(f"Error getting bars: {e}")

# Get recent trades
try:
    print("\n💱 RECENT TRADES:")

    trades_request = CryptoTradesRequest(
        symbol_or_symbols="BTC/USD",
        start=datetime.now() - timedelta(minutes=1)
    )

    trades = crypto_client.get_crypto_trades(trades_request)

    trades_df = trades.df
    if not trades_df.empty:
        trades_df = trades_df.reset_index()
        latest_trades = trades_df.tail(10)

        print(f"  Last 10 trades:")
        for idx, trade in latest_trades.iterrows():
            timestamp = trade['timestamp'] if 'timestamp' in trade else idx
            print(f"  {timestamp}: ${trade['price']:,.2f} x {trade['size']:.8f} BTC")

        # Trade statistics
        print(f"\n  Trade Statistics (Last Minute):")
        print(f"  Total Trades: {len(trades_df)}")
        print(f"  Avg Price: ${trades_df['price'].mean():,.2f}")
        print(f"  Total Volume: {trades_df['size'].sum():.8f} BTC")
        print(f"  VWAP: ${(trades_df['price'] * trades_df['size']).sum() / trades_df['size'].sum():,.2f}")
    else:
        print("  No recent trades available")

except Exception as e:
    print(f"Error getting trades: {e}")

print("\n" + "="*50)
print("Data provided by Alpaca Markets")