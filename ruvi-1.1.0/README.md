# ruvi - rUv Agentic Engineering CLI

```
  █▀█ █░█ █░█ █
  █▀▄ █▄█ ▀▄▀ █
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Agentic Engineering Console
  with MCP Tools & Resources
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**A powerful command-line interface for accessing rUv's AI coaching platform, featuring an interactive console with RAG-powered AI chat, authentication, booking, and Model Context Protocol (MCP) integration.**

---

## 🌟 About rUv

**rUv (Reuven Cohen)** is an independent AI consultant working with some of the largest companies in the world on their enterprise AI architecture and management strategies. A seasoned technology expert with a career spanning over three decades, marked by a profound impact on the industry's most groundbreaking innovations.

### 🏆 Career Highlights

- **Over 30 years of technology expertise** and industry innovation
- **Independent AI consultant** to Fortune 500 companies
- **Pivotal role in EY.ai deployment** ($1.4B budget, 400k+ employees, 1.5M users)
- **Founded Enomaly Inc.** - pioneering cloud computing company
- **Coined "Infrastructure as a Service" (IaaS)** in 2005 (before AWS EC2)
- **Inaugural member** of Amazon Web Services advisory board
- **Alpha/beta tester** for OpenAI, Napster, AOL, Sierra Online
- **Co-authored first US Cloud Definition** with NIST (2009)
- **Co-founded CloudCamp** (2008) - introduced 100,000+ to cloud computing
- **Advisor** to US Federal CIO Council and international organizations
- **Host** of Fungibility Podcast

### 🎯 Expertise

- Enterprise AI Architecture & Strategy
- Autonomous AI Agent Development
- Multi-Agent System Orchestration
- Cloud Computing & Infrastructure as a Service
- Quantum-Resistant AI Architectures
- Neural Network Trading Systems
- Distributed ML Frameworks
- Large-Scale Enterprise System Design

---

## 🚀 Featured Projects

### **AgentDB**
Vector database optimized for AI agent workflows
- GitHub: [github.com/ruvnet/agentdb](https://github.com/ruvnet/agentdb)

### **Claude-Flow v2**
Enterprise AI orchestration with swarm intelligence
- Multi-agent coordination
- Distributed processing

### **Neural Trader**
Autonomous trading system with neural networks
- Deep learning algorithms
- Real-time market analysis

### **FACT**
Revolutionary LLM data retrieval
- Sub-100ms response times
- 60-90% cost reduction

### **QuDAG**
Quantum-resistant platform for autonomous AI agents
- Post-quantum cryptography
- Agent security framework

### **Goalie**
Goal-oriented AI research with anti-hallucination features
- A* pathfinding algorithms
- Validation layer

### **strange-loops**
Real-time distributed systems
- 500K+ ticks/second performance
- High-performance computing

### **agentic-payments**
AI agent payment infrastructure
- Autonomous transactions
- Blockchain integration

---

## 📦 Installation

### Via npx (Recommended)

```bash
npx ruvi
```

### Global Installation

```bash
npm install -g ruvi
ruvi
```

### Local Development

```bash
git clone https://github.com/ruvnet/hacker-console-coach.git
cd hacker-console-coach/cli
npm install
npm run dev
```

---

## 🎮 Usage

### Interactive Menu (Default)

```bash
npx ruvi
```

This launches an interactive menu where you can:
- 🏠 **Overview** - Learn about rUv
- 💬 **Console** - Chat with AI assistant
- 📋 **Resume** - View projects and portfolio
- 📅 **Booking** - Schedule coaching sessions
- 🌟 **Tribe** - Join the Agentic Tribe community
- 🔐 **Login/Logout** - Authenticate with Supabase

### Direct Commands

```bash
# Authentication
npx ruvi register       # Create a new account
npx ruvi login          # Login to your account
npx ruvi logout         # Logout from account
npx ruvi status         # Check authentication status

# Package Discovery & Installation
npx ruvi packages       # Browse all rUv packages (aliases: pkgs, list)
npx ruvi search         # Search packages (alias: find)

# Features
npx ruvi console        # Start AI chat console
npx ruvi resume         # View projects (alias: projects)
npx ruvi overview       # View about info (alias: about)
npx ruvi booking        # Book a session (alias: book)
npx ruvi tribe          # View tribe information

# MCP Server
npx ruvi mcp            # Start MCP server (stdio transport)
```

---

## 📦 Package Discovery

The CLI includes built-in package discovery and installation features to help you explore and install the rUv ecosystem.

### Browse Packages

```bash
npx ruvi packages
```

This command fetches and displays all npm packages from the rUv ecosystem, organized by category:

- 🤖 **AI Orchestration** - claude-flow, agentic-flow, ruv-swarm
- 🧠 **Agent Frameworks** - Research tools and autonomous systems
- 🔌 **MCP Servers** - Model Context Protocol integrations
- 💾 **Databases & Storage** - agentdb and vector databases
- 🛡️ **Security & Defense** - aidefence and security tools
- 🔬 **Research Tools** - goalie, research-swarm
- 🛠️ **Development Tools** - Solvers, frameworks, utilities

### Search Packages

```bash
npx ruvi search
# Then enter your search term (e.g., "agent", "mcp", "database")
```

### Interactive Installation

The package browser offers interactive installation:

1. **Browse by category** - See all packages organized by purpose
2. **Search functionality** - Find specific packages quickly
3. **Installation options**:
   - 🌍 Global installation (`npm install -g`)
   - 📁 Local project (`npm install`)
   - ⚡ Run with npx (no install)
   - 📋 Copy command to clipboard

### MCP Server Discovery

When browsing packages, you can view MCP servers and get instant configuration snippets for Claude Desktop:

```bash
npx ruvi packages
# Select "View MCP servers"
# Get ready-to-use configuration for Claude Desktop
```

---

## 💬 AI Console

The interactive console provides streaming AI chat powered by Google's Gemini 2.5 Flash via Supabase edge functions with RAG (Retrieval-Augmented Generation) knowledge base integration.

### Console Commands

```bash
ruv> Tell me about Neural Trader
ruv> What are strange-loops?
ruv> How do I book a coaching session?

# Special commands
/help      - Show help
/clear     - Clear conversation history
/history   - Show conversation history
/exit      - Exit console
```

### Features

- **Streaming responses** with real-time display
- **RAG knowledge base** search for accurate information
- **Conversation history** maintained during session
- **Parallel tool execution** for multi-topic queries
- **Secure authentication** with Supabase

---

## 🔐 Authentication

The CLI uses the same secure Supabase authentication as the web dashboard.

```bash
# Create account
npx ruvi register

# Login
npx ruvi login

# Check status
npx ruvi status

# Logout
npx ruvi logout
```

Session tokens are securely stored in `~/.ruv/session.json` with automatic expiration.

---

## 📅 Booking & Services

### Coaching Sessions

**15-Minute Quick Guidance** - $149
- Quick guidance and consultation
- Calendly: [calendly.com/ruvnet/15min](https://calendly.com/ruvnet/15min)

**30-Minute Strategic Planning** - $299 ⭐ MOST POPULAR
- Strategic planning and deep-dive consultation
- Calendly: [calendly.com/ruvnet/30min](https://calendly.com/ruvnet/30min)

**60-Minute Comprehensive Coaching** - $499
- Comprehensive coaching on complex topics
- Calendly: [calendly.com/ruvnet/60min](https://calendly.com/ruvnet/60min)

### Neural Trader Training

Specialized training programs:
- Group Training Sessions
- Private 1-on-1 Coaching
- Enterprise Team Training

---

## 🌟 Agentic Tribe

Join an elite community of AI practitioners, engineers, and leaders building the future of autonomous systems.

### Format
- Bi-weekly 2-hour live sessions
- Small cohorts of ~5 people
- Hands-on projects and collaboration
- Direct access to rUv

### Investment
$250/month subscription

### Topics Covered
- Multi-agent orchestration patterns
- Neural network optimization
- Autonomous trading algorithms
- Quantum-resistant architectures
- Distributed ML frameworks
- Enterprise AI deployment strategies
- Model Context Protocol (MCP) integration
- Agent security and privacy

---

## 🔧 MCP Integration

The CLI includes a full Model Context Protocol (MCP) server with FastMCP, providing AI assistants with direct access to rUv's knowledge base, projects, and AI chat capabilities.

### Starting the MCP Server

```bash
npx ruvi mcp
```

The server runs on stdio transport and is compatible with any MCP client.

---

### 📋 Available MCP Tools

#### **ai_chat**
Chat with rUv AI assistant powered by RAG knowledge base
- **Parameters**: `message` (string), `conversation_history` (array, optional)
- **Returns**: Streaming AI responses with knowledge base context
- **Use case**: Ask questions about rUv's projects, expertise, or agentic engineering

#### **semantic_search**
Search the knowledge base using vector similarity
- **Parameters**: `query` (string), `limit` (number, default: 5)
- **Returns**: Relevant documents with similarity scores
- **Use case**: Find specific information about projects, technologies, or methodologies

---

### 📚 Available MCP Resources

#### **ruv://profile**
Professional profile and expertise
- 30+ years of technology leadership
- Enterprise AI architecture experience
- Career highlights and achievements

#### **ruv://projects**
Complete project portfolio
- AgentDB, Claude-Flow v2, Neural Trader
- FACT, QuDAG, Goalie, strange-loops
- agentic-payments and more

#### **ruv://services**
Coaching and services information
- Session types and pricing
- Agentic Tribe community details
- Availability and booking links

---

### 🖥️ Claude Desktop Integration

Add ruvi MCP server to Claude Desktop for seamless AI assistance.

#### **Configuration File Location**

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### **Configuration**

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ruvi": {
      "command": "npx",
      "args": ["-y", "ruvi@latest", "mcp"]
    }
  }
}
```

**Note**: The `-y` flag auto-confirms npx installation, and `@latest` ensures you always use the newest version.

#### **Restart Claude Desktop**

After updating the config:
1. Quit Claude Desktop completely
2. Relaunch the application
3. Look for the 🔌 MCP icon to confirm connection

---

### 🛠️ Other MCP Clients

#### **Cline (VS Code Extension)**

Add to Cline's MCP settings:

```json
{
  "mcpServers": {
    "ruvi": {
      "command": "npx",
      "args": ["-y", "ruvi@latest", "mcp"]
    }
  }
}
```

#### **Continue.dev**

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "name": "ruvi",
        "command": "npx",
        "args": ["-y", "ruvi@latest", "mcp"]
      }
    ]
  }
}
```

#### **Custom MCP Client**

For any MCP-compatible client using stdio transport:

```bash
# Start the server
npx ruvi mcp

# Or use in your application
const { spawn } = require('child_process');
const mcp = spawn('npx', ['ruvi', 'mcp']);
```

---

### 💡 Example Usage

Once connected, you can use ruvi MCP in your AI assistant:

**Ask about projects:**
```
Tell me about rUv's AgentDB project
```

**Search knowledge base:**
```
Search for information about neural trading systems
```

**Get professional info:**
```
What is rUv's experience with enterprise AI?
```

**Book coaching:**
```
How do I book a coaching session with rUv?
```

---

### 🔍 Troubleshooting MCP

**Server not connecting?**
- Ensure `npx` is in your PATH
- Try running `npx ruvi mcp` manually to check for errors
- Check MCP client logs for connection details

**Tools not showing up?**
- Restart your MCP client completely
- Verify config file syntax with a JSON validator
- Check that the config file path is correct for your OS

**Authentication issues?**
- MCP server works without authentication for public resources
- Login with `npx ruvi login` for personalized features (future)

---

## 🏗️ Architecture

### Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Google Gemini 2.5 Flash (via Lovable AI Gateway)
- **Embeddings**: OpenAI text-embedding-3-small
- **Vector DB**: pgvector (PostgreSQL extension)
- **MCP**: FastMCP with stdio transport
- **CLI Framework**: Commander.js
- **UI**: Chalk, Enquirer, Ora

### Security

- **Anon key approach** - Safe for client-side use
- **Row-level security (RLS)** on database
- **JWT token authentication** with auto-refresh
- **Session persistence** in secure local file
- **Automatic token expiration**

### Edge Functions

The CLI leverages Supabase edge functions:

- **ai-chat** - Streaming AI with RAG integration
- **semantic-search** - Vector similarity search
- **check-subscription** - Subscription validation

---

## 📁 Project Structure

```
cli/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── supabase.ts       # Supabase client
│   ├── modules/
│   │   ├── auth.ts           # Authentication
│   │   ├── console.ts        # AI chat console
│   │   ├── resume.ts         # Projects/portfolio
│   │   ├── overview.ts       # About/overview
│   │   ├── tribe.ts          # Tribe information
│   │   └── booking.ts        # Session booking
│   ├── mcp/
│   │   └── server.ts         # FastMCP server
│   └── utils/
│       ├── ascii-art.ts      # ASCII art & branding
│       ├── session.ts        # Session management
│       └── ui.ts             # UI helpers
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔨 Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

```bash
# Clone repository
git clone https://github.com/ruvnet/hacker-console-coach.git
cd hacker-console-coach/cli

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

### Environment Variables

Create a `.env` file (optional - defaults provided):

```env
VITE_SUPABASE_URL=https://lgctetjaggzaykfngqzt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🔗 Links

- **Website**: [ruv.io](https://ruv.io)
- **GitHub**: [github.com/ruvnet](https://github.com/ruvnet)
- **Agentics Foundation**: [agentics.org](https://agentics.org)
- **Fungibility Podcast**: [fungibility.io](https://fungibility.io)

---

## 💡 Philosophy

> "Building the future through intelligent automation and human-AI collaboration. Pushing boundaries while remaining approachable and relatable, sharing wisdom to benefit industry giants, governments, and aspiring entrepreneurs alike."

---

## 📞 Support

For questions, issues, or feature requests:

- **Email**: ruv@ruv.net
- **GitHub Issues**: [Create an issue](https://github.com/ruvnet/hacker-console-coach/issues)
- **Book a Session**: [calendly.com/ruvnet](https://calendly.com/ruvnet)

---

**Built with ❤️ by rUv - Pioneering AI Innovation for Three Decades**
