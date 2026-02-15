---
title: Agent Factory
nextjs:
  metadata:
    title: Agent Factory – Building Type-Safe Agents
    description: Use the AgentFactory builder to create typed, event-driven agents with @m4trix/core/matrix.
---

The `AgentFactory` is a fluent builder for creating agents. It provides full TypeScript inference — the types of your trigger events and emitted events flow through the entire chain. {% .lead %}

---

## Basic Usage

```ts
import { AgentFactory, AgentNetworkEvent, S } from '@m4trix/core/matrix';

// Define events
const inputEvent = AgentNetworkEvent.of(
  'user-input',
  S.Struct({ text: S.String }),
);

const outputEvent = AgentNetworkEvent.of(
  'agent-output',
  S.Struct({ reply: S.String }),
);

// Build the agent
const echoAgent = AgentFactory.run()
  .listensTo([inputEvent])
  .emits([outputEvent])
  .logic(async ({ triggerEvent, emit }) => {
    emit({
      name: 'agent-output',
      payload: { reply: `Echo: ${triggerEvent.payload.text}` },
    });
  })
  .produce({});
```

---

## Builder Chain

The builder follows a fluent pattern. Each method returns a new `AgentFactory` instance with updated type information.

### `AgentFactory.run()`

Entry point. Creates a fresh builder with no configuration.

```ts
const builder = AgentFactory.run();
```

### `.params(schema)`

Defines the parameter schema for the agent. Parameters are static configuration passed when producing the agent.

```ts
const builder = AgentFactory.run()
  .params(S.Struct({
    model: S.String,
    temperature: S.Number,
  }));
```

### `.listensTo(events)`

Declares which event types trigger this agent. Accepts an array of `AgentNetworkEventDef` instances. Can be called multiple times — events accumulate.

```ts
const builder = AgentFactory.run()
  .listensTo([eventA, eventB])
  .listensTo([eventC]); // now listens to A, B, and C
```

### `.emits(events)`

Declares which event types this agent can emit. Also accumulates across multiple calls.

```ts
const builder = AgentFactory.run()
  .emits([responseEvent, errorEvent]);
```

### `.logic(fn)`

The core handler. Receives a context object with:

- **`params`** — The resolved parameters passed to `.produce()`
- **`triggerEvent`** — The full event envelope `{ name, meta, payload }` that triggered the agent
- **`emit(event)`** — Function to emit events, typed to the declared `.emits()` events

```ts
.logic(async ({ params, triggerEvent, emit }) => {
  // params.model, params.temperature — fully typed
  // triggerEvent.payload.text — inferred from listensTo
  emit({
    name: 'agent-output',  // must match an emits() event
    payload: { reply: '...' },
  });
})
```

### `.produce(params)`

Finalizes the builder and returns an `Agent` instance ready for registration in a network. The `params` argument must match the schema defined in `.params()`.

```ts
const agent = AgentFactory.run()
  .params(S.Struct({ model: S.String }))
  .listensTo([inputEvent])
  .emits([outputEvent])
  .logic(async ({ params, triggerEvent, emit }) => {
    // params.model is typed as string
    emit({ name: 'agent-output', payload: { reply: params.model } });
  })
  .produce({ model: 'gpt-4o' });
```

---

## Type Safety

The builder provides end-to-end type inference:

1. **Trigger events** — `triggerEvent` in `.logic()` is typed as a union of all `listensTo` event envelopes
2. **Emit payloads** — The `emit()` function only accepts payloads matching declared `emits` events
3. **Parameters** — `params` in `.logic()` matches the schema from `.params()`

```ts
const eventA = AgentNetworkEvent.of('a', S.Struct({ x: S.Number }));
const eventB = AgentNetworkEvent.of('b', S.Struct({ y: S.String }));
const outEvent = AgentNetworkEvent.of('out', S.Struct({ result: S.String }));

AgentFactory.run()
  .listensTo([eventA, eventB])
  .emits([outEvent])
  .logic(async ({ triggerEvent, emit }) => {
    // triggerEvent is:
    //   { name: 'a', meta: EventMeta, payload: { x: number } }
    // | { name: 'b', meta: EventMeta, payload: { y: string } }

    emit({
      name: 'out',
      payload: { result: 'done' },
    });

    // TypeScript error: name 'invalid' not in emits
    // emit({ name: 'invalid', payload: {} });
  });
```

---

## Streaming Pattern

A common pattern for LLM-powered agents is to emit multiple events during streaming:

```ts
const streamingAgent = AgentFactory.run()
  .listensTo([requestEvent])
  .emits([responseEvent])
  .logic(async ({ triggerEvent, emit }) => {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [{ role: 'user', content: triggerEvent.payload.query }],
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        emit({
          name: 'response',
          payload: { text: content, isFinal: false },
        });
      }
    }

    emit({
      name: 'response',
      payload: { text: '', isFinal: true },
    });
  })
  .produce({});
```

---

## Catch-All Agents

If you omit `.listensTo()`, the agent receives **every event** on its subscribed channels. This is useful for logging, monitoring, or routing agents.

```ts
const loggerAgent = AgentFactory.run()
  .logic(async ({ triggerEvent }) => {
    console.log('Event received:', triggerEvent);
  })
  .produce({});
```
