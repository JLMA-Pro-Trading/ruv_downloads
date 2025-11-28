#!/bin/bash

# AI News Trader Environment Setup Script
# This script helps you set up your environment configuration

echo "🚀 AI News Trader Environment Setup"
echo "=================================="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  Warning: .env file already exists!"
    echo ""
    read -p "Do you want to backup the existing .env file? (y/n): " backup_choice
    
    if [ "$backup_choice" == "y" ] || [ "$backup_choice" == "Y" ]; then
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file=".env.backup.$timestamp"
        cp .env "$backup_file"
        echo "✅ Backed up existing .env to $backup_file"
    fi
    
    echo ""
    read -p "Do you want to overwrite the existing .env file? (y/n): " overwrite_choice
    
    if [ "$overwrite_choice" != "y" ] && [ "$overwrite_choice" != "Y" ]; then
        echo "❌ Setup cancelled. Existing .env file preserved."
        exit 0
    fi
fi

# Copy example.env to .env
echo "📄 Creating .env from example.env..."
cp example.env .env
echo "✅ Created .env file"

echo ""
echo "📝 Next Steps:"
echo "1. Edit .env and add your API credentials"
echo "2. Currently implemented integrations:"
echo "   - POLYMARKET_API_KEY (for prediction markets)"
echo "   - POLYMARKET_PRIVATE_KEY (for prediction markets)"
echo "3. Save the file and start the MCP server"
echo ""
echo "ℹ️  Note: Most features work without API keys:"
echo "   - News sentiment (Yahoo Finance, Reuters)"
echo "   - Neural forecasting (built-in models)"
echo "   - GPU acceleration (auto-detected)"
echo "   - Trading strategies (demo mode)"
echo ""
echo "🔐 Security Reminder:"
echo "- NEVER commit .env to version control"
echo "- Keep your API keys secret and secure"
echo "- Rotate keys regularly"
echo ""
echo "📖 For detailed setup instructions, see:"
echo "- POLYMARKET_SETUP.md (for Polymarket API)"
echo "- README.md (for general setup)"
echo ""
echo "✨ Setup complete! Edit .env to add your credentials."