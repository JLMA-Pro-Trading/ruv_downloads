#!/bin/bash

# AI News Trader - Fly.io Deployment Script (Non-GPU Version)
# This script deploys the application to Fly.io without GPU requirements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="${FLY_APP_NAME:-ruvtrade}"  # Set FLY_APP_NAME env var or defaults to ruvtrade
REGION="${FLY_REGION:-iad}"  # Set FLY_REGION env var or defaults to iad (Northern Virginia)
FLY_ORG=""    # Will be set after checking authentication

echo -e "${GREEN}🚀 Neural Trader - Fly.io Deployment Script${NC}"
echo "================================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print error and exit
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    exit 1
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠️  Warning: $1${NC}"
}

# Function to print success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Check for Fly CLI installation
echo -e "\n${YELLOW}Checking prerequisites...${NC}"
if ! command_exists fly; then
    error_exit "Fly CLI is not installed. Please install it first:
    curl -L https://fly.io/install.sh | sh
    or
    brew install flyctl (on macOS)"
fi
success "Fly CLI is installed"

# Check Fly CLI version
FLY_VERSION=$(fly version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
echo "Fly CLI version: $FLY_VERSION"

# Check authentication status
echo -e "\n${YELLOW}Checking Fly.io authentication...${NC}"
if ! fly auth whoami >/dev/null 2>&1; then
    echo "Not authenticated with Fly.io. Starting authentication..."
    fly auth login || error_exit "Failed to authenticate with Fly.io"
fi
success "Authenticated with Fly.io"

# Get default organization
FLY_ORG=$(fly orgs list --json 2>/dev/null | jq -r '.[0].slug' 2>/dev/null || echo "personal")
if [ -z "$FLY_ORG" ]; then
    FLY_ORG="personal"
fi
echo "Using organization: $FLY_ORG"

# Check if app already exists
echo -e "\n${YELLOW}Checking app status...${NC}"
if fly apps list --json | jq -e ".[] | select(.name == \"$APP_NAME\")" >/dev/null 2>&1; then
    warning "App '$APP_NAME' already exists"
    read -p "Do you want to use the existing app? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter a new app name: " APP_NAME
        if fly apps list --json | jq -e ".[] | select(.name == \"$APP_NAME\")" >/dev/null 2>&1; then
            error_exit "App '$APP_NAME' also exists. Please choose a unique name."
        fi
    fi
else
    echo "App '$APP_NAME' will be created"
fi

# Check Docker installation (optional but recommended)
if command_exists docker; then
    success "Docker is installed (optional, but good for local testing)"
else
    warning "Docker is not installed. Fly.io will build remotely."
fi

# Check for required files and directories
echo -e "\n${YELLOW}Checking project structure...${NC}"
[ -d "src" ] || error_exit "src/ directory not found"
[ -f "requirements.txt" ] || warning "requirements.txt not found - Python dependencies may be missing"

success "Project structure verified"

# Create fly.toml configuration
echo -e "\n${YELLOW}Creating Fly.io configuration...${NC}"
cat > fly.toml << 'EOF'
# fly.toml app configuration file
app = "ai-news-trader"
primary_region = "iad"
kill_signal = "SIGINT"
kill_timeout = "5s"

[build]
  dockerfile = "Dockerfile.fly"

[env]
  PORT = "8080"
  # Add any other non-sensitive environment variables here

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

  [http_service.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

[[services]]
  protocol = "tcp"
  internal_port = 8080
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"
    grace_period = "5s"

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "get"
    path = "/health"
    protocol = "http"
EOF

# Update fly.toml with actual app name
sed -i.bak "s/app = \"ai-news-trader\"/app = \"$APP_NAME\"/" fly.toml && rm fly.toml.bak
sed -i.bak "s/primary_region = \"iad\"/primary_region = \"$REGION\"/" fly.toml && rm fly.toml.bak

success "Created fly.toml configuration"

# Create Dockerfile for non-GPU deployment
echo -e "\n${YELLOW}Creating Dockerfile for non-GPU deployment...${NC}"
cat > Dockerfile.fly << 'EOF'
# AI News Trader - Non-GPU Python deployment
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy Python source code
COPY src/ ./src/

# Copy requirements file
COPY requirements.txt* ./

# Install Python dependencies (CPU versions only)
RUN pip install --no-cache-dir \
    numpy pandas scikit-learn requests python-dotenv \
    fastapi uvicorn[standard] httpx alpaca-py \
    newsapi-python finnhub-python yfinance ta structlog \
    "python-jose[cryptography]" "passlib[bcrypt]" python-multipart \
    && pip list

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start command for Python FastAPI app
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
EOF

success "Created Dockerfile.fly"

# Create .dockerignore
echo -e "\n${YELLOW}Creating .dockerignore...${NC}"
cat > .dockerignore << 'EOF'
node_modules/
npm-debug.log
.env
.env.local
.git/
.gitignore
README.md
.vscode/
.idea/
*.log
*.pid
*.seed
*.pid.lock
.DS_Store
Thumbs.db
coverage/
.nyc_output/
dist/
build/
*.test.js
*.spec.js
__tests__/
test/
tests/
docs/
*.md
LICENSE
.github/
.gitlab-ci.yml
.travis.yml
docker-compose*.yml
Dockerfile
.dockerignore
fly.toml
scripts/
*.pyc
__pycache__/
.pytest_cache/
.coverage
htmlcov/
.tox/
*.egg-info/
.mypy_cache/
.ruff_cache/
EOF

success "Created .dockerignore"

# Function to set secrets
set_secrets() {
    echo -e "\n${YELLOW}Setting up secrets...${NC}"
    
    # Check for .env file
    if [ -f .env ]; then
        echo "Found .env file. Setting secrets from environment variables..."
        
        # Read .env file and set secrets (excluding comments and empty lines)
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ "$key" =~ ^#.*$ ]] && continue
            [[ -z "$key" ]] && continue
            
            # Remove quotes from value if present
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            
            # Only set if the key looks like a secret (contains API, KEY, SECRET, TOKEN, PASSWORD, AUTH, JWT)
            if [[ "$key" =~ (API|KEY|SECRET|TOKEN|PASSWORD|ALPACA|NEWS|FINNHUB|POLYGON|AUTH|JWT) ]]; then
                echo "Setting secret: $key"
                fly secrets set "$key=$value" --app "$APP_NAME" 2>/dev/null || warning "Failed to set $key"
            fi
        done < .env
        
        success "Secrets configured"
    else
        warning "No .env file found. You'll need to set secrets manually:"
        echo "  fly secrets set KEY=value --app $APP_NAME"
    fi
}

# Main deployment
echo -e "\n${GREEN}🚀 Starting deployment...${NC}"
echo "================================"

# Create or use existing app
if ! fly apps list --json | jq -e ".[] | select(.name == \"$APP_NAME\")" >/dev/null 2>&1; then
    echo "Creating new Fly.io app..."
    fly apps create "$APP_NAME" --org "$FLY_ORG" || error_exit "Failed to create app"
    success "Created app: $APP_NAME"
else
    success "Using existing app: $APP_NAME"
fi

# Set secrets
set_secrets

# Deploy the application
echo -e "\n${YELLOW}Deploying application...${NC}"
echo "This may take a few minutes..."

if fly deploy --app "$APP_NAME" --primary-region "$REGION" --ha=false --strategy immediate; then
    success "Deployment successful!"
    
    # Get app URL
    APP_URL="https://$APP_NAME.fly.dev"
    
    echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
    echo "================================"
    echo "App Name: $APP_NAME"
    echo "URL: $APP_URL"
    echo "Region: $REGION"
    echo ""
    echo "Useful commands:"
    echo "  fly status --app $APP_NAME      # Check app status"
    echo "  fly logs --app $APP_NAME        # View logs"
    echo "  fly ssh console --app $APP_NAME # SSH into container"
    echo "  fly scale show --app $APP_NAME  # View scaling"
    echo "  fly secrets list --app $APP_NAME # List secrets"
    echo ""
    echo "To add more secrets:"
    echo "  fly secrets set KEY=value --app $APP_NAME"
    echo ""
    echo "To destroy the app:"
    echo "  fly apps destroy $APP_NAME"
else
    error_exit "Deployment failed. Check the logs above for details."
fi

echo -e "\n${GREEN}Script completed successfully!${NC}"