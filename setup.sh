#!/bin/bash

# Quick setup script for testing client-server separation

echo "🐠 Guppy Client-Server Setup"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your actual credentials and API keys"
    echo ""
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "🚀 You can now:"
echo "   1. Run full stack (dev):  npm run dev"
echo "   2. Run server only:       npm run server"
echo "   3. Deploy with Docker:    docker-compose up -d"
echo ""
echo "📱 For mobile apps:"
echo "   - Set PUBLIC_SERVER_URL in .env to your server's IP/domain"
echo "   - Build your mobile app with: npm run build"
echo "   - The mobile app will connect to the configured server"
echo ""
