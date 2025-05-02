/**
 * StreamChunk is the base interface for all streams.
 * It can hold voice and text chunks.
 *
 * @template T The type of data contained in the chunk
 */
export interface StreamChunk<T> {
  sequence: number;
  data: T;
  done: boolean;
}

/**
 * MessageStream represents an asynchronous iterable stream of chunks.
 * Used as the core stream representation throughout the Pump library.
 *
 * @template T The type of data contained in the chunks of the stream
 */
export type MessageStream<T> = AsyncIterable<StreamChunk<T>>;

/**
 * Represents any source that can be converted to a stream.
 * This includes AsyncIterable and ReadableStream sources.
 *
 * @template T The type of data contained in the source
 */
export type Source<T> =
  | AsyncIterable<T>
  | ReadableStream<T>
  | NodeJS.ReadableStream;

/**
 * A transformer for stream data that also provides a response.
 * Used primarily to transform and consume stream data while producing a response object.
 *
 * @template T The type of data being transformed
 * @template R The type of the response (defaults to Response)
 */
export type StreamTransformer<T, R = Response> = {
  transform(data: T): T;
  close(): void;
  response: R;
};

/**
 * Pump is an asynchronous stream processing pipeline with fluent operators.
 * It provides a comprehensive set of operations for transforming, filtering, batching,
 * combining, and consuming stream data.
 *
 * The Pump class follows a builder pattern where each operation returns a new Pump instance,
 * allowing for chaining of operations to build complex stream processing pipelines.
 *
 * @template T The type of data contained in the stream
 */
export class Pump<T> {
  constructor(private readonly src: MessageStream<T>) {}

  /**
   * Wrap an existing AsyncIterable or Readable stream into a Pump
   *
   * @template U The type of data in the source stream
   * @param source The source stream to convert to a Pump (AsyncIterable, ReadableStream, or NodeJS.ReadableStream)
   * @returns A new Pump instance that wraps the source
   */
  static from<U>(source: Source<U>): Pump<U> {
    async function* gen(): AsyncGenerator<StreamChunk<U>> {
      let seq = 0;

      // Type guard functions to narrow the type
      function isAsyncIterable(obj: Source<U>): obj is AsyncIterable<U> {
        return Symbol.asyncIterator in obj;
      }

      function isWebReadableStream(obj: Source<U>): obj is ReadableStream {
        return 'getReader' in obj && typeof obj.getReader === 'function';
      }

      function isNodeReadableStream(
        obj: Source<U>
      ): obj is NodeJS.ReadableStream {
        return (
          'pipe' in obj &&
          'on' in obj &&
          typeof obj.pipe === 'function' &&
          typeof obj.on === 'function'
        );
      }

      if (isAsyncIterable(source)) {
        // Handle AsyncIterable
        const iterator = source[Symbol.asyncIterator]();
        try {
          while (true) {
            const result = await iterator.next();
            if (result.done) break;
            yield {
              sequence: seq++,
              data: result.value,
              done: false,
            };
          }
        } finally {
          // No need to clean up AsyncIterator
        }
      } else if (isWebReadableStream(source)) {
        // Handle Web API ReadableStream
        const reader = source.getReader();
        try {
          while (true) {
            const result = await reader.read();
            if (result.done) break;
            yield {
              sequence: seq++,
              data: result.value as U,
              done: false,
            };
          }
        } finally {
          reader.releaseLock();
        }
      } else if (isNodeReadableStream(source)) {
        // Handle Node.js ReadableStream
        try {
          // Convert Node stream to an AsyncIterable
          for await (const chunk of source) {
            yield {
              sequence: seq++,
              data: chunk as U,
              done: false,
            };
          }
        } catch (error) {
          console.error('Error reading from Node.js stream:', error);
          throw error;
        }
      }

      // final done signal
      yield { sequence: seq, data: undefined as unknown as U, done: true };
    }
    return new Pump<U>(gen()) as Pump<U>;
  }

  /**
   * Sync or async map over the data portion of each chunk
   *
   * @template U The output type after transformation
   * @param fn The mapping function that transforms each chunk
   * @returns A new Pump instance with the transformed data
   */
  map<U>(fn: (data: T) => U | Promise<U>): Pump<U> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<U>> {
      for await (const { sequence, data, done } of this.src) {
        if (done) {
          const out = data !== undefined ? await fn(data) : undefined;
          yield { sequence, data: out as unknown as U, done };
          break;
        }

        const out = await fn(data);
        yield { sequence, data: out, done };
      }
    }
    return new Pump<U>(gen.call(this));
  }

  /**
   * Filter items based on a predicate
   *
   * @param predicate A function that determines whether to keep each chunk
   * @returns A new Pump instance containing only chunks that passed the predicate
   */
  filter(predicate: (data: T) => boolean | Promise<boolean>): Pump<T> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T>> {
      for await (const { sequence, data, done } of this.src) {
        if (done) {
          yield { sequence, data, done: true };
          break;
        }

        const keep = await predicate(data);
        if (keep) {
          yield { sequence, data, done: false };
        }
      }
    }
    return new Pump<T>(gen.call(this));
  }

  /**
   * Bundles (accumulates) chunks together based on a condition rather than a fixed size.
   *
   * This is useful when you need to group chunks dynamically based on their content or other criteria.
   *
   * Example: Bundling text chunks with a maximum character limit
   *
   * Input chunks: ["Hello", " this", " is", " a few", " chunks", " of text"]
   * With max size of 10 characters:
   * - First bundle: ["Hello", " this"] (10 chars)
   * - Second bundle: [" is", " a few"] (8 chars)
   * - Third bundle: [" chunks", " of text"] (13 chars)
   *
   * @param closeBundleCondition - Function that determines when to close the current bundle
   *                              Returns true when the current bundle should be emitted
   *                              Parameters:
   *                              - chunk: The current chunk being processed
   *                              - accumulatedChunks: Array of chunks in the current bundle
   *
   * @returns A pump that emits arrays of bundled items
   */
  bundle(
    closeBundleCondition: (
      chunk: T,
      accumulatedChunks: Array<T>
    ) => boolean | Promise<boolean>
  ): Pump<Array<T>> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<Array<T>>> {
      let buffer: Array<T> = [];
      let lastSequence = 0;

      for await (const { sequence, data, done } of this.src) {
        lastSequence = sequence;

        if (done) {
          // Emit any remaining items in the buffer when the stream ends
          if (buffer.length > 0) {
            yield { sequence, data: [...buffer], done: false };
          }
          // Emit the termination signal
          yield {
            sequence: lastSequence,
            data: undefined as unknown as Array<T>,
            done: true,
          };
          break;
        }

        const shouldClose = await closeBundleCondition(data, buffer);
        buffer.push(data);

        if (shouldClose) {
          yield {
            sequence: lastSequence,
            data: [...buffer],
            done: false,
          };
          buffer = [];
        }
      }
    }
    return new Pump<Array<T>>(gen.call(this));
  }

  /**
   * Tap into each chunk without altering it
   *
   * @param fn A function that receives each chunk but doesn't affect the stream
   * @returns The same pump instance with unmodified data
   */
  onChunk(fn: (chunk: T) => void | Promise<void>): Pump<T> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T>> {
      for await (const chunk of this.src) {
        if (chunk.data === undefined && chunk.done) {
          // Yield early since we don't need to tap into a closing signal (unless it contains data)
          yield chunk;
        }

        await fn(chunk.data);
        yield chunk;
      }
    }
    return new Pump<T>(gen.call(this));
  }

  /**
   * Collect all chunks in the stream and run a callback when the stream is done.
   * The callback receives an array of all chunks that passed through.
   *
   * This is useful for analytics, logging, or processing the complete stream history
   * after all chunks have been received.
   *
   * @param fn - Callback function that receives the array of all chunks when the stream is complete
   * @returns The same pump, for chaining
   */
  onClose(fn: (history: T[]) => void | Promise<void>): Pump<T> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T>> {
      const history: T[] = [];

      for await (const chunk of this.src) {
        // Add non-done chunks to history
        if (chunk.data !== undefined) {
          history.push(chunk.data);
        }

        // If we've reached the end, run the callback
        if (chunk.done) {
          await fn(history);
        }

        // Pass through the chunk unchanged
        yield chunk;
      }
    }
    return new Pump<T>(gen.call(this));
  }

  /**
   * Batch `n` chunks into arrays before emitting
   *
   * @param n The number of chunks to batch together
   * @returns A new Pump instance that emits arrays of batched chunks
   */
  batch(n: number): Pump<Array<T>> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<Array<T>>> {
      let buffer: StreamChunk<T>[] = [];

      for await (const chunk of this.src) {
        if (chunk.done) {
          // Termination signal edge case handling
          if (chunk.data === undefined) {
            // Flush the rest
            yield {
              sequence: buffer[0].sequence,
              data: buffer.map((c) => c.data),
              done: false,
            };

            // and then emit the termination signal
            yield {
              sequence: chunk.sequence,
              data: undefined as unknown as Array<T>,
              done: true,
            };
            buffer = [];
          } else {
            // in that case the termination signal contains data
            // so we need to emit this as a closing singal with the rest of the buffer
            buffer.push(chunk);
            yield {
              sequence: buffer[0].sequence,
              data: buffer.map((c) => c.data),
              done: true,
            };
          }

          break;
        }

        // Normal case

        buffer.push(chunk);

        if (buffer.length === n) {
          yield {
            sequence: buffer[0].sequence,
            data: buffer.map((c) => c.data),
            done: chunk.done,
          };
          buffer = [];
        }
      }
    }
    return new Pump<Array<T>>(gen.call(this));
  }

  /**
   * If you want to prevent chunk starvation, you can buffer the chunks.
   * Chunks will not be bundled into arrays or object but kept as is,
   * but the pipeline will not progress at that segment until the buffer is filled up.
   * Once a buffer is filled up it will drain and never buffer again.
   *
   * @param n The number of chunks to buffer before processing continues
   * @returns A new Pump instance with buffering behavior
   */
  buffer(n: number): Pump<T> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T>> {
      let buffer: StreamChunk<T>[] = [];
      let bufferFilled = false;

      for await (const chunk of this.src) {
        if (!bufferFilled) {
          if (!chunk.done) {
            buffer.push(chunk);
          }

          // If buffer is filled or we've reached the end of the stream
          if (buffer.length >= n || chunk.done) {
            bufferFilled = true;
            // Yield all buffered chunks
            for (const bufferedChunk of buffer) {
              yield bufferedChunk;
            }
            if (chunk.done) {
              yield {
                sequence: chunk.sequence,
                data: undefined as unknown as T,
                done: true,
              };
              break;
            }
            buffer = [];
          }
        } else {
          // After buffer is filled, just pass chunks through
          yield chunk;
        }
      }

      // Yield any remaining chunks in the buffer
      for (const bufferedChunk of buffer) {
        yield bufferedChunk;
      }
    }
    return new Pump<T>(gen.call(this));
  }

  /**
   * Rechunk the stream: transform one chunk into zero, one, or many output chunks.
   * The handler function receives the current buffer of chunks, a push function to emit new chunks,
   * and a flag indicating if this is the last chunk in the stream.
   *
   * @param handler Function that transforms chunks and pushes new ones
   * @returns A new Pump instance with rechunked data
   */
  rechunk(
    handler: (params: {
      buffer: T[];
      push: (chunk: T) => void;
      lastChunk: boolean;
      setBuffer: (buffer: T[]) => void;
    }) => void | Promise<void>
  ): Pump<T> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T>> {
      let buffer: Array<T> = [];
      let seq = 0;
      const pending: Array<T> = [];

      const push = (chunk: T): void => {
        pending.push(chunk);
      };

      for await (const { data, done } of this.src) {
        if (!done) {
          if (data !== undefined) {
            buffer.push(data);
          }
          await handler({
            buffer,
            push,
            lastChunk: false,
            setBuffer: (b: T[]) => {
              buffer = b;
            },
          });
        } else {
          await handler({
            buffer,
            push,
            lastChunk: true,
            setBuffer: (b: T[]) => {
              buffer = b;
            },
          });
        }

        while (pending.length > 0) {
          const out = pending.shift()!;
          yield { sequence: seq++, data: out, done: false };
        }

        if (done) {
          break;
        }
      }

      yield { sequence: seq, data: undefined as unknown as T, done: true };
    }

    return new Pump<T>(gen.call(this));
  }

  /**
   * Emit sliding windows of the last `size` items with step `step`.
   * Each window is an array [current, previous1, ..., previous(size-1)].
   * Optionally, map each window through a function.
   *
   * | Step | Window | Resulting Window |
   * |------|--------|------------------|
   * | 1    | ▪︎▪︎[▪︎▫︎▫︎] | ▪︎▫︎▫︎ |
   * | 2    | ▪︎[▪︎▪︎▫︎] | ▪︎▪︎▫︎ |
   * | 3    | [▪︎▪︎▪︎] | ▪︎▪︎▪︎ |
   * | 4    | [▫︎▪︎▪︎] | ▫︎▪︎▪︎ |
   * | 5    | [▫︎▫︎▪︎] | ▫︎▫︎▪ |
   *
   * @param size The size of each window
   * @param step The number of items to move between windows
   * @returns A Pump that emits arrays representing sliding windows
   */
  slidingWindow(size: number, step: number): Pump<Array<T | undefined>>;
  /**
   * Emit sliding windows of the last `size` items with step `step`,
   * and map each window using the provided function.
   *
   * @template N The size type parameter (extends number)
   * @template U The output type after window transformation
   * @param size The size of each window
   * @param step The number of items to move between windows
   * @param fn A function to transform each window
   * @returns A Pump that emits transformed sliding windows
   */
  slidingWindow<N extends number, U>(
    size: N,
    step: number,
    fn: (window: Array<T | undefined>) => U | Promise<U>
  ): Pump<U>;
  slidingWindow<U>(
    size: number,
    step: number,
    fn?: (window: Array<T | undefined>) => U | Promise<U>
  ): Pump<Array<T | undefined>> | Pump<U> {
    async function* gen(
      this: Pump<T>
    ): AsyncGenerator<StreamChunk<Array<T | undefined>>> {
      const history: Array<T> = [];
      let offset = 0;
      let lastSeq = 0;

      function buildWindow(
        _offset: number,
        _size: number,
        _history: Array<T>
      ): Array<T | undefined> {
        const window: Array<T | undefined> = Array(_size).fill(undefined);
        let windowIndex = 0;

        for (let i = _offset; i > _offset - _size; i -= step) {
          if (i >= history.length) {
            windowIndex++;
            // we can skip this since we are filling the blank spots with undefined
            continue;
          }

          if (i < 0) {
            break;
          }

          window[windowIndex] = _history[i]; // the window follows the analoy so its filled reversed from the graphic
          windowIndex++;
        }

        return window;
      }

      for await (const { sequence, data, done } of this.src) {
        if (done) {
          // if we are done that means we are not receiving any more signals to push the window
          // so we have to emit the last window steps
          // [▪︎▪︎▫︎]
          // [▪︎▫︎▫︎]
          for (let i = 0; i < size - 1; i++) {
            const window = buildWindow(offset + i, size, history);
            yield { sequence: lastSeq, data: window, done: false };
          }

          if (data === undefined) {
            // final done signal
            yield {
              sequence: lastSeq,
              data: undefined as unknown as Array<T>,
              done: true,
            };
          } else {
            // final done signal
            yield {
              sequence: lastSeq,
              data: [
                history[history.length - 2] ?? undefined,
                history[history.length - 3] ?? undefined,
                history[history.length - 1],
              ],
              done: true,
            };
          }
          break;
        }

        lastSeq = sequence;
        history.push(data);

        // the rolling window goes from the oldest to the newest and pushes it self
        // with a step length. The analogy of the pipe shifts the window from right to left
        // but the array appends to the end. So in this implementation we are shifting from left to right.

        // lets calculate the window indexes
        // [▫︎▫︎▪︎]▪︎▪︎
        // [▫︎▪︎▪︎]▪︎
        // [▪︎▪︎▪︎]
        // [▪︎▪︎▫︎] <- this case is handled above
        // [▪︎▫︎▫︎] <- this case is handled above
        const window = buildWindow(offset, size, history);

        yield { sequence, data: window, done: false };
        offset++;
      }
    }
    const base = new Pump<Array<T | undefined>>(gen.call(this));
    // If fn is provided, map over the window, otherwise return the window as is
    return fn
      ? base.map(fn as (window: Array<T | undefined>) => U)
      : (base as Pump<Array<T | undefined>>);
  }

  /**
   * Sequentially flatten inner stream sources emitted by the pipeline.
   * Works with any Source type (AsyncIterable or ReadableStream).
   * This method is only available when the current Pump contains Source elements.
   *
   * @template U The type of data in the inner streams
   * @template F The type of inner stream source (extends Source<U>)
   * @returns A Pump instance with flattened stream data
   */
  sequenceStreams<U, F extends Source<U>>(this: Pump<F>): Pump<U> {
    async function* gen(this: Pump<F>): AsyncGenerator<StreamChunk<U>> {
      let seq = 0;

      for await (const { data: innerSource, done: outerDone } of this.src) {
        if (outerDone) break;

        // Convert the inner source to a pump first
        const innerPump = Pump.from(innerSource as unknown as Source<U>);

        // Then extract all items from it
        for await (const { data, done } of innerPump.src) {
          if (done) break;
          yield { sequence: seq++, data: data as U, done: false };
        }
      }

      yield { sequence: seq, data: undefined as unknown as U, done: true };
    }
    return new Pump<U>(gen.call(this));
  }

  /**
   * Fork the stream: two independent Pump<T> consumers
   * Both resulting Pumps will receive the same data, allowing for divergent processing paths.
   *
   * @returns An array containing two independent Pump instances with the same source data
   */
  fork(): [Pump<T>, Pump<T>] {
    const buffers: StreamChunk<T>[][] = [[], []];
    let done = false;
    const srcIter = this.src[Symbol.asyncIterator]();

    async function fill(): Promise<void> {
      const { value, done: streamDone } = await srcIter.next();
      if (streamDone) {
        done = true;
        return;
      }
      buffers.forEach((q) => q.push(value));
      if (value.done) done = true;
    }

    function makeStream(buf: StreamChunk<T>[]): MessageStream<T> {
      return {
        [Symbol.asyncIterator](): AsyncIterator<StreamChunk<T>> {
          return {
            async next(): Promise<IteratorResult<StreamChunk<T>>> {
              while (buf.length === 0 && !done) {
                await fill();
              }
              if (buf.length === 0)
                return {
                  done: true,
                  value: undefined as unknown as StreamChunk<T>,
                };
              return { done: false, value: buf.shift()! };
            },
          };
        },
      };
    }

    return [new Pump(makeStream(buffers[0])), new Pump(makeStream(buffers[1]))];
  }

  /**
   * Drain the pipeline, consuming all chunks.
   * Returns a Promise that resolves when all chunks have been consumed.
   *
   * @returns A Promise that resolves when all chunks have been consumed
   */
  drain(): Promise<void> {
    return (async (): Promise<void> => {
      for await (const { done } of this.src) {
        if (done) break;
      }
    })();
  }

  /**
   * Drain the pipeline to a StreamTransformer.
   * Applies transform() to each data chunk, then closes the transformer,
   * and returns its response (which can be of any type defined by the transformer).
   *
   * Example with httpStreamResponse:
   * ```
   * const { transform, response, close } = httpStreamResponse(options);
   * return Pump.from(messageStream).drainTo({ transform, close, response });
   * ```
   *
   * @template U The type of data expected by the transformer (extends T)
   * @template R The response type produced by the transformer
   * @param transformer The StreamTransformer to drain to
   * @returns The response from the transformer
   */
  drainTo<U extends T, R>(transformer: StreamTransformer<U, R>): R {
    (async (): Promise<void> => {
      for await (const { data, done } of this.src) {
        if (done) break;
        transformer.transform(data as unknown as U);
      }
      transformer.close();
    })();
    return transformer.response;
  }
}

// ----------------------------------------------------------
// Example usage in Next.js App Router (app/api/stream/route.ts)
//
// import { Pump } from '@/lib/pump';
// import { Response } from '@/lib/httpStream';
// import { openAiStream } from '@/lib/openai';
//
// export async function GET() {
//   // 1. Obtain an AsyncIterable<string> from OpenAI
//   const aiStream = await openAiStream({ model: 'gpt-4o-mini', prompt: 'Hello!' });
//
//   // 2. Set up the HTTP streaming transformer
//   const { transform, response, close } = Response.httpStreamResponse<string>({
//     init: {
//       status: 200,
//       headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
//     },
//     encoder: text => new TextEncoder().encode(text)
//   });
//
//   // 3. Wire up the Pump: map each chunk through transform, then drain
//   return Pump
//     .from(aiStream)
//     .map(data => data)     // if you want to preprocess data
//     .map(transform)         // writes to HTTP response
//     .drain({ transform, close, response });
// }
