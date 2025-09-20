/**
 * OpenCode Voice Interface Plugin
 * 
 * This plugin integrates with the MCP Voice Interface to forward voice messages
 * to OpenCode sessions even when they are busy processing other tasks.
 * 
 * Installation: Copy this file to .opencode/plugin/ directory in your project
 * or globally to ~/.config/opencode/plugin/
 */

// === VoiceLogger ===
class VoiceLogger {
    static isDebugEnabled() {
        return process.env.VOICE_DEBUG === 'true';
    }
    static log(...args) {
        if (this.isDebugEnabled()) {
            console.log('[Voice Plugin]', ...args);
        }
    }
    static error(...args) {
        if (this.isDebugEnabled()) {
            console.error('[Voice Plugin Error]', ...args);
        }
    }
    static warn(...args) {
        if (this.isDebugEnabled()) {
            console.warn('[Voice Plugin Warning]', ...args);
        }
    }
    static info(...args) {
        if (this.isDebugEnabled()) {
            console.info('[Voice Plugin Info]', ...args);
        }
    }
}
//# sourceMappingURL=voice-logger.js.map

// === VoiceMessageService ===
class VoiceMessageService {
    config;
    client;
    isPolling = false;
    lastCheck = new Date();
    autoForwarding = true;
    get debugMode() {
        return this.config.debug;
    }
    constructor(client, config) {
        this.client = client;
        this.config = config;
        VoiceLogger.log('Voice Service initialized with config:', this.config);
    }
    /**
     * Check for pending voice messages and forward them to the current session
     */
    async checkAndForwardMessages(sessionID) {
        if (!this.autoForwarding) {
            return { messagesFound: 0, messagesForwarded: 0, errors: [] };
        }
        if (this.isPolling) {
            return { messagesFound: 0, messagesForwarded: 0, errors: ['Already polling'] };
        }
        this.isPolling = true;
        this.lastCheck = new Date();
        const errors = [];
        try {
            // Request pending messages and mark them as delivered in one call
            const messages = await this.fetchAndDeliverMessages();
            VoiceLogger.log(`Got ${messages} voice messages`);
            if (!messages || messages.length === 0) {
                return { messagesFound: 0, messagesForwarded: 0, errors: [] };
            }
            VoiceLogger.log(`Got ${messages.length} voice messages`);
            // Sort messages by timestamp (earliest first)
            const sortedMessages = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            // Combine all messages into single user message (plain text, no emoji prefix)
            const combinedText = sortedMessages.map(msg => msg.text).join('\n');
            // Send as single user message to OpenCode
            await this.forwardCombinedMessages(sessionID, combinedText);
            VoiceLogger.log(`Forwarded combined message: "${combinedText}"`);
            return { messagesFound: messages.length, messagesForwarded: 1, errors: [] };
        }
        catch (error) {
            const errorMsg = `Voice service error: ${error}`;
            errors.push(errorMsg);
            VoiceLogger.error(errorMsg);
            return { messagesFound: 0, messagesForwarded: 0, errors };
        }
        finally {
            this.isPolling = false;
        }
    }
    /**
     * Get current voice service status
     */
    async getStatus() {
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
        }
        catch {
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
    async updateConfig(updates) {
        const result = {};
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
    async fetchAndDeliverMessages() {
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
    async forwardCombinedMessages(sessionID, combinedText) {
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
        }
        catch (error) {
            throw new Error(`Failed to forward to session: ${error}`);
        }
    }
}
//# sourceMappingURL=voice-service.js.map

// === Main Plugin ===
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
const plugin = async (input) => {
    const { client, project, directory } = input;
    // Initialize voice message service
    const voiceService = new VoiceMessageService(client, {
        // Default to HTTP localhost voice interface (more reliable for background operations)
        voiceInterfaceUrl: process.env.VOICE_INTERFACE_URL || 'http://localhost:5113',
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
        event: async ({ event }) => {
            VoiceLogger.log('Event triggered:', event.type);
            // Extract sessionID from session events
            let sessionID;
            if (event.type === 'session.idle' && 'sessionID' in event.properties) {
                sessionID = event.properties.sessionID;
            }
            else if (event.type === 'session.updated' && 'info' in event.properties) {
                sessionID = event.properties.info.id;
            }
            else if (event.type === 'session.error' && 'sessionID' in event.properties) {
                sessionID = event.properties.sessionID;
            }
            if (sessionID) {
                VoiceLogger.log('Session event with ID:', sessionID, 'checking for voice messages');
                await voiceService.checkAndForwardMessages(sessionID);
            }
            else {
                VoiceLogger.log('Non-session event (ignored):', event.type);
            }
        },
        // Monitor tool execution completion
        "tool.execute.after": async (input, output) => {
            VoiceLogger.log('Tool execution completed, checking for voice messages');
            await voiceService.checkAndForwardMessages(input.sessionID);
        },
        "tool.execute.before": async (input, output) => {
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
export const VoiceInterfacePlugin = plugin;
//# sourceMappingURL=index.js.map
