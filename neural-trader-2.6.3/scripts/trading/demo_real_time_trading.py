#!/usr/bin/env python3
"""
Demo script showing real-time news-driven trading system in action
Safe demonstration that doesn't execute actual trades
"""

import os
import sys
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src'))

from trading.real_time_trader import RealTimeTrader, NewsSignal, MarketSignal

# Load environment
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SafeDemoTrader(RealTimeTrader):
    """Demo trader that shows signals but doesn't execute trades"""
    
    def __init__(self):
        super().__init__()
        # Override symbols for demo
        self.symbols = ["SPY", "AAPL"]
        self.demo_mode = True
        self.signal_count = 0
        
    async def _execute_trade(self, decision):
        """Override to prevent actual trading - demo mode"""
        self.signal_count += 1
        
        logger.info("🎯 DEMO MODE - TRADE SIGNAL DETECTED")
        logger.info("=" * 50)
        logger.info(f"📈 Action: {decision.action.upper()}")
        logger.info(f"🎯 Symbol: {decision.symbol}")
        logger.info(f"📊 Quantity: {decision.quantity} shares")
        logger.info(f"💰 Price: ${decision.price_limit:.2f}")
        logger.info(f"🛑 Stop Loss: ${decision.stop_loss:.2f}")
        logger.info(f"🎯 Take Profit: ${decision.take_profit:.2f}")
        logger.info(f"🔥 Confidence: {decision.confidence:.2f}")
        logger.info(f"💡 Reasoning: {decision.reasoning}")
        logger.info("=" * 50)
        
        # Simulate order success
        self.stats['trades_executed'] += 1
        
        # Update positions for demo
        if decision.action == "buy":
            self.trading_engine.positions[decision.symbol] = \
                self.trading_engine.positions.get(decision.symbol, 0) + decision.quantity
        elif decision.action == "sell":
            self.trading_engine.positions[decision.symbol] = \
                self.trading_engine.positions.get(decision.symbol, 0) - decision.quantity
        
        logger.info(f"✅ DEMO TRADE #{self.signal_count} SIMULATED")
        
    async def _get_news_signals(self, symbol: str):
        """Enhanced mock news with more realistic scenarios"""
        import random
        
        # More varied news scenarios
        news_scenarios = {
            "SPY": [
                "Market rally continues as inflation data shows cooling trends",
                "Fed officials hint at potential rate cuts in upcoming meetings", 
                "Strong earnings season drives market optimism higher",
                "Economic indicators suggest continued growth momentum"
            ],
            "AAPL": [
                "Apple announces record iPhone sales in quarterly earnings beat",
                "New Apple AI features drive analyst upgrades across Wall Street",
                "Apple supply chain concerns emerge from Asia manufacturing",
                "Apple stock downgraded on valuation concerns by major firm"
            ]
        }
        
        # Random news selection with sentiment
        headlines = news_scenarios.get(symbol, [f"{symbol} shows mixed trading signals"])
        selected = random.sample(headlines, min(2, len(headlines)))
        
        return await self.news_analyzer.analyze_news(selected, symbol)
    
    async def _demo_stats_reporter(self):
        """Demo-specific stats reporting"""
        while self.running:
            try:
                await asyncio.sleep(60)  # Report every minute
                
                runtime = datetime.now() - self.stats['start_time']
                
                logger.info("📊 DEMO TRADING SESSION STATS")
                logger.info(f"   ⏱️ Runtime: {runtime}")
                logger.info(f"   📡 Signals Generated: {self.signal_count}")
                logger.info(f"   🎯 Active Symbols: {', '.join(self.symbols)}")
                
                # Show current "positions" (simulated)
                if self.trading_engine.positions:
                    logger.info("   💼 Simulated Positions:")
                    for symbol, qty in self.trading_engine.positions.items():
                        if qty != 0:
                            logger.info(f"     • {symbol}: {qty} shares")
                
                logger.info("   📈 Status: DEMO MODE - No real trades executed")
                
            except Exception as e:
                logger.error(f"❌ Demo stats error: {e}")
                await asyncio.sleep(30)
    
    async def start(self):
        """Start demo trading system"""
        logger.info("🚀 STARTING REAL-TIME TRADING DEMO")
        logger.info("=" * 60)
        logger.info("⚠️  DEMO MODE: No actual trades will be executed")
        logger.info(f"📈 Monitoring symbols: {', '.join(self.symbols)}")
        logger.info(f"💰 Max position size: ${self.trading_engine.max_position_size}")
        logger.info("📡 Connecting to live market data...")
        logger.info("=" * 60)
        
        self.running = True
        
        try:
            # Connect to WebSocket
            await self.ws_client.connect()
            logger.info("✅ Connected to Alpaca WebSocket (IEX feed)")
            
            # Register handlers
            self.ws_client.register_handler("t", self._handle_trade)
            self.ws_client.register_handler("q", self._handle_quote)
            
            # Subscribe to symbols
            await self.ws_client.subscribe(
                trades=self.symbols,
                quotes=self.symbols
            )
            logger.info(f"✅ Subscribed to live data for {len(self.symbols)} symbols")
            logger.info("🎯 Waiting for trading signals...")
            
            # Start background tasks (replace stats reporter with demo version)
            tasks = [
                asyncio.create_task(self._news_monitor()),
                asyncio.create_task(self._trade_monitor()),
                asyncio.create_task(self._demo_stats_reporter()),  # Demo version
                asyncio.create_task(self._keep_alive())
            ]
            
            # Wait for all tasks
            await asyncio.gather(*tasks)
            
        except Exception as e:
            logger.error(f"❌ Demo system error: {e}")
            raise
        finally:
            await self.shutdown()


async def run_demo(duration_minutes=5):
    """Run trading demo for specified duration"""
    logger.info("🎮 REAL-TIME TRADING SYSTEM DEMO")
    logger.info(f"⏱️ Demo will run for {duration_minutes} minutes")
    logger.info("🔒 SAFE MODE: No actual trades will be executed")
    
    demo_trader = SafeDemoTrader()
    
    try:
        # Start demo with timeout
        demo_task = asyncio.create_task(demo_trader.start())
        await asyncio.wait_for(demo_task, timeout=duration_minutes * 60)
        
    except asyncio.TimeoutError:
        logger.info(f"⏰ Demo completed after {duration_minutes} minutes")
        
    except KeyboardInterrupt:
        logger.info("⏹️ Demo stopped by user")
        
    except Exception as e:
        logger.error(f"❌ Demo error: {e}")
        
    finally:
        # Final stats
        logger.info("📊 DEMO SESSION SUMMARY")
        logger.info("=" * 40)
        logger.info(f"Signals Generated: {demo_trader.signal_count}")
        logger.info(f"Runtime: {datetime.now() - demo_trader.stats['start_time']}")
        logger.info("Status: Demo completed safely")
        logger.info("=" * 40)
        
        await demo_trader.shutdown()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Real-Time Trading Demo")
    parser.add_argument('--duration', type=int, default=3, help='Demo duration in minutes')
    args = parser.parse_args()
    
    try:
        asyncio.run(run_demo(args.duration))
    except KeyboardInterrupt:
        logger.info("Demo interrupted")
    except Exception as e:
        logger.error(f"Demo failed: {e}")
        sys.exit(1)