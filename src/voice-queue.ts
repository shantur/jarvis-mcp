import { randomUUID } from 'crypto';

export interface VoiceInput {
  id: string;
  text: string;
  timestamp: Date;
  status: 'pending' | 'delivered';
}

export interface SSEClient {
  id: string;
  response: any; // Express Response object
  connected: boolean;
}

export class VoiceQueue {
  private inputs: VoiceInput[] = [];
  private sseClients = new Map<string, SSEClient>();
  private voiceActive = false;
  private conversationWaiting = false;

  // Add voice input to queue
  addInput(text: string): VoiceInput {
    console.error(`[Queue] addInput called with:`, { text, type: typeof text, length: text?.length });
    
    const input: VoiceInput = {
      id: randomUUID(),
      text: text?.trim() || '',
      timestamp: new Date(),
      status: 'pending'
    };

    this.inputs.push(input);
    console.error(`[Queue] Voice input queued: "${input.text}" (processed from "${text}")`);
    
    // Broadcast queue update to all connected browsers
    this.broadcastQueueUpdate();
    
    // Keep input pending for AI Assistant to retrieve via tools
    console.error(`[Queue] Voice input queued: "${input.text}"`);
    
    // Log conversation waiting state
    if (this.conversationWaiting) {
      console.error(`[Queue] Conversation tool is waiting - input will be picked up by waiting tool`);
    }
    
    return input;
  }

  // Get pending voice inputs
  getPendingInput(): VoiceInput[] {
    return this.inputs.filter(input => input.status === 'pending');
  }

  // Mark all pending inputs as delivered (auto-delivery)
  deliverPendingInput(): VoiceInput[] {
    const pending = this.getPendingInput();
    pending.forEach(input => {
      input.status = 'delivered';
      console.error(`[Queue] Delivered: "${input.text}"`);
    });
    
    if (pending.length > 0) {
      this.broadcastQueueUpdate();
    }
    
    return pending;
  }

  // Get recent inputs for display
  getRecentInputs(limit: number = 10): VoiceInput[] {
    return this.inputs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Clear all inputs
  clear(): number {
    const count = this.inputs.length;
    this.inputs = [];
    console.error(`[Queue] Cleared ${count} voice inputs`);
    this.broadcastQueueUpdate();
    return count;
  }

  // Voice state management
  setVoiceActive(active: boolean): void {
    this.voiceActive = active;
    console.error(`[Queue] Voice ${active ? 'activated' : 'deactivated'}`);
    this.broadcastStatusUpdate();
  }

  isVoiceActive(): boolean {
    return this.voiceActive;
  }

  // SSE client management
  addSSEClient(clientId: string, response: any): void {
    this.sseClients.set(clientId, {
      id: clientId,
      response,
      connected: true
    });

    console.error(`[SSE] Client connected: ${clientId}`);
    
    // Send initial status
    this.sendToClient(clientId, {
      type: 'connected',
      voiceActive: this.voiceActive,
      pendingCount: this.getPendingInput().length
    });

    // Handle client disconnect
    response.on('close', () => {
      this.removeSSEClient(clientId);
    });
  }

  removeSSEClient(clientId: string): void {
    const client = this.sseClients.get(clientId);
    if (client) {
      client.connected = false;
      this.sseClients.delete(clientId);
      console.error(`[SSE] Client disconnected: ${clientId}`);
      
      // If no clients remain, deactivate voice
      if (this.sseClients.size === 0) {
        this.setVoiceActive(false);
      }
    }
  }

  // Broadcast methods
  broadcastTTS(text: string): void {
    this.broadcast({
      type: 'speak',
      text
    });
  }

  broadcastQueueUpdate(): void {
    this.broadcast({
      type: 'queueUpdate',
      pendingCount: this.getPendingInput().length,
      recentInputs: this.getRecentInputs(5).map(input => ({
        text: input.text,
        timestamp: input.timestamp,
        status: input.status
      }))
    });
  }

  broadcastStatusUpdate(): void {
    this.broadcast({
      type: 'statusUpdate',
      voiceActive: this.voiceActive,
      connectedClients: this.sseClients.size
    });
  }

  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    
    for (const [clientId, client] of this.sseClients) {
      if (client.connected) {
        try {
          client.response.write(`data: ${messageStr}\n\n`);
        } catch (error) {
          console.error(`[SSE] Failed to send to client ${clientId}:`, error);
          this.removeSSEClient(clientId);
        }
      }
    }
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.sseClients.get(clientId);
    if (client && client.connected) {
      try {
        const messageStr = JSON.stringify(message);
        client.response.write(`data: ${messageStr}\n\n`);
      } catch (error) {
        console.error(`[SSE] Failed to send to client ${clientId}:`, error);
        this.removeSSEClient(clientId);
      }
    }
  }



  // Set conversation waiting state
  setConversationWaiting(waiting: boolean) {
    this.conversationWaiting = waiting;
    console.error(`[Queue] Conversation waiting state: ${waiting}`);
  }

  // Get stats for debugging
  getStats() {
    return {
      totalInputs: this.inputs.length,
      pendingInputs: this.getPendingInput().length,
      connectedClients: this.sseClients.size,
      voiceActive: this.voiceActive,

      conversationWaiting: this.conversationWaiting
    };
  }
}