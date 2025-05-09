---
title: What is Streaming in AI Development
nextjs:
  metadata:
    title: What is Streaming in AI Development
    description: Understanding how streaming works in AI and how build-ai optimizes streaming
---

## Understanding Streaming

Streaming in AI development is the process of processing and sending data incrementally rather than waiting for the entire response:

- Data arrives in chunks (text, audio, etc.) as it's generated
- Reduces perceived latency for users
- Enables real-time interactions with AI systems


## The Pump Interface

build-ai solves streaming challenges with the `Pump` interface from `build-ai/stream`:

```typescript
// Example from route.ts - next.js
export async function POST(req: NextRequest) {
  const transcript = await transcribeFormData(formData);
  const agentStream = await runLangAgent(transcript);
  
  return await Pump
    .from(agentStream)
    .filter(shouldChunkBeStreamed)
    .rechunk(ensureFullWords)
    .onChunk(logChunk)
    .drainTo(httpStreamResponse());
}
```

The Pump provides a fluent API for transforming streams with operations like:

- `filter`: Remove unwanted chunks
- `map`: Transform chunks from one format to another
- `bundle`: Combine small chunks for efficiency
- `rechunk`: Ensure chunks break at logical points
- `drainTo`: Deliver processed chunks to the destination

This approach simplifies complex streaming logic while maintaining high performance.
