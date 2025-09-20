import type { OpenCodeClient } from "./types";
import { VoiceLogger } from "./voice-logger";

/**
 * Voice Message Service
 * 
 * Handles communication with the MCP Voice Interface to check for pending
 * voice messages and forward them to OpenCode sessions.
 */

export interface VoiceServiceConfig {
  voiceInterfaceUrl: string;
  pollInterval: number;
  maxMessagesPerPoll: number;
  debug: boolean;
}

export interface VoiceMessage {
  id: string;
  text: string;
  timestamp: string;
  status: 'pending' | 'delivered';
}

export interface VoiceStatus {
  connected: boolean;
  pendingMessages: number;
  lastCheck: string;
  url: string;
  autoForwarding: boolean;
}

export interface ForwardResult {
  messagesFound: number;
  messagesForwarded: number;
  errors: string[];
}

export class VoiceMessageService {
  private config: VoiceServiceConfig;
  private client: OpenCodeClient;
  private isPolling = false;
  private lastCheck = new Date();
  private autoForwarding = true;

  get debugMode(): boolean {
    return this.config.debug;
  }

  constructor(client: OpenCodeClient, config: VoiceServiceConfig) {
    this.client = client;
    this.config = config;
    
    VoiceLogger.log('Voice Service initialized with config:', this.config);
  }

  /**
   * Check for pending voice messages and forward them to the current session
   */
  async checkAndForwardMessages(sessionID: string): Promise<ForwardResult> {
    if (!this.autoForwarding) {
      return { messagesFound: 0, messagesForwarded: 0, errors: [] };
    }

    if (this.isPolling) {
      return { messagesFound: 0, messagesForwarded: 0, errors: ['Already polling'] };
    }

    this.isPolling = true;
    this.lastCheck = new Date();
    const errors: string[] = [];

    try {
      // Request pending messages and mark them as delivered in one call
      const messages = await this.fetchAndDeliverMessages();
      
      VoiceLogger.log(`Got ${messages} voice messages`);

      if (!messages || messages.length === 0) {
        return { messagesFound: 0, messagesForwarded: 0, errors: [] };
      }

      VoiceLogger.log(`Got ${messages.length} voice messages`);

      // Sort messages by timestamp (earliest first)
      const sortedMessages = messages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Combine all messages into single user message (plain text, no emoji prefix)
      const combinedText = sortedMessages.map(msg => msg.text).join('\n');
      
      // Send as single user message to OpenCode
      await this.forwardCombinedMessages(sessionID, combinedText);
      
      VoiceLogger.log(`Forwarded combined message: "${combinedText}"`);

      return { messagesFound: messages.length, messagesForwarded: 1, errors: [] };

    } catch (error) {
      const errorMsg = `Voice service error: ${error}`;
      errors.push(errorMsg);
      
      VoiceLogger.error(errorMsg);
      
      return { messagesFound: 0, messagesForwarded: 0, errors };
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Get current voice service status
   */
  async getStatus(): Promise<VoiceStatus> {
    try {
      const response = await fetch(`${this.config.voiceInterfaceUrl}/api/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const status = await response.json();
      
      return {
        connected: true,
        pendingMessages: status?.pendingInputCount || 0,
        lastCheck: this.lastCheck.toISOString(),
        url: this.config.voiceInterfaceUrl,
        autoForwarding: this.autoForwarding
      };
    } catch {
      return {
        connected: false,
        pendingMessages: 0,
        lastCheck: this.lastCheck.toISOString(),
        url: this.config.voiceInterfaceUrl,
        autoForwarding: this.autoForwarding
      };
    }
  }

  /**
   * Update service configuration
   */
  async updateConfig(updates: Partial<VoiceServiceConfig & { autoForwarding: boolean }>): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    if (updates.voiceInterfaceUrl) {
      this.config.voiceInterfaceUrl = updates.voiceInterfaceUrl;
      result.voiceInterfaceUrl = updates.voiceInterfaceUrl;
    }

    if (updates.pollInterval) {
      this.config.pollInterval = updates.pollInterval;
      result.pollInterval = updates.pollInterval;
    }

    if (typeof updates.autoForwarding === 'boolean') {
      this.autoForwarding = updates.autoForwarding;
      result.autoForwarding = updates.autoForwarding;
    }

    return result;
  }

  /**
   * Fetch and deliver all pending messages in one call
   */
  private async fetchAndDeliverMessages(): Promise<VoiceMessage[]> {
    const response = await fetch(`${this.config.voiceInterfaceUrl}/api/get-voice-input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.messages || [];
  }

  /**
   * Forward combined messages to the current OpenCode session
   */
  private async forwardCombinedMessages(sessionID: string, combinedText: string): Promise<void> {
    try {
      await this.client.session.prompt({
        path: {
          id: sessionID
        },
        body: {
          parts: [
            {
              type: 'text',
              text: combinedText
            }
          ]
        }
      });
      
    } catch (error) {
      throw new Error(`Failed to forward to session: ${error}`);
    }
  }
}