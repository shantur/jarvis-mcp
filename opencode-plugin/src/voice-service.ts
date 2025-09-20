import type { OpenCodeClient } from "./types";

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

  constructor(client: OpenCodeClient, config: VoiceServiceConfig) {
    this.client = client;
    this.config = config;
    
    if (this.config.debug) {
      console.log('[Voice Service] Initialized with config:', this.config);
    }
  }

  /**
   * Check for pending voice messages and forward them to the current session
   */
  async checkAndForwardMessages(): Promise<ForwardResult> {
    if (!this.autoForwarding) {
      return { messagesFound: 0, messagesForwarded: 0, errors: [] };
    }

    if (this.isPolling) {
      // Avoid concurrent polling
      return { messagesFound: 0, messagesForwarded: 0, errors: ['Already polling'] };
    }

    this.isPolling = true;
    this.lastCheck = new Date();
    const errors: string[] = [];
    let messagesFound = 0;
    let messagesForwarded = 0;

    try {
      // Check voice interface status
      const status = await this.fetchVoiceStatus();
      if (!status || status.pendingInputCount === 0) {
        return { messagesFound: 0, messagesForwarded: 0, errors: [] };
      }

      messagesFound = status.pendingInputCount;

      if (this.config.debug) {
        console.log(`[Voice Service] Found ${messagesFound} pending messages`);
      }

      // Get pending messages (but don't consume them)
      const messages = await this.fetchPendingMessages();
      if (!messages || messages.length === 0) {
        return { messagesFound, messagesForwarded: 0, errors: [] };
      }

      // Forward up to maxMessagesPerPoll messages
      const messagesToForward = messages.slice(0, this.config.maxMessagesPerPoll);
      
      for (const message of messagesToForward) {
        try {
          await this.forwardMessageToSession(message);
          messagesForwarded++;
          
          if (this.config.debug) {
            console.log(`[Voice Service] Forwarded message: "${message.text}"`);
          }
        } catch (error) {
          const errorMsg = `Failed to forward message "${message.text}": ${error}`;
          errors.push(errorMsg);
          
          if (this.config.debug) {
            console.error('[Voice Service]', errorMsg);
          }
        }
      }

    } catch (error) {
      const errorMsg = `Voice service error: ${error}`;
      errors.push(errorMsg);
      
      if (this.config.debug) {
        console.error('[Voice Service]', errorMsg);
      }
    } finally {
      this.isPolling = false;
    }

    return { messagesFound, messagesForwarded, errors };
  }

  /**
   * Get current voice service status
   */
  async getStatus(): Promise<VoiceStatus> {
    try {
      const status = await this.fetchVoiceStatus();
      return {
        connected: !!status,
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
   * Fetch voice interface status from MCP server
   */
  private async fetchVoiceStatus(): Promise<any> {
    const response = await fetch(`${this.config.voiceInterfaceUrl}/api/status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Fetch pending messages from voice interface (without consuming them)
   */
  private async fetchPendingMessages(): Promise<VoiceMessage[]> {
    const status = await this.fetchVoiceStatus();
    return status.recentInputs?.filter((msg: any) => msg.status === 'pending') || [];
  }

  /**
   * Forward a voice message to the current OpenCode session
   */
  private async forwardMessageToSession(message: VoiceMessage): Promise<void> {
    // Use OpenCode client to send message to current session
    // This simulates a user message being added to the conversation
    
    try {
      // Create a user message that appears in the chat
      const userMessage = `🎤 Voice: ${message.text}`;
      
      // Use the OpenCode client to add the message to the current session
      // Note: This is a simplified approach - the actual API might differ
      await this.client.messages.create({
        content: userMessage,
        role: 'user',
        metadata: {
          source: 'voice-interface',
          originalMessageId: message.id,
          timestamp: message.timestamp
        }
      });
      
    } catch (error) {
      throw new Error(`Failed to forward to session: ${error}`);
    }
  }
}