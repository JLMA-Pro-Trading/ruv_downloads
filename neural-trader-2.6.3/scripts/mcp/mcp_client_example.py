#!/usr/bin/env python3
"""
Example MCP Client for AI News Trading Platform

Demonstrates how to interact with the MCP server for trading operations
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional


class TradingMCPClient:
    """Example MCP client for trading operations"""
    
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
        self.mcp_url = f"{base_url}/mcp"
        self.session: Optional[aiohttp.ClientSession] = None
        self.request_id = 0
        self.auth_token: Optional[str] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def call_method(self, method: str, params: Dict = None) -> Dict:
        """Call an MCP method"""
        self.request_id += 1
        
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id
        }
        
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        async with self.session.post(self.mcp_url, json=payload, headers=headers) as resp:
            result = await resp.json()
            
            if "error" in result:
                raise Exception(f"MCP Error: {result['error']}")
            
            return result.get("result", {})
    
    async def authenticate(self, client_id: str = "example-client"):
        """Authenticate with the MCP server"""
        print(f"Authenticating as {client_id}...")
        
        result = await self.call_method("authenticate", {
            "client_id": client_id,
            "client_secret": "example-secret"
        })
        
        self.auth_token = result.get("token")
        print(f"✓ Authenticated successfully")
        return result
    
    async def get_available_strategies(self) -> Dict:
        """Get list of available trading strategies"""
        print("\nFetching available strategies...")
        
        result = await self.call_method("read_resource", {
            "uri": "mcp://config/strategies"
        })
        
        config = json.loads(result['contents'][0]['text'])
        strategies = config['available_strategies']
        
        print(f"✓ Found {len(strategies)} strategies:")
        for strategy in strategies:
            print(f"  - {strategy['name']}: {strategy['description']}")
            print(f"    Risk Level: {strategy['risk_level']}, Min Capital: ${strategy['min_capital']:,}")
        
        return strategies
    
    async def get_strategy_parameters(self, strategy: str) -> Dict:
        """Get optimized parameters for a strategy"""
        print(f"\nFetching parameters for {strategy}...")
        
        result = await self.call_method("read_resource", {
            "uri": f"mcp://parameters/{strategy}"
        })
        
        params = json.loads(result['contents'][0]['text'])
        
        if 'best_parameters' in params:
            print(f"✓ Loaded optimized parameters")
            print(f"  Performance metrics:")
            metrics = params.get('performance_metrics', {})
            for key, value in list(metrics.items())[:5]:
                print(f"    {key}: {value}")
        else:
            print(f"✓ Using default parameters")
        
        return params
    
    async def get_strategy_recommendation(self, market_conditions: str, 
                                        risk_profile: str, capital: float) -> str:
        """Get AI-powered strategy recommendation"""
        print(f"\nGetting strategy recommendation...")
        print(f"  Market: {market_conditions}, Risk: {risk_profile}, Capital: ${capital:,}")
        
        result = await self.call_method("get_prompt", {
            "name": "strategy_recommendation",
            "arguments": {
                "market_conditions": market_conditions,
                "risk_profile": risk_profile,
                "investment_horizon": "medium",
                "capital": capital
            }
        })
        
        prompt = result['messages'][0]['content']
        
        # Get AI completion
        completion_result = await self.call_method("complete_prompt", {
            "messages": result['messages']
        })
        
        recommendation = completion_result['completion']['content']
        print(f"\n✓ Recommendation received:")
        print("-" * 60)
        print(recommendation)
        print("-" * 60)
        
        return recommendation
    
    async def execute_trade(self, strategy: str, symbol: str, 
                          quantity: int, side: str = "buy") -> Dict:
        """Execute a trading order"""
        print(f"\nExecuting {side} order: {quantity} shares of {symbol} using {strategy}")
        
        result = await self.call_method("call_tool", {
            "name": "execute_trade",
            "arguments": {
                "strategy": strategy,
                "symbol": symbol,
                "quantity": quantity,
                "order_type": "market",
                "side": side
            }
        })
        
        execution = result['result']
        
        if execution.get('status') == 'executed':
            print(f"✓ Order executed successfully!")
            print(f"  Order ID: {execution['order_id']}")
            print(f"  Executed Price: ${execution['execution']['executed_price']:.2f}")
            print(f"  Commission: ${execution['execution']['commission']:.2f}")
        else:
            print(f"✗ Order failed: {execution.get('error', 'Unknown error')}")
        
        return execution
    
    async def run_backtest(self, strategy: str, symbols: list, 
                          days_back: int = 90, capital: float = 100000) -> Dict:
        """Run a backtest for a strategy"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        print(f"\nRunning backtest for {strategy}...")
        print(f"  Symbols: {', '.join(symbols)}")
        print(f"  Period: {start_date.date()} to {end_date.date()}")
        print(f"  Initial Capital: ${capital:,}")
        
        result = await self.call_method("call_tool", {
            "name": "backtest",
            "arguments": {
                "strategy": strategy,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "symbols": symbols,
                "initial_capital": capital
            }
        })
        
        backtest = result['result']
        metrics = backtest.get('metrics', {})
        
        print(f"\n✓ Backtest completed:")
        print(f"  Total Return: {metrics.get('total_return', 0):.2%}")
        print(f"  Sharpe Ratio: {metrics.get('sharpe_ratio', 0):.2f}")
        print(f"  Max Drawdown: {metrics.get('max_drawdown', 0):.2%}")
        print(f"  Win Rate: {metrics.get('win_rate', 0):.1%}")
        print(f"  Total Trades: {metrics.get('trades_count', 0)}")
        
        return backtest
    
    async def get_current_positions(self, strategy: Optional[str] = None) -> list:
        """Get current portfolio positions"""
        print(f"\nFetching current positions...")
        
        params = {"strategy": strategy} if strategy else {}
        
        result = await self.call_method("call_tool", {
            "name": "get_positions",
            "arguments": params
        })
        
        positions = result['result']['positions']
        total_value = result['result']['total_value']
        
        print(f"✓ Found {len(positions)} positions (Total Value: ${total_value:,.2f})")
        
        for pos in positions:
            pnl = pos['unrealized_pnl']
            pnl_pct = (pnl / (pos['entry_price'] * pos['quantity'])) * 100
            print(f"  {pos['symbol']}: {pos['quantity']} shares @ ${pos['entry_price']:.2f}")
            print(f"    Current: ${pos['current_price']:.2f}, P&L: ${pnl:,.2f} ({pnl_pct:+.1f}%)")
        
        return positions
    
    async def run_monte_carlo_analysis(self) -> Dict:
        """Run Monte Carlo risk analysis"""
        print("\nRunning Monte Carlo simulation for risk analysis...")
        
        result = await self.call_method("create_message", {
            "messages": [{
                "role": "user",
                "content": "Run Monte Carlo simulation for portfolio risk analysis with 10000 iterations"
            }],
            "sampling": {
                "max_tokens": 3000,
                "temperature": 0.7
            }
        })
        
        analysis = result['content']
        
        print(f"\n✓ Monte Carlo analysis completed:")
        print("-" * 60)
        # Print first 1000 characters of analysis
        print(analysis[:1000] + "..." if len(analysis) > 1000 else analysis)
        print("-" * 60)
        
        return result
    
    async def monitor_market_data(self, symbols: list, duration: int = 10):
        """Monitor real-time market data (WebSocket example)"""
        print(f"\nMonitoring market data for: {', '.join(symbols)}")
        print(f"Duration: {duration} seconds")
        
        # This would normally use WebSocket connection
        # For demo, we'll poll the resource
        
        start_time = datetime.now()
        update_count = 0
        
        while (datetime.now() - start_time).seconds < duration:
            try:
                result = await self.call_method("read_resource", {
                    "uri": "mcp://data/market"
                })
                
                market_data = json.loads(result['contents'][0]['text'])
                quotes = market_data['quotes']
                
                update_count += 1
                print(f"\rUpdate #{update_count}: ", end="")
                for symbol, quote in quotes.items():
                    if symbol in symbols:
                        print(f"{symbol}: ${quote['last']:.2f} ", end="")
                
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"\nError monitoring market data: {str(e)}")
                break
        
        print(f"\n✓ Monitoring complete. Received {update_count} updates.")


async def main():
    """Run example trading workflow"""
    print("=" * 60)
    print("AI News Trading Platform - MCP Client Example")
    print("=" * 60)
    
    async with TradingMCPClient() as client:
        try:
            # 1. Authenticate
            await client.authenticate()
            
            # 2. Get available strategies
            strategies = await client.get_available_strategies()
            
            # 3. Get strategy recommendation based on market conditions
            recommendation = await client.get_strategy_recommendation(
                market_conditions="volatile",
                risk_profile="moderate",
                capital=50000
            )
            
            # 4. Get parameters for recommended strategy (momentum_trader)
            params = await client.get_strategy_parameters("momentum_trader")
            
            # 5. Run backtest
            backtest = await client.run_backtest(
                strategy="momentum_trader",
                symbols=["AAPL", "GOOGL", "MSFT"],
                days_back=30,
                capital=50000
            )
            
            # 6. Execute a trade (simulated)
            execution = await client.execute_trade(
                strategy="momentum_trader",
                symbol="AAPL",
                quantity=100,
                side="buy"
            )
            
            # 7. Check positions
            positions = await client.get_current_positions()
            
            # 8. Run risk analysis
            risk_analysis = await client.run_monte_carlo_analysis()
            
            # 9. Monitor market data
            await client.monitor_market_data(
                symbols=["AAPL", "GOOGL", "MSFT"],
                duration=5
            )
            
            print("\n" + "=" * 60)
            print("✓ Example workflow completed successfully!")
            print("=" * 60)
            
        except Exception as e:
            print(f"\n✗ Error: {str(e)}")
            print("\nMake sure the MCP server is running:")
            print("  python start_mcp_server.py")


if __name__ == "__main__":
    asyncio.run(main())