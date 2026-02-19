---
title: Test Case
nextjs:
  metadata:
    title: Test Case
    description: Define input/output pairs for AI evaluation
---

Test cases define the input and output pairs used during evaluation. Each test case has a name, tags, and typed input/output.

## Basic usage

```ts
import { S, TestCase } from '@m4trix/evals';

const inputSchema = S.Struct({ prompt: S.String });
const outputSchema = S.Struct({ expectedMinScore: S.Number });

export const shortPromptCase = TestCase.describe({
  name: 'Summarize product description for search',
  tags: ['demo', 'short'],
  inputSchema,
  input: { prompt: 'Hello from evals example' },
  outputSchema,
  output: { expectedMinScore: 40 },
});
```

## API

### `TestCase.describe(config)`

| Property | Description |
|----------|-------------|
| `name` | Display name for the test case |
| `tags` | Tags used by datasets for inclusion/exclusion |
| `inputSchema` | Effect schema for the input |
| `input` | Input value or `() => value` builder |
| `outputSchema` | Optional Effect schema for the output |
| `output` | Optional output value or `() => value` builder |

### Input and output

Both `input` and `output` can be:

- A plain value: `input: { prompt: 'Hello' }`
- A builder function: `input: () => ({ prompt: fetchPrompt() })`

Use builders when you need dynamic or lazy values.

## Tags

Tags are used by datasets to filter which test cases are included. A dataset with `includedTags: ['demo']` will include any test case that has the `demo` tag.

```ts
export const greetingCase = TestCase.describe({
  name: 'Extract key entities from news article',
  tags: ['demo', 'greeting'],
  inputSchema,
  input: { prompt: 'Hey there!' },
  outputSchema,
  output: { expectedMinScore: 35 },
});
```

## Full example

```ts
import { S, TestCase } from '@m4trix/evals';

const inputSchema = S.Struct({ prompt: S.String });
const outputSchema = S.Struct({ expectedMinScore: S.Number });

export const shortPromptCase = TestCase.describe({
  name: 'Summarize product description for search',
  tags: ['demo', 'short'],
  inputSchema,
  input: { prompt: 'Hello from evals example' },
  outputSchema,
  output: { expectedMinScore: 40 },
});

export const longPromptCase = TestCase.describe({
  name: 'Classify customer support ticket intent',
  tags: ['demo', 'long'],
  inputSchema,
  input: {
    prompt:
      'This is a longer fake prompt to demonstrate score differences in a tiny example project.',
  },
  outputSchema,
  output: { expectedMinScore: 55 },
});

export const codingPromptCase = TestCase.describe({
  name: 'Explain coding concept with examples',
  tags: ['demo', 'coding'],
  inputSchema,
  input: {
    prompt:
      'Explain the difference between unit tests, integration tests, and end-to-end tests with examples.',
  },
  outputSchema,
  output: { expectedMinScore: 65 },
});
```
