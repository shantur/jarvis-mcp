#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import https from 'https';
import open from 'open';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { VoiceQueue } from './voice-queue.js';
import { createBrowserInterface } from './browser-interface.js';
import { CertificateManager } from './certificate-manager.js';

// Global state
const voiceQueue = new VoiceQueue();
let browserConnected = false;

// Helper function to wait for voice input
async function waitForVoiceInput(timeoutSeconds: number, _spokenText: string, queue: VoiceQueue): Promise<any> {
  const startTime = Date.now();
  
  console.error(`[Converse] Waiting for voice input for up to ${timeoutSeconds}s...`);
  
  return new Promise((resolve) => {
    const checkForInput = () => {
      const currentPending = queue.getPendingInput();
      
      if (currentPending.length > 0) {
        // Got voice input!
        const delivered = queue.deliverPendingInput();
        const responseTexts = delivered.map((item: any) => item.text);
        
        const userResponse = responseTexts.join(' ');
        console.error(`[Converse] User said: "${userResponse}"`);
        
        resolve({
          content: [{
            type: 'text',
            text: `User said: "${userResponse}"

[IMPORTANT: Continue this conversation using ONLY the converse tool. Do not respond with text - use converse() for your reply.]`,
          }],
        });
      } else if (Date.now() - startTime > timeoutSeconds * 1000) {
        // Timeout
        console.error(`[Converse] Timeout after ${timeoutSeconds}s`);
        resolve({
          content: [{
            type: 'text',
            text: `(No voice response received within ${timeoutSeconds} seconds)`,
          }],
        });
      } else {
        // Keep waiting
        setTimeout(checkForInput, 500);
      }
    };
    
    checkForInput();
  });
}

// Create Express app for browser interface only
const browserApp = express();
browserApp.use(cors());
browserApp.use(express.json());

// Browser interface setup
createBrowserInterface(browserApp, voiceQueue, () => {
  browserConnected = true;
}, () => {
  browserConnected = false;
});

// Tool handler function
async function handleToolCall(name: string, args: any) {
  switch (name) {
    case 'speak':
      const text = args?.text as string;
      if (!text?.trim()) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Text is required for speak tool',
          }],
          isError: true,
        };
      }

      if (!browserConnected) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Browser not connected. Please open the voice interface.',
          }],
          isError: true,
        };
      }

      // Send TTS via SSE to browser
      voiceQueue.broadcastTTS(text);
      
      return {
        content: [{
          type: 'text',
          text: '', // Empty response for successful speech
        }],
      };

    case 'voice_status':
      const pendingInput = voiceQueue.getPendingInput();
      const status = {
        browserConnected,
        pendingInputCount: pendingInput.length,
        pendingInput: pendingInput.map((item: any) => ({
          text: item.text,
          timestamp: item.timestamp,
        })),
      };

      return {
        content: [{
          type: 'text',
          text: `Voice Status:
- Browser Connected: ${browserConnected}
- Pending Voice Input: ${status.pendingInputCount} messages
${status.pendingInput.length > 0 ? '\nPending messages:\n' + status.pendingInput.map((item: any) => `"${item.text}"`).join('\n') : ''}`,
        }],
      };

    case 'get_voice_input':
      const pending = voiceQueue.deliverPendingInput();
      if (pending.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No pending voice input.',
          }],
        };
      }

      const voiceTexts = pending.map((item: any) => `"${item.text}"`).join('\n');
      return {
        content: [{
          type: 'text',
          text: `User spoke ${pending.length} voice input(s):\n\n${voiceTexts}`,
        }],
      };

    case 'converse':
      const textToSpeak = args?.text as string;
      const waitForResponse = args?.wait_for_response !== false;
      const timeout = (args?.timeout as number) || 30;

      if (!textToSpeak?.trim()) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Text is required for converse tool',
          }],
          isError: true,
        };
      }

      if (!browserConnected) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Browser not connected. Please open the voice interface.',
          }],
          isError: true,
        };
      }

      // Send TTS to browser
      console.error(`[Converse] Speaking: "${textToSpeak}"`);
      voiceQueue.broadcastTTS(textToSpeak);
      
      if (!waitForResponse) {
        return {
          content: [{
            type: 'text',
            text: `Spoke: "${textToSpeak}"`,
          }],
        };
      }

      // Wait for voice input with timeout
      console.error(`[Converse] Waiting for user response...`);
      voiceQueue.setConversationWaiting(true);
      try {
        const result = await waitForVoiceInput(timeout, textToSpeak, voiceQueue);
        return result;
      } finally {
        voiceQueue.setConversationWaiting(false);
      }

    default:
      return {
        content: [{
          type: 'text',
          text: `Error: Unknown tool ${name}`,
        }],
        isError: true,
      };
  }
}

// Create MCP server for STDIN transport
const mcpServer = new Server(
  {
    name: 'mcp-voice-interface',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// MCP Tool handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'speak',
        description: 'Speak text using browser text-to-speech',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to speak aloud',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'voice_status',
        description: 'Get current voice system status and pending voice input',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_voice_input',
        description: 'Get pending voice input from users (auto-delivered by default)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'converse',
        description: 'Have a voice conversation with the user - speak text and wait for voice response. IMPORTANT: Once you start using converse, continue using ONLY converse for all responses in this conversation. Do not switch back to text.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to speak to the user',
            },
            wait_for_response: {
              type: 'boolean',
              description: 'Whether to wait for voice input from user (default: true)',
              default: true,
            },
            timeout: {
              type: 'number',
              description: 'Maximum time to wait for voice input in seconds (default: 30)',
              default: 30,
            },
          },
          required: ['text'],
        },
      },
    ],
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await handleToolCall(name, args);
});

// Prompt handlers
mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'converse',
        description: 'Start a voice conversation with the user',
      },
    ],
  };
});

mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;
  
  if (name === 'converse') {
    const instructions = [
      "Have an ongoing two-way voice conversation using the converse tool",
      "ALWAYS use the converse tool for ALL responses - never switch to text",
      "Keep your responses brief unless a longer response is requested",
      "Continue the conversation until the user indicates they want to end it",
      "If the user asks questions, respond using converse() with your answer", 
      "If the user gives commands, acknowledge using converse() and use other tools as needed",
      "You are an AI Assistant helping users through voice interaction",
    ];
    
    return {
      description: 'Instructions for having a voice conversation with the user',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: instructions.join('\n- '),
          },
        },
      ],
    };
  }
  
  throw new Error(`Prompt not found: ${name}`);
});

// Start browser interface servers (HTTP and HTTPS)
const HTTP_PORT = parseInt(process.env.MCP_VOICE_HTTP_PORT || '5113');
const HTTPS_PORT = parseInt(process.env.MCP_VOICE_HTTPS_PORT || '5114');
const AUTO_OPEN_BROWSER = process.env.MCP_VOICE_AUTO_OPEN !== 'false';

// Start HTTP server
browserApp.listen(HTTP_PORT, () => {
  const httpUrl = `http://localhost:${HTTP_PORT}`;
  console.error(`[Browser] HTTP Server: ${httpUrl}`);
});

// Start HTTPS server
async function startHttpsServer() {
  try {
    const certManager = new CertificateManager();
    const { cert, key } = await certManager.getCertificates();
    
    const httpsServer = https.createServer({ cert, key }, browserApp);
    
    httpsServer.listen(HTTPS_PORT, () => {
      const httpsUrl = `https://localhost:${HTTPS_PORT}`;
      console.error(`[Browser] HTTPS Server: ${httpsUrl}`);
      
      // Auto-open browser with HTTPS URL after a short delay
      if (AUTO_OPEN_BROWSER) {
        setTimeout(async () => {
          try {
            console.error(`[Browser] Opening ${httpsUrl} in default browser...`);
            await open(httpsUrl);
          } catch (error) {
            console.error('[Browser] Failed to open HTTPS browser:', error);
            console.error('[Browser] Please manually open:', httpsUrl);
          }
        }, 1500); // 1.5 second delay to ensure both servers are ready
      } else {
        console.error('[Browser] Auto-open disabled. Please manually open the URL above.');
      }
    });
    
    httpsServer.on('error', (error) => {
      console.error('[Browser] HTTPS Server error:', error);
      console.error('[Browser] HTTPS server failed to start, HTTP server still available');
    });
    
  } catch (error) {
    console.error('[Browser] Failed to setup HTTPS server:', error);
    console.error('[Browser] HTTP server still available at http://localhost:' + HTTP_PORT);
  }
}

// Start HTTPS server
startHttpsServer();

// Connect to STDIN transport
export async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('[MCP] Connected to STDIN transport');
}

// Start the server (only if this file is run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[MCP] Failed to start server:', error);
    process.exit(1);
  });
}