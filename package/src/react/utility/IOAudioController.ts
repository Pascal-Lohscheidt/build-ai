import { Logger } from '../../utility/Logger';

/**
 * Represents the current state of the voice agent in the conversation flow.
 */
export type VoiceAgentState =
  | 'READY'
  | 'RECORDING'
  | 'UPSTREAMING'
  | 'PROCESSING'
  | 'DOWNSTREAMING'
  | 'RESPONDING';

/**
 * Represents the state of the Web Audio API context and nodes.
 */
type AudioContextState = {
  context: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
};

/**
 * Configuration options for audio processing.
 */
type AudioProcessingConfig = {
  sampleRate: number;
  channelCount: number;
};

export type StartRecordingCallbacks = {
  onRecordedChunk?: (chunk: Blob) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;
};

export type StopRecordingCallbacks = {
  onRecordingCompleted?: (allData: Blob) => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;
};

type PlayAudioStreamParams = {
  response: Response;
  mimeCodec?: string;
  onComplete?: () => void;
};

type PlayAudioParams = {
  source: Blob | string;
  onComplete?: () => void;
};

const DEFAULT_SLICING_INTERVAL = 2_000; // 2 seconds

/**
 * Controller for managing audio input/output operations.
 * Handles recording from microphone and playing back audio responses.
 */
export class IOAudioController {
  private logger = new Logger('sunken-trove > IOAudioController');

  // ─── Recording state ─────────────────────────────────────────────────────
  private audioContextState: AudioContextState = {
    context: null,
    source: null,
    analyser: null,
  };
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;

  // ─── Playback state ──────────────────────────────────────────────────────
  private currentHtmlAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;

  constructor(private audioConfig: Partial<AudioProcessingConfig> = {}) {}

  public get audioContext(): AudioContext | null {
    return this.audioContextState.context;
  }

  private async createAudioContext(): Promise<AudioContextState> {
    const context = new AudioContext({
      sampleRate: this.audioConfig.sampleRate || 48000,
      latencyHint: 'interactive',
    });
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    return { context, source: null, analyser };
  }

  private async cleanupAudioContext(): Promise<void> {
    this.logger.debug('Cleaning up audio context');
    const { source, context } = this.audioContextState;
    if (source) source.disconnect();
    if (context) await context.close();
    this.audioContextState = { context: null, source: null, analyser: null };
  }

  public async startRecording({
    onRecordedChunk,
    onError,
  }: StartRecordingCallbacks = {}): Promise<void> {
    try {
      this.logger.debug('Starting recording');
      this.recordedChunks = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordingStream = stream;

      if (!this.audioContextState.context) {
        this.audioContextState = await this.createAudioContext();
      }

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.mediaRecorder.ondataavailable = (e: BlobEvent): void => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
          onRecordedChunk?.(e.data);
          this.logger.debug('Recorded chunk', e.data.size);
        }
      };

      this.mediaRecorder.start(DEFAULT_SLICING_INTERVAL);
      this.logger.debug('MediaRecorder started');
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to start recording');
      this.logger.error(error);
      onError?.(error);
    }
  }

  public async stopRecording({
    onRecordingCompleted,
  }: StopRecordingCallbacks = {}): Promise<void> {
    this.logger.debug('Stopping recording');
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

    await new Promise<void>((resolve) => {
      this.mediaRecorder!.onstop = async (): Promise<void> => {
        if (this.recordedChunks.length) {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          onRecordingCompleted?.(blob);
          this.logger.debug('Recording completed', blob.size);
        }
        this.recordingStream?.getTracks().forEach((t) => t.stop());
        this.recordingStream = null;
        await this.cleanupAudioContext();
        resolve();
      };
      this.mediaRecorder!.stop();
    });
  }

  // ─── One-shot playback ────────────────────────────────────────────────────

  /**
   * Play either a Blob or a URL string.
   * Uses <audio> under the hood for maximum browser compatibility.
   */
  public async playAudio({
    source,
    onComplete,
  }: PlayAudioParams): Promise<void> {
    // Tear down any previous playback
    if (this.currentHtmlAudio) {
      this.currentHtmlAudio.pause();
      this.currentHtmlAudio.src = '';
      if (this.currentAudioUrl && source instanceof Blob) {
        URL.revokeObjectURL(this.currentAudioUrl);
      }
    }

    const audio = new Audio();
    this.currentHtmlAudio = audio;

    let url: string;
    if (source instanceof Blob) {
      url = URL.createObjectURL(source);
      this.currentAudioUrl = url;
      audio.onended = (): void => {
        URL.revokeObjectURL(url);
        onComplete?.();
      };
    } else {
      url = source;
    }

    audio.src = url;
    try {
      await audio.play();
    } catch (err) {
      this.logger.error('Playback failed, user gesture may be required', err);
      // UI can retry via user interaction
    }
  }

  // ─── Streaming playback ──────────────────────────────────────────────────

  /**
   * Stream audio from a Response via MediaSource Extensions.
   * @param params.response The fetch Response whose body is an audio stream
   * @param params.mimeCodec MIME type+codec string, e.g. 'audio/mpeg'
   * @param params.onComplete Optional callback once the stream ends
   */
  public async playAudioStream({
    response,
    mimeCodec = 'audio/mpeg',
    onComplete,
  }: PlayAudioStreamParams): Promise<void> {
    // 1) Validation
    if (!response.ok || !response.body) {
      throw new Error(`Invalid response (${response.status})`);
    }
    if (
      typeof MediaSource === 'undefined' ||
      !MediaSource.isTypeSupported(mimeCodec)
    ) {
      throw new Error(`Unsupported MIME type or codec: ${mimeCodec}`);
    }

    // 2) Stop any prior playback
    await this.stopPlayback();

    // 3) Create MediaSource + <audio>
    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    this.currentAudioUrl = url;

    const audio = new Audio(url);
    this.currentHtmlAudio = audio;
    audio.autoplay = true;
    audio.onended = (): void => {
      URL.revokeObjectURL(url);
      this.currentAudioUrl = null;
      onComplete?.();
    };

    // 4) Pump incoming bytes into the SourceBuffer
    mediaSource.addEventListener(
      'sourceopen',
      () => {
        const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
        const reader = response.body!.getReader();

        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            mediaSource.endOfStream();
            return;
          }
          if (value) {
            sourceBuffer.appendBuffer(value);
          }
          if (sourceBuffer.updating) {
            sourceBuffer.addEventListener('updateend', pump, { once: true });
          } else {
            pump();
          }
        };

        pump();
      },
      { once: true }
    );

    // 5) Kick off playback
    try {
      await audio.play();
    } catch (err) {
      this.logger.error(
        'Streaming playback failed, user gesture may be required',
        err
      );
    }
  }

  /**
   * Stop any ongoing HTMLAudioElement playback.
   */
  public async stopPlayback(): Promise<void> {
    if (this.currentHtmlAudio) {
      try {
        this.currentHtmlAudio.pause();
        this.currentHtmlAudio.src = '';
      } catch (err) {
        this.logger.error('Error stopping playback', err);
      }
      this.currentHtmlAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  /**
   * Cleans up all audio resources (recording + playback).
   */
  public cleanup(): void {
    this.cleanupAudioContext();
    this.stopPlayback();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach((t) => t.stop());
      this.recordingStream = null;
    }
  }
}
