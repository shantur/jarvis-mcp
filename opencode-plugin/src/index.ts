import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";
import { VoiceMessageService } from "./voice-service";
import { VoiceLogger } from "./voice-logger";

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
  const httpsPort = process.env.MCP_VOICE_INTERFACE_PORT || '5114';
  const voiceService = new VoiceMessageService(client, {
    // Default to HTTPS localhost voice interface (required for new architecture)
    voiceInterfaceUrl: process.env.VOICE_INTERFACE_URL || `https://localhost:${httpsPort}`,
    // Poll interval for checking voice messages
    pollInterval: parseInt(process.env.VOICE_POLL_INTERVAL || '2000'), // 2 seconds
    // Maximum messages to process per poll
    maxMessagesPerPoll: parseInt(process.env.VOICE_MAX_MESSAGES || '5'),
    // Debug logging
    debug: process.env.VOICE_DEBUG === 'true'
  });

  VoiceLogger.log('Initialized ');

  return {
    // Hook into session-specific events to trigger voice message checking  
    event: async ({ event }: { event: Event }) => {
      VoiceLogger.log('Event triggered:', event.type);
      
      // Extract sessionID from session events
      let sessionID: string | undefined;
      
      if (event.type === 'session.idle' && 'sessionID' in event.properties) {
        sessionID = event.properties.sessionID;
      } else if (event.type === 'session.updated' && 'info' in event.properties) {
        sessionID = event.properties.info.id;
      } else if (event.type === 'session.error' && 'sessionID' in event.properties) {
        sessionID = event.properties.sessionID;
      }
      
      if (sessionID) {
        VoiceLogger.log('Session event with ID:', sessionID, 'checking for voice messages');
        await voiceService.checkAndForwardMessages(sessionID);
      } else {
        VoiceLogger.log('Non-session event (ignored):', event.type);
      }
    },

    // Monitor tool execution completion
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: any }
    ) => {
      VoiceLogger.log('Tool execution completed, checking for voice messages');
      await voiceService.checkAndForwardMessages(input.sessionID);
    },

    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: any }
    ) => {
      VoiceLogger.log('Tool execution started, checking for voice messages');
      await voiceService.checkAndForwardMessages(input.sessionID);
    },

    // Monitor chat message events
    // "chat.message": async (
    //   input: {},
    //   output: { message: any; parts: any[] }
    // ) => {
    //   VoiceLogger.log('Chat message event, checking for voice messages');
    //   await voiceService.checkAndForwardMessages();
    // },

    // Note: Custom tools disabled to avoid Zod schema validation errors
    // The plugin focuses on automatic voice message forwarding via event hooks
    // Manual tools can be added later when proper OpenCode tool() helper format is clarified
  };
};

export default plugin;