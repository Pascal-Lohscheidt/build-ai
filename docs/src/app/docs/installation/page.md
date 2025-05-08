---
title: Installation
nextjs:
  metadata:
    title: Installation
    description: How to install and get started with Sunken Trove
---

## Installation





You can install the Sunken Trove library using npm, yarn, or pnpm:

```bash
# Using npm
npm install build-ai

# Using yarn
yarn add build-ai

# Using pnpm
pnpm add build-ai
```

---

## Usage

Sunken Trove provides multiple entry points for different functionality:

```typescript
// Main package
import { /* core features */ } from 'build-ai';

// Stream utilities
import { Pump } from 'build-ai/stream';

// UI components
import { /* UI components */ } from 'build-ai/ui';
```

## Example: Using the Pump Stream Processor

The `Pump` class provides a powerful way to process streaming data through composable operations:

```typescript
import { Pump } from 'build-ai/stream';

// Create a simple async source
async function* generateNumbers() {
  for (let i = 0; i < 10; i++) {
    yield i;
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
  }
}

// Create a Pump from the source
const pump = Pump.from(generateNumbers());

// Process the stream: filter even numbers and double them
pump
  .filter(num => num % 2 === 0)       // Keep only even numbers
  .map(num => ({ value: num * 2 }))   // Double and wrap in object
  .onChunk(data => console.log('Processing:', data.value))
  .drain()                           // Consume the stream
  .then(() => console.log('Stream processing complete'));

// Output:
// Processing: 0
// Processing: 4
// Processing: 8
// Processing: 12
// Processing: 16
// Stream processing complete
```

For more advanced usage examples, check out the [Stream Processing documentation](/docs/stream-processing) or the API reference for each module.
