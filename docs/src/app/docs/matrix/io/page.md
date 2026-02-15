---
title: IO & Adapters
nextjs:
  metadata:
    title: IO & Adapters – Exposing Networks as APIs
    description: Expose agent networks as SSE HTTP endpoints with Next.js and Express adapters.
---

The IO layer turns an `AgentNetwork` into an HTTP API. It handles request parsing, authentication, event streaming, and comes with built-in adapters for Next.js and Express. {% .lead %}

---

## Exposing a Network

Call `network.expose()` to create an `ExposedAPI`:

```ts
const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'user-request',
});
```

### Options

- **`protocol`** (`'sse'`) — Streaming protocol (currently SSE)
- **`auth`** — Per-request authentication callback returning `{ allowed, message?, status? }`
- **`select.channels`** (`string` or `string[]`) — Which channel(s) to stream from
- **`select.events`** (`string[]`) — Filter to only stream specific event names
- **`startEventName`** (`string`) — Name of the event published when a request arrives (default: `'request'`)
- **`onRequest`** — Callback before streaming starts
- **`plane`** (`EventPlane`) — Optional: reuse an existing event plane

---

## Authentication

Add per-request auth with the `auth` callback:

```ts
const api = network.expose({
  protocol: 'sse',
  auth: async (req) => {
    const token = req.request?.headers?.get?.('authorization');
    if (!token || !isValid(token)) {
      return { allowed: false, message: 'Invalid token', status: 401 };
    }
    return { allowed: true };
  },
  select: { channels: 'client' },
});
```

When auth fails, the adapter returns the appropriate HTTP error response.

---

## Custom Request Handling

Use `onRequest` for advanced control over how requests are processed:

```ts
const api = network.expose({
  protocol: 'sse',
  onRequest: async ({ emitStartEvent, req, payload }) => {
    // Transform the payload before emitting
    const enrichedPayload = {
      ...payload,
      timestamp: Date.now(),
      source: 'web',
    };
    emitStartEvent(enrichedPayload);
  },
  select: { channels: 'client' },
});
```

The `onRequest` callback receives:
- **`emitStartEvent(payload?)`** — Call this to publish the start event with an optional custom payload
- **`req`** — The raw request object
- **`payload`** — The extracted JSON payload from the request body

If `onRequest` is provided, the start event is **not** automatically published — you must call `emitStartEvent()` yourself.

---

## Event Filtering

Stream only specific events to the client:

```ts
const api = network.expose({
  protocol: 'sse',
  select: {
    channels: 'client',
    events: ['agent-response', 'agent-error'],  // Only these events
  },
});
```

---

## Next.js Adapter

The `NextEndpoint` adapter maps an `ExposedAPI` to a Next.js App Router handler:

```ts
import { NextEndpoint } from '@m4trix/core/matrix';

const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'user-request',
});

const handler = NextEndpoint.from(api).handler();

// Export as GET and/or POST
export const GET = handler;
export const POST = handler;
```

### How It Works

1. Receives the incoming `Request`
2. Runs auth (if configured)
3. Extracts JSON payload from POST body (or empty object for GET)
4. Creates an SSE `Response` with streaming headers
5. Publishes the start event to the main channel
6. Streams matching events from the selected channels as SSE

### Response Format

Events are streamed as standard Server-Sent Events:

```text
event: agent-response
data: {"name":"agent-response","meta":{"runId":"..."},"payload":{"text":"Hello!"}}

event: agent-response
data: {"name":"agent-response","meta":{"runId":"..."},"payload":{"text":" World!"}}
```

---

## Express Adapter

The `ExpressEndpoint` adapter works the same way for Express apps:

```ts
import { ExpressEndpoint } from '@m4trix/core/matrix';

const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'user-request',
});

const handler = ExpressEndpoint.from(api).handler();

app.get('/api/stream', handler);
app.post('/api/stream', handler);
```

### Express-Specific Behavior

- Reads `req.body` for POST payloads (make sure body-parser middleware is applied)
- Sets SSE headers (`Content-Type`, `Cache-Control`, `Connection`)
- Properly handles client disconnect via the `close` event
- Calls `res.flush()` if available (for compression middleware compatibility)

---

## Full Example: Next.js Streaming API

```ts
// app/api/chat/route.ts
import OpenAI from 'openai';
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
  NextEndpoint,
  S,
} from '@m4trix/core/matrix';

const chatRequest = AgentNetworkEvent.of(
  'chat-request',
  S.Struct({ message: S.String }),
);

const chatResponse = AgentNetworkEvent.of(
  'chat-response',
  S.Struct({ text: S.String, done: S.Boolean }),
);

const chatAgent = AgentFactory.run()
  .listensTo([chatRequest])
  .emits([chatResponse])
  .logic(async ({ triggerEvent, emit }) => {
    const openai = new OpenAI();
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [{ role: 'user', content: triggerEvent.payload.message }],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        emit({ name: 'chat-response', payload: { text, done: false } });
      }
    }
    emit({ name: 'chat-response', payload: { text: '', done: true } });
  })
  .produce({});

const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());
    registerAgent(chatAgent).subscribe(main).publishTo(client);
  },
);

const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'chat-request',
});

const handler = NextEndpoint.from(api).handler();
export const GET = handler;
export const POST = handler;
```
