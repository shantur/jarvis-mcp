# OpenCode Voice Interface Plugin

This OpenCode plugin integrates with the MCP Voice Interface to enable voice message forwarding to OpenCode sessions, even when they are busy processing other tasks.

## Features

- **Non-blocking Voice Forwarding**: Forwards voice messages to OpenCode sessions without interrupting ongoing operations
- **Smart Event Monitoring**: Automatically checks for voice messages on various OpenCode events
- **Configurable Polling**: Customizable polling intervals and message limits
- **Voice Status Tools**: Built-in tools to monitor and configure voice integration
- **Message Consumption**: Voice messages are consumed after forwarding and no longer available to `converse()` tool

## Installation

1. Copy the `opencode-plugin` folder to your OpenCode plugins directory
2. Install dependencies:
   ```bash
   cd opencode-plugin
   npm install
   npm run build
   ```

3. Configure OpenCode to load the plugin (refer to OpenCode documentation)

## Configuration

The plugin can be configured via environment variables:

- `VOICE_INTERFACE_URL`: URL of the MCP Voice Interface (default: `http://localhost:5113`)
  - Uses HTTP by default for reliability (avoids SSL certificate issues in background operations)
  - Can be changed to HTTPS if needed: `https://localhost:5114`
- `VOICE_POLL_INTERVAL`: Polling interval in milliseconds (default: `2000`)
- `VOICE_MAX_MESSAGES`: Maximum messages to process per poll (default: `5`)
- `VOICE_DEBUG`: Enable debug logging (default: `false`)

## Usage

### Automatic Operation

The plugin automatically monitors OpenCode events and forwards voice messages:

- Tool execution completion
- Chat message events
- General OpenCode events

### Manual Tools

The plugin provides several tools for manual control:

#### `voice_status`
Check the current status of the voice interface connection.

```
voice_status()
```

#### `voice_forward_now`
Immediately check for and forward any pending voice messages.

```
voice_forward_now()
```

#### `voice_configure`
Configure voice interface settings.

```
voice_configure(url="https://localhost:5114", autoForward=true, pollInterval=3000)
```

## How It Works

1. **Event Monitoring**: The plugin hooks into various OpenCode events (tool execution, chat messages, etc.)

2. **Voice Message Detection**: On each event, it polls the MCP Voice Interface `/api/status` endpoint to check for pending messages

3. **Message Forwarding**: When pending messages are found, they are forwarded to the current OpenCode session via the internal API

4. **Message Consumption**: After successful forwarding, messages are marked as delivered/consumed and are no longer available to the `converse()` tool to prevent duplicate processing

5. **Non-blocking Operation**: The forwarding process doesn't block or interfere with ongoing OpenCode operations

## Integration with MCP Voice Interface

This plugin works alongside the main MCP Voice Interface server:

- **MCP Server**: Handles voice input/output and provides voice tools (`converse`, `speak`, etc.)
- **OpenCode Plugin**: Forwards voice messages to OpenCode sessions when they're busy
- **Browser Interface**: Provides the voice controls and real-time communication

## API Endpoints Used

The plugin communicates with these MCP Voice Interface endpoints:

- `GET /api/status` - Get voice interface status and pending message count
- Voice messages are read from the status response but not consumed

## Error Handling

- **Connection Failures**: Gracefully handles voice interface connection issues
- **Concurrent Operations**: Prevents multiple polling operations from running simultaneously
- **Message Forwarding Errors**: Logs errors but continues operation for remaining messages
- **Configuration Validation**: Validates configuration updates before applying

## Development

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

### Development Mode

```bash
npm run dev  # Watch mode
```

## Troubleshooting

### Voice messages not forwarding

1. Check voice interface is running: `voice_status()`
2. Verify URL configuration is correct
3. Enable debug logging: `VOICE_DEBUG=true`
4. Check OpenCode logs for plugin errors

### Plugin not loading

1. Ensure plugin is in correct OpenCode plugins directory
2. Verify plugin is built: `npm run build`
3. Check OpenCode plugin configuration
4. Review OpenCode startup logs

### Performance issues

1. Adjust polling interval: `voice_configure(pollInterval=5000)`
2. Reduce max messages per poll: `voice_configure(maxMessages=3)`
3. Disable auto-forwarding if needed: `voice_configure(autoForward=false)`

## License

MIT - Same as the MCP Voice Interface project