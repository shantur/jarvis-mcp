#!/bin/bash

# Build script for OpenCode Voice Interface Plugin

echo "Building OpenCode Voice Interface Plugin..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run TypeScript compilation
echo "🔨 Compiling TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Plugin built successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Copy this plugin folder to your OpenCode plugins directory"
    echo "2. Configure OpenCode to load the plugin"
    echo "3. Start the MCP Voice Interface server"
    echo "4. Use voice tools in OpenCode sessions"
    echo ""
    echo "🔧 Configuration:"
    echo "Set environment variables to customize behavior:"
    echo "  MCP_VOICE_INTERFACE_PORT=5114"
    echo "  VOICE_INTERFACE_URL=https://localhost:5114"
    echo "  VOICE_POLL_INTERVAL=2000"
    echo "  VOICE_MAX_MESSAGES=5"
    echo "  VOICE_DEBUG=true"
else
    echo "❌ Build failed"
    exit 1
fi