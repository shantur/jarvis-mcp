#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import open from 'open';
import os from 'os';
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

const envSttMode = (process.env.MCP_VOICE_STT_MODE || 'browser').toLowerCase();
const WHISPER_URL = process.env.MCP_VOICE_WHISPER_URL || '';
const WHISPER_TOKEN = process.env.MCP_VOICE_WHISPER_TOKEN || '';
const whisperConfigured = envSttMode === 'whisper' && WHISPER_URL.length > 0;
const ACTIVE_STT_MODE = whisperConfigured ? 'whisper' : 'browser';
const DEFAULT_AUTO_CLAIM_SECONDS = 3600;
const SESSION_AUTO_CLAIM_SECONDS_RAW = Number(process.env.MCP_VOICE_AUTO_CLAIM_SECONDS);
const SESSION_AUTO_CLAIM_SECONDS = Number.isFinite(SESSION_AUTO_CLAIM_SECONDS_RAW)
  ? Math.max(0, SESSION_AUTO_CLAIM_SECONDS_RAW)
  : DEFAULT_AUTO_CLAIM_SECONDS;

// Global state
const voiceQueue = new VoiceQueue();
let browserConnected = false;
let browserDisconnectedAt: number | null = null;
let browserHasEverConnected = false;
const browserReconnectWaiters = new Set<() => void>();
const BROWSER_DISCONNECT_GRACE_MS = 60_000;

interface ClientSession {
  id: string;
  audioReady: boolean;
  claimedAt: number | null;
  deviceInfo?: {
    userAgent?: string;
    label?: string;
  };
}

const clientSessions = new Map<string, ClientSession>();
let activeClientId: string | null = null;
const audioReadyWaiters = new Set<() => void>();
const AUDIO_READY_TIMEOUT_MS = 300_000;

const HOST_CANDIDATES = computeHostCandidates();

function computeHostCandidates(): string[] {
  const interfaces = os.networkInterfaces();
  const hosts = new Set<string>();

  hosts.add('localhost');
  hosts.add('127.0.0.1');

  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const entry of iface) {
      if (entry.internal) continue;
      if (entry.family !== 'IPv4') continue;
      if (!entry.address) continue;
      hosts.add(entry.address);
    }
  }

  return Array.from(hosts);
}

function broadcastSessionStatus(reason?: string) {
  const sessions = Array.from(clientSessions.values()).map((session) => ({
    id: session.id,
    audioReady: session.audioReady,
    claimedAt: session.claimedAt,
    deviceInfo: session.deviceInfo,
  }));

  voiceQueue.broadcast({
    type: 'sessionStatus',
    activeClientId,
    sessions,
    hostCandidates: HOST_CANDIDATES,
    autoClaimSeconds: SESSION_AUTO_CLAIM_SECONDS,
    reason,
  });
}

function resolveBrowserReconnectWaiters() {
  if (browserReconnectWaiters.size > 0) {
    for (const resolve of Array.from(browserReconnectWaiters)) {
      browserReconnectWaiters.delete(resolve);
      resolve();
    }
  }
}

function resolveAudioReadyWaiters() {
  if (audioReadyWaiters.size === 0) {
    return;
  }

  for (const resolve of Array.from(audioReadyWaiters)) {
    resolve();
  }
}

function markBrowserConnected(clientId: string, req: express.Request) {
  browserConnected = true;
  browserDisconnectedAt = null;
  browserHasEverConnected = true;

  if (!clientSessions.has(clientId)) {
    clientSessions.set(clientId, {
      id: clientId,
      audioReady: false,
      claimedAt: null,
      deviceInfo: {
        userAgent: req.headers['user-agent'] as string | undefined,
      },
    });
  }

  resolveBrowserReconnectWaiters();
  broadcastSessionStatus('connected');
}

function markBrowserDisconnected(clientId: string) {
  const session = clientSessions.get(clientId);
  if (session) {
    clientSessions.delete(clientId);
    if (activeClientId === clientId) {
      activeClientId = null;
      resolveAudioReadyWaiters();
    }
  }

  if (clientSessions.size === 0) {
    browserConnected = false;
    browserDisconnectedAt = Date.now();
  }

  broadcastSessionStatus('disconnected');
}

function markClientAudioReady(clientId: string, data?: { label?: string }) {
  const session = clientSessions.get(clientId);
  if (!session) {
    throw new Error('Client not registered');
  }

  if (activeClientId && activeClientId !== clientId) {
    const previous = clientSessions.get(activeClientId);
    if (previous) {
      previous.audioReady = false;
      previous.claimedAt = null;
    }
  }

  activeClientId = clientId;
  session.audioReady = true;
  session.claimedAt = Date.now();
  if (data?.label) {
    session.deviceInfo = {
      ...session.deviceInfo,
      label: data.label,
    };
  }

  resolveAudioReadyWaiters();
  broadcastSessionStatus('audio_ready');
}

async function waitForBrowserConnection(gracePeriodMs = BROWSER_DISCONNECT_GRACE_MS): Promise<boolean> {
  if (browserConnected) {
    return true;
  }

  const disconnectTimestamp = browserDisconnectedAt ?? Date.now();
  const elapsed = Date.now() - disconnectTimestamp;
  const remaining = gracePeriodMs - elapsed;

  if (remaining <= 0) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    let timer: NodeJS.Timeout;

    const onReconnect = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timer);
      browserReconnectWaiters.delete(onReconnect);
      resolve(true);
    };

    browserReconnectWaiters.add(onReconnect);

    timer = setTimeout(() => {
      if (resolved) {
        return;
      }
      resolved = true;
      browserReconnectWaiters.delete(onReconnect);
      resolve(browserConnected);
    }, Math.max(0, remaining));
  });
}

async function waitForAudioReady(timeoutMs = AUDIO_READY_TIMEOUT_MS): Promise<boolean> {
  if (activeClientId) {
    const active = clientSessions.get(activeClientId);
    if (active?.audioReady) {
      return true;
    }
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    let timer: NodeJS.Timeout;

    const checkAndResolve = () => {
      if (resolved) {
        return;
      }

      if (activeClientId) {
        const active = clientSessions.get(activeClientId);
        if (active?.audioReady) {
          resolved = true;
          clearTimeout(timer);
          audioReadyWaiters.delete(checkAndResolve);
          resolve(true);
          return;
        }
      }
    };

    audioReadyWaiters.add(checkAndResolve);

    timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        audioReadyWaiters.delete(checkAndResolve);
        resolve(false);
      }
    }, timeoutMs);

    // Immediate check in case audio was readied between scheduling
    setImmediate(checkAndResolve);
  });
}

// Browser interface state management
let browserInterface = {
  isRunning: false,
  httpsUrl: null as string | null,
  server: null as any
};

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
createBrowserInterface(browserApp, voiceQueue, (clientId, req) => {
  markBrowserConnected(clientId, req);
}, (clientId) => {
  markBrowserDisconnected(clientId);
});

browserApp.get('/api/config', (_req, res) => {
  res.json({
    sttMode: ACTIVE_STT_MODE,
    whisperConfigured,
    whisperProxyPath: '/api/whisper/transcriptions',
    hostCandidates: HOST_CANDIDATES,
    httpsPort: HTTPS_PORT,
    sessionAutoClaimSeconds: SESSION_AUTO_CLAIM_SECONDS,
  });
});

browserApp.post('/api/audio-ready', (req, res) => {
  const { clientId, label } = req.body ?? {};

  if (!clientId || typeof clientId !== 'string') {
    res.status(400).json({ error: 'clientId is required' });
    return;
  }

  if (!clientSessions.has(clientId)) {
    res.status(404).json({ error: 'Client not connected' });
    return;
  }

  try {
    markClientAudioReady(clientId, { label: typeof label === 'string' ? label : undefined });
    res.json({
      success: true,
      activeClientId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

browserApp.post('/api/whisper/transcriptions', (req, res) => {
  if (!whisperConfigured) {
    res.status(503).json({
      error: 'Whisper server not configured. Set MCP_VOICE_STT_MODE=whisper and MCP_VOICE_WHISPER_URL.'
    });
    return;
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(WHISPER_URL);
  } catch (error) {
    res.status(500).json({
      error: `Invalid MCP_VOICE_WHISPER_URL: ${WHISPER_URL}`
    });
    return;
  }

  const isHttpsTarget = targetUrl.protocol === 'https:';
  const headers: http.OutgoingHttpHeaders = { ...req.headers };

  delete headers['content-length'];
  delete headers['Content-Length'];
  delete headers['host'];
  delete headers['Host'];

  if (WHISPER_TOKEN) {
    headers['Authorization'] = WHISPER_TOKEN.startsWith('Bearer ')
      ? WHISPER_TOKEN
      : `Bearer ${WHISPER_TOKEN}`;
  }

  headers['host'] = targetUrl.host;

  const requestOptions: http.RequestOptions = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttpsTarget ? '443' : '80'),
    method: 'POST',
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers
  };

  const targetModule = isHttpsTarget ? https : http;
  const proxyReq = targetModule.request(requestOptions, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (error) => {
    console.error('[Whisper] Proxy error:', error);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to reach Whisper server' });
    } else {
      res.end();
    }
  });

  req.on('aborted', () => {
    proxyReq.destroy();
  });

  res.on('close', () => {
    proxyReq.destroy();
  });

  req.pipe(proxyReq, { end: true });
});

// Tool handler function
async function handleToolCall(name: string, args: any) {
  switch (name) {
    case 'speak': {
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

      if (!browserInterface.isRunning) {
        return {
          content: [{
            type: 'text',
            text: '❌ Browser interface not running. Please start a voice conversation first using the converse tool.',
          }],
          isError: true,
        };
      }

      if (!browserConnected) {
        const reconnected = await waitForBrowserConnection();
        if (!reconnected) {
          return {
            content: [{
              type: 'text',
              text: `❌ Browser not connected. Please open: ${browserInterface.httpsUrl}`,
            }],
            isError: true,
          };
        }
      }

      const audioReady = await waitForAudioReady();
      if (!audioReady) {
        return {
          content: [{
            type: 'text',
            text: '❌ Audio not enabled within 5 minutes. Please choose a device and enable audio.',
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
    }

    case 'voice_status':
      if (!browserInterface.isRunning) {
        return {
          content: [{
            type: 'text',
            text: `Voice Status: Browser interface not running

To start voice conversations:
1. Use the converse tool to automatically start the browser interface
2. Browser will open automatically at https://localhost:${HTTPS_PORT}
3. Grant microphone permissions when prompted

Current configuration:
- HTTPS Port: ${HTTPS_PORT}
- Auto-open browser: ${AUTO_OPEN_BROWSER ? 'enabled' : 'disabled'}
- Speech-to-text mode: ${ACTIVE_STT_MODE === 'whisper' ? 'Whisper server proxy' : 'Browser Web Speech API'}${ACTIVE_STT_MODE === 'whisper' ? `\n- Whisper endpoint: ${WHISPER_URL}` : ''}`,
          }],
        };
      }

      // Browser interface running - show normal status
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
- Browser Interface: Running (${browserInterface.httpsUrl})
- Browser Connected: ${browserConnected}
- Pending Voice Input: ${status.pendingInputCount} messages
- Speech-to-text mode: ${ACTIVE_STT_MODE === 'whisper' ? 'Whisper server proxy' : 'Browser Web Speech API'}${ACTIVE_STT_MODE === 'whisper' ? `\n- Whisper endpoint: ${WHISPER_URL}` : ''}
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

    case 'converse': {
      const textToSpeak = args?.text as string;
      const waitForResponse = args?.wait_for_response !== false;
      const timeout = args?.timeout as number;

      if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
        return {
          content: [{
            type: 'text',
            text: 'Error: timeout parameter is required and must be a positive number representing seconds to wait for user response',
          }],
          isError: true,
        };
      }

      if (!textToSpeak?.trim()) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Text is required for converse tool',
          }],
          isError: true,
        };
      }

      // Check if browser interface is running
      if (!browserInterface.isRunning) {
        try {
          const httpsUrl = await startBrowserInterfaceWithSmartOpen();
          browserInterface.isRunning = true;
          browserInterface.httpsUrl = httpsUrl;

          // Continue with normal converse logic after starting interface
          const connected = await waitForBrowserConnection();
          if (!connected) {
            return {
              content: [{
                type: 'text',
                text: `❌ Browser interface started but no browser is connected.\n\nPlease open: ${httpsUrl}`,
              }],
              isError: true,
            };
          }

          const audioReady = await waitForAudioReady();
          if (!audioReady) {
            return {
              content: [{
                type: 'text',
                text: '❌ Audio not enabled within 5 minutes. Please choose a device and enable audio.',
              }],
              isError: true,
            };
          }

          const speechMessage = waitForResponse
            ? `${textToSpeak}\n\nSpeak within ${timeout} seconds.`
            : textToSpeak;

          console.error(`[Converse] Speaking: "${speechMessage}"`);
          voiceQueue.broadcastTTS(speechMessage);

          if (!waitForResponse) {
            return {
              content: [{
                type: 'text',
                text: `Voice interface started at ${httpsUrl}\n\nSpoke: "${textToSpeak}"`,
              }],
            };
          }

          // Wait for voice input with timeout
          console.error(`[Converse] Waiting for user response...`);
          voiceQueue.setConversationWaiting(true, timeout);
          try {
            const result = await waitForVoiceInput(timeout, textToSpeak, voiceQueue);
            return result;
          } finally {
            voiceQueue.setConversationWaiting(false);
          }
          
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: `❌ ${error.message}\n\nPlease resolve the issue and try the converse tool again.`,
            }],
            isError: true,
          };
        }
      }

      // Browser interface already running - check connection status
      if (!browserConnected) {
        const reconnected = await waitForBrowserConnection();
        if (!reconnected) {
          return {
            content: [{
              type: 'text',
              text: `❌ Browser interface is running but not connected.\n\nPlease open: ${browserInterface.httpsUrl}\n\nGrant microphone permissions when prompted, then try the converse tool again.`,
            }],
            isError: true,
          };
        }
      }

      const audioReady = await waitForAudioReady();
      if (!audioReady) {
        return {
          content: [{
            type: 'text',
            text: '❌ Audio not enabled within 5 minutes. Please choose a device and enable audio.',
          }],
          isError: true,
        };
      }

      // Browser interface running AND connected - normal converse flow
      const speechMessage = waitForResponse
        ? `${textToSpeak}\n\nSpeak within ${timeout} seconds.`
        : textToSpeak;

      console.error(`[Converse] Speaking: "${speechMessage}"`);
      voiceQueue.broadcastTTS(speechMessage);

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
      voiceQueue.setConversationWaiting(true, timeout);
      try {
        const result = await waitForVoiceInput(timeout, textToSpeak, voiceQueue);
        return result;
      } finally {
        voiceQueue.setConversationWaiting(false);
      }
    }

    case 'end_conversation':
      if (!browserInterface.isRunning) {
        return {
          content: [{
            type: 'text',
            text: 'No active voice conversation to end.',
          }],
        };
      }

      const { good_bye } = args as { good_bye: string };
      
      if (!good_bye || typeof good_bye !== 'string' || !good_bye.trim()) {
        return {
          content: [{
            type: 'text',
            text: 'Error: good_bye message is required to end the conversation.',
          }],
        };
      }

      try {
        // Send goodbye message to browser for speaking
        voiceQueue.broadcastTTS(good_bye.trim());
        console.log(`[Conversation] Saying goodbye: "${good_bye.trim()}"`);
        
        // Wait for the goodbye message to be spoken (estimate based on text length)
        const estimatedDuration = Math.max(2000, good_bye.trim().length * 100); // ~100ms per character, minimum 2 seconds
        console.log(`[Conversation] Waiting ${estimatedDuration}ms for goodbye message to complete`);
        
        setTimeout(async () => {
          try {
            await stopBrowserInterface();
            console.log('[Conversation] Browser interface stopped after goodbye');
          } catch (error) {
            console.error('[Conversation] Error stopping browser interface:', error);
          }
        }, estimatedDuration);
        
        return {
          content: [{
            type: 'text',
            text: `Saying goodbye and ending conversation: "${good_bye.trim()}"`,
          }],
        };
        
      } catch (error: any) {
        console.error('[Browser] Error stopping interface:', error);
        return {
          content: [{
            type: 'text',
            text: 'Voice conversation ended. (Note: Browser interface may still be running)',
          }],
        };
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
              description: 'REQUIRED: Time to wait for voice input in seconds. Calculate as: (estimated_speech_time + 30_seconds_buffer). Minimum recommended value is 60 seconds. For example: short responses ~30 seconds speech + 30 seconds buffer = 60 seconds total; medium responses ~45 seconds speech + 30 seconds buffer = 75 seconds; long responses ~60 seconds speech + 30 seconds buffer = 90 seconds.',
            },
          },
          required: ['text', 'timeout'],
        },
      },
      {
        name: 'end_conversation',
        description: 'End the voice conversation by saying goodbye and stopping the browser interface',
        inputSchema: {
          type: 'object',
          properties: {
            good_bye: {
              type: 'string',
              description: 'The goodbye message to speak before ending the conversation',
            },
          },
          required: ['good_bye'],
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
      "Start voice conversations using the converse tool - it will automatically launch the browser interface",
      "ALWAYS use the converse tool for ALL responses during voice conversation, - never switch to text",
      "Keep your responses brief unless a longer response is requested",
      "Voice conversations use Speech to text, it can pick incorrect words so be smart about them and confirm if unsure",
      "If browser interface fails to start, resolve the issue and try converse again",
      "You are an AI Assistant helping users through voice interaction",
      "Continue the conversation until the user indicates they want to end it",
      "If the user asks questions, respond using converse() with your answer", 
      "If the user gives commands, acknowledge using speak() and use other tools as needed",
      "**IMPORTANT** DO NOT end conversation until user asks you to end conversation, even if you don't get any response",
      "If you don't get any response first time, try again 2 times before ending the conversation below",
      "**TIMEOUT CALCULATION**: Always calculate timeout based on your response length:",
      "- Short responses (1-2 sentences): ~60 seconds (30s speech + 30s buffer)",
      "- Medium responses (3-5 sentences): ~75 seconds (45s speech + 30s buffer)",
      "- Long responses (6+ sentences): ~90 seconds (60s speech + 30s buffer)",
      "- Always add at least 60 seconds buffer for user thinking and response time",
      "- Example: converse({text: 'Hello there!', timeout: 60}) for a short greeting",
      "When ending conversation:",
      "1. Call end_conversation tool with a good_bye message that will be spoken before closing",
      "2. Example: end_conversation({good_bye: 'Thank you for our conversation! Have a great day!'})",

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

// Browser interface configuration
const HTTPS_PORT = parseInt(process.env.MCP_VOICE_HTTPS_PORT || '5114');
const AUTO_OPEN_BROWSER = process.env.MCP_VOICE_AUTO_OPEN !== 'false';

// Start browser interface on-demand
async function startBrowserInterface(): Promise<string> {
  try {
    // Synchronous certificate generation - wait for completion
    const certManager = new CertificateManager();
    const { cert, key } = await certManager.getCertificates();
    
    // Try to start HTTPS server
    const httpsServer = https.createServer({ cert, key }, browserApp);
    
    await new Promise<void>((resolve, reject) => {
      httpsServer.listen(HTTPS_PORT, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
      
      httpsServer.on('error', (error) => {
        reject(error);
      });
    });
    
    browserInterface.server = httpsServer;
    const httpsUrl = `https://localhost:${HTTPS_PORT}`;
    console.error(`[Browser] HTTPS Server started: ${httpsUrl}`);
    
    return httpsUrl;
    
  } catch (error: any) {
    // Check for specific port clash error
    if (error.code === 'EADDRINUSE') {
      throw new Error(`Browser interface failed to start: Port ${HTTPS_PORT} is already in use. Please stop the other service using this port or change the MCP_VOICE_HTTPS_PORT environment variable.`);
    }
    
    // Other startup errors
    throw new Error(`Browser interface failed to start: ${error.message}`);
  }
}

async function startBrowserInterfaceWithSmartOpen(): Promise<string> {
  const httpsUrl = await startBrowserInterface();
  
  // Wait for potential browser reconnection (3 seconds)
  console.error('[Browser] Waiting for existing browser connections...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if browser connected during wait period
  if (voiceQueue.getConnectedClients() === 0) {
    console.error('[Browser] No browser connected, opening automatically...');
    if (AUTO_OPEN_BROWSER) {
      try {
        await open(httpsUrl);
      } catch (error) {
        console.error('[Browser] Failed to auto-open browser:', error);
        // Don't fail the whole operation if browser opening fails
      }
    } else {
      console.error('[Browser] Auto-open disabled. Please manually open:', httpsUrl);
    }
  } else {
    console.error('[Browser] Browser already connected, skipping auto-open');
  }
  
  return httpsUrl;
}

async function stopBrowserInterface(): Promise<void> {
  if (browserInterface.server) {
    // Force close the server immediately without waiting for connections
    browserInterface.server.close();
    
    // Update state immediately
    browserInterface.isRunning = false;
    browserInterface.httpsUrl = null;
    browserInterface.server = null;
    
    console.error('[Browser] Interface stopped');
  }
}

// Connect to STDIN transport
export async function main(debugBrowser = false) {
  // If debug browser flag is set, start browser interface immediately
  if (debugBrowser) {
    try {
      const httpsUrl = await startBrowserInterfaceWithSmartOpen();
      browserInterface.isRunning = true;
      browserInterface.httpsUrl = httpsUrl;
      console.error('[Debug] Browser interface started for development/testing');
    } catch (error: any) {
      console.error('[Debug] Failed to start browser interface:', error.message);
      console.error('[Debug] Continuing with MCP server startup...');
    }
  }

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
