# 🎯 Goalie - AI Research Assistant

[![Crates.io](https://img.shields.io/crates/v/goalie.svg)](https://crates.io/crates/goalie)
[![npm version](https://badge.fury.io/js/goalie.svg)](https://www.npmjs.com/package/goalie)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/crates/d/goalie.svg)](https://crates.io/crates/goalie)
[![Documentation](https://docs.rs/goalie/badge.svg)](https://docs.rs/goalie)

> **AI-powered research assistant with Goal-Oriented Action Planning (GOAP), advanced reasoning capabilities, and Model Context Protocol (MCP) integration for Claude Desktop.**

Goalie combines intelligent search planning with the Perplexity API to deliver comprehensive research workflows. This Rust crate provides a native binary wrapper around the [goalie npm package](https://www.npmjs.com/package/goalie), offering seamless integration with both Rust and Node.js ecosystems.

## 🌟 What Makes Goalie Special?

- **🎯 GOAP Planning**: Uses A* pathfinding algorithms for intelligent research workflows
- **🧠 Advanced Reasoning**: Four specialized reasoning modes (Chain-of-Thought, Self-Consistency, Anti-Hallucination, Agentic Research)
- **🔧 MCP Integration**: Native Claude Desktop integration with 11+ specialized tools
- **🔍 Smart Search**: Enhanced Perplexity API integration with domain filtering and citation management
- **🛡️ Quality Assurance**: Built-in fact-checking and hallucination prevention
- **⚡ Cross-Platform**: Available as both Rust binary and npm package

## Installation

### Via Cargo (Rust)
```bash
cargo install goalie
```

### Via npm (Node.js)
```bash
npm install -g goalie
# or run directly
npx goalie@latest --help
```

## Quick Start

Set up your Perplexity API key:
```bash
# Get your API key from https://perplexity.ai/settings/api
export PERPLEXITY_API_KEY="pplx-your-key-here"
# Or add to .env file:
echo 'PERPLEXITY_API_KEY="pplx-your-key-here"' >> .env
```

Start researching immediately:
```bash
goalie search "What are the latest developments in quantum computing?"
```

## Usage

All commands are forwarded to the npm package `goalie@1.2.1`:

### Command Line Interface
```bash
# Interactive search with GOAP planning
goalie search "latest developments in renewable energy"

# Raw search without planning
goalie query "climate change impacts 2024"

# Advanced reasoning modes
goalie reason --mode chain-of-thought "Should companies invest in AI?"
goalie reason --mode self-consistency "Is nuclear energy safe?" --samples 5
goalie reason --mode anti-hallucination --claims "AI will replace all jobs" --citations "..."

# Multi-agent research
goalie research "future of space exploration" --agents researcher,analyst,critic

# MCP server for Claude integration
goalie start

# Configuration and diagnostics
goalie validate
goalie info
goalie --help
```

### MCP Server Integration

Start the MCP server for Claude Desktop integration:
```bash
goalie start
```

Then add to your Claude Desktop configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "goalie": {
      "command": "goalie",
      "args": ["start"],
      "env": {
        "PERPLEXITY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Available MCP Tools
- `goap.search` - Intelligent search with planning
- `goap.plan.explain` - Explain GOAP planning process
- `search.raw` - Direct Perplexity search
- `reasoning.chain_of_thought` - Multi-path reasoning analysis
- `reasoning.self_consistency` - Consensus-based verification
- `reasoning.anti_hallucination` - Fact-checking with citations
- `reasoning.agentic_research` - Multi-agent research workflows
- Plugin management tools (list, enable, disable, info)

## Features

### 🎯 GOAP Planning System
Goal-Oriented Action Planning with A* pathfinding algorithm for intelligent research workflows:
- Automatic query decomposition and action planning
- Dynamic replanning based on search results
- Confidence-based path selection
- Multi-step reasoning chains

### 🔍 Enhanced Search Capabilities
Perplexity API integration with advanced features:
- Real-time web search with citations
- Domain filtering and recency controls
- Academic and web search modes
- Result synthesis and analysis

### 🧠 Advanced Reasoning Engine
Four specialized reasoning modes:
- **Chain-of-Thought**: Multi-branch exploration with confidence scoring
- **Self-Consistency**: Consensus validation across multiple samples
- **Anti-Hallucination**: Citation-based fact verification with token limits
- **Agentic Research**: Multi-agent collaborative analysis

### 🔧 Professional Integration
- **MCP Protocol**: Native Claude Desktop integration
- **Plugin System**: Extensible architecture with 11+ built-in tools
- **CLI Interface**: Complete command-line functionality
- **API Access**: Programmatic usage via npm package

### 🛡️ Quality Assurance
- Ed25519 cryptographic verification (experimental)
- Citation requirement enforcement
- Uncertainty flagging for unverified claims
- Token limit management to prevent overflow

## Requirements

- **Node.js 18+** (for the underlying npm package)
- **Perplexity API Key** ([get one here](https://perplexity.ai/settings/api))
- **npm or npx** available in PATH

## Examples

### Research Query
```bash
goalie search "state of the art in large language models 2024"
```

### Multi-Agent Analysis
```bash
goalie research "impact of AI on healthcare" --agents researcher,analyst,critic --parallel
```

### Fact Verification
```bash
goalie reason --mode anti-hallucination \
  --claims "ChatGPT was released in 2022" \
  --citations "OpenAI announced ChatGPT in November 2022"
```

## Recent Updates

**v1.2.1** (Latest)
- ✅ Fixed anti-hallucination tool token limit issues
- ✅ Added pagination support for large citation responses
- ✅ Improved MCP server stability
- ✅ All reasoning tools verified working with real API calls

**v1.2.0**
- ✅ Fixed mock reasoning handlers to use real Perplexity API
- ✅ Replaced server-side mock implementations
- ✅ Comprehensive reasoning tool verification

## Publishing

The npm package is automatically published from the main repository:
```bash
# Update version
npm version patch|minor|major

# Publish to npm
npm publish

# Install latest version
npm install -g goalie@latest
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Repository

[https://github.com/ruvnet/goalie](https://github.com/ruvnet/goalie)