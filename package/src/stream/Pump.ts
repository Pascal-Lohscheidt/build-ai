/**
 * StreamChunk is the base interface for all streams.
 * It can hold voice and text chunks.
 */
export interface StreamChunk<T> {
  sequence: number;
  data: T;
  done: boolean;
}

export type MessageStream<T> = AsyncIterable<StreamChunk<T>>;

export type StreamTransformer<T> = {
  transform(data: T): T;
  close(): void;
  response: Response;
};

/**
 * Asynchronous pipeline with fluent operators
 */
export class Pump<T> {
  constructor(private readonly src: MessageStream<T>) {}

  /**
   * Wrap an existing AsyncIterable into a Pump
   */
  static from<U>(source: AsyncIterable<U>): Pump<U> {
    async function* gen(): AsyncGenerator<StreamChunk<U>> {
      let seq = 0;
      for await (const data of source) {
        yield { sequence: seq++, data, done: false };
      }
      // final done signal
      yield { sequence: seq, data: undefined as unknown as U, done: true };
    }
    return new Pump<U>(gen());
  }

  /**
   * Sync or async map over the data portion of each chunk
   */
  map<U>(fn: (data: T) => U | Promise<U>): Pump<U> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<U>> {
      for await (const { sequence, data, done } of this.src) {
        if (done) {
          yield { sequence, data: undefined as unknown as U, done: true };
          break;
        }
        const out = await fn(data);
        yield { sequence, data: out, done: false };
      }
    }
    return new Pump<U>(gen.call(this));
  }

  /**
   * Filter items based on a predicate
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
   * Sometimes you want to bundle (accumulate) chunks together but not on a fixed size but on
   * a condition based on the previous chunks.
   *
   * Imagine you get 5 chunks of text that are differently long but you want to generate bundles
   * with a max size of 10 characters.
   *
   * For Hallo this | is a few chunks of text | that are longer then 10 characters
   *
   * You want to generate bundles with a max size of 10 characters.
   *
   * The first bundle would be "Hallo this"
   *
   * @param closeBundleCondition - A function that returns true if the bundle should be closed
   * @param chunkBundler - A function that defines how the chunks are bundled together
   *
   * The default bundling behaviour is just clustering the bundled chunks into an array
   *
   * @returns A pump that emits arrays of bundled items
   */
  bundle(
    closeBundleCondition: (
      chunk: T,
      accumulatedChunks: T[]
    ) => boolean | Promise<boolean>,
    chunkBundler?: (chunk: T, accumulatedChunks: T[]) => T[] | Promise<T[]>
  ): Pump<T[]> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T[]>> {
      let buffer: T[] = [];
      let lastSequence = 0;

      for await (const { sequence, data, done } of this.src) {
        if (done) {
          if (buffer.length > 0) {
            yield { sequence, data: buffer, done: true };
          } else {
            yield { sequence, data: [], done: true };
          }
          break;
        }

        lastSequence = sequence;

        // Use chunkBundler if provided, otherwise just push the data
        if (chunkBundler) {
          buffer = await chunkBundler(data, buffer);
        } else {
          buffer.push(data);
        }

        const shouldClose = await closeBundleCondition(data, buffer);

        if (shouldClose) {
          yield { sequence: lastSequence, data: [...buffer], done: false };
          buffer = [];
        }
      }
    }
    return new Pump<T[]>(gen.call(this));
  }

  /**
   * Tap into each chunk without altering it
   */
  onChunk(fn: (chunk: StreamChunk<T>) => void | Promise<void>): Pump<T> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T>> {
      for await (const chunk of this.src) {
        await fn(chunk);
        yield chunk;
      }
    }
    return new Pump<T>(gen.call(this));
  }

  /**
   * Batch `n` chunks into arrays before emitting
   */
  batch(n: number): Pump<T[]> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T[]>> {
      let buffer: StreamChunk<T>[] = [];
      for await (const chunk of this.src) {
        buffer.push(chunk);
        if (buffer.length === n || chunk.done) {
          yield {
            sequence: buffer[0].sequence,
            data: buffer.map((c) => c.data),
            done: chunk.done,
          };
          buffer = [];
        }
      }
    }
    return new Pump<T[]>(gen.call(this));
  }

  /**
   * If you want to prevent chunk starvation, you can buffer the chunks.
   * Chunks will not be bundled into arrays or object but kept as is,
   * but the pipeline will not progress at that segment until the buffer is filled up.
   * Once a buffer is filled up it will drain and never buffer again.
   */
  buffer(n: number): Pump<T> {
    async function* gen(this: Pump<T>): AsyncGenerator<StreamChunk<T>> {
      let buffer: StreamChunk<T>[] = [];
      let bufferFilled = false;

      for await (const chunk of this.src) {
        if (!bufferFilled) {
          buffer.push(chunk);

          // If buffer is filled or we've reached the end of the stream
          if (buffer.length >= n || chunk.done) {
            bufferFilled = true;
            // Yield all buffered chunks
            for (const bufferedChunk of buffer) {
              yield bufferedChunk;
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
   * Fork the stream: two independent Pump<T> consumers
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
   * Drain the pipeline.
   * - Without args: consumes all chunks, returns a Promise<void>.
   * - With a StreamTransformer: applies transform() to each data,
   *   closes the transformer, and returns its Response.
   */
  drain(): Promise<void>;
  drain<U>(transformer: StreamTransformer<U>): Response;
  drain(transformer?: StreamTransformer<T>): Promise<void> | Response | void {
    if (transformer) {
      (async (): Promise<Response> => {
        for await (const { data, done } of this.src) {
          if (done) break;
          transformer.transform(data);
        }
        transformer.close();
        return transformer.response;
      })();
    } else {
      return (async (): Promise<void> => {
        for await (const { done } of this.src) {
          if (done) break;
        }
      })();
    }
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
