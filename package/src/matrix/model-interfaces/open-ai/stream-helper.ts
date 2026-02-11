import { Effect, Stream } from 'effect/index';
import { OpenAiEvent } from './open-ai-event-types';

// Configuration for the streaming request
export interface StreamConfig {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

// Create a stream of raw OpenAI events using Effect.gen pattern
export const createOpenAIEventStream = (
  config: StreamConfig
): Stream.Stream<OpenAiEvent, Error> => {
  return Stream.unwrap(
    Effect.gen(function* () {
      // Fetch the streaming response
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify(config.body),
          }),
        catch: (error) => new Error(`Fetch failed: ${String(error)}`),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Convert response to stream of raw events
      return Stream.fromAsyncIterable(
        streamEventsGenerator(response),
        (error) => new Error(`Stream parsing error: ${String(error)}`)
      );
    })
  );
};

// Async generator for parsing SSE events
async function* streamEventsGenerator(
  response: Response
): AsyncGenerator<OpenAiEvent, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is null');

  const decoder = new TextDecoder();
  let buffer = '';

  const parseLines = (lines: Array<string>): Array<OpenAiEvent | null> => {
    return lines.filter(Boolean).map((line) => {
      const trimmed = line.trim();
      if (trimmed === '[DONE]') return null;
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        try {
          return JSON.parse(data) as OpenAiEvent;
        } catch {
          return null;
        }
      }
      return null;
    });
  };

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const lines = buffer.split('\n');
        if (lines.length > 0) {
          const events = parseLines(lines).filter(Boolean);
          for (const event of events) {
            if (event) yield event;
          }
        }
        return;
      }

      const text = decoder.decode(value, { stream: true });
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      const events = parseLines(lines).filter(Boolean);
      for (const event of events) {
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
