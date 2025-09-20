# Installing MCP Browser Voice for ~/Coding/test-ai

## Method 1: Claude Desktop Configuration

Add this to your Claude Desktop MCP configuration:

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
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
```

## Method 2: Project-Specific Claude Configuration

Create `.claude/settings.local.json` in your test-ai project:

```bash
cd ~/Coding/test-ai
mkdir -p .claude
```

Then create `.claude/settings.local.json`:

```json
{
  "mcp": {
    "servers": {
      "mcp-browser-voice": {
        "command": "node",
        "args": ["/Users/shantur/Coding/mcp-voice-hooks/mcp-browser-voice/dist/index.js"],
        "env": {
          "MCP_BROWSER_VOICE_HTTP_PORT": "5113",
          "MCP_BROWSER_VOICE_HTTPS_PORT": "5114",
          "MCP_BROWSER_VOICE_MCP_PORT": "5115"
        }
      }
    }
  }
}
```

## Method 3: NPM Global Installation

From the mcp-browser-voice directory:

```bash
cd /Users/shantur/Coding/mcp-voice-hooks/mcp-browser-voice
npm link
```

Then in your test-ai project:

```bash
cd ~/Coding/test-ai
npm link mcp-browser-voice
```

Add to your project's MCP config:

```json
{
  "mcp": {
    "servers": {
      "mcp-browser-voice": {
        "command": "mcp-browser-voice"
      }
    }
  }
}
```

## Usage

1. Start Claude Code in your test-ai project:
   ```bash
   cd ~/Coding/test-ai
   claude
   ```

2. The MCP Browser Voice server will automatically start
3. Browser interface opens at: http://localhost:5113
4. Click "Start Listening" to begin voice interaction
5. Speak to Claude and get voice responses back

## Testing the Installation

You can test if it's working by asking Claude:

```
Can you check your voice status?
```

Claude should have access to these tools:
- `speak` - Text-to-speech
- `voice_status` - Check voice system status  
- `get_voice_input` - Get pending voice input

## Ports Used

- **5113**: HTTP browser interface
- **5114**: HTTPS browser interface  
- **5115**: MCP endpoint for Claude

Make sure these ports are available.