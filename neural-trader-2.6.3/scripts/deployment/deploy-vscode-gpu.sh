#!/bin/bash

# VS Code GPU Deployment Script for Fly.io
# AI News Trading Platform Development Environment

set -e  # Exit on any error

# Configuration
APP_NAME="ai-trader-vscode-gpu"
REGION="ord"
VOLUME_SIZE="50"
VSCODE_PASSWORD="TradingDev2024!"
VSCODE_USER="trader"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AI Trading Platform - VS Code GPU Environment Deployment${NC}"
echo -e "${BLUE}================================================================${NC}"

# Check if fly CLI is installed and authenticated
if ! command -v fly &> /dev/null; then
    echo -e "${RED}❌ Fly CLI not found. Please install: https://fly.io/docs/hands-on/install-flyctl/${NC}"
    exit 1
fi

if ! fly auth whoami &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with Fly.io. Please run: fly auth login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Fly CLI authenticated${NC}"

# Step 1: Create the app
echo -e "${YELLOW}📱 Creating Fly.io app: ${APP_NAME}${NC}"
if fly apps list | grep -q "$APP_NAME"; then
    echo -e "${YELLOW}⚠️  App $APP_NAME already exists${NC}"
else
    fly apps create "$APP_NAME" --yes
    echo -e "${GREEN}✅ App created: ${APP_NAME}${NC}"
fi

# Step 2: Create persistent volume
echo -e "${YELLOW}💾 Creating persistent volume for workspace${NC}"
if fly volumes list --app "$APP_NAME" | grep -q "vscode_data"; then
    echo -e "${YELLOW}⚠️  Volume already exists${NC}"
else
    fly volumes create vscode_data --app "$APP_NAME" --region "$REGION" --size "$VOLUME_SIZE" --yes
    echo -e "${GREEN}✅ Volume created: vscode_data (${VOLUME_SIZE}GB)${NC}"
fi

# Step 3: Set secrets for authentication
echo -e "${YELLOW}🔐 Setting up authentication${NC}"
fly secrets set \
    VSCODE_PASSWORD="$VSCODE_PASSWORD" \
    VSCODE_USER="$VSCODE_USER" \
    --app "$APP_NAME"
echo -e "${GREEN}✅ Authentication configured${NC}"

# Step 4: Deploy VS Code with GPU
echo -e "${YELLOW}🚀 Deploying VS Code with GPU support${NC}"
echo -e "${BLUE}This may take 5-10 minutes for GPU initialization...${NC}"

fly deploy \
    --config fly_deployment/fly-vscode.toml \
    --app "$APP_NAME" \
    --strategy rolling \
    --wait-timeout 15m

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Step 5: Get connection information
echo -e "${YELLOW}📡 Getting connection information${NC}"
APP_URL=$(fly status --app "$APP_NAME" | grep "Hostname" | awk '{print $2}')

# Step 6: Create connection info file
cat > fly-vscode-connection.txt << EOF
🚀 AI Trading Platform - VS Code GPU Environment
================================================

🌐 VS Code URL: https://$APP_URL
👤 Username: $VSCODE_USER  
🔑 Password: $VSCODE_PASSWORD

🔧 Connection Commands:
- SSH Access: fly ssh console --app $APP_NAME
- Logs: fly logs --app $APP_NAME
- Status: fly status --app $APP_NAME
- Scale: fly scale count 1 --app $APP_NAME

🔄 Management Commands:
- Stop: fly machine stop --app $APP_NAME
- Start: fly machine start --app $APP_NAME  
- Restart: fly machine restart --app $APP_NAME
- Destroy: fly apps destroy $APP_NAME

💾 Workspace: /home/coder/workspace (persistent)
🖥️  GPU: NVIDIA A100 40GB
🧠 Memory: 32GB RAM
⚡ CPUs: 8 Performance cores

📊 Monitoring:
- GPU Usage: nvidia-smi (in VS Code terminal)
- System: htop (in VS Code terminal)

🛠️  Pre-installed:
- Python 3.10 + PyTorch with CUDA
- TA-Lib (financial indicators)
- NeuralForecast with GPU support
- Jupyter notebooks
- Git, curl, wget, build tools

🚀 Getting Started:
1. Open: https://$APP_URL
2. Login with credentials above
3. Open terminal and run: nvidia-smi
4. Clone your repo: git clone <your-repo>
5. Start coding with GPU acceleration!

Generated: $(date)
EOF

# Display final information
echo -e "${GREEN}🎉 VS Code GPU Environment Ready!${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}🌐 URL: https://$APP_URL${NC}"
echo -e "${GREEN}👤 User: $VSCODE_USER${NC}"
echo -e "${GREEN}🔑 Pass: $VSCODE_PASSWORD${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${YELLOW}📄 Full connection details saved to: fly-vscode-connection.txt${NC}"
echo -e "${YELLOW}🔗 Opening in browser...${NC}"

# Try to open in browser (works on most systems)
if command -v open &> /dev/null; then
    open "https://$APP_URL"
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://$APP_URL"
elif command -v start &> /dev/null; then
    start "https://$APP_URL"
fi

echo -e "${GREEN}✅ Deployment complete! Happy coding with GPU acceleration! 🚀${NC}"