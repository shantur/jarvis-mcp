#!/bin/bash

# Quick installer for test-ai project
cd ~/Coding/test-ai

echo "🎤 Installing MCP Browser Voice for test-ai project..."

# Create .claude directory
mkdir -p .claude

# Backup existing settings if they exist
if [ -f ".claude/settings.local.json" ]; then
    echo "📋 Backing up existing settings..."
    cp .claude/settings.local.json .claude/settings.local.json.backup
fi

# Create or update settings
echo "📝 Creating MCP configuration..."
cat > .claude/settings.local.json << 'EOF'
{
  "mcp": {
    "servers": {
      "mcp-browser-voice": {
        "command": "node",
        "args": ["/Users/shantur/Coding/mcp-voice-hooks/mcp-browser-voice/dist/index.js"],
        "env": {
          "MCP_BROWSER_VOICE_HTTP_PORT": "5113",
          "MCP_BROWSER_VOICE_HTTPS_PORT": "5114", 
          "MCP_BROWSER_VOICE_MCP_PORT": "5115",
          "MCP_BROWSER_VOICE_AUTO_OPEN": "true"
        }
      }
    }
  }
}
EOF

echo "✅ MCP Browser Voice installed for test-ai project!"
echo ""
echo "🚀 To use:"
echo "1. cd ~/Coding/test-ai"
echo "2. claude"
echo "3. Ask Claude: 'Can you check your voice status?'"
echo "4. Browser opens at http://localhost:5113"
echo ""
echo "🔧 If you had existing MCP servers, restore from:"
echo "   .claude/settings.local.json.backup"