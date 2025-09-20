import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { VoiceQueue } from './voice-queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createBrowserInterface(
  app: express.Application, 
  voiceQueue: VoiceQueue,
  onConnect: () => void,
  onDisconnect: () => void
) {
  
  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Main page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // SSE endpoint for real-time updates
  app.get('/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    const clientId = randomUUID();
    voiceQueue.addSSEClient(clientId, res);
    onConnect();

    res.on('close', () => {
      onDisconnect();
    });
  });

  // API: Add voice input
  app.post('/api/voice-input', (req, res) => {
    console.error('[API] Voice input received:', JSON.stringify(req.body));
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      console.error('[API] Invalid text input:', { text, type: typeof text });
      return res.status(400).json({ error: 'Text is required and must be a non-empty string' });
    }

    console.error('[API] Processing voice input:', text);
    const input = voiceQueue.addInput(text);
    
    // Auto-deliver immediately (only if no conversation tool is waiting)
    let delivered: any[] = [];
    // if (!voiceQueue.getStats().conversationWaiting) {
    //   delivered = voiceQueue.deliverPendingInput();
    // }
    
    res.json({
      success: true,
      input: {
        id: input.id,
        text: input.text,
        timestamp: input.timestamp,
        status: input.status,
      },
      delivered: delivered.length
    });
  });

  // API: Set voice state
  app.post('/api/voice-state', (req, res) => {
    const { active } = req.body;
    voiceQueue.setVoiceActive(!!active);
    
    res.json({
      success: true,
      voiceActive: voiceQueue.isVoiceActive()
    });
  });

  // API: Get voice status
  app.get('/api/status', (req, res) => {
    const stats = voiceQueue.getStats();
    const recentInputs = voiceQueue.getRecentInputs(10);
    
    res.json({
      ...stats,
      recentInputs: recentInputs.map(input => ({
        text: input.text,
        timestamp: input.timestamp,
        status: input.status
      }))
    });
  });

  // API: Clear voice queue
  app.delete('/api/clear', (req, res) => {
    const cleared = voiceQueue.clear();
    
    res.json({
      success: true,
      clearedCount: cleared
    });
  });

  // API: Deliver/consume specific voice input by ID
  app.post('/api/deliver-input', (req, res) => {
    const { inputId } = req.body;
    
    if (!inputId || typeof inputId !== 'string') {
      return res.status(400).json({ error: 'inputId is required and must be a string' });
    }
    
    const delivered = voiceQueue.deliverSpecificInput(inputId);
    
    if (delivered) {
      res.json({
        success: true,
        delivered: {
          id: delivered.id,
          text: delivered.text,
          timestamp: delivered.timestamp,
          status: delivered.status
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Voice input not found or already delivered'
      });
    }
  });

  // API: Get and deliver all pending voice inputs (for plugin use)
  app.post('/api/get-voice-input', (req, res) => {
    const delivered = voiceQueue.deliverPendingInput();
    
    res.json({
      success: true,
      messages: delivered.map(input => ({
        id: input.id,
        text: input.text,
        timestamp: input.timestamp,
        status: input.status
      }))
    });
  });
}