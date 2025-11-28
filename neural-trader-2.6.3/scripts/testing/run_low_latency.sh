#!/bin/bash
# Low-latency Trading API Runner Script
# Optimizes CPU, memory, and network settings for minimal latency

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Low-Latency Trading API...${NC}"

# Check if running as root for system optimizations
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Warning: Not running as root. Some optimizations may not apply.${NC}"
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# CPU Frequency Scaling - Set to performance mode
if command_exists cpupower; then
    echo -e "${GREEN}Setting CPU governor to performance mode...${NC}"
    sudo cpupower frequency-set -g performance 2>/dev/null || true
fi

# Disable CPU frequency scaling
if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
    echo -e "${GREEN}Disabling CPU frequency scaling...${NC}"
    for i in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
        echo performance | sudo tee $i > /dev/null 2>&1 || true
    done
fi

# Disable CPU idle states for lower latency
if [ -f /sys/devices/system/cpu/cpu0/cpuidle/state0/disable ]; then
    echo -e "${GREEN}Disabling CPU idle states...${NC}"
    for i in /sys/devices/system/cpu/cpu*/cpuidle/state*/disable; do
        echo 1 | sudo tee $i > /dev/null 2>&1 || true
    done
fi

# Network optimizations
echo -e "${GREEN}Applying network optimizations...${NC}"

# Increase network buffer sizes
sudo sysctl -w net.core.rmem_max=134217728 2>/dev/null || true
sudo sysctl -w net.core.wmem_max=134217728 2>/dev/null || true
sudo sysctl -w net.ipv4.tcp_rmem="4096 87380 134217728" 2>/dev/null || true
sudo sysctl -w net.ipv4.tcp_wmem="4096 65536 134217728" 2>/dev/null || true

# Enable TCP no delay and keepalive
sudo sysctl -w net.ipv4.tcp_nodelay=1 2>/dev/null || true
sudo sysctl -w net.ipv4.tcp_low_latency=1 2>/dev/null || true

# Disable TCP timestamps for lower overhead
sudo sysctl -w net.ipv4.tcp_timestamps=0 2>/dev/null || true

# Memory optimizations
echo -e "${GREEN}Applying memory optimizations...${NC}"

# Disable transparent huge pages
if [ -f /sys/kernel/mm/transparent_hugepage/enabled ]; then
    echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled > /dev/null 2>&1 || true
fi

# Set swappiness to 0 (avoid swapping)
sudo sysctl -w vm.swappiness=0 2>/dev/null || true

# Check if Docker is available
if command_exists docker; then
    echo -e "${GREEN}Using Docker to run the application...${NC}"
    
    # Build the Docker image
    docker build -t trading-api:latest .
    
    # Run with optimized settings
    docker run -d \
        --name low-latency-trading \
        --rm \
        --privileged \
        --network host \
        --cpus="4" \
        --memory="2g" \
        --memory-swap="2g" \
        --cpu-shares=1024 \
        --ulimit memlock=-1:-1 \
        --ulimit nofile=65536:65536 \
        --env-file .env \
        -v $(pwd)/config:/app/config:ro \
        -v $(pwd)/logs:/app/logs \
        -v $(pwd)/data:/app/data \
        trading-api:latest \
        bash -c "
            # Set CPU affinity (cores 0-3)
            taskset -c 0-3 \
            # Set high priority
            nice -n -20 \
            # Set real-time scheduling
            chrt -f 99 \
            python -m src.main
        "
    
    echo -e "${GREEN}Trading API started in Docker container 'low-latency-trading'${NC}"
    echo -e "${YELLOW}Monitor logs with: docker logs -f low-latency-trading${NC}"
    
else
    echo -e "${GREEN}Running natively (Docker not found)...${NC}"
    
    # Check virtual environment
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}Creating virtual environment...${NC}"
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Run with CPU affinity and priority
    if command_exists taskset && command_exists nice; then
        # Set CPU affinity to cores 0-3 and high priority
        taskset -c 0-3 nice -n -20 python -m src.main
    else
        # Run normally if tools not available
        python -m src.main
    fi
fi

echo -e "${GREEN}Low-latency optimizations applied successfully!${NC}"