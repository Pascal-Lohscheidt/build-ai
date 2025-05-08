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

/**
 * Base class for voice socket adapters that handles voice data transmission.
 *
 * @emits connect - Emitted when the socket connection is established
 * @emits disconnect - Emitted when the socket connection is closed
 * @emits error - Emitted when an error occurs, with the error object as parameter
 * @emits chunk-received - Emitted when a voice chunk is received, with the ArrayBuffer as parameter
 * @emits received-end-of-response-stream - Emitted when the stream of voice chunks is ended
 * @emits chunk-sent - Emitted when a voice chunk is sent, with the chunk (ArrayBuffer or Blob) as parameter
 * @emits file-received - Emitted when a voice file is received, with the Blob as parameter
 * @emits file-sent - Emitted when a voice file is sent, with the Blob as parameter
 * @emits control-message - Emitted when a control message is received, with the message object as parameter
 */
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
  protected abstract onReceivedEndOfResponseStream(): void;
  protected abstract onVoiceFileReceived(blob: Blob): void;
}
