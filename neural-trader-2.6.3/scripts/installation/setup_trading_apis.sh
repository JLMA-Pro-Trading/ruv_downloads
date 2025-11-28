#!/bin/bash
# Trading APIs Setup Script
# Automates the setup process for low-latency trading system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 Trading APIs Setup Script                    ║${NC}"
echo -e "${BLUE}║            Low-Latency Trading System Installation          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt for input
prompt_for_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    
    if [ -n "$default_value" ]; then
        read -p "$prompt [$default_value]: " input
        eval "$var_name=\"${input:-$default_value}\""
    else
        read -p "$prompt: " input
        eval "$var_name=\"$input\""
    fi
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Python version
if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is required but not installed${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
if [[ $(echo "$PYTHON_VERSION < 3.8" | bc) -eq 1 ]]; then
    echo -e "${RED}Error: Python 3.8+ is required, found Python $PYTHON_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"

# Check Docker (optional)
if command_exists docker; then
    echo -e "${GREEN}✓ Docker found${NC}"
    DOCKER_AVAILABLE=true
else
    echo -e "${YELLOW}! Docker not found - will use native Python installation${NC}"
    DOCKER_AVAILABLE=false
fi

# Check for root privileges (for optimizations)
if [ "$EUID" -eq 0 ]; then
    echo -e "${GREEN}✓ Running as root - all optimizations will be applied${NC}"
    ROOT_AVAILABLE=true
else
    echo -e "${YELLOW}! Not running as root - some optimizations may not apply${NC}"
    ROOT_AVAILABLE=false
fi

# Collect API credentials
echo -e "${BLUE}Setting up API credentials...${NC}"

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Found existing .env file${NC}"
    read -p "Do you want to update it? (y/N): " update_env
    if [[ ! "$update_env" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Using existing .env file${NC}"
    else
        rm .env
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    
    echo "# Trading API Configuration" > .env
    echo "# Generated on $(date)" >> .env
    echo "" >> .env
    
    # Polygon.io API Key
    echo -e "${YELLOW}Polygon.io API Key:${NC}"
    echo "Get your API key from: https://polygon.io/dashboard/api-keys"
    prompt_for_input "Enter your Polygon.io API key" POLYGON_API_KEY ""
    echo "POLYGON_API_KEY=$POLYGON_API_KEY" >> .env
    
    # Alpaca API credentials
    echo -e "${YELLOW}Alpaca API Credentials:${NC}"
    echo "Get your credentials from: https://app.alpaca.markets/paper/dashboard/overview"
    prompt_for_input "Enter your Alpaca API key" ALPACA_API_KEY ""
    prompt_for_input "Enter your Alpaca API secret" ALPACA_API_SECRET ""
    echo "ALPACA_API_KEY=$ALPACA_API_KEY" >> .env
    echo "ALPACA_API_SECRET=$ALPACA_API_SECRET" >> .env
    
    # Additional settings
    echo "" >> .env
    echo "# Environment Settings" >> .env
    echo "ENVIRONMENT=development" >> .env
    echo "LOG_LEVEL=INFO" >> .env
    echo "ENABLE_METRICS=true" >> .env
    echo "METRICS_PORT=9090" >> .env
    
    echo -e "${GREEN}✓ .env file created${NC}"
fi

# Choose installation method
echo -e "${BLUE}Choose installation method:${NC}"
echo "1. Docker (recommended for production)"
echo "2. Native Python (for development)"

if [ "$DOCKER_AVAILABLE" = true ]; then
    read -p "Enter choice (1 or 2) [1]: " install_method
    install_method=${install_method:-1}
else
    echo -e "${YELLOW}Docker not available, using native Python installation${NC}"
    install_method=2
fi

if [ "$install_method" = "1" ]; then
    echo -e "${BLUE}Setting up Docker environment...${NC}"
    
    # Build Docker image
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t trading-api:latest .
    
    # Create Docker Compose override if needed
    if [ ! -f "docker-compose.override.yml" ]; then
        echo -e "${YELLOW}Creating Docker Compose override...${NC}"
        cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  trading-api:
    environment:
      - POLYGON_API_KEY=$POLYGON_API_KEY
      - ALPACA_API_KEY=$ALPACA_API_KEY
      - ALPACA_API_SECRET=$ALPACA_API_SECRET
EOF
    fi
    
    echo -e "${GREEN}✓ Docker setup complete${NC}"
    echo -e "${BLUE}To start the service: docker-compose up -d${NC}"
    
else
    echo -e "${BLUE}Setting up native Python environment...${NC}"
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}Creating virtual environment...${NC}"
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    echo -e "${YELLOW}Upgrading pip...${NC}"
    pip install --upgrade pip
    
    # Install dependencies
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -r requirements.txt
    
    echo -e "${GREEN}✓ Python environment setup complete${NC}"
    echo -e "${BLUE}To activate environment: source venv/bin/activate${NC}"
fi

# System optimizations
if [ "$ROOT_AVAILABLE" = true ]; then
    echo -e "${BLUE}Applying system optimizations...${NC}"
    
    # Make run script executable
    chmod +x run_low_latency.sh
    
    # Apply immediate optimizations
    echo -e "${YELLOW}Applying CPU optimizations...${NC}"
    
    # CPU governor
    if command_exists cpupower; then
        cpupower frequency-set -g performance 2>/dev/null || true
    fi
    
    # Network optimizations
    echo -e "${YELLOW}Applying network optimizations...${NC}"
    sysctl -w net.core.rmem_max=134217728 2>/dev/null || true
    sysctl -w net.core.wmem_max=134217728 2>/dev/null || true
    sysctl -w net.ipv4.tcp_nodelay=1 2>/dev/null || true
    
    # Memory optimizations
    echo -e "${YELLOW}Applying memory optimizations...${NC}"
    sysctl -w vm.swappiness=0 2>/dev/null || true
    
    echo -e "${GREEN}✓ System optimizations applied${NC}"
    echo -e "${BLUE}For full optimizations, run: sudo ./run_low_latency.sh${NC}"
else
    echo -e "${YELLOW}Skipping system optimizations (requires root)${NC}"
    echo -e "${BLUE}For optimal performance, run: sudo ./run_low_latency.sh${NC}"
fi

# Test connections
echo -e "${BLUE}Testing API connections...${NC}"

# Source environment variables
source .env

# Test Polygon.io connection
echo -e "${YELLOW}Testing Polygon.io connection...${NC}"
response=$(curl -s "https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apikey=$POLYGON_API_KEY")
if echo "$response" | grep -q "results"; then
    echo -e "${GREEN}✓ Polygon.io connection successful${NC}"
else
    echo -e "${RED}✗ Polygon.io connection failed${NC}"
    echo "Please check your API key and internet connection"
fi

# Test Alpaca connection
echo -e "${YELLOW}Testing Alpaca connection...${NC}"
response=$(curl -s -H "APCA-API-KEY-ID: $ALPACA_API_KEY" -H "APCA-API-SECRET-KEY: $ALPACA_API_SECRET" "https://paper-api.alpaca.markets/v2/account")
if echo "$response" | grep -q "account_number"; then
    echo -e "${GREEN}✓ Alpaca connection successful${NC}"
else
    echo -e "${RED}✗ Alpaca connection failed${NC}"
    echo "Please check your API credentials"
fi

# Setup monitoring
echo -e "${BLUE}Setting up monitoring...${NC}"
mkdir -p logs data

# Create systemd service (optional)
if [ "$ROOT_AVAILABLE" = true ]; then
    read -p "Create systemd service for automatic startup? (y/N): " create_service
    if [[ "$create_service" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Creating systemd service...${NC}"
        cat > /etc/systemd/system/trading-api.service << EOF
[Unit]
Description=Low-Latency Trading API
After=network.target

[Service]
Type=simple
User=$(whoami)
Group=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/run_low_latency.sh
Restart=always
RestartSec=5
Environment=PATH=$(pwd)/venv/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload
        systemctl enable trading-api.service
        echo -e "${GREEN}✓ Systemd service created${NC}"
        echo -e "${BLUE}To start service: sudo systemctl start trading-api${NC}"
    fi
fi

# Final instructions
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Setup Complete!                         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"

echo -e "${GREEN}Setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "${BLUE}1. Review configuration: config/trading_apis.yaml${NC}"
echo -e "${BLUE}2. Start the application:${NC}"

if [ "$install_method" = "1" ]; then
    echo -e "   ${GREEN}docker-compose up -d${NC}"
else
    echo -e "   ${GREEN}./run_low_latency.sh${NC}"
fi

echo -e "${BLUE}3. Monitor metrics: http://localhost:9090/metrics${NC}"
echo -e "${BLUE}4. Check logs: tail -f logs/trading.log${NC}"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo -e "${BLUE}- Trading API Guide: README_TRADING_APIS.md${NC}"
echo -e "${BLUE}- Latency Optimization: LATENCY_OPTIMIZATION_GUIDE.md${NC}"
echo ""
echo -e "${GREEN}Happy trading!${NC}"