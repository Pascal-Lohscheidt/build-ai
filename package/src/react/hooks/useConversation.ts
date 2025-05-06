'use client';
// Voice conversation hook for handling audio recording and playback
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  VoiceEndpointAdapter,
  BaseVoiceEndpointAdapter,
} from '../adapter/VoiceEndpointAdapter';
import { VoiceSocketAdapter } from '../adapter/socket/VoiceSocketAdapter';
import { Logger } from '../../utility/Logger';
import { VoiceSocketIOAdapter } from '../adapter/socket/VoiceSocketIOAdapter';
import { InputAudioController } from '../utility/audio/InputAudioController';
import { OutputAudioController } from '../utility/audio/OutputAudioController';
import { WebAudioOutputAudioController } from '../utility/audio/WebAudioOutputAudioController';

// Types
export type VoiceAgentState =
  | 'READY'
  | 'RECORDING'
  | 'UPSTREAMING'
  | 'PROCESSING'
  | 'DOWNSTREAMING'
  | 'RESPONDING';

export type UpstreamMode = 'STREAM_WHILE_TALK' | 'UPLOAD_AFTER_TALK';
export type DownstreamMode = 'STREAM' | 'DOWNLOAD';

export interface ConversationOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  backendMode?: 'SOCKET' | 'ENDPOINT';
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onReceive?: (
    blob: Blob,
    playResponseVoice: () => Promise<void> | void,
    stopResponseVoice: () => Promise<void> | void
  ) => void;
  onError?: (stateWhileErrorHappened: VoiceAgentState, error: Error) => void;
  autoPlay?: boolean;
  downstreamMode?: DownstreamMode;
  upstreamMode?: UpstreamMode;
  handsFreeEnginePlugin?: unknown[];
  backendConfig?: {
    baseUrl?: string;
    endpointAdapter?: VoiceEndpointAdapter;
    socketAdapter?: VoiceSocketAdapter;
    headers?: Record<string, string>;
  };
  audioConfig?: Partial<{
    sampleRate: number;
    channelCount: number;
    processingBlockSize: number;
  }>;
  requestData?: T;
}

export interface UseConversationResult {
  startRecording: () => void;
  stopRecording: () => void;
  enableHandsFreeRecording?: () => void;
  voiceAgentState: VoiceAgentState;
  error: Error | null;
  audioContext: AudioContext | null;
  socket: unknown | null;
}

Logger.enableGlobalLogging();

/**
 * A hook for managing voice conversations in React applications using Web Audio API
 */
export function useConversation<T extends Record<string, unknown>>(
  endpointOrScope: string,
  {
    backendMode = 'ENDPOINT',
    onStartRecording,
    onStopRecording,
    onReceive,
    autoPlay = true,
    upstreamMode = backendMode === 'SOCKET'
      ? 'STREAM_WHILE_TALK'
      : 'UPLOAD_AFTER_TALK',
    downstreamMode = 'STREAM',
    //onError,
    //handsFreeEnginePlugin = [],
    audioConfig = {},
    requestData = {} as T,
    backendConfig = {},
  }: ConversationOptions<T>
): UseConversationResult {
  // Refs
  const { current: logger } = useRef<Logger>(
    new Logger('SuTr > useConversation')
  );
  const inputAudioControllerRef = useRef<InputAudioController | undefined>(
    undefined
  );
  const outputAudioControllerRef = useRef<OutputAudioController | undefined>(
    undefined
  );

  const socketAdapterRef = useRef<VoiceSocketAdapter | undefined>(undefined);
  const endpointAdapterRef = useRef<VoiceEndpointAdapter | undefined>(
    undefined
  );
  const [socket, setSocket] = useState<unknown | null>(null);

  // State
  const [voiceAgentState, setVoiceAgentState] =
    useState<VoiceAgentState>('READY');
  const [error] = useState<Error | undefined>(undefined);

  // ================================================
  // =============== Inferred Config ================
  // ================================================

  const shouldStreamWhileTalk =
    backendMode === 'SOCKET' && upstreamMode === 'STREAM_WHILE_TALK';

  // ================================================
  // =============== Callbacks ======================
  // ================================================

  const subscribeToSocketEventsForChunkDownstreaming = useCallback(
    async (socketAdapter: VoiceSocketAdapter) => {
      logger.debug('Setting up audio stream for receiving chunks');

      const { addChunkToStream, endChunkStream } =
        await outputAudioControllerRef.current!.initializeChunkStream({
          mimeCodec: 'audio/mpeg',
          onComplete: () => {
            logger.debug('Audio stream playback completed');
            setVoiceAgentState('READY');
          },
        });

      // Keep track of received chunks for debugging
      let chunkCount = 0;

      const chunkReceivedEmitter = socketAdapter.on(
        'chunk-received',
        async (chunk: ArrayBuffer) => {
          chunkCount++;
          logger.debug(
            `Received voice chunk #${chunkCount} from socket, size: ${chunk.byteLength} bytes`
          );

          if (!chunk || chunk.byteLength === 0) {
            logger.warn('Received empty chunk, skipping');
            return;
          }

          try {
            await addChunkToStream(chunk);
            logger.debug(
              `Successfully added chunk #${chunkCount} to audio stream`
            );
          } catch (err) {
            logger.error(
              `Failed to add chunk #${chunkCount} to audio stream`,
              err
            );
          }
        }
      );

      const endOfStreamEmitter = socketAdapter.on('response-completed', () => {
        logger.debug(
          `Received end of stream signal after ${chunkCount} chunks, ending chunk stream`
        );
        endChunkStream();
        setVoiceAgentState('READY');
      });

      // Returning a cleanup callback to remove the event listeners
      return () => {
        logger.debug('Cleaning up socket event listeners');
        chunkReceivedEmitter.removeAllListeners();
        endOfStreamEmitter.removeAllListeners();
        endChunkStream();
      };
    },
    []
  );

  const hookupSocketAdapter = useCallback(
    async (socketAdapter: VoiceSocketAdapter) => {
      logger.debug('Connecting to socket...');

      await socketAdapter.connect();

      socketAdapter.on('connect', () => {
        logger.debug('Socket adapter connected');
      });

      socketAdapter.on('disconnect', () => {
        logger.debug('Socket adapter disconnected');
      });

      setSocket(socketAdapter.exposeSocket<unknown>());
    },
    []
  );

  const startRecording = useCallback(() => {
    if (inputAudioControllerRef.current) {
      logger.debug('Starting recording');
      setVoiceAgentState('RECORDING');
      inputAudioControllerRef.current.startRecording({
        onRecordedChunk: async (chunk) => {
          if (shouldStreamWhileTalk) {
            await socketAdapterRef.current?.sendVoiceChunk(chunk);
          }
        },
      });
      onStartRecording?.();
    }
  }, [onStartRecording, shouldStreamWhileTalk]);

  const stopRecording = useCallback(async () => {
    if (inputAudioControllerRef.current) {
      logger.debug('Stopping recording');
      await inputAudioControllerRef.current.stopRecording({
        onRecordingCompleted: async (allData) => {
          setVoiceAgentState('PROCESSING');
          if (!shouldStreamWhileTalk) {
            if (backendMode === 'ENDPOINT') {
              await endpointAdapterRef.current
                ?.sendVoiceFile({
                  blob: allData,
                  metadata: requestData,
                })
                .then(async (response) => {
                  setVoiceAgentState('RESPONDING');
                  if (downstreamMode === 'STREAM' && autoPlay) {
                    outputAudioControllerRef.current?.playAudioStream({
                      response,
                      onComplete: () => {
                        setVoiceAgentState('READY');
                      },
                    });
                  } else if (downstreamMode === 'DOWNLOAD' && autoPlay) {
                    outputAudioControllerRef.current?.playAudio({
                      source: await response.blob(),
                      onComplete: () => {
                        setVoiceAgentState('READY');
                      },
                    });
                  }

                  onReceive?.(
                    allData,
                    () => {}, //audioControllerRef.current?.(allData),
                    () => outputAudioControllerRef.current?.stopPlayback()
                  );
                });
            } else {
              await socketAdapterRef.current?.sendVoiceFile(allData);
            }
          } else {
            logger.debug('Committing voice message');
            await socketAdapterRef.current?.commitVoiceMessage();
            await subscribeToSocketEventsForChunkDownstreaming(
              socketAdapterRef.current!
            );
            //cleanup(); <- we need to have a more structured way to handle this.
          }
        },
      });
      onStopRecording?.();
    }
  }, [
    onStopRecording,
    requestData,
    shouldStreamWhileTalk,
    autoPlay,
    downstreamMode,
    backendMode,
  ]);

  // Setup Adapters, AudioController
  useEffect(() => {
    if (endpointAdapterRef.current || socketAdapterRef.current) {
      return;
    }

    const { endpointAdapter, socketAdapter } = setupAdapters(
      backendMode,
      backendConfig,
      endpointOrScope
    );

    if (endpointAdapter) {
      endpointAdapterRef.current = endpointAdapter;
    }

    if (socketAdapter && socketAdapterRef.current !== socketAdapter) {
      socketAdapterRef.current = socketAdapter;
      if (!socketAdapter.isConnected()) {
        hookupSocketAdapter(socketAdapter);
      }
    }

    if (!inputAudioControllerRef.current) {
      inputAudioControllerRef.current = new InputAudioController(audioConfig);
    }

    if (!outputAudioControllerRef.current) {
      outputAudioControllerRef.current = new WebAudioOutputAudioController();
    }
  }, [backendMode, endpointOrScope, backendConfig, hookupSocketAdapter]);

  // On Mount and on unmount, cleanup the audio controller
  useEffect(() => {
    return () => {
      inputAudioControllerRef.current?.cleanup();
      outputAudioControllerRef.current?.cleanup();
      socketAdapterRef.current?.disconnect();
    };
  }, []);

  // Return the public API
  return {
    startRecording,
    stopRecording,
    voiceAgentState,
    error: error || null,
    audioContext: inputAudioControllerRef.current?.audioContext || null,
    socket,
  };
}

/**
 * Creates the adapters based on the configuration given
 */
function setupAdapters(
  backendMode: string,
  backendConfig: {
    baseUrl?: string;
    endpointAdapter?: VoiceEndpointAdapter;
    socketAdapter?: VoiceSocketAdapter;
    headers?: Record<string, string>;
  },
  endpointOrScope: string
): {
  endpointAdapter: VoiceEndpointAdapter | undefined;
  socketAdapter: VoiceSocketAdapter | undefined;
} {
  let endpointAdapter: VoiceEndpointAdapter | undefined = undefined;
  let socketAdapter: VoiceSocketAdapter | undefined = undefined;

  if (backendMode === 'ENDPOINT') {
    endpointAdapter = backendConfig.endpointAdapter
      ? backendConfig.endpointAdapter
      : new BaseVoiceEndpointAdapter({
          baseUrl: backendConfig.baseUrl,
          endpoint: endpointOrScope,
          headers: backendConfig.headers,
        });
  } else if (backendMode === 'SOCKET') {
    socketAdapter = backendConfig.socketAdapter
      ? backendConfig.socketAdapter
      : new VoiceSocketIOAdapter({
          scope: endpointOrScope,
          baseUrl: backendConfig.baseUrl!,
          headers: backendConfig.headers,
        });
  }
  return { endpointAdapter, socketAdapter };
}
