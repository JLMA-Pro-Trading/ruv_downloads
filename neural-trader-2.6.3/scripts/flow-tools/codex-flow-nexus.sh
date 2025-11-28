#!/bin/bash

# Codex + Flow-Nexus Integration Script
# This script allows you to use flow-nexus features within Codex CLI

FLOW_NEXUS_CMD="npx flow-nexus@latest"

case "$1" in
    "swarm")
        echo "🚀 Initializing Flow-Nexus Swarm..."
        $FLOW_NEXUS_CMD swarm init --topology "${2:-mesh}"
        ;;
    "agent")
        echo "🤖 Spawning Flow-Nexus Agent..."
        $FLOW_NEXUS_CMD agent spawn --type "${2:-coder}"
        ;;
    "task")
        echo "📋 Orchestrating Task..."
        $FLOW_NEXUS_CMD task orchestrate --task "$2"
        ;;
    "chat")
        echo "👑 Connecting to Queen Seraphina..."
        $FLOW_NEXUS_CMD seraphina chat --message "$2"
        ;;
    "sandbox")
        echo "📦 Creating Sandbox..."
        $FLOW_NEXUS_CMD sandbox create --template "${2:-node}"
        ;;
    "neural")
        echo "🧠 Training Neural Network..."
        $FLOW_NEXUS_CMD neural train --config "$2"
        ;;
    "help"|*)
        echo "Codex + Flow-Nexus Integration"
        echo "Usage: codex-flow-nexus.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  swarm [topology]  - Initialize swarm (mesh|hierarchical|ring|star)"
        echo "  agent [type]      - Spawn agent (coder|tester|researcher|analyst)"
        echo "  task \"<task>\"     - Orchestrate a task across agents"
        echo "  chat \"<message>\"  - Chat with Queen Seraphina"
        echo "  sandbox [template]- Create execution sandbox"
        echo "  neural <config>   - Train neural network"
        echo "  help             - Show this help message"
        ;;
esac