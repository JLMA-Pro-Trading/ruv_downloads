#!/usr/bin/env python3
"""
Test Alpaca API connection with real account verification
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv
import aiohttp

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AlpacaConnectionTester:
    """Test Alpaca API connection and account access"""
    
    def __init__(self):
        self.api_endpoint = os.getenv('ALPACA_API_ENDPOINT', 'https://paper-api.alpaca.markets')
        self.api_key = os.getenv('ALPACA_API_KEY')
        self.api_secret = os.getenv('ALPACA_API_SECRET')
        self.api_version = os.getenv('ALPACA_API_VERSION', 'v2')
        
        if not self.api_key or not self.api_secret:
            logger.error("❌ Alpaca credentials not found!")
            sys.exit(1)
            
        # Mask credentials for logging
        self.masked_key = self.api_key[:4] + "..." + self.api_key[-4:] if len(self.api_key) > 8 else "***"
        
    async def test_rest_api(self):
        """Test REST API connection"""
        logger.info("🔍 Testing REST API connection...")
        
        headers = {
            'APCA-API-KEY-ID': self.api_key,
            'APCA-API-SECRET-KEY': self.api_secret
        }
        
        async with aiohttp.ClientSession() as session:
            # Test 1: Get Account Info
            try:
                url = f"{self.api_endpoint}/{self.api_version}/account"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        account = await response.json()
                        logger.info("✅ Account connection successful!")
                        logger.info(f"  • Account ID: {account.get('id', 'N/A')}")
                        logger.info(f"  • Status: {account.get('status', 'N/A')}")
                        logger.info(f"  • Currency: {account.get('currency', 'N/A')}")
                        logger.info(f"  • Buying Power: ${float(account.get('buying_power', 0)):,.2f}")
                        logger.info(f"  • Cash: ${float(account.get('cash', 0)):,.2f}")
                        logger.info(f"  • Portfolio Value: ${float(account.get('portfolio_value', 0)):,.2f}")
                        logger.info(f"  • Pattern Day Trader: {account.get('pattern_day_trader', False)}")
                        logger.info(f"  • Trade Suspended: {account.get('trade_suspended_by_user', False)}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Account request failed: {response.status}")
                        logger.error(f"  Error: {error_text}")
                        return False
            except Exception as e:
                logger.error(f"❌ Connection error: {e}")
                return False
    
    async def test_market_data(self):
        """Test market data access"""
        logger.info("📊 Testing market data access...")
        
        headers = {
            'APCA-API-KEY-ID': self.api_key,
            'APCA-API-SECRET-KEY': self.api_secret
        }
        
        async with aiohttp.ClientSession() as session:
            # Test market data endpoint
            try:
                # Get latest trade for SPY
                url = f"https://data.alpaca.markets/{self.api_version}/stocks/SPY/trades/latest"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        trade = data.get('trade', {})
                        logger.info("✅ Market data access successful!")
                        logger.info(f"  • Symbol: SPY")
                        logger.info(f"  • Latest Price: ${trade.get('p', 0):.2f}")
                        logger.info(f"  • Size: {trade.get('s', 0)}")
                        logger.info(f"  • Time: {trade.get('t', 'N/A')}")
                        return True
                    else:
                        logger.warning(f"⚠️ Market data request returned: {response.status}")
                        return False
            except Exception as e:
                logger.error(f"❌ Market data error: {e}")
                return False
    
    async def test_positions(self):
        """Test positions endpoint"""
        logger.info("💼 Testing positions access...")
        
        headers = {
            'APCA-API-KEY-ID': self.api_key,
            'APCA-API-SECRET-KEY': self.api_secret
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                url = f"{self.api_endpoint}/{self.api_version}/positions"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        positions = await response.json()
                        logger.info(f"✅ Positions access successful!")
                        logger.info(f"  • Open positions: {len(positions)}")
                        
                        if positions:
                            for pos in positions[:3]:  # Show first 3 positions
                                logger.info(f"  • {pos.get('symbol')}: {pos.get('qty')} shares @ ${float(pos.get('avg_entry_price', 0)):.2f}")
                        return True
                    else:
                        logger.warning(f"⚠️ Positions request returned: {response.status}")
                        return False
            except Exception as e:
                logger.error(f"❌ Positions error: {e}")
                return False
    
    async def test_orders(self):
        """Test orders endpoint"""
        logger.info("📋 Testing orders access...")
        
        headers = {
            'APCA-API-KEY-ID': self.api_key,
            'APCA-API-SECRET-KEY': self.api_secret
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                url = f"{self.api_endpoint}/{self.api_version}/orders"
                async with session.get(url, headers=headers, params={'status': 'open'}) as response:
                    if response.status == 200:
                        orders = await response.json()
                        logger.info(f"✅ Orders access successful!")
                        logger.info(f"  • Open orders: {len(orders)}")
                        
                        if orders:
                            for order in orders[:3]:  # Show first 3 orders
                                logger.info(f"  • {order.get('symbol')}: {order.get('side')} {order.get('qty')} @ {order.get('order_type')}")
                        return True
                    else:
                        logger.warning(f"⚠️ Orders request returned: {response.status}")
                        return False
            except Exception as e:
                logger.error(f"❌ Orders error: {e}")
                return False
    
    async def test_clock(self):
        """Test market clock endpoint"""
        logger.info("🕐 Testing market clock...")
        
        headers = {
            'APCA-API-KEY-ID': self.api_key,
            'APCA-API-SECRET-KEY': self.api_secret
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                url = f"{self.api_endpoint}/{self.api_version}/clock"
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        clock = await response.json()
                        logger.info(f"✅ Market clock access successful!")
                        logger.info(f"  • Market is: {'OPEN 🟢' if clock.get('is_open') else 'CLOSED 🔴'}")
                        logger.info(f"  • Next open: {clock.get('next_open', 'N/A')}")
                        logger.info(f"  • Next close: {clock.get('next_close', 'N/A')}")
                        return True
                    else:
                        logger.warning(f"⚠️ Clock request returned: {response.status}")
                        return False
            except Exception as e:
                logger.error(f"❌ Clock error: {e}")
                return False
    
    async def run_all_tests(self):
        """Run all connection tests"""
        logger.info("=" * 60)
        logger.info("🚀 ALPACA CONNECTION TEST SUITE")
        logger.info("=" * 60)
        logger.info(f"📍 Endpoint: {self.api_endpoint}")
        logger.info(f"🔑 API Key: {self.masked_key}")
        logger.info(f"📊 Mode: {'Paper Trading' if 'paper' in self.api_endpoint else 'Live Trading'}")
        logger.info("=" * 60)
        
        results = []
        
        # Run tests
        results.append(("REST API", await self.test_rest_api()))
        results.append(("Market Data", await self.test_market_data()))
        results.append(("Positions", await self.test_positions()))
        results.append(("Orders", await self.test_orders()))
        results.append(("Market Clock", await self.test_clock()))
        
        # Summary
        logger.info("=" * 60)
        logger.info("📊 TEST SUMMARY")
        logger.info("=" * 60)
        
        passed = 0
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"{test_name:15} : {status}")
            if result:
                passed += 1
        
        logger.info("=" * 60)
        logger.info(f"Results: {passed}/{len(results)} tests passed")
        
        if passed == len(results):
            logger.info("🎉 ALL TESTS PASSED! Alpaca connection is working perfectly!")
        elif passed > 0:
            logger.info("⚠️ Some tests passed. Check the failures above.")
        else:
            logger.error("❌ All tests failed. Please check your credentials.")
        
        return passed == len(results)


async def main():
    """Main entry point"""
    tester = AlpacaConnectionTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
    except Exception as e:
        logger.error(f"Test failed: {e}")
        sys.exit(1)