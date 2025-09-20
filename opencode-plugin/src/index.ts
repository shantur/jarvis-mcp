import type { Plugin, PluginInput, Hooks, Event, ToolContext } from "./types.js";
import { VoiceMessageService } from "./voice-service";

/**
 * OpenCode Plugin for MCP Voice Interface
 * 
 * This plugin integrates with the MCP Voice Interface to forward voice messages
 * to OpenCode sessions even when they are busy. It monitors various OpenCode events
 * and checks for pending voice messages, then forwards them via the internal API.
 * 
 * Key features:
 * - Monitors OpenCode events (tool execution, chat messages, etc.)
 * - Polls for pending voice messages from MCP Voice Interface
 * - Forwards messages to current session via internal API
 * - Messages remain pending in MCP (not marked as consumed)
 * - Non-blocking operation - doesn't interfere with ongoing sessions
 */
const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  const { client, project, directory } = input;
  
  // Initialize voice message service
  const voiceService = new VoiceMessageService(client, {
    // Default to localhost voice interface
    voiceInterfaceUrl: process.env.VOICE_INTERFACE_URL || 'http://localhost:5113',
    // Poll interval for checking voice messages
    pollInterval: parseInt(process.env.VOICE_POLL_INTERVAL || '2000'), // 2 seconds
    // Maximum messages to process per poll
    maxMessagesPerPoll: parseInt(process.env.VOICE_MAX_MESSAGES || '5'),
    // Debug logging
    debug: process.env.VOICE_DEBUG === 'true'
  });

  console.log('[Voice Plugin] Initialized for project:', project.name);

  return {
    // Hook into various events to trigger voice message checking
    event: async ({ event }: { event: Event }) => {
      await voiceService.checkAndForwardMessages();
    },

    // Monitor tool execution completion
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: any }
    ) => {
      await voiceService.checkAndForwardMessages();
    },

    // Monitor chat message events
    "chat.message": async (
      input: {},
      output: { message: any; parts: any[] }
    ) => {
      await voiceService.checkAndForwardMessages();
    },

    // Provide voice-related tools
    tool: {
      voice_status: {
        description: "Check the status of the voice interface connection and pending messages",
        args: {},
        async execute(args: any, context: ToolContext) {
          const status = await voiceService.getStatus();
          return `Voice Interface Status:
- Connected: ${status.connected}
- Pending Messages: ${status.pendingMessages}
- Last Check: ${status.lastCheck}
- Voice Interface URL: ${status.url}
- Auto-forwarding: ${status.autoForwarding ? 'Enabled' : 'Disabled'}`;
        }
      },

      voice_forward_now: {
        description: "Immediately check for and forward any pending voice messages",
        args: {},
        async execute(args: any, context: ToolContext) {
          const result = await voiceService.checkAndForwardMessages();
          return `Voice message check completed:
- Messages found: ${result.messagesFound}
- Messages forwarded: ${result.messagesForwarded}
- Errors: ${result.errors.length}
${result.errors.length > 0 ? '\nErrors:\n' + result.errors.join('\n') : ''}`;
        }
      },

      voice_configure: {
        description: "Configure voice interface settings",
        args: {
          url: { type: "string", description: "Voice interface URL (optional)" },
          autoForward: { type: "boolean", description: "Enable/disable auto-forwarding (optional)" },
          pollInterval: { type: "number", description: "Poll interval in milliseconds (optional)" }
        },
        async execute(args: any, context: ToolContext) {
          const updates = await voiceService.updateConfig({
            voiceInterfaceUrl: args.url,
            autoForwarding: args.autoForward,
            pollInterval: args.pollInterval
          });
          
          return `Voice interface configuration updated:
${Object.entries(updates).map(([key, value]) => `- ${key}: ${value}`).join('\n')}`;
        }
      }
    }
  };
};

export default plugin;