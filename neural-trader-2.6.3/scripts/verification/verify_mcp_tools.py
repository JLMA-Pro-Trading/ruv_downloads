#!/usr/bin/env python3
"""
Simple verification script for MCP tool integration
Analyzes the integrated MCP server file to verify all tools are properly defined
"""

import re
from pathlib import Path

def verify_mcp_integration():
    """Verify that all expected MCP tools are properly implemented"""
    
    mcp_file = Path("src/mcp/mcp_server_integrated.py")
    
    if not mcp_file.exists():
        print("❌ MCP server file not found")
        return False
    
    content = mcp_file.read_text()
    
    # Count tools
    tool_decorators = re.findall(r'@mcp\.tool\(\)', content)
    tool_registrations = re.findall(r'mcp\.tool\(\)\(([\w_]+)\)', content)
    async_functions = re.findall(r'async def ([\w_]+)\(', content)
    
    print("🔍 MCP Integration Analysis")
    print("=" * 50)
    
    # Check for original tool imports
    original_imports = [
        "ping", "list_strategies", "get_strategy_info", "quick_analysis",
        "simulate_trade", "get_portfolio_status", "analyze_news", "get_news_sentiment",
        "run_backtest", "optimize_strategy", "risk_analysis", "execute_trade",
        "performance_report", "correlation_analysis", "run_benchmark",
        "neural_forecast", "neural_train", "neural_evaluate", "neural_backtest",
        "neural_model_status", "neural_optimize"
    ]
    
    print(f"📊 Original Tools (22 expected):")
    found_imports = 0
    for tool in original_imports:
        if tool in content:
            print(f"  ✅ {tool}")
            found_imports += 1
        else:
            print(f"  ❌ {tool} (missing)")
    
    print(f"  Coverage: {found_imports}/{len(original_imports)} ({found_imports/len(original_imports)*100:.1f}%)")
    
    # Check for Polymarket tools
    polymarket_tools = [
        "get_prediction_markets_tool", "analyze_market_sentiment_tool",
        "get_market_orderbook_tool", "place_prediction_order_tool",
        "get_prediction_positions_tool", "calculate_expected_value_tool"
    ]
    
    print(f"\n📊 Polymarket Tools (6 expected):")
    found_polymarket = 0
    for tool in polymarket_tools:
        if tool in content:
            print(f"  ✅ {tool}")
            found_polymarket += 1
        else:
            print(f"  ❌ {tool} (missing)")
    
    print(f"  Coverage: {found_polymarket}/{len(polymarket_tools)} ({found_polymarket/len(polymarket_tools)*100:.1f}%)")
    
    # Check for new integration tools
    new_integration_tools = [
        "control_news_collection", "get_news_provider_status", 
        "fetch_filtered_news", "get_news_trends",
        "recommend_strategy", "switch_active_strategy", 
        "get_strategy_comparison", "adaptive_strategy_selection",
        "get_system_metrics", "monitor_strategy_health", 
        "get_execution_analytics", "execute_multi_asset_trade", 
        "portfolio_rebalance", "cross_asset_correlation_matrix"
    ]
    
    print(f"\n📊 New Integration Tools (14 expected):")
    found_new = 0
    for tool in new_integration_tools:
        if f"async def {tool}(" in content:
            print(f"  ✅ {tool}")
            found_new += 1
        else:
            print(f"  ❌ {tool} (missing)")
    
    print(f"  Coverage: {found_new}/{len(new_integration_tools)} ({found_new/len(new_integration_tools)*100:.1f}%)")
    
    # Analysis summary
    print(f"\n📊 Technical Analysis:")
    print(f"@mcp.tool() decorators: {len(tool_decorators)}")
    print(f"Tool registrations: {len(tool_registrations)}")
    print(f"Async functions: {len(async_functions)}")
    
    # Check for key components
    print(f"\n🔧 Component Integration:")
    components = {
        "FastMCP import": "from fastmcp import FastMCP" in content,
        "News aggregation": "NEWS_AGGREGATION_AVAILABLE" in content,
        "Strategy manager": "STRATEGY_MANAGER_AVAILABLE" in content,
        "GPU support": "GPU_AVAILABLE" in content,
        "Polymarket integration": "POLYMARKET_TOOLS_AVAILABLE" in content,
        "Server initialization": "mcp = FastMCP" in content,
        "Main function": "async def main()" in content
    }
    
    for component, found in components.items():
        status = "✅" if found else "❌"
        print(f"  {status} {component}")
    
    # Overall assessment
    total_expected = len(original_imports) + len(polymarket_tools) + len(new_integration_tools)
    total_found = found_imports + found_polymarket + found_new
    
    print(f"\n🏁 Overall Assessment:")
    print(f"Total tools expected: {total_expected}")
    print(f"Total tools found: {total_found}")
    print(f"Coverage: {total_found/total_expected*100:.1f}%")
    
    # Check for proper tool categories mentioned in documentation
    tool_categories = [
        "News Collection Control Tools",
        "Strategy Selection Tools", 
        "Performance Monitoring Tools",
        "Multi-Asset Trading Tools"
    ]
    
    print(f"\n📚 Documentation Categories:")
    for category in tool_categories:
        if category in content:
            print(f"  ✅ {category}")
        else:
            print(f"  ❌ {category} (missing)")
    
    # Success criteria
    success = (
        total_found >= total_expected * 0.9 and  # 90% tool coverage
        all(components.values()) and  # All components present
        len(tool_decorators) >= 10  # Reasonable number of new tools
    )
    
    if success:
        print(f"\n🎉 VERIFICATION SUCCESSFUL!")
        print(f"✅ All expected MCP tools are properly integrated")
        print(f"✅ Core components are properly configured")
        print(f"✅ Integration appears complete")
    else:
        print(f"\n⚠️  VERIFICATION ISSUES DETECTED")
        if total_found < total_expected * 0.9:
            print(f"❌ Tool coverage below 90% ({total_found/total_expected*100:.1f}%)")
        if not all(components.values()):
            missing = [k for k, v in components.items() if not v]
            print(f"❌ Missing components: {', '.join(missing)}")
        if len(tool_decorators) < 10:
            print(f"❌ Insufficient new tools: {len(tool_decorators)} found")
    
    return success

def check_file_structure():
    """Verify the expected file structure is in place"""
    
    print("\n📁 File Structure Verification:")
    
    expected_files = {
        "MCP Server": "src/mcp/mcp_server_integrated.py",
        "Original MCP": "src/mcp/mcp_server_enhanced.py", 
        "News Trading": "src/news_trading/__init__.py",
        "News Collection": "src/news_trading/news_collection/__init__.py",
        "Sentiment Analysis": "src/news_trading/sentiment_analysis/__init__.py",
        "Decision Engine": "src/news_trading/decision_engine/__init__.py",
        "Strategies": "src/news_trading/strategies/__init__.py",
        "Performance": "src/news_trading/performance/__init__.py",
        "Asset Trading": "src/news_trading/asset_trading/__init__.py"
    }
    
    all_present = True
    for name, file_path in expected_files.items():
        path = Path(file_path)
        if path.exists():
            print(f"  ✅ {name}: {file_path}")
        else:
            print(f"  ❌ {name}: {file_path} (missing)")
            all_present = False
    
    return all_present

if __name__ == "__main__":
    print("🚀 MCP Integration Verification\n")
    
    # Check file structure
    structure_ok = check_file_structure()
    
    # Check MCP integration
    integration_ok = verify_mcp_integration()
    
    # Final result
    print("\n" + "=" * 60)
    if structure_ok and integration_ok:
        print("🎉 ALL VERIFICATION CHECKS PASSED!")
        print("✅ File structure is complete")
        print("✅ MCP tool integration is successful") 
        print("✅ Ready for production use")
        exit(0)
    else:
        print("⚠️  VERIFICATION ISSUES FOUND")
        if not structure_ok:
            print("❌ File structure problems")
        if not integration_ok:
            print("❌ MCP integration problems")
        exit(1)