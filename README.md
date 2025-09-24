# Jarvis MCP

Bring your AI to life—talk to assistants instantly in your browser. Compatible with Claude Desktop, OpenCode, and other MCP-enabled AI tools.

> ✅ No extra software, services, or API keys required—just open the web app in your browser and grant microphone access.

## Features

🎙️ **Voice Conversations** - Speak naturally with AI assistants  
🌍 **30+ Languages** - Speech recognition in multiple languages  
📱 **Remote Access** - Use from phone/tablet while AI runs on computer  
⚙️ **Smart Controls** - Collapsible settings, always-on mode, custom voices  
⏱️ **Dynamic Timeouts** - Intelligent wait times based on response length  
🧰 **Zero Extra Software** - Runs entirely in your browser—no extra installs or API keys
🔌 **Optional Whisper Streaming** - Plug into a local Whisper server for low-latency transcripts  

## Easy Installation

### 🚀 One-Command Setup

**Claude Desktop:**
```bash
npx @shantur/jarvis-mcp --install-claude-config
# Restart Claude Desktop and you're ready!
```

**OpenCode (in current project):**
```bash
npx @shantur/jarvis-mcp --install-opencode-config --local
npx @shantur/jarvis-mcp --install-opencode-plugin --local
# Start OpenCode and use the converse tool
```

**Claude Code CLI:**
```bash
npx @shantur/jarvis-mcp --install-claude-code-config --local
# Start Claude Code CLI and use voice tools
```

### 🤖 Why Install the OpenCode Plugin?

- Stream voice messages into OpenCode even while tools are running or tasks are in progress.
- Auto-forward pending Jarvis MCP conversations so you never miss a user request.
- Works entirely locally—no external services required, just your OpenCode project and browser.
- Installs with one command and stays in sync with the latest Jarvis MCP features.

### 📦 Manual Installation

**From NPM:**
```bash
npm install -g @shantur/jarvis-mcp
jarvis-mcp
```

**From Source:**
```bash
git clone <repository-url>
cd jarvis-mcp
npm install && npm run build && npm start
```

## How to Use

1. **Start the server** - Run `jarvis-mcp`
2. **Open browser** - Visit `https://localhost:5114` (opens automatically)
3. **Allow microphone** - Grant permissions when prompted
4. **Start talking** - Use the `converse` tool in your AI assistant

### Voice Commands in AI Chat

```
Use the converse tool to start talking:
- converse("Hello! How can I help you today?", timeout: 35)
```

## Browser Interface

The web interface provides:

- **Voice Settings** (click ⚙️ to expand)
  - Language selection (30+ options)
  - Voice selection
  - Speech speed control
  - Always-on microphone mode
  - Silence detection sensitivity & timeout (for Whisper streaming)
- **Smart Controls**
  - Pause during AI speech (prevents echo)
  - Stop AI when user speaks (natural conversation)
- **Mobile Friendly** - Works on phones and tablets

## Remote Access

Access from any device on your network:

1. Find your computer's IP: `ifconfig | grep inet` (Mac/Linux) or `ipconfig` (Windows)
2. Visit `https://YOUR_IP:5114` on your phone/browser
3. Accept the security warning (self-signed certificate)
4. Grant microphone permissions

Perfect for continuing conversations away from your desk!

## Configuration

### Environment Variables

```bash
export MCP_VOICE_AUTO_OPEN=false  # Disable auto-opening browser
export MCP_VOICE_HTTPS_PORT=5114  # Change HTTPS port
export MCP_VOICE_STT_MODE=whisper  # Switch the web app to Whisper streaming
export MCP_VOICE_WHISPER_URL=http://localhost:12017/v1/audio/transcriptions  # Whisper endpoint (full path)
export MCP_VOICE_WHISPER_TOKEN=your_token  # Optional Bearer auth for Whisper server
```

### Whisper Streaming Mode

- Whisper mode records raw PCM in the browser, converts it to 16 kHz mono WAV, and streams it through the built-in HTTPS proxy, so the local `whisper-server` sees OpenAI-compatible requests.
- By default we proxy to the standard `whisper-server` endpoint at `http://localhost:12017/v1/audio/transcriptions`; point `MCP_VOICE_WHISPER_URL` at your own host/port if you run it elsewhere.
- The UI keeps recording while transcripts are in flight and ignores Whisper’s non-verbal tags (e.g. `[BLANK_AUDIO]`, `(typing)`), so only real speech is queued.
- To enable it:
  1. Run your Whisper server locally (e.g. `whisper-server` from `pfrankov/whisper-server`).
  2. Set the environment variables above (`MCP_VOICE_STT_MODE=whisper` and the full `MCP_VOICE_WHISPER_URL`).
  3. Restart `jarvis-mcp` and hard-refresh the browser (empty-cache reload) to load the streaming bundle.
  4. Voice status (`voice_status()` tool) now reports whether Whisper or browser STT is active.

### Ports

- **HTTPS**: 5114 (required for microphone access)
- **HTTP**: 5113 (local access only)

## Requirements

- Node.js 18+
- Google Chrome (only browser tested so far)
- Microphone access
- Optional: Local Whisper server (like `pfrankov/whisper-server`) if you want streaming STT via `MCP_VOICE_STT_MODE=whisper`

## Troubleshooting

**Certificate warnings on mobile?**
- Tap "Advanced" → "Proceed to site" to accept self-signed certificate

**Microphone not working?**
- Ensure you're using HTTPS (not HTTP)
- Check browser permissions
- Try refreshing the page

**AI not responding to voice?**
- Make sure the `converse` tool is being used (not just `speak`)
- Check that timeouts are properly calculated

## Development

```bash
npm install
npm run build
npm run dev     # Watch mode
npm run start   # Run server
```

## License

MIT
