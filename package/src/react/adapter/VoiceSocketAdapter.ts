import { EventEmitter } from 'events';

export interface VoiceSocketConfig {
  scope?: string;
  baseUrl: string;
  protocols?: string | string[];
  headers?: Record<string, string>;
  autoReconnect?: boolean;
}

export interface VoiceSocketMessage {
  type: 'chunk' | 'file';
  data: string; // base64 encoded
  metadata?: Record<string, unknown>;
}

export abstract class VoiceSocketAdapter extends EventEmitter {
  protected config: VoiceSocketConfig;
  protected socket: WebSocket | null = null;
  protected isConnected = false;

  constructor(config: VoiceSocketConfig, socket?: WebSocket) {
    super();
    this.config = config;
    if (socket) {
      this.socket = socket;
    }
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract sendVoiceChunk(
    chunk: ArrayBuffer | Blob,
    metadata?: Record<string, unknown>
  ): Promise<void>;
  abstract sendVoiceFile(blob: Blob, metadata?: Record<string, unknown>): void;
  abstract onVoiceChunkReceived(chunk: ArrayBuffer): void;
  abstract onVoiceFileReceived(blob: Blob): void;
}

export class BaseVoiceSocketAdapter extends VoiceSocketAdapter {
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        this.socket = new WebSocket(this.config.baseUrl, this.config.protocols);
      }

      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = (): void => {
        this.isConnected = true;
        this.emit('connect');
        resolve();
      };

      this.socket.onclose = (): void => {
        this.isConnected = false;
        this.emit('disconnect');
        if (this.config.autoReconnect) this.connect(); // naive reconnect
      };

      this.socket.onerror = (e: Event): void => {
        const errorEvent = e as ErrorEvent;
        this.emit('error', errorEvent);
        reject(errorEvent);
      };

      this.socket.onmessage = (event: MessageEvent): void => {
        try {
          const { data } = event;

          if (typeof data === 'string') {
            // Optional: handle control messages
            try {
              const controlMsg = JSON.parse(data);
              this.emit('control-message', controlMsg);
            } catch (err) {
              this.emit('error', new Error('Invalid control JSON'));
            }
          } else if (data instanceof ArrayBuffer) {
            // Binary voice chunk
            this.onVoiceChunkReceived(data);
          }
        } catch (err) {
          this.emit('error', err);
        }
      };
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.isConnected = false;
  }

  async sendVoiceChunk(chunk: ArrayBuffer | Blob): Promise<void> {
    let chunkToSend: ArrayBuffer;
    if (chunk instanceof Blob) {
      chunkToSend = await chunk.arrayBuffer();
    } else {
      chunkToSend = chunk;
    }

    if (!this.socket || !this.isConnected)
      throw new Error('Socket not connected');
    this.socket.send(chunkToSend);
    this.emit('chunk-sent', chunk);
  }

  sendVoiceFile(blob: Blob): void {
    if (!this.socket || !this.isConnected)
      throw new Error('Socket not connected');
    this.socket.send(blob);
    this.emit('file-sent', blob);
  }

  onVoiceChunkReceived(chunk: ArrayBuffer): void {
    this.emit('chunk-received', chunk);
  }

  onVoiceFileReceived(blob: Blob): void {
    this.emit('file-received', blob);
  }
}
