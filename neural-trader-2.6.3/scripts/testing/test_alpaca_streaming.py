#!/usr/bin/env python3
"""
Test Alpaca WebSocket streaming with real-time data
"""

import os
import sys
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.alpaca_trading.websocket.alpaca_client import AlpacaWebSocketClient
from src.alpaca_trading.websocket.stream_manager import StreamManager

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AlpacaStreamTester:
    """Test Alpaca WebSocket streaming"""
    
    def __init__(self):
        self.api_key = os.getenv('ALPACA_API_KEY')
        self.api_secret = os.getenv('ALPACA_API_SECRET')
        self.trade_count = 0
        self.quote_count = 0
        self.bar_count = 0
        self.start_time = datetime.now()
        
    async def handle_trades(self, messages):
        """Handle trade messages"""
        for trade in messages:
            self.trade_count += 1
            logger.info(f"📈 Trade #{self.trade_count}: {trade.get('S', 'N/A')} @ ${trade.get('p', 0):.2f} x {trade.get('s', 0)}")
    
    async def handle_quotes(self, messages):
        """Handle quote messages"""
        for quote in messages:
            self.quote_count += 1
            if self.quote_count % 10 == 0:  # Log every 10th quote to reduce spam
                logger.info(f"📊 Quote #{self.quote_count}: {quote.get('S', 'N/A')} Bid: ${quote.get('bp', 0):.2f} Ask: ${quote.get('ap', 0):.2f}")
    
    async def handle_bars(self, messages):
        """Handle bar messages"""
        for bar in messages:
            self.bar_count += 1
            logger.info(f"📊 Bar #{self.bar_count}: {bar.get('S', 'N/A')} OHLC: ${bar.get('o', 0):.2f}/${bar.get('h', 0):.2f}/${bar.get('l', 0):.2f}/${bar.get('c', 0):.2f} Vol: {bar.get('v', 0):,}")
    
    async def test_streaming(self, duration=30):
        """Test WebSocket streaming for specified duration"""
        logger.info("=" * 60)
        logger.info("🚀 ALPACA WEBSOCKET STREAMING TEST")
        logger.info("=" * 60)
        logger.info(f"Testing real-time data streaming for {duration} seconds...")
        logger.info("Subscribing to: SPY, QQQ, AAPL")
        logger.info("=" * 60)
        
        # Initialize client
        client = AlpacaWebSocketClient(
            api_key=self.api_key,
            api_secret=self.api_secret,
            stream_type="data",
            raw_data=False,
            feed="iex"  # Use IEX feed for free tier
        )
        
        # Override the URL for IEX feed
        client.url = "wss://stream.data.alpaca.markets/v2/iex"
        
        # Create stream manager
        manager = StreamManager(client)
        
        # Set handlers
        manager.on_trade = self.handle_trades
        manager.on_quote = self.handle_quotes
        manager.on_bar = self.handle_bars
        
        try:
            # Connect
            logger.info("🔌 Connecting to Alpaca WebSocket...")
            await client.connect()
            logger.info("✅ Connected successfully!")
            
            # Subscribe to symbols
            symbols = ["SPY", "QQQ", "AAPL"]
            logger.info(f"📡 Subscribing to symbols: {', '.join(symbols)}")
            
            await manager.subscribe(
                trades=symbols,
                quotes=symbols,
                bars=symbols
            )
            
            logger.info("✅ Subscribed! Waiting for data...")
            logger.info("-" * 60)
            
            # Wait for specified duration
            await asyncio.sleep(duration)
            
            # Print summary
            elapsed = (datetime.now() - self.start_time).total_seconds()
            logger.info("-" * 60)
            logger.info("📊 STREAMING TEST SUMMARY")
            logger.info("-" * 60)
            logger.info(f"Duration: {elapsed:.1f} seconds")
            logger.info(f"Trades received: {self.trade_count}")
            logger.info(f"Quotes received: {self.quote_count}")
            logger.info(f"Bars received: {self.bar_count}")
            logger.info(f"Total messages: {self.trade_count + self.quote_count + self.bar_count}")
            
            if self.trade_count + self.quote_count + self.bar_count > 0:
                logger.info("✅ WebSocket streaming is working!")
            else:
                logger.warning("⚠️ No data received. Market might be closed.")
            
        except Exception as e:
            logger.error(f"❌ Streaming error: {e}")
            
        finally:
            # Disconnect
            logger.info("🔌 Disconnecting...")
            await client.disconnect()
            logger.info("✅ Disconnected")


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Alpaca WebSocket Streaming")
    parser.add_argument("--duration", type=int, default=30, help="Test duration in seconds")
    args = parser.parse_args()
    
    tester = AlpacaStreamTester()
    await tester.test_streaming(duration=args.duration)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n⏹️ Test stopped by user")
    except Exception as e:
        logger.error(f"Test failed: {e}")
        sys.exit(1)