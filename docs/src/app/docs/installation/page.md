---
title: Installation
nextjs:
  metadata:
    title: Installation
    description: How to install and get started with @m4trix/core
---

## Installation

You can install @m4trix/core using npm, yarn, or pnpm:

```bash
# Using pnpm (recommended)
pnpm add @m4trix/core

# Using npm
npm install @m4trix/core

# Using yarn
yarn add @m4trix/core
```

---

## Entry Points

@m4trix/core is organized into multiple entry points. Import only what you need:

```typescript
// Matrix — Event-driven agent orchestration (primary)
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
  NextEndpoint,
  ExpressEndpoint,
  S,
} from '@m4trix/core/matrix';

// Stream utilities
import { Pump } from '@m4trix/core/stream';

// React hooks
import { useConversation } from '@m4trix/core/react';
```

The **Matrix** module is the primary entry point. It provides the full agent orchestration system including typed events, agent factories, network wiring, and HTTP adapters.

---

## Peer Dependencies

Matrix uses [Effect](https://effect.website/) for schema validation and concurrency. It's included as a dependency — no additional setup needed.

---

## Quick Example: Streaming Agent API

Here's a complete Next.js API route with a streaming agent:

```typescript
// app/api/chat/route.ts
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
  NextEndpoint,
  S,
} from '@m4trix/core/matrix';

const request = AgentNetworkEvent.of(
  'chat-request',
  S.Struct({ message: S.String }),
);

const response = AgentNetworkEvent.of(
  'chat-response',
  S.Struct({ text: S.String }),
);

const agent = AgentFactory.run()
  .listensTo([request])
  .emits([response])
  .logic(async ({ triggerEvent, emit }) => {
    emit({
      name: 'chat-response',
      payload: { text: `Echo: ${triggerEvent.payload.message}` },
    });
  })
  .produce({});

const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());
    registerAgent(agent).subscribe(main).publishTo(client);
  },
);

const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'chat-request',
});

export const GET = NextEndpoint.from(api).handler();
export const POST = NextEndpoint.from(api).handler();
```

For more details, see the [Matrix Overview](/docs/matrix/overview) or jump straight to the [Agent Factory](/docs/matrix/agent-factory) docs.
