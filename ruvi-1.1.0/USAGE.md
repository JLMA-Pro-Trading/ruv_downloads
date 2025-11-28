# ruvi CLI - Usage Guide

## Quick Start

```bash
# Run the CLI
npx ruvi

# Or use a specific command directly
npx ruvi console
npx ruvi resume
npx ruvi booking
```

## Commands Overview

### Interactive Menu (Default)

Simply run `npx ruvi` to launch the interactive menu:

```
  ██████╗ ██╗   ██╗██╗   ██╗██╗
  ██╔══██╗██║   ██║██║   ██║██║
  ██████╔╝██║   ██║██║   ██║██║
  ██╔══██╗██║   ██║╚██╗ ██╔╝██║
  ██║  ██║╚██████╔╝ ╚████╔╝ ██║
  ╚═╝  ╚═╝ ╚═════╝   ╚═══╝  ╚═╝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Agentic Engineering Console
  with MCP Tools & Resources
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? What would you like to do?
  🏠 Overview - About rUv
  💬 Console - Chat with AI
  📋 Resume - Projects & Portfolio
  📅 Booking - Schedule a Session
  🌟 Tribe - Join the Community
  🔐 Login
  👋 Exit
```

### Authentication Commands

#### Login

```bash
npx ruvi login
```

You'll be prompted for:
- Email address
- Password

The session is stored securely in `~/.ruv/session.json` and will auto-refresh.

#### Logout

```bash
npx ruvi logout
```

Clears your session and signs you out.

#### Check Status

```bash
npx ruvi status
```

Shows your current authentication status and user information.

### Console - AI Chat

```bash
npx ruvi console
```

Start an interactive AI chat session powered by Gemini 2.5 Flash with RAG knowledge base.

**Example Session:**

```
🚀 Agentic Console
Interactive AI console with RAG knowledge base
Commands: /help, /clear, /history, /exit

ruv> Tell me about Neural Trader

🔍 Searching: Neural Trader