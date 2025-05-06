import { EventEmitter } from 'events';
import { Logger } from '../../../utility/Logger';

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
  protected _isConnected = false;
  protected logger = new Logger('SuTr > VoiceSocketAdapter');

  constructor(config: VoiceSocketConfig) {
    super();
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): void;

  isConnected(): boolean {
    return this._isConnected;
  }
  abstract exposeSocket<T>(): T | null;

  abstract sendVoiceChunk(
    chunk: ArrayBuffer | Blob,
    metadata?: Record<string, unknown>
  ): Promise<void>;
  abstract commitVoiceMessage(): void;
  abstract sendVoiceFile(blob: Blob, metadata?: Record<string, unknown>): void;

  protected abstract onVoiceChunkReceived(chunk: ArrayBuffer): void;
  protected abstract onVoiceFileReceived(blob: Blob): void;
}
