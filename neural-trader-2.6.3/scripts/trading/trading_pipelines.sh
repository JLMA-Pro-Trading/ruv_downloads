#!/bin/bash
# Claude-Flow Stream Chain Trading Pipelines
# Real-time trading strategy automation

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔗 Claude-Flow Trading Pipeline Runner${NC}"
echo "======================================="

# Function: Crypto Momentum Pipeline
crypto_momentum_pipeline() {
    local SYMBOL=${1:-"BTC/USDT"}
    local TIMEFRAME=${2:-"4h"}
    
    echo -e "${GREEN}Running Crypto Momentum Pipeline for $SYMBOL${NC}"
    
    ./claude-flow stream-chain run \
        "Analyze $SYMBOL market regime and calculate current volatility using ATR" \
        "Check momentum indicators (RSI, MACD, ROC) for $SYMBOL on $TIMEFRAME timeframe" \
        "Use mcp__ai-news-trader__neural_forecast to predict next 4 hour movement for $SYMBOL" \
        "Calculate fee efficiency ratio for potential trade with 0.1% fees" \
        "Generate CryptoMomentumStrategy signal if move > 1.5% and fee efficiency > 7x" \
        "Output final trading decision with position size using Kelly Criterion" \
        --verbose \
        --timeout 45
}

# Function: Risk-Managed Entry Pipeline
risk_managed_entry() {
    local SYMBOL=${1:-"BTC/USDT"}
    local PORTFOLIO_VALUE=${2:-100000}
    
    echo -e "${YELLOW}Running Risk-Managed Entry Pipeline${NC}"
    
    ./claude-flow stream-chain run \
        "Check current portfolio exposure and calculate available risk budget" \
        "Analyze $SYMBOL correlation with existing positions" \
        "Run mcp__ai-news-trader__risk_analysis for portfolio with new position" \
        "Calculate Value at Risk (VaR) at 95% confidence" \
        "Determine optimal position size considering portfolio constraints" \
        "Generate entry orders with stop-loss and take-profit levels" \
        --verbose
}

# Function: News-Driven Trading Pipeline
news_driven_pipeline() {
    local SYMBOL=${1:-"BTC"}
    
    echo -e "${BLUE}Running News-Driven Trading Pipeline${NC}"
    
    ./claude-flow stream-chain run \
        "Use mcp__ai-news-trader__analyze_news for $SYMBOL with 6 hour lookback" \
        "Identify major catalysts and sentiment extremes from news" \
        "Correlate news sentiment with price action for $SYMBOL" \
        "Check if sentiment divergence exists (bullish news, bearish price)" \
        "Generate contrarian or momentum signal based on sentiment analysis" \
        "Calculate position size based on sentiment confidence score" \
        --verbose
}

# Function: Multi-Asset Arbitrage Pipeline
arbitrage_pipeline() {
    echo -e "${GREEN}Running Multi-Asset Arbitrage Pipeline${NC}"
    
    ./claude-flow stream-chain run \
        "Scan BTC/USDT prices across Binance, Coinbase, and Kraken" \
        "Calculate arbitrage opportunities considering fees and slippage" \
        "Check liquidity depth on each exchange for position size" \
        "Verify fund availability on each exchange" \
        "Execute simultaneous buy/sell orders if profit > 0.5%" \
        "Monitor execution and report final P&L" \
        --timeout 60
}

# Function: Pyramiding Strategy Pipeline
pyramiding_pipeline() {
    local SYMBOL=${1:-"ETH/USDT"}
    
    echo -e "${YELLOW}Running Pyramiding Strategy Pipeline${NC}"
    
    ./claude-flow stream-chain run \
        "Check existing $SYMBOL position P&L and entry price" \
        "Calculate if position is profitable enough for pyramiding (>1%)" \
        "Verify remaining expected move can cover additional fees" \
        "Determine pyramid size (50% of original position)" \
        "Execute pyramid order if all conditions met" \
        "Update position tracking with new average price" \
        --verbose
}

# Function: Real-Time Monitoring Pipeline
monitoring_pipeline() {
    echo -e "${RED}Running Real-Time Monitoring Pipeline${NC}"
    
    ./claude-flow stream-chain run \
        "Check all open positions and their current P&L" \
        "Monitor positions approaching stop-loss or take-profit" \
        "Scan for news events that could impact positions" \
        "Calculate current portfolio VaR and exposure metrics" \
        "Generate alerts for positions requiring attention" \
        "Create performance report with fee analysis" \
        --verbose \
        --timeout 30
}

# Function: End-of-Day Analysis Pipeline
eod_analysis_pipeline() {
    echo -e "${BLUE}Running End-of-Day Analysis Pipeline${NC}"
    
    ./claude-flow stream-chain run \
        "Calculate total P&L for the day including all fees" \
        "Analyze winning vs losing trades with fee impact" \
        "Review fee efficiency ratios for all trades" \
        "Identify best and worst performing strategies" \
        "Generate recommendations for tomorrow's trading" \
        "Create detailed performance report with charts" \
        --verbose
}

# Main menu
show_menu() {
    echo ""
    echo "Select Trading Pipeline:"
    echo "1) Crypto Momentum Pipeline"
    echo "2) Risk-Managed Entry Pipeline"
    echo "3) News-Driven Trading Pipeline"
    echo "4) Multi-Asset Arbitrage Pipeline"
    echo "5) Pyramiding Strategy Pipeline"
    echo "6) Real-Time Monitoring Pipeline"
    echo "7) End-of-Day Analysis Pipeline"
    echo "8) Custom Chain (Interactive)"
    echo "9) Exit"
    echo ""
}

# Interactive custom chain builder
custom_chain() {
    echo -e "${GREEN}Custom Stream Chain Builder${NC}"
    echo "Enter your prompts (one per line, empty line to finish):"
    
    PROMPTS=()
    while true; do
        read -p "> " prompt
        [[ -z "$prompt" ]] && break
        PROMPTS+=("$prompt")
    done
    
    if [ ${#PROMPTS[@]} -ge 2 ]; then
        echo -e "${BLUE}Executing custom chain with ${#PROMPTS[@]} steps...${NC}"
        ./claude-flow stream-chain run "${PROMPTS[@]}" --verbose
    else
        echo -e "${RED}Need at least 2 prompts for a chain${NC}"
    fi
}

# Main execution
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [pipeline_name] [symbol] [params...]"
    echo ""
    echo "Pipelines:"
    echo "  momentum [SYMBOL] [TIMEFRAME]  - Run momentum strategy pipeline"
    echo "  risk [SYMBOL] [PORTFOLIO]       - Run risk-managed entry"
    echo "  news [SYMBOL]                   - Run news-driven trading"
    echo "  arbitrage                       - Run arbitrage scanner"
    echo "  pyramid [SYMBOL]                - Run pyramiding strategy"
    echo "  monitor                         - Run position monitoring"
    echo "  eod                             - Run end-of-day analysis"
    echo ""
    echo "Or run without arguments for interactive menu"
    exit 0
fi

# Direct pipeline execution
case "$1" in
    momentum)
        crypto_momentum_pipeline "$2" "$3"
        ;;
    risk)
        risk_managed_entry "$2" "$3"
        ;;
    news)
        news_driven_pipeline "$2"
        ;;
    arbitrage)
        arbitrage_pipeline
        ;;
    pyramid)
        pyramiding_pipeline "$2"
        ;;
    monitor)
        monitoring_pipeline
        ;;
    eod)
        eod_analysis_pipeline
        ;;
    "")
        # Interactive menu
        while true; do
            show_menu
            read -p "Enter choice [1-9]: " choice
            
            case $choice in
                1) 
                    read -p "Enter symbol (default: BTC/USDT): " symbol
                    crypto_momentum_pipeline "${symbol:-BTC/USDT}"
                    ;;
                2)
                    read -p "Enter symbol (default: BTC/USDT): " symbol
                    read -p "Enter portfolio value (default: 100000): " portfolio
                    risk_managed_entry "${symbol:-BTC/USDT}" "${portfolio:-100000}"
                    ;;
                3)
                    read -p "Enter symbol (default: BTC): " symbol
                    news_driven_pipeline "${symbol:-BTC}"
                    ;;
                4)
                    arbitrage_pipeline
                    ;;
                5)
                    read -p "Enter symbol (default: ETH/USDT): " symbol
                    pyramiding_pipeline "${symbol:-ETH/USDT}"
                    ;;
                6)
                    monitoring_pipeline
                    ;;
                7)
                    eod_analysis_pipeline
                    ;;
                8)
                    custom_chain
                    ;;
                9)
                    echo "Exiting..."
                    exit 0
                    ;;
                *)
                    echo -e "${RED}Invalid option${NC}"
                    ;;
            esac
            
            echo ""
            read -p "Press Enter to continue..."
        done
        ;;
    *)
        echo -e "${RED}Unknown pipeline: $1${NC}"
        echo "Run $0 --help for usage"
        exit 1
        ;;
esac