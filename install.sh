#!/bin/bash

# MCP Browser Voice Installation Script

set -e

echo "🎤 Installing MCP Browser Voice..."

# Get the project directory from argument or current directory
PROJECT_DIR="${1:-$(pwd)}"
MCP_VOICE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📁 Project directory: $PROJECT_DIR"
echo "📁 MCP Voice directory: $MCP_VOICE_DIR"

# Ensure we have a built version
if [ ! -f "$MCP_VOICE_DIR/dist/index.js" ]; then
    echo "🔨 Building MCP Browser Voice..."
    cd "$MCP_VOICE_DIR"
    npm install
    npm run build
fi

# Create .claude directory if it doesn't exist
mkdir -p "$PROJECT_DIR/.claude"

# Check if settings.local.json exists
SETTINGS_FILE="$PROJECT_DIR/.claude/settings.local.json"

if [ -f "$SETTINGS_FILE" ]; then
    echo "⚠️  Existing .claude/settings.local.json found"
    echo "📝 Please manually add this MCP server configuration:"
    echo ""
    echo "\"mcp-browser-voice\": {"
    echo "  \"command\": \"node\","
    echo "  \"args\": [\"$MCP_VOICE_DIR/dist/index.js\"],"
    echo "  \"env\": {"
    echo "    \"MCP_BROWSER_VOICE_HTTP_PORT\": \"5113\","
    echo "    \"MCP_BROWSER_VOICE_HTTPS_PORT\": \"5114\","
    echo "    \"MCP_BROWSER_VOICE_MCP_PORT\": \"5115\""
    echo "  }"
    echo "}"
else
    echo "📝 Creating .claude/settings.local.json..."
    cat > "$SETTINGS_FILE" << EOF
{
  "mcp": {
    "servers": {
      "mcp-browser-voice": {
        "command": "node",
        "args": ["$MCP_VOICE_DIR/dist/index.js"],
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
fi

echo "✅ MCP Browser Voice installed successfully!"
echo ""
echo "🚀 Usage:"
echo "1. cd $PROJECT_DIR"
echo "2. claude"
echo "3. Browser opens at http://localhost:5113"
echo "4. Click 'Start Listening' to begin voice interaction"
echo ""
echo "🛠️  Available tools for Claude:"
echo "   - speak: Text-to-speech output"
echo "   - voice_status: Check voice system status"
echo "   - get_voice_input: Get pending voice input"
echo ""
echo "🌐 Ports used:"
echo "   - 5113: HTTP browser interface"
echo "   - 5114: HTTPS browser interface"
echo "   - 5115: MCP endpoint for Claude"