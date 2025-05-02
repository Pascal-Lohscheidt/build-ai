'use client';
// Voice conversation hook for handling audio recording and playback
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  VoiceEndpointAdapter,
  BaseVoiceEndpointAdapter,
} from '../adapter/VoiceEndpointAdapter';
import {
  VoiceSocketAdapter,
  BaseVoiceSocketAdapter,
} from '../adapter/VoiceSocketAdapter';
import { IOAudioController } from '../utility/IOAudioController';
import { Logger } from '../../utility/Logger';

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
  backendMode?: 'socket' | 'endpoint';
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
}

Logger.enableGlobalLogging();

/**
 * A hook for managing voice conversations in React applications using Web Audio API
 */
export function useConversation<T extends Record<string, unknown>>(
  endpointOrScope: string,
  {
    backendMode = 'endpoint',
    onStartRecording,
    onStopRecording,
    onReceive,
    autoPlay = true,
    upstreamMode = backendMode === 'socket'
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
    new Logger('sunken-trove > useConversation')
  );
  const audioControllerRef = useRef<IOAudioController | undefined>(undefined);
  const socketAdapterRef = useRef<VoiceSocketAdapter | undefined>(undefined);
  const endpointAdapterRef = useRef<VoiceEndpointAdapter | undefined>(
    undefined
  );

  // State
  const [voiceAgentState, setVoiceAgentState] =
    useState<VoiceAgentState>('READY');
  const [error] = useState<Error | undefined>(undefined);

  // Setup Adapters, AudioController
  useEffect(() => {
    const { endpointAdapter, socketAdapter } = setupAdapters(
      backendMode,
      backendConfig,
      endpointOrScope
    );

    if (endpointAdapter) {
      endpointAdapterRef.current = endpointAdapter;
    }
    if (socketAdapter) {
      socketAdapterRef.current = socketAdapter;
    }

    if (!audioControllerRef.current) {
      audioControllerRef.current = new IOAudioController(audioConfig);
    }
  }, [backendMode, endpointOrScope, backendConfig]);

  // On Mount and on unmount, cleanup the audio controller
  useEffect(() => {
    return () => {
      audioControllerRef.current?.cleanup();
    };
  }, []);

  // ================================================
  // =============== Inferred Config ================
  // ================================================

  const shouldStreamWhileTalk =
    backendMode === 'socket' && upstreamMode === 'STREAM_WHILE_TALK';

  // ================================================
  // =============== Callbacks ======================
  // ================================================

  const startRecording = useCallback(() => {
    if (audioControllerRef.current) {
      logger.debug('Starting recording');
      setVoiceAgentState('RECORDING');
      audioControllerRef.current.startRecording({
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
    if (audioControllerRef.current) {
      logger.debug('Stopping recording');
      await audioControllerRef.current.stopRecording({
        onRecordingCompleted: async (allData) => {
          setVoiceAgentState('PROCESSING');
          if (!shouldStreamWhileTalk) {
            if (backendMode === 'endpoint') {
              await endpointAdapterRef.current
                ?.sendVoiceFile({
                  blob: allData,
                  metadata: requestData,
                })
                .then(async (response) => {
                  setVoiceAgentState('RESPONDING');
                  if (downstreamMode === 'STREAM' && autoPlay) {
                    audioControllerRef.current?.playAudioStream({
                      response,
                      onComplete: () => {
                        setVoiceAgentState('READY');
                      },
                    });
                  } else if (downstreamMode === 'DOWNLOAD' && autoPlay) {
                    audioControllerRef.current?.playAudio({
                      source: await response.blob(),
                      onComplete: () => {
                        setVoiceAgentState('READY');
                      },
                    });
                  }

                  onReceive?.(
                    allData,
                    () => {}, //audioControllerRef.current?.(allData),
                    () => audioControllerRef.current?.stopPlayback()
                  );
                });
            } else {
              await socketAdapterRef.current?.sendVoiceFile(allData);
            }
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

  // Return the public API
  return {
    startRecording,
    stopRecording,
    voiceAgentState,
    error: error || null,
    audioContext: audioControllerRef.current?.audioContext || null,
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

  if (backendMode === 'endpoint') {
    endpointAdapter = backendConfig.endpointAdapter
      ? backendConfig.endpointAdapter
      : new BaseVoiceEndpointAdapter({
          baseUrl: backendConfig.baseUrl,
          endpoint: endpointOrScope,
          headers: backendConfig.headers,
        });
  } else if (backendMode === 'socket') {
    socketAdapter = backendConfig.socketAdapter
      ? backendConfig.socketAdapter
      : new BaseVoiceSocketAdapter({
          scope: endpointOrScope,
          baseUrl: backendConfig.baseUrl!,
          headers: backendConfig.headers,
        });
  }
  return { endpointAdapter, socketAdapter };
}
