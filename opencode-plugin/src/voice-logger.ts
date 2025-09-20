export class VoiceLogger {
  private static isDebugEnabled(): boolean {
    return process.env.VOICE_DEBUG === 'true';
  }

  static log(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.log('[Voice Plugin]', ...args);
    }
  }

  static error(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.error('[Voice Plugin Error]', ...args);
    }
  }

  static warn(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.warn('[Voice Plugin Warning]', ...args);
    }
  }

  static info(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.info('[Voice Plugin Info]', ...args);
    }
  }
}