'use client';

import { useState, useRef } from 'react';
import { useConversation } from 'sunken-trove/react';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';

export default function SpeechToSpeechPage() {
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const socketUrl = useRef('http://localhost:8080');

  const { startRecording, stopRecording, voiceAgentState } = useConversation(
    'speech',
    {
      backendMode: 'socket',
      upstreamMode: 'STREAM_WHILE_TALK',
      downstreamMode: 'STREAM',
      autoPlay: true,
      onStartRecording: () => {
        setTranscript('');
        setResponse('');
      },
      onStopRecording: () => {
        console.log('Recording stopped');
      },
      onReceive: (
        blob: Blob,
        _playResponse: () => void,
        _stopResponse: () => void
      ) => {
        // This would handle the received audio response
        console.log('Received response blob:', blob);
      },
      backendConfig: {
        baseUrl: socketUrl.current,
      },
    }
  );

  const isRecording = voiceAgentState === 'RECORDING';

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center">
          OpenAI Speech-to-Speech
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">
              Status: {voiceAgentState}
            </p>

            <button
              onClick={handleToggleRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white transition-colors`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <StopIcon className="w-8 h-8" />
              ) : (
                <MicrophoneIcon className="w-8 h-8" />
              )}
            </button>
          </div>

          {transcript && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700">You said:</h3>
              <p className="mt-1 text-gray-900 bg-gray-50 rounded p-3">
                {transcript}
              </p>
            </div>
          )}

          {response && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700">Response:</h3>
              <p className="mt-1 text-gray-900 bg-gray-50 rounded p-3">
                {response}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
