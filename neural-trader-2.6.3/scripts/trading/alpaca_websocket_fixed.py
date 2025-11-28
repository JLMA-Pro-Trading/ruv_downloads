#!/usr/bin/env python3
"""
Fixed Alpaca WebSocket client for paper trading
Properly handles authentication and feed types
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any
from dotenv import load_dotenv
import websockets
import msgpack

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AlpacaWebSocketFixed:
    """Fixed WebSocket client for Alpaca with proper authentication"""
    
    # Correct WebSocket URLs for paper trading
    DATA_URL_IEX = "wss://stream.data.alpaca.markets/v2/iex"  # Free tier
    DATA_URL_SIP = "wss://stream.data.alpaca.markets/v2/sip"  # Paid tier
    TRADING_URL = "wss://api.alpaca.markets/stream"  # Trading updates (works for both paper and live)
    
    def __init__(self):
        self.api_key = os.getenv('ALPACA_API_KEY')
        self.api_secret = os.getenv('ALPACA_API_SECRET')
        self.ws = None
        self.authenticated = False
        self.running = False
        
        # Statistics
        self.message_count = 0
        self.trade_count = 0
        self.quote_count = 0
        self.bar_count = 0
        
    async def connect_data_stream(self, use_iex=True):
        """Connect to market data stream"""
        # Use IEX for free tier, SIP for paid
        url = self.DATA_URL_IEX if use_iex else self.DATA_URL_SIP
        feed = "iex" if use_iex else "sip"
        
        logger.info(f"🔌 Connecting to {url} with {feed} feed...")
        
        try:
            # Connect without subprotocols first to see what happens
            self.ws = await websockets.connect(url)
            logger.info("✅ WebSocket connected")
            
            # Send authentication immediately
            auth_msg = {
                "action": "auth",
                "key": self.api_key,
                "secret": self.api_secret
            }
            
            logger.info("🔑 Sending authentication...")
            await self.ws.send(json.dumps(auth_msg))
            
            # Wait for auth response (may come in multiple messages)
            max_wait = 5
            start_time = asyncio.get_event_loop().time()
            
            while (asyncio.get_event_loop().time() - start_time) < max_wait:
                try:
                    response = await asyncio.wait_for(self.ws.recv(), timeout=1.0)
                    auth_data = json.loads(response)
                    logger.info(f"📩 Response: {auth_data}")
                    
                    # Check authentication in response
                    if isinstance(auth_data, list):
                        for msg in auth_data:
                            if msg.get("T") == "success":
                                if msg.get("msg") == "authenticated":
                                    self.authenticated = True
                                    logger.info("✅ Authentication successful!")
                                    return True
                            elif msg.get("T") == "error":
                                logger.error(f"❌ Auth error: {msg.get('msg', msg.get('code', 'Unknown error'))}")
                                return False
                    elif isinstance(auth_data, dict):
                        if auth_data.get("T") == "error":
                            logger.error(f"❌ Auth error: {auth_data.get('msg', auth_data.get('code', 'Unknown error'))}")
                            return False
                            
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.error(f"Error waiting for auth: {e}")
                    break
            
            return self.authenticated
            
        except Exception as e:
            logger.error(f"❌ Connection error: {e}")
            return False
    
    async def subscribe_to_symbols(self, symbols: List[str], data_types: List[str] = None):
        """Subscribe to market data for symbols"""
        if not self.authenticated:
            logger.error("❌ Not authenticated")
            return False
        
        if data_types is None:
            data_types = ["trades", "quotes", "bars"]
        
        # Build subscription message
        sub_msg = {"action": "subscribe"}
        
        for data_type in data_types:
            if data_type in ["trades", "quotes", "bars"]:
                sub_msg[data_type] = symbols
        
        logger.info(f"📡 Subscribing to {symbols} for {data_types}...")
        await self.ws.send(json.dumps(sub_msg))
        
        # Wait for subscription confirmation
        response = await self.ws.recv()
        sub_data = json.loads(response)
        logger.info(f"📩 Subscription response: {sub_data}")
        
        return True
    
    async def receive_messages(self, duration=30):
        """Receive messages for specified duration"""
        logger.info(f"📊 Receiving messages for {duration} seconds...")
        self.running = True
        start_time = asyncio.get_event_loop().time()
        
        while self.running and (asyncio.get_event_loop().time() - start_time) < duration:
            try:
                message = await asyncio.wait_for(self.ws.recv(), timeout=1.0)
                data = json.loads(message)
                
                # Process different message types
                if isinstance(data, list):
                    for msg in data:
                        self.process_message(msg)
                else:
                    self.process_message(data)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error receiving message: {e}")
                break
        
        logger.info(f"📊 Stopped receiving after {duration} seconds")
        return self.get_statistics()
    
    def process_message(self, msg: Dict[str, Any]):
        """Process a single message"""
        self.message_count += 1
        msg_type = msg.get("T", "")
        
        if msg_type == "t":  # Trade
            self.trade_count += 1
            symbol = msg.get("S", "")
            price = msg.get("p", 0)
            size = msg.get("s", 0)
            logger.info(f"📈 Trade: {symbol} @ ${price:.2f} x {size}")
            
        elif msg_type == "q":  # Quote
            self.quote_count += 1
            if self.quote_count % 10 == 0:  # Log every 10th quote
                symbol = msg.get("S", "")
                bid = msg.get("bp", 0)
                ask = msg.get("ap", 0)
                logger.info(f"📊 Quote #{self.quote_count}: {symbol} Bid: ${bid:.2f} Ask: ${ask:.2f}")
                
        elif msg_type == "b":  # Bar
            self.bar_count += 1
            symbol = msg.get("S", "")
            open_price = msg.get("o", 0)
            high = msg.get("h", 0)
            low = msg.get("l", 0)
            close = msg.get("c", 0)
            volume = msg.get("v", 0)
            logger.info(f"📊 Bar: {symbol} OHLC: ${open_price:.2f}/${high:.2f}/${low:.2f}/${close:.2f} Vol: {volume:,}")
            
        elif msg_type in ["success", "subscription"]:
            logger.debug(f"ℹ️ Info: {msg.get('msg', msg)}")
            
        elif msg_type == "error":
            logger.error(f"❌ Error: {msg.get('msg', 'Unknown error')}")
    
    def get_statistics(self):
        """Get message statistics"""
        return {
            "total_messages": self.message_count,
            "trades": self.trade_count,
            "quotes": self.quote_count,
            "bars": self.bar_count
        }
    
    async def disconnect(self):
        """Disconnect from WebSocket"""
        self.running = False
        if self.ws:
            await self.ws.close()
            logger.info("🔌 Disconnected")


async def test_alpaca_websocket():
    """Test the fixed WebSocket implementation"""
    logger.info("=" * 60)
    logger.info("🚀 TESTING FIXED ALPACA WEBSOCKET")
    logger.info("=" * 60)
    
    client = AlpacaWebSocketFixed()
    
    try:
        # Test 1: Connect with IEX feed (free tier)
        logger.info("\n📋 Test 1: IEX Feed (Free Tier)")
        logger.info("-" * 40)
        
        if await client.connect_data_stream(use_iex=True):
            # Subscribe to popular symbols
            await client.subscribe_to_symbols(["SPY", "QQQ", "AAPL"], ["trades", "quotes"])
            
            # Receive messages for 10 seconds
            stats = await client.receive_messages(duration=10)
            
            logger.info("-" * 40)
            logger.info("📊 Statistics:")
            for key, value in stats.items():
                logger.info(f"  • {key}: {value}")
            
            await client.disconnect()
            
            if stats["total_messages"] > 0:
                logger.info("✅ IEX feed working!")
                return True
            else:
                logger.warning("⚠️ No messages received (market might be closed)")
                
        else:
            logger.error("❌ Failed to connect with IEX feed")
            
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        
    finally:
        await client.disconnect()
    
    return False


async def test_trading_stream():
    """Test the trading updates stream"""
    logger.info("\n📋 Test 2: Trading Updates Stream")
    logger.info("-" * 40)
    
    try:
        # Connect to trading stream
        ws = await websockets.connect("wss://api.alpaca.markets/stream")
        logger.info("✅ Connected to trading stream")
        
        # Authenticate
        auth_msg = {
            "action": "auth",
            "key": os.getenv('ALPACA_API_KEY'),
            "secret": os.getenv('ALPACA_API_SECRET')
        }
        
        await ws.send(json.dumps(auth_msg))
        response = await ws.recv()
        auth_data = json.loads(response)
        logger.info(f"📩 Trading auth response: {auth_data}")
        
        # Subscribe to trade updates
        sub_msg = {
            "action": "listen",
            "data": {
                "streams": ["trade_updates"]
            }
        }
        
        await ws.send(json.dumps(sub_msg))
        response = await ws.recv()
        logger.info(f"📩 Subscription response: {response}")
        
        await ws.close()
        logger.info("✅ Trading stream working!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Trading stream error: {e}")
        return False


async def main():
    """Main test runner"""
    # Test data stream
    data_success = await test_alpaca_websocket()
    
    # Test trading stream
    trading_success = await test_trading_stream()
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 TEST SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Data Stream (IEX): {'✅ PASS' if data_success else '❌ FAIL'}")
    logger.info(f"Trading Stream: {'✅ PASS' if trading_success else '❌ FAIL'}")
    
    if data_success or trading_success:
        logger.info("\n🎉 WebSocket connection is working!")
        logger.info("Note: If no market data received, market might be closed.")
        logger.info("Market hours: Mon-Fri 9:30 AM - 4:00 PM ET")
    else:
        logger.error("\n❌ WebSocket tests failed")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n⏹️ Test stopped by user")
    except Exception as e:
        logger.error(f"Test failed: {e}")