---
title: Package Structure
---

Learn about the build-ai package structure and how it's organized to help you integrate AI capabilities into your applications. {% .lead %}



## Package Structure Overview

The build-ai package is organized into multiple entry points, each serving a specific purpose in the AI integration workflow. This structure allows for tree-shaking and more efficient bundling in your applications.

### Entry Points

build-ai exposes the following entry points at the moment:

```typescript
// UI components - Visual elements for AI interfaces
import { AiCursor } from 'build-ai/ui';

// Stream utilities - Tools for handling streaming data
import { Pump, ensureFullWords } from 'build-ai/stream';

// React hooks - React-specific integration
import { useConversation, useSocketConversation } from 'build-ai/react';

// API utilities - Communication with AI services
import { SocketIoFactory } from 'build-ai/api';
```

Each entry point serves a specific purpose: UI components for interfaces, stream utilities for data processing, React hooks for framework integration, and API utilities for service communication. This modular design lets you import only what you need, reducing bundle size and improving performance.

### Bundle Formats

All entry points are available in both ESM and CommonJS formats, with TypeScript type definitions included. This ensures compatibility with various JavaScript environments and build systems.

### Tree-Shaking Benefits

This modular approach offers significant benefits:

- **Reduced Bundle Size**: Only the code you actually use gets included in your final bundle.
- **Improved Performance**: Smaller bundles lead to faster load times and better runtime performance.
- **Framework Flexibility**: You can use only the parts of the library that work with your chosen framework.
