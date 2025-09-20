/**
 * Local type definitions for OpenCode plugin development
 * These types are based on the OpenCode plugin API structure
 */

export interface Project {
  name: string;
  path: string;
}

export interface Event {
  type: string;
  data: any;
}

export interface OpenCodeClient {
  messages: {
    create(message: {
      content: string;
      role: 'user' | 'assistant';
      metadata?: Record<string, any>;
    }): Promise<void>;
  };
}

export interface BunShell {
  (strings: TemplateStringsArray, ...expressions: any[]): Promise<any>;
}

export interface PluginInput {
  client: OpenCodeClient;
  project: Project;
  directory: string;
  worktree: string;
  $: BunShell;
}

export interface ToolContext {
  sessionID: string;
  messageID: string;
  agent: string;
  abort: AbortSignal;
}

export interface ToolDefinition {
  description: string;
  args: Record<string, any>;
  execute(args: any, context: ToolContext): Promise<string>;
}

export interface Hooks {
  event?: (input: { event: Event }) => Promise<void>;
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: any }
  ) => Promise<void>;
  "chat.message"?: (
    input: {},
    output: { message: any; parts: any[] }
  ) => Promise<void>;
  tool?: {
    [key: string]: ToolDefinition;
  };
}

export type Plugin = (input: PluginInput) => Promise<Hooks>;