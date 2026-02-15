---
title: Matrix Overview
nextjs:
  metadata:
    title: Matrix – Event-Driven Agent Orchestration
    description: Build type-safe, event-driven AI agent networks with @m4trix/core/matrix.
---

The **Matrix** module is the core of `@m4trix/core`. It provides an event-driven, type-safe agent orchestration system for building AI applications — from a single agent to a full multi-agent network. {% .lead %}

---

## Why Matrix?

Most AI orchestration frameworks force you into rigid graph structures or rely on untyped message passing. Matrix takes a different approach:

- **Event-driven** — Agents communicate through typed events on named channels, not through hard-wired function calls.
- **Type-safe** — Full TypeScript inference from event schemas through agent logic to HTTP responses.
- **Composable** — Start with one agent, scale to many. Add channels, sinks, and adapters as you grow.
- **Framework-agnostic** — Built-in adapters for Next.js and Express, with SSE streaming out of the box.

---

## Core Concepts

Matrix is built around four main primitives:

### 1. Events

Events are the messages that flow through the system. Each event has a **name**, a **payload schema** (validated at runtime via [Effect Schema](https://effect.website/)), and automatically-attached **metadata** (run ID, timestamps, correlation IDs).

```ts
import { AgentNetworkEvent, S } from '@m4trix/core/matrix';

const requestEvent = AgentNetworkEvent.of(
  'user-request',
  S.Struct({ query: S.String }),
);
```

### 2. Agents

Agents are units of work. You build them with the `AgentFactory` builder, declaring which events they listen to, which events they emit, and the async logic that runs when triggered.

```ts
import { AgentFactory } from '@m4trix/core/matrix';

const myAgent = AgentFactory.run()
  .listensTo([requestEvent])
  .emits([responseEvent])
  .logic(async ({ triggerEvent, emit }) => {
    const query = triggerEvent.payload.query;
    emit({ name: 'response', payload: { answer: `You asked: ${query}` } });
  })
  .produce({});
```

### 3. Channels

Channels are named routes for events. Agents subscribe to channels to receive events, and publish to channels to send events. Channels can have **sinks** (e.g. HTTP stream, Kafka) that determine how events leave the system.

```ts
const main = mainChannel('main');
const client = createChannel('client').sink(sink.httpStream());
```

### 4. Agent Network

The `AgentNetwork` wires everything together. You declare channels, register agents with their subscriptions and publish targets, and the network manages the event plane at runtime.

```ts
const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());

    registerAgent(myAgent).subscribe(main).publishTo(client);
  },
);
```

---

## End-to-End Example

Here's a complete example — a reasoning agent that streams OpenAI responses via SSE in a Next.js API route:

```ts
import OpenAI from 'openai';
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
  NextEndpoint,
  S,
} from '@m4trix/core/matrix';

// 1. Define events
const reasoningRequest = AgentNetworkEvent.of(
  'reasoning-request',
  S.Struct({ request: S.String }),
);

const reasoningResponse = AgentNetworkEvent.of(
  'reasoning-response',
  S.Struct({ response: S.String, isFinal: S.Boolean }),
);

// 2. Build the agent
const reasoningAgent = AgentFactory.run()
  .listensTo([reasoningRequest])
  .emits([reasoningResponse])
  .logic(async ({ triggerEvent, emit }) => {
    const openai = new OpenAI();
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [{ role: 'user', content: triggerEvent.payload.request }],
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        emit({
          name: 'reasoning-response',
          payload: { response: content, isFinal: false },
        });
      }
    }
    emit({
      name: 'reasoning-response',
      payload: { response: '', isFinal: true },
    });
  })
  .produce({});

// 3. Wire the network
const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());
    registerAgent(reasoningAgent).subscribe(main).publishTo(client);
  },
);

// 4. Expose as an API
const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'reasoning-request',
});

const handler = NextEndpoint.from(api).handler();
export const GET = handler;
export const POST = handler;
```

---

## Architecture Diagram

```text
HTTP Request
    │
    ▼
┌─────────────────────┐
│   expose() / API    │  ← Auth, payload extraction
└────────┬────────────┘
         │ start event
         ▼
┌─────────────────────┐
│    Main Channel     │  ← Events enter here
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│      Agent(s)       │  ← Logic runs, emits new events
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Client Channel    │  ← sink: httpStream()
└────────┬────────────┘
         │ SSE
         ▼
      Browser
```

---

## What's Next

- **[Agent Factory](/docs/matrix/agent-factory)** — Builder API for creating type-safe agents
- **[Agent Network](/docs/matrix/agent-network)** — Wiring agents, channels, and the event plane
- **[Events & Channels](/docs/matrix/events-and-channels)** — Typed events, schemas, and routing
- **[IO & Adapters](/docs/matrix/io)** — Exposing networks as HTTP APIs with Next.js and Express adapters
