---
title: Getting started
---

{% quick-links %}

{% quick-link title="Installation" icon="installation" href="/docs/installation" description="Install @m4trix/core and set up your project." /%}

{% quick-link title="Matrix Overview" icon="presets" href="/docs/matrix/overview" description="Understand the event-driven agent orchestration system." /%}

{% quick-link title="Agent Factory" icon="plugins" href="/docs/matrix/agent-factory" description="Build type-safe agents with the fluent builder API." /%}

{% quick-link title="IO & Adapters" icon="theming" href="/docs/matrix/io" description="Expose your network as an SSE API with Next.js or Express." /%}

{% /quick-links %}

{% callout type="warning" title="Alpha Release" %}
This project is currently in alpha. Features may change without notice and the API is not yet stable. We welcome your feedback! Please reach out via issues or email the maintainer directly at [pascal@stepsailor.com](mailto:pascal@stepsailor.com).
{% /callout %}

## Quick start

@m4trix/core provides a powerful, type-safe agent orchestration system. The **Matrix** module (`@m4trix/core/matrix`) is the primary entry point for building event-driven AI agent networks.

### Install

```shell
pnpm add @m4trix/core
```

### Build your first agent network

```ts
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
  NextEndpoint,
  S,
} from '@m4trix/core/matrix';

// 1. Define events
const requestEvent = AgentNetworkEvent.of(
  'user-request',
  S.Struct({ query: S.String }),
);

const responseEvent = AgentNetworkEvent.of(
  'agent-response',
  S.Struct({ answer: S.String, done: S.Boolean }),
);

// 2. Create an agent
const myAgent = AgentFactory.run()
  .listensTo([requestEvent])
  .emits([responseEvent])
  .logic(async ({ triggerEvent, emit }) => {
    emit({
      name: 'agent-response',
      payload: {
        answer: `You asked: ${triggerEvent.payload.query}`,
        done: true,
      },
    });
  })
  .produce({});

// 3. Wire the network
const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());
    registerAgent(myAgent).subscribe(main).publishTo(client);
  },
);

// 4. Expose as an API
const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'user-request',
});

export const GET = NextEndpoint.from(api).handler();
```

### What's happening here?

1. **Events** define the typed messages flowing through your system
2. **AgentFactory** builds an agent that listens for requests and emits responses
3. **AgentNetwork** wires the agent to channels — a main channel for input, a client channel for output
4. **expose()** turns the network into an SSE-streaming HTTP endpoint
5. **NextEndpoint** adapts it for Next.js App Router

### Next steps

- [Matrix Overview](/docs/matrix/overview) — Understand the architecture
- [Agent Factory](/docs/matrix/agent-factory) — Deep dive into building agents
- [Agent Network](/docs/matrix/agent-network) — Multi-agent patterns and wiring
- [Events & Channels](/docs/matrix/events-and-channels) — Typed events and routing
- [IO & Adapters](/docs/matrix/io) — HTTP APIs with Next.js and Express
