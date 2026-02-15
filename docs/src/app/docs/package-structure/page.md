---
title: Package Structure
---

Learn about the @m4trix/core package structure and how it's organized to help you integrate AI capabilities into your applications. {% .lead %}



## Package Structure Overview

The @m4trix/core package is organized into multiple entry points, each serving a specific purpose. This structure allows for tree-shaking and efficient bundling.

### Entry Points

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

// Stream utilities — Composable stream processing
import { Pump, ensureFullWords } from '@m4trix/core/stream';

// React hooks — Framework integration
import { useConversation, useSocketConversation } from '@m4trix/core/react';

// UI components — Visual elements for AI interfaces
import { AiCursor } from '@m4trix/core/ui';
```

### Matrix (Primary)

The **Matrix** entry point is the core of the library. It provides:

- **AgentFactory** — Fluent builder for creating type-safe agents
- **AgentNetwork** — Orchestrator for wiring agents to channels
- **AgentNetworkEvent** — Schema-validated event definitions
- **Channels & Sinks** — Event routing with HTTP stream and Kafka sinks
- **NextEndpoint / ExpressEndpoint** — Framework adapters for exposing networks as APIs

See the [Matrix Overview](/docs/matrix/overview) for details.

### Stream Utilities

The `Pump` class provides composable stream processing with `map`, `filter`, `batch`, `bundle`, `rechunk`, and more. See [Pump](/docs/utilities/pump).

### React Hooks

Hooks for integrating AI streaming into React applications. `useConversation` handles SSE connections and state management.

### Bundle Formats

All entry points are available in both ESM and CommonJS formats, with TypeScript type definitions included. This ensures compatibility with various JavaScript environments and build systems.

### Tree-Shaking Benefits

This modular approach offers significant benefits:

- **Reduced Bundle Size**: Only the code you actually use gets included in your final bundle.
- **Improved Performance**: Smaller bundles lead to faster load times and better runtime performance.
- **Framework Flexibility**: You can use only the parts of the library that work with your chosen framework.
