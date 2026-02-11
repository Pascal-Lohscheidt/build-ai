# Pump API Documentation

The Pump library provides a powerful, chainable stream processing pipeline for handling asynchronous data streams. It allows for transforming, filtering, batching, and consuming stream data using a fluent interface.

## Basic Usage

```typescript
import { Pump } from '@m4trix/core/stream';

// Create a Pump from an AsyncIterable source
const pump = Pump.from(sourceStream);

// Transform the data
const transformedPump = pump.map(item => transformItem(item));

// Filter items
const filteredPump = transformedPump.filter(item => someCondition(item));

// Consume the stream
await filteredPump.drain();
```

## Core Concepts

The Pump library is built around these key concepts:

- **StreamChunk**: The basic unit that flows through a Pump pipeline, containing sequence information, data, and a done flag.
- **MessageStream**: An AsyncIterable of StreamChunks that forms the core stream representation.
- **Source**: Any data source that can be converted to a MessageStream (AsyncIterable, ReadableStream, or NodeJS.ReadableStream).
- **StreamTransformer**: A utility for transforming stream data while producing a response.

## API Reference

### Creating a Pump

#### `Pump.from<U>(source: Source<U>): Pump<U>`

Creates a new Pump instance from any supported source type.

```typescript
// From an AsyncIterable
async function* source() {
  yield 'a';
  yield 'b';
  yield 'c';
}
const pump = Pump.from(source());

// From Web API ReadableStream
const pump = Pump.from(readableStream);

// From Node.js ReadableStream
const pump = Pump.from(nodeStream);
```

### Transformation Methods

#### `map<U>(fn: (data: T) => U | Promise<U>): Pump<U>`

Transforms each data item in the stream using the provided function.

```typescript
const doubled = Pump.from([1, 2, 3])
  .map(num => num * 2);
// Result: [2, 4, 6]
```

#### `filter(predicate: (data: T) => boolean | Promise<boolean>): Pump<T>`

Filters stream items based on a predicate function.

```typescript
const evens = Pump.from([1, 2, 3, 4])
  .filter(num => num % 2 === 0);
// Result: [2, 4]
```

#### `rechunk(handler: (params: { buffer: T[], push: (chunk: T) => void, lastChunk: boolean, setBuffer: (buffer: T[]) => void }) => void | Promise<void>): Pump<T>`

Transforms one chunk into zero, one, or many output chunks with fine-grained control.

```typescript
const rechunked = Pump.from(["Hello ", "world", "!"])
  .rechunk(({ buffer, push, lastChunk, setBuffer }) => {
    // Custom logic to rechunk the data
    if (buffer.length >= 2) {
      push(buffer.join(''));
      setBuffer([]);
    }
    if (lastChunk && buffer.length > 0) {
      push(buffer.join(''));
    }
  });
```

### Grouping Methods

#### `batch(n: number): Pump<Array<T>>`

Groups consecutive chunks into arrays of the specified size.

```typescript
const batched = Pump.from([1, 2, 3, 4, 5])
  .batch(2);
// Result: [[1, 2], [3, 4], [5]]
```

#### `bundle(closeBundleCondition: (chunk: T, accumulatedChunks: Array<T>) => boolean | Promise<boolean>): Pump<Array<T>>`

Groups chunks into bundles based on a dynamic condition.

```typescript
const bundled = Pump.from(["Hello", " this", " is", " text"])
  .bundle((chunk, accumulated) => {
    const totalLength = accumulated.reduce((len, str) => len + str.length, 0) + chunk.length;
    return totalLength > 10;
  });
```

#### `buffer(n: number): Pump<T>`

Buffers a specified number of chunks before passing them through, helping prevent chunk starvation.

```typescript
const buffered = Pump.from(dataStream)
  .buffer(10); // Wait for 10 chunks before processing starts
```

#### `slidingWindow(size: number, step: number): Pump<Array<T | undefined>>`

Creates sliding windows of the specified size, with each window containing the current item and previous items.

```typescript
const windows = Pump.from([1, 2, 3, 4, 5])
  .slidingWindow(3, 1);
// Windows: [[1, undefined, undefined], [2, 1, undefined], [3, 2, 1], [4, 3, 2], [5, 4, 3]]
```

You can also transform each window:

```typescript
const sums = Pump.from([1, 2, 3, 4, 5])
  .slidingWindow(3, 1, window => 
    window.reduce((sum, num) => sum + (num ?? 0), 0)
  );
// Result: [1, 3, 6, 9, 12]
```

### Stream Branching

#### `fork(): [Pump<T>, Pump<T>]`

Creates two independent Pump instances that both receive the same data.

```typescript
const [stream1, stream2] = Pump.from(dataStream).fork();

// Process each stream differently
stream1.map(data => processData1(data)).drain();
stream2.map(data => processData2(data)).drain();
```

### Stream Composition

#### `sequenceStreams<U, F extends Source<U>>(this: Pump<F>): Pump<U>`

Sequentially flattens inner stream sources emitted by the pipeline.

```typescript
const pump = Pump.from([source1(), source2(), source3()])
  .sequenceStreams(); // Flattens all sources into a single stream
```

### Monitoring and Side Effects

#### `onChunk(fn: (chunk: T) => void | Promise<void>): Pump<T>`

Performs a side effect for each chunk without altering the stream.

```typescript
const monitored = Pump.from(dataStream)
  .onChunk(data => console.log('Processing:', data));
```

#### `onClose(fn: (history: T[]) => void | Promise<void>): Pump<T>`

Collects all chunks and runs a callback when the stream is complete.

```typescript
const withAnalytics = Pump.from(dataStream)
  .onClose(history => {
    // Process the complete history of data when done
    analyzeData(history);
  });
```

### Consumption Methods

#### `drain(): Promise<void>`

Consumes all chunks in the stream, returning a Promise that resolves when complete.

```typescript
await Pump.from(dataStream).drain();
```

#### `drainTo<U extends T, R>(transformer: StreamTransformer<U, R>): R`

Drains the pipeline to a StreamTransformer, applying the transformer to each chunk.

```typescript
const { transform, response, close } = httpStreamResponse(options);
return Pump.from(messageStream)
  .drainTo({ transform, close, response });
```

## Example: HTTP Streaming Response

```typescript
import { Pump } from '@/lib/pump';
import { Response } from '@/lib/httpStream';
import { openAiStream } from '@/lib/openai';

export async function GET() {
  // 1. Obtain an AsyncIterable<string> from OpenAI
  const aiStream = await openAiStream({ 
    model: 'gpt-4o-mini', 
    prompt: 'Hello!' 
  });

  // 2. Set up the HTTP streaming transformer
  const { transform, response, close } = Response.httpStreamResponse<string>({
    init: {
      status: 200,
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8', 
        'Cache-Control': 'no-cache' 
      }
    },
    encoder: text => new TextEncoder().encode(text)
  });

  // 3. Create the pipeline
  return Pump
    .from(aiStream)
    .map(data => data)      // Optional preprocessing
    .drainTo({ transform, close, response });
}
```

## Advanced Use Cases

### Text Processing Pipeline

```typescript
// Process a stream of text chunks
const textProcessor = Pump.from(textSource)
  .filter(text => text.trim().length > 0)       // Skip empty chunks
  .map(text => text.toLowerCase())              // Normalize case
  .bundle((chunk, accumulated) => {             // Bundle into paragraphs
    return chunk.includes('\n\n');
  })
  .map(chunks => chunks.join(''))               // Join paragraph chunks
  .map(paragraph => analyzeText(paragraph));    // Process each paragraph
```

### Data Batching with Window Analysis

```typescript
// Process time-series data with sliding window analysis
const analyzer = Pump.from(timeSeriesData)
  .slidingWindow(10, 1, window => {
    // Analyze each window of 10 data points
    return {
      average: calculateAverage(window),
      trend: detectTrend(window),
      anomalies: detectAnomalies(window)
    };
  })
  .filter(analysis => analysis.anomalies.length > 0)  // Only pass anomalies
  .batch(5)                                           // Group 5 anomalies together
  .map(anomalyGroup => generateAlert(anomalyGroup));  // Generate alerts
```

## Performance Considerations

- Use `buffer` when you need to ensure a minimum batch size before processing begins
- The `rechunk` method offers the most control but requires more complex logic
- For high-volume streams, consider using `batch` or `bundle` to reduce the number of downstream operations
- Use `fork` when you need to process the same data in different ways without duplicating the source
