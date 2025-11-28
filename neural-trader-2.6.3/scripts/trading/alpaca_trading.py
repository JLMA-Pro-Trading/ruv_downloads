#!/usr/bin/env python3
"""
Alpaca Trading Integration Script
Uses environment variables from .env file for authentication
"""

import os
import sys
import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.alpaca_trading.websocket.alpaca_client import AlpacaWebSocketClient
from src.alpaca_trading.websocket.stream_manager import StreamManager
from src.alpaca_trading.websocket.message_handler import MessageHandler
from src.strategies.crypto_momentum_strategy import CryptoMomentumStrategy

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AlpacaTradingBot:
    """
    Trading bot that integrates Alpaca API with Crypto Momentum Strategy
    """
    
    def __init__(self):
        """Initialize the trading bot with environment variables"""
        
        # Load Alpaca credentials from environment
        self.api_endpoint = os.getenv('ALPACA_API_ENDPOINT', 'https://paper-api.alpaca.markets')
        self.api_key = os.getenv('ALPACA_API_KEY')
        self.api_secret = os.getenv('ALPACA_API_SECRET')
        self.api_version = os.getenv('ALPACA_API_VERSION', 'v2')
        
        # Validate credentials
        if not self.api_key or not self.api_secret:
            logger.error("❌ Alpaca API credentials not found in environment!")
            logger.info("Please set ALPACA_API_KEY and ALPACA_API_SECRET in your .env file")
            sys.exit(1)
        
        # Mask credentials for logging
        masked_key = self.api_key[:4] + "..." + self.api_key[-4:] if len(self.api_key) > 8 else "***"
        logger.info(f"✅ Alpaca credentials loaded (Key: {masked_key})")
        logger.info(f"📍 Endpoint: {self.api_endpoint}")
        logger.info(f"📊 API Version: {self.api_version}")
        
        # Initialize WebSocket client
        self.ws_client = None
        self.stream_manager = None
        
        # Initialize strategy
        self.strategy = CryptoMomentumStrategy(
            min_move_threshold=0.015,
            confidence_threshold=0.75
        )
        
        # Track active subscriptions
        self.active_symbols = []
        
    async def initialize_websocket(self):
        """Initialize WebSocket connection"""
        logger.info("🔌 Initializing Alpaca WebSocket connection...")
        
        self.ws_client = AlpacaWebSocketClient(
            api_key=self.api_key,
            api_secret=self.api_secret,
            stream_type="data",
            raw_data=False,
            feed="sip"  # Use SIP feed for best data quality
        )
        
        self.stream_manager = StreamManager(self.ws_client)
        
        # Set up message handlers
        self.stream_manager.on_trade = self.handle_trade
        self.stream_manager.on_quote = self.handle_quote
        self.stream_manager.on_bar = self.handle_bar
        
        logger.info("✅ WebSocket client initialized")
        
    async def handle_trade(self, messages: List[Any]):
        """Handle incoming trade messages"""
        for trade in messages:
            logger.info(f"📈 Trade: {trade.symbol} @ ${trade.price:.2f} x {trade.size}")
            
            # You can integrate with strategy here
            # For crypto, you might want to convert crypto symbols
            if trade.symbol.startswith("BTC") or trade.symbol.startswith("ETH"):
                # Process crypto trades
                await self.process_crypto_trade(trade)
    
    async def handle_quote(self, messages: List[Any]):
        """Handle incoming quote messages"""
        for quote in messages:
            spread = quote.ask_price - quote.bid_price
            logger.debug(
                f"📊 Quote: {quote.symbol} "
                f"Bid: ${quote.bid_price:.2f} Ask: ${quote.ask_price:.2f} "
                f"Spread: ${spread:.4f}"
            )
    
    async def handle_bar(self, messages: List[Any]):
        """Handle incoming bar messages"""
        for bar in messages:
            logger.info(
                f"📊 Bar: {bar.symbol} "
                f"OHLC: ${bar.open:.2f}/${bar.high:.2f}/${bar.low:.2f}/${bar.close:.2f} "
                f"Volume: {bar.volume:,}"
            )
            
            # Generate trading signals based on bar data
            # This is where you'd integrate with the momentum strategy
    
    async def process_crypto_trade(self, trade):
        """Process crypto trades with momentum strategy"""
        # This would integrate with your crypto momentum strategy
        logger.info(f"🔄 Processing crypto trade for {trade.symbol}")
        
    async def subscribe_to_symbols(self, symbols: List[str]):
        """Subscribe to real-time data for symbols"""
        logger.info(f"📡 Subscribing to symbols: {', '.join(symbols)}")
        
        await self.stream_manager.subscribe(
            trades=symbols,
            quotes=symbols,
            bars=symbols
        )
        
        self.active_symbols.extend(symbols)
        logger.info(f"✅ Subscribed to {len(symbols)} symbols")
    
    async def start_trading(self, symbols: Optional[List[str]] = None):
        """Start the trading bot"""
        if symbols is None:
            # Default symbols (you can map crypto to stock equivalents)
            symbols = ["SPY", "QQQ", "AAPL", "MSFT", "TSLA"]
        
        logger.info("🚀 Starting Alpaca Trading Bot")
        
        # Initialize WebSocket
        await self.initialize_websocket()
        
        # Connect to Alpaca
        await self.ws_client.connect()
        
        # Subscribe to symbols
        await self.subscribe_to_symbols(symbols)
        
        # Start receiving data
        logger.info("📊 Listening for market data...")
        
        try:
            # Keep the connection alive
            while True:
                await asyncio.sleep(1)
                
                # You can add periodic tasks here
                # e.g., check positions, rebalance, etc.
                
        except KeyboardInterrupt:
            logger.info("⏹️ Stopping trading bot...")
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """Clean up resources"""
        if self.ws_client:
            await self.ws_client.disconnect()
        logger.info("🧹 Cleanup completed")
    
    def get_account_info(self):
        """Get Alpaca account information"""
        # This would use the REST API
        # For now, just show we have the credentials
        logger.info("📋 Account Information:")
        logger.info(f"  • Endpoint: {self.api_endpoint}")
        logger.info(f"  • Mode: {'Paper Trading' if 'paper' in self.api_endpoint else 'Live Trading'}")
        logger.info(f"  • API Version: {self.api_version}")


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Alpaca Trading Bot")
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=["SPY", "QQQ"],
        help="Symbols to trade"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test connection only"
    )
    
    args = parser.parse_args()
    
    # Create trading bot
    bot = AlpacaTradingBot()
    
    if args.test:
        # Just test the connection
        logger.info("🧪 Testing Alpaca connection...")
        bot.get_account_info()
        logger.info("✅ Configuration test successful!")
    else:
        # Start trading
        await bot.start_trading(args.symbols)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Trading stopped by user")
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)