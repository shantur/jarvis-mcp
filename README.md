# MCP Voice Interface

Browser-based voice input/output for AI Assistant conversations via MCP (Model Context Protocol).

## Features

- 🎤 **Voice Input**: Browser-based speech recognition
- 🔊 **Voice Output**: Text-to-speech with multiple voice options  
- ⚡ **Speed Control**: Adjustable speech speed (0.5x - 2.0x)
- 🎛️ **Voice Selection**: Choose from available system voices
- 💾 **Preferences**: Automatic saving of user settings
- 🧪 **Test Voice**: Built-in voice testing functionality
- 🔄 **Smart Listening**: Automatic pause during AI speech

## Installation & Usage

### Quick Start

```bash
# Run the MCP server directly
npx mcp-voice-interface

# Show help
npx mcp-voice-interface --help
```

### Setup for Claude Desktop

```bash
npx mcp-voice-interface --install-claude-config
```

Then restart Claude Desktop app.

### Setup for OpenCode

```bash
# Install in current project directory
npx mcp-voice-interface --install-opencode-config --local

# Install globally 
npx mcp-voice-interface --install-opencode-config --global
```

### Setup for Claude Code CLI

```bash
# Install in current project directory
npx mcp-voice-interface --install-claude-code-config --local

# Install globally 
npx mcp-voice-interface --install-claude-code-config --global
```

### OpenCode Plugin

For enhanced integration with OpenCode, install the companion plugin:

```bash
# Install plugin in current project (recommended)
npx mcp-voice-interface --install-opencode-plugin --local

# Install plugin globally
npx mcp-voice-interface --install-opencode-plugin --global
```

The plugin enables voice message forwarding to OpenCode sessions even when they're busy. Messages are consumed after forwarding to prevent duplicate processing.

You can also manually build and install from the `opencode-plugin/` folder:
```bash
cd opencode-plugin
./build.sh
```

## Usage in AI Conversations

### Voice Conversation Tool

Use the `converse` tool for bidirectional voice conversations:

```
converse("Hello! How can I help you today?")
```

### Other Available Tools

- `speak("text")` - One-way text-to-speech
- `voice_status()` - Check voice system status  
- `get_voice_input()` - Get pending voice input

### Voice Conversation Prompt

Use the `converse` prompt to start a voice conversation mode where the AI will only respond using voice.

## Browser Interface

When the MCP server runs, it starts both HTTP and HTTPS servers and automatically opens the HTTPS interface:

- **HTTPS**: `https://localhost:5114` (auto-opens, recommended)
- **HTTP**: `http://localhost:5113` (fallback)

The browser interface includes:

- **Voice Controls**: Start/stop listening
- **Speed Slider**: Adjust speech speed  
- **Voice Selection**: Choose from available voices
- **Test Voice**: Verify your settings
- **Live Display**: See what the AI is saying
- **Voice Queue**: View recent voice interactions

## Configuration Files

### Claude Desktop
- **Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Format**: Standard Claude Desktop MCP configuration

### OpenCode
- **Location**: `opencode.json` in project directory (local) or home directory (global)
- **Format**: OpenCode MCP configuration with `mcp` object and `type: "local"`

### Claude Code CLI
- **Location**: `.mcp.json` in project directory (local) or home directory (global)  
- **Format**: Claude Code CLI MCP configuration with `mcpServers` object

## Environment Variables

- **`MCP_VOICE_AUTO_OPEN`**: Controls automatic browser opening (default: `true`)
  - Set to `false` to disable auto-opening: `MCP_VOICE_AUTO_OPEN=false`
- **`MCP_VOICE_HTTP_PORT`**: HTTP server port (default: `5113`)
- **`MCP_VOICE_HTTPS_PORT`**: HTTPS server port (default: `5114`)

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run the MCP server directly
npm run mcp
```

## Requirements

- **Node.js**: 18.0.0 or higher
- **Browser**: Chrome/Safari (for speech recognition)
- **Platform**: macOS, Linux, Windows

## CLI Options

```
npx mcp-voice-interface [options]

Options:
  --install-claude-config      Install configuration for Claude Desktop
  --install-opencode-config    Install configuration for OpenCode/Claude Code  
  --install-claude-code-config Install configuration for Claude Code CLI
  --local                      Install config in current directory
  --global                     Install config globally (for Claude Desktop)
  --help, -h                   Show help message
  --version, -v                Show version information
```

## License

MIT