---
title: Agent Network
nextjs:
  metadata:
    title: Agent Network – Orchestrating Agents
    description: Wire agents, channels, and the event plane together with AgentNetwork.setup().
---

The `AgentNetwork` is the orchestrator. It wires agents to channels, manages the event plane, and provides the runtime that routes events between agents. {% .lead %}

---

## Setting Up a Network

Use `AgentNetwork.setup()` with a callback that receives the setup context:

```ts
import { AgentNetwork } from '@m4trix/core/matrix';

const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent, spawner }) => {
    // Define channels
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());

    // Register agents
    registerAgent(myAgent).subscribe(main).publishTo(client);
  },
);
```

---

## Setup Context

The callback receives a `SetupContext` with these tools:

### `mainChannel(name)`

Creates and designates a channel as the **main channel**. This is where start events are published when the network is exposed as an API. Every network should have exactly one main channel.

```ts
const main = mainChannel('main');
```

### `createChannel(name)`

Creates an additional named channel. Channel names must be kebab-case (e.g. `'client'`, `'processing-output'`).

```ts
const client = createChannel('client');
const analytics = createChannel('analytics');
```

### `sink`

Provides sink factories for channels. Sinks determine how events leave the system.

```ts
// HTTP streaming (for SSE to browsers)
const client = createChannel('client').sink(sink.httpStream());

// Kafka (for event-driven backends)
const events = createChannel('events').sink(sink.kafka({ topic: 'events' }));
```

### `registerAgent(agent)`

Registers an agent and returns a binding builder:

```ts
registerAgent(myAgent)
  .subscribe(main)        // Listen to the 'main' channel
  .publishTo(client);     // Emit events to the 'client' channel
```

An agent can subscribe to **multiple channels** and publish to **multiple channels**:

```ts
registerAgent(routerAgent)
  .subscribe(main)
  .subscribe(feedback)
  .publishTo(client)
  .publishTo(analytics);
```

### `spawner`

Creates a spawner for dynamically creating agents at runtime. Useful for multi-tenant or on-demand agent creation.

```ts
spawner(AgentFactory)
  .listen(main, spawnEvent)
  .registry({ analyst: analystFactory, writer: writerFactory })
  .defaultBinding(({ kind }) => ({
    subscribe: ['main'],
    publishTo: ['client'],
  }))
  .onSpawn(({ kind, factory, payload, spawn }) => {
    const agent = factory.produce(payload.params);
    spawn(agent);
    return agent;
  });
```

---

## Multi-Agent Patterns

### Agent Chain

Events flow through a series of agents, each transforming and forwarding:

```ts
const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const processing = createChannel('processing');
    const client = createChannel('client').sink(sink.httpStream());

    // Request → Planner → Executor → Client
    registerAgent(plannerAgent).subscribe(main).publishTo(processing);
    registerAgent(executorAgent).subscribe(processing).publishTo(client);
  },
);
```

### Fan-Out

One event triggers multiple agents in parallel:

```ts
registerAgent(agentA).subscribe(main).publishTo(client);
registerAgent(agentB).subscribe(main).publishTo(client);
registerAgent(agentC).subscribe(main).publishTo(client);
```

### Multi-Channel Routing

Different agents handle different event types on different channels:

```ts
const main = mainChannel('main');
const internal = createChannel('internal');
const client = createChannel('client').sink(sink.httpStream());

registerAgent(routerAgent).subscribe(main).publishTo(internal);
registerAgent(workerAgent).subscribe(internal).publishTo(client);
registerAgent(loggerAgent).subscribe(main).subscribe(internal);
```

---

## Running the Network

### Programmatic Run

For direct usage (e.g. in tests or scripts), the network runs inside an Effect scope:

```ts
import { Effect, Scope } from 'effect';

await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const plane = yield* network.run();
      // publish events, wait for results...
    }),
  ),
);
```

### HTTP API (recommended)

For most use cases, expose the network as an HTTP API instead:

```ts
const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'user-request',
});

// Next.js
const handler = NextEndpoint.from(api).handler();
export const GET = handler;
export const POST = handler;
```

See [IO & Adapters](/docs/matrix/io) for full details.

---

## Accessors

The network exposes useful getters for inspection and testing:

```ts
network.getChannels();            // Map<ChannelName, ConfiguredChannel>
network.getMainChannel();         // ConfiguredChannel | undefined
network.getAgentRegistrations();  // Map<string, AgentRegistration>
network.getSpawnerRegistrations(); // ReadonlyArray<SpawnerRegistration>
```
