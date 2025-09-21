# MCP Voice Interface

Browser-based voice input/output for AI Assistant conversations via MCP (Model Context Protocol).

**Talk to AI coding assistants using your voice** - Compatible with Claude Code CLI, OpenCode, and other AI development tools. Enables hands-free coding conversations and voice-driven development workflows.

**Remote Voice Access** - Use your phone, tablet, or any device with a browser to talk to AI assistants running on your computer. Perfect for mobile coding discussions, reviewing code from anywhere, or continuing conversations away from your desk.

## Features

- 🎤 **Voice Input**: Browser-based speech recognition
- 🔊 **Voice Output**: Text-to-speech with multiple voice options  
- ⚡ **Speed Control**: Adjustable speech speed (0.5x - 2.0x)
- 🎛️ **Voice Selection**: Choose from available system voices
- 🔴 **Always-On Mode**: Keep microphone continuously active for hands-free operation
- 📱 **Remote Access**: Talk to AI assistants from your phone/tablet while they run on your computer
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

- **HTTPS**: `https://<MACHINE_IP>:5114` (auto-opens, **required for microphone access**)
- **HTTP**: `http://localhost:5113` (only for use on same machine)

The browser interface includes:

- **Voice Controls**: Start/stop listening with always-on mode option
- **Speed Slider**: Adjust speech speed  
- **Voice Selection**: Choose from available voices
- **Test Voice**: Verify your settings
- **Live Display**: See what the AI is saying
- **Voice Queue**: View recent voice interactions

### Remote Access from Mobile Devices

Access the voice interface from any device on your network:

1. **Find your computer's IP address**: 
   - macOS/Linux: `ifconfig | grep inet`
   - Windows: `ipconfig`

2. **Connect from mobile device**:
   - Visit `https://YOUR_COMPUTER_IP:5114` on your phone/tablet
   - Accept the self-signed certificate warning (click "Advanced" → "Proceed")
   - Enable microphone permissions when prompted
   - Talk to AI assistants running on your computer remotely

**Note**: HTTPS is required for microphone access on remote devices. The server generates self-signed certificates automatically.

Perfect for:
- 📱 **Mobile code reviews** - Ask questions about code while away from desk
- 🛋️ **Couch coding** - Continue development conversations from anywhere
- 🚶 **Walking meetings** - Discuss architecture while taking a walk
- 👥 **Team collaboration** - Share voice access with team members

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

## Troubleshooting Remote Access

### Certificate Warnings on Mobile Devices

When accessing from phones/tablets, you'll see a security warning due to self-signed certificates:

**Chrome/Safari on Mobile:**
1. You'll see "Your connection is not private" or similar
2. Tap "Advanced" or "Show Details"
3. Tap "Proceed to [IP address]" or "Visit this unsafe site"
4. The interface will load and request microphone permissions

**Alternative Solutions:**
- **Local network only**: The self-signed certificate approach works fine for local network access
- **Production setup**: For internet access, consider using a reverse proxy with real SSL certificates

## Development

```bash
# Install dependencies
npm install

# Build everything (plugin + main project)
npm run build

# Build only the OpenCode plugin
npm run build:plugin

# Build only the main MCP server
npm run build:main

# Clean all build artifacts
npm run clean

# Run in development mode
npm run dev

# Run the MCP server directly
npm run mcp
```

### Build Process

The build system handles both the main MCP server and the OpenCode plugin:

1. **Plugin build**: Compiles TypeScript and creates bundled `plugin.js` for OpenCode
2. **Main build**: Compiles the MCP server TypeScript code

The plugin is built first since it's included in the npm package distribution.

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