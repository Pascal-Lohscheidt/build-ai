---
title: Events & Channels
nextjs:
  metadata:
    title: Events & Channels – Typed Event Routing
    description: Define schema-validated events and route them through channels with sinks.
---

Events and channels form the communication backbone of every Matrix agent network. Events are typed messages validated at runtime, and channels route them between agents. {% .lead %}

---

## Defining Events

Use `AgentNetworkEvent.of()` to define an event with a name and a payload schema powered by [Effect Schema](https://effect.website/):

```ts
import { AgentNetworkEvent, S } from '@m4trix/core/matrix';

const userMessage = AgentNetworkEvent.of(
  'user-message',
  S.Struct({
    text: S.String,
    userId: S.optional(S.String),
  }),
);
```

The resulting event definition is a constant you reference throughout your code — in agent factories, network setup, and expose configuration.

---

## Event Envelope

Every event flowing through the system is wrapped in an envelope:

```ts
{
  name: 'user-message',        // Event name (literal type)
  meta: {
    runId: 'uuid-...',         // Unique run identifier
    contextId: '...',          // Optional context grouping
    correlationId: '...',      // Optional correlation chain
    causationId: '...',        // Optional cause tracking
    ts: 1700000000,            // Optional timestamp
  },
  payload: {
    text: 'Hello!',            // Validated against the schema
    userId: 'user-123',
  },
}
```

The `meta` fields are automatically managed by the runtime. You only need to provide the `name` and `payload` when emitting events from agents.

---

## Event Definition API

### `AgentNetworkEvent.of(name, schema)`

Creates an event definition.

```ts
const myEvent = AgentNetworkEvent.of('my-event', S.Struct({ value: S.Number }));
```

### `.make(payload)`

Creates an unbound event (name + payload only) for use with `emit`. Validates the payload via schema. Meta is injected by the runtime when the event is emitted.

```ts
emit(myEvent.make({ value: 42 }));
```

### `.makeBound(meta, payload)`

Creates a full envelope (meta + payload) for tests or manual trigger events. Sync, throws on invalid data.

```ts
const envelope = myEvent.makeBound(
  { runId: crypto.randomUUID() },
  { value: 42 },
);
```

### `.makeEffect(payload)`

Effect version of `make`. Use when composing in Effect pipelines.

```ts
import { Effect } from 'effect';

const unbound = Effect.runSync(myEvent.makeEffect({ value: 42 }));
```

### `.makeBoundEffect(meta, payload)`

Effect version of `makeBound`. Returns full envelope as Effect.

### `.decode(unknown)`

Decodes an unknown value into a validated event envelope. Useful for parsing incoming requests.

```ts
const result = Effect.runSync(myEvent.decode(rawData));
```

### `.is(value)`

Type guard that checks whether an unknown value matches this event's shape.

```ts
if (myEvent.is(someValue)) {
  // someValue is typed as the full envelope
  console.log(someValue.payload.value);
}
```

---

## Channels

Channels are named conduits for events. They route events between agents and connect to external systems via sinks.

### Creating Channels

```ts
const network = AgentNetwork.setup(({ mainChannel, createChannel, sink }) => {
  // The main channel — where start events are published
  const main = mainChannel('main');

  // Additional channels
  const processing = createChannel('processing');
  const client = createChannel('client');
});
```

Channel names must be **kebab-case** (e.g. `'main'`, `'client-output'`, `'processing-queue'`). This is enforced at runtime with a branded type.

### Channel Events

You can optionally declare which events a channel carries:

```ts
const client = createChannel('client')
  .events([responseEvent, errorEvent]);
```

---

## Sinks

Sinks determine how events leave a channel. They are the bridge between the internal event plane and external systems.

### HTTP Stream Sink

Routes events to HTTP SSE streams. Required for `expose()` to work.

```ts
const client = createChannel('client').sink(sink.httpStream());
```

### Kafka Sink

Routes events to a Kafka topic.

```ts
const events = createChannel('events').sink(sink.kafka({ topic: 'agent-events' }));
```

### Multiple Sinks

A single channel can have multiple sinks:

```ts
const output = createChannel('output')
  .sink(sink.httpStream())
  .sink(sink.kafka({ topic: 'output-events' }));
```

---

## Event Flow

Here's how events flow through the system:

1. A **start event** is published to the main channel (either programmatically or via `expose()`)
2. Agents subscribed to that channel **receive the event** (filtered by their `listensTo` declarations)
3. Agent logic runs and **emits new events**
4. Emitted events are published to the agent's **publishTo channels**
5. Other agents on those channels pick up the events, continuing the chain
6. Events on channels with an **HTTP stream sink** are streamed to the client

```text
Start Event → Main Channel → Agent A → Processing Channel → Agent B → Client Channel → SSE
```
