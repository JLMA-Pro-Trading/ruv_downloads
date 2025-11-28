# E2B Swarm CLI - Quick Start Guide

## 🚀 Get Started in 3 Minutes

### 1. Setup Environment (30 seconds)

```bash
cd scripts
npm install
chmod +x e2b-swarm-cli.js
```

Create `.env` in project root:
```bash
E2B_API_KEY=your-e2b-api-key
E2B_ACCESS_TOKEN=your-e2b-access-token
ALPACA_API_KEY=your-alpaca-key
ALPACA_SECRET_KEY=your-alpaca-secret
```

### 2. Basic Commands (1 minute)

```bash
# Show all commands
node e2b-swarm-cli.js --help

# Create 3 sandboxes
node e2b-swarm-cli.js create --count 3 --name test

# Deploy a momentum trader
node e2b-swarm-cli.js deploy --agent momentum --symbols AAPL,MSFT,GOOGL

# Check health
node e2b-swarm-cli.js health

# Monitor live
node e2b-swarm-cli.js monitor --interval 5s
```

### 3. Run Example Workflow (90 seconds)

```bash
cd examples
./basic-workflow.sh
```

## 📖 Next Steps

- **Full Guide**: `/docs/getting-started/guides/E2B_CLI_GUIDE.md`
- **README**: `README.md`
- **Examples**: `examples/*.sh`

## 🎯 Common Commands

### Development
```bash
# Quick test setup
node e2b-swarm-cli.js create --count 1 --name dev
node e2b-swarm-cli.js deploy --agent momentum --symbols SPY
node e2b-swarm-cli.js execute --strategy momentum --symbols SPY
```

### Production
```bash
# Full production deployment
./examples/production-deploy.sh
```

### Monitoring
```bash
# Real-time dashboard
node e2b-swarm-cli.js monitor --interval 5s

# Health check every minute
watch -n 60 "node e2b-swarm-cli.js health"
```

### Backtesting
```bash
# Test strategy
node e2b-swarm-cli.js backtest \
  --strategy momentum \
  --start 2024-01-01 \
  --symbols AAPL,MSFT,GOOGL
```

### Cleanup
```bash
# Safe cleanup
./examples/cleanup-swarm.sh
```

## 💡 Pro Tips

1. **JSON Mode**: Add `--json` for scripting
   ```bash
   node e2b-swarm-cli.js list --json | jq '.sandboxes[] | .id'
   ```

2. **Parallel Deployment**: Deploy multiple agents
   ```bash
   node e2b-swarm-cli.js deploy --agent momentum --symbols AAPL &
   node e2b-swarm-cli.js deploy --agent pairs --symbols MSFT &
   wait
   ```

3. **Monitor Logs**: Check detailed logs
   ```bash
   tail -f .swarm/cli.log
   ```

## 🆘 Troubleshooting

**Problem**: Missing environment variables
```bash
cat .env | grep E2B_API_KEY
```

**Problem**: Command not found
```bash
cd scripts
node e2b-swarm-cli.js --help
```

**Problem**: Sandbox creation fails
```bash
node e2b-swarm-cli.js health --json
tail .swarm/cli.log
```

## 📚 Documentation

- **Comprehensive Guide**: 645 lines of detailed documentation
- **README**: Complete reference with examples
- **Example Scripts**: 3 production-ready workflows
- **Source Code**: 935 lines with comments

## ✅ Features

- ✅ 11 commands for complete control
- ✅ Sandbox management
- ✅ Agent deployment
- ✅ Swarm coordination
- ✅ Strategy execution
- ✅ Real-time monitoring
- ✅ Backtesting
- ✅ JSON mode
- ✅ State management
- ✅ Comprehensive logging

---

**Version**: 2.1.1
**Status**: Production Ready
**Support**: https://github.com/ruvnet/neural-trader
