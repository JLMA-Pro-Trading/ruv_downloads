#!/usr/bin/env python3
"""
Real-Time Trading Orchestrator using Claude-Flow Stream Chaining
Integrates stream chaining with the Crypto Momentum Strategy
"""

import subprocess
import json
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.strategies.crypto_momentum_strategy import CryptoMomentumStrategy, FeeStructure

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class StreamChainTrader:
    """
    Orchestrates real-time trading using Claude-Flow stream chaining
    """
    
    def __init__(self, symbols: List[str], check_interval: int = 300):
        """
        Initialize the real-time trading orchestrator
        
        Args:
            symbols: List of trading symbols to monitor
            check_interval: Seconds between trading checks (default 5 minutes)
        """
        self.symbols = symbols
        self.check_interval = check_interval
        self.strategy = CryptoMomentumStrategy(
            min_move_threshold=0.015,
            confidence_threshold=0.75,
            fee_structure=FeeStructure(has_fee_token=True)
        )
        self.active_positions = {}
        self.last_analysis = {}
        
    def execute_stream_chain(self, prompts: List[str], verbose: bool = True) -> str:
        """
        Execute a Claude-Flow stream chain
        
        Args:
            prompts: List of prompts to chain
            verbose: Show detailed output
            
        Returns:
            Combined output from the chain
        """
        cmd = ["npx", "claude-flow@alpha", "stream-chain", "run"] + prompts
        
        if verbose:
            cmd.append("--verbose")
            
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                return result.stdout
            else:
                logger.error(f"Stream chain failed: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            logger.error("Stream chain timed out")
            return None
        except Exception as e:
            logger.error(f"Stream chain error: {e}")
            return None
    
    async def analyze_market(self, symbol: str) -> Dict[str, Any]:
        """
        Run market analysis pipeline for a symbol
        """
        logger.info(f"🔍 Analyzing {symbol}...")
        
        prompts = [
            f"Analyze {symbol} price action: get OHLCV data for last 100 candles",
            f"Calculate technical indicators for {symbol}: RSI, MACD, ROC, ATR",
            f"Use mcp__ai-news-trader__neural_forecast to predict {symbol} movement for next 4 hours",
            f"Use mcp__ai-news-trader__analyze_news to get sentiment for {symbol}",
            f"Combine all signals and output JSON with: predicted_move, confidence, sentiment, volatility_regime"
        ]
        
        output = self.execute_stream_chain(prompts)
        
        if output:
            try:
                # Parse JSON from output (you'd need to extract JSON from the text)
                # This is simplified - in reality you'd parse the Claude output
                analysis = {
                    "symbol": symbol,
                    "timestamp": datetime.now().isoformat(),
                    "predicted_move": 0.025,  # Would come from actual output
                    "confidence": 0.82,
                    "sentiment": 0.65,
                    "volatility_regime": "medium",
                    "should_trade": False
                }
                
                # Check if meets trading criteria
                if abs(analysis["predicted_move"]) > 0.015 and analysis["confidence"] > 0.75:
                    analysis["should_trade"] = True
                    
                self.last_analysis[symbol] = analysis
                return analysis
                
            except Exception as e:
                logger.error(f"Failed to parse analysis: {e}")
                return None
        
        return None
    
    async def execute_trade(self, symbol: str, analysis: Dict[str, Any]) -> bool:
        """
        Execute trade using stream chain
        """
        logger.info(f"💰 Executing trade for {symbol}...")
        
        direction = "LONG" if analysis["predicted_move"] > 0 else "SHORT"
        
        prompts = [
            f"Calculate position size for {symbol} using Kelly Criterion with confidence {analysis['confidence']}",
            f"Check current portfolio exposure and risk limits",
            f"Calculate fee efficiency for {abs(analysis['predicted_move'])*100}% move with 0.1% fees",
            f"If fee efficiency > 7x, generate entry order for {direction} {symbol}",
            f"Set stop-loss at {abs(analysis['predicted_move'])*50}% and take-profit at {abs(analysis['predicted_move'])*80}%",
            f"Execute trade and return order details in JSON format"
        ]
        
        output = self.execute_stream_chain(prompts)
        
        if output and "executed" in output.lower():
            self.active_positions[symbol] = {
                "entry_time": datetime.now(),
                "direction": direction,
                "predicted_move": analysis["predicted_move"],
                "confidence": analysis["confidence"]
            }
            logger.info(f"✅ Trade executed for {symbol}: {direction}")
            return True
            
        logger.info(f"❌ Trade not executed for {symbol} (didn't meet criteria)")
        return False
    
    async def monitor_positions(self):
        """
        Monitor active positions using stream chain
        """
        if not self.active_positions:
            return
            
        logger.info("📊 Monitoring active positions...")
        
        for symbol, position in self.active_positions.items():
            prompts = [
                f"Get current price for {symbol}",
                f"Calculate P&L for {position['direction']} position entered at {position['entry_time']}",
                f"Check if position hit stop-loss or take-profit",
                f"If position profitable > 1%, check if pyramiding conditions met",
                f"Generate position update report"
            ]
            
            output = self.execute_stream_chain(prompts, verbose=False)
            
            if output:
                logger.info(f"Position update for {symbol}: {output[:100]}...")
    
    async def run_trading_loop(self):
        """
        Main trading loop
        """
        logger.info("🚀 Starting Real-Time Trading Orchestrator")
        logger.info(f"Monitoring symbols: {', '.join(self.symbols)}")
        logger.info(f"Check interval: {self.check_interval} seconds")
        
        while True:
            try:
                # Analyze all symbols
                for symbol in self.symbols:
                    analysis = await self.analyze_market(symbol)
                    
                    if analysis and analysis["should_trade"]:
                        # Check if we already have a position
                        if symbol not in self.active_positions:
                            await self.execute_trade(symbol, analysis)
                        else:
                            logger.info(f"Already have position in {symbol}, skipping")
                
                # Monitor existing positions
                await self.monitor_positions()
                
                # Run end-of-hour analysis
                if datetime.now().minute == 0:
                    await self.run_hourly_analysis()
                
                # Wait for next check
                logger.info(f"💤 Waiting {self.check_interval} seconds until next check...")
                await asyncio.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break
            except Exception as e:
                logger.error(f"Error in trading loop: {e}")
                await asyncio.sleep(30)  # Wait before retrying
    
    async def run_hourly_analysis(self):
        """
        Run comprehensive hourly analysis
        """
        logger.info("📈 Running hourly analysis...")
        
        prompts = [
            "Calculate total portfolio P&L for the last hour",
            "Analyze fee impact on returns",
            "Review all trades executed with win/loss ratio",
            "Identify best performing positions",
            "Generate hourly performance report with recommendations"
        ]
        
        output = self.execute_stream_chain(prompts)
        if output:
            logger.info(f"Hourly Report Generated: {output[:200]}...")


class AdvancedStreamChainStrategies:
    """
    Advanced trading strategies using stream chaining
    """
    
    @staticmethod
    def correlation_trading_chain(symbols: List[str]) -> List[str]:
        """
        Multi-asset correlation trading chain
        """
        return [
            f"Calculate correlation matrix for {', '.join(symbols)} over last 30 days",
            "Identify pairs with correlation > 0.8 or < -0.8",
            "Find divergences from historical correlation",
            "Generate pairs trading signals for divergent pairs",
            "Calculate hedge ratios and position sizes",
            "Execute market-neutral pairs trades"
        ]
    
    @staticmethod
    def regime_adaptive_chain(symbol: str) -> List[str]:
        """
        Market regime adaptive trading chain
        """
        return [
            f"Identify current market regime for {symbol} using volatility and trend metrics",
            "Select optimal strategy for detected regime (momentum for trending, mean-reversion for ranging)",
            "Adjust risk parameters based on regime (position size, stop-loss, holding period)",
            "Generate regime-specific entry signals",
            "Set dynamic exit criteria based on regime characteristics",
            "Execute trade with regime-optimized parameters"
        ]
    
    @staticmethod
    def news_catalyst_chain(symbol: str) -> List[str]:
        """
        News-driven catalyst trading chain
        """
        return [
            f"Scan latest news for {symbol} using mcp__ai-news-trader__fetch_filtered_news",
            "Identify high-impact catalysts (earnings, regulatory, partnerships)",
            "Analyze historical price reactions to similar news",
            "Calculate expected move based on news magnitude",
            "Check options flow for institutional positioning",
            "Generate catalyst-driven trade with event-based stop-loss"
        ]
    
    @staticmethod
    def multi_timeframe_chain(symbol: str) -> List[str]:
        """
        Multi-timeframe analysis chain
        """
        return [
            f"Analyze {symbol} on 1H timeframe for short-term momentum",
            f"Analyze {symbol} on 4H timeframe for medium-term trend",
            f"Analyze {symbol} on 1D timeframe for major support/resistance",
            "Identify timeframe alignment (all bullish/bearish)",
            "Weight signals by timeframe reliability",
            "Generate trade only if 2+ timeframes agree"
        ]


def main():
    """
    Main entry point for real-time trading
    """
    # Configuration
    SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
    CHECK_INTERVAL = 300  # 5 minutes
    
    # Create trader
    trader = StreamChainTrader(SYMBOLS, CHECK_INTERVAL)
    
    # Run async trading loop
    try:
        asyncio.run(trader.run_trading_loop())
    except KeyboardInterrupt:
        logger.info("Trading stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Real-Time Trading with Claude-Flow Stream Chains")
    parser.add_argument("--symbols", nargs="+", default=["BTC/USDT"], help="Symbols to trade")
    parser.add_argument("--interval", type=int, default=300, help="Check interval in seconds")
    parser.add_argument("--strategy", choices=["momentum", "correlation", "regime", "news", "multi"],
                       default="momentum", help="Trading strategy to use")
    
    args = parser.parse_args()
    
    if args.strategy == "momentum":
        trader = StreamChainTrader(args.symbols, args.interval)
        asyncio.run(trader.run_trading_loop())
    else:
        # Run specific strategy chain
        strategies = AdvancedStreamChainStrategies()
        
        if args.strategy == "correlation":
            prompts = strategies.correlation_trading_chain(args.symbols)
        elif args.strategy == "regime":
            prompts = strategies.regime_adaptive_chain(args.symbols[0])
        elif args.strategy == "news":
            prompts = strategies.news_catalyst_chain(args.symbols[0])
        elif args.strategy == "multi":
            prompts = strategies.multi_timeframe_chain(args.symbols[0])
        
        # Execute the chain
        trader = StreamChainTrader(args.symbols, args.interval)
        output = trader.execute_stream_chain(prompts)
        print(output)