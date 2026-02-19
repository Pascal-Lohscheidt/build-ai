---
title: Evaluator
nextjs:
  metadata:
    title: Evaluator
    description: Define scoring logic for AI evaluation test cases
---

Evaluators define the scoring logic applied to each test case. They receive input, optional output, and return scores and metrics.

## Basic usage

```ts
import {
  Evaluator,
  S,
  latencyMetric,
  percentScore,
  tokenCountMetric,
} from '@m4trix/evals';

const inputSchema = S.Struct({ prompt: S.String });

export const myEvaluator = Evaluator.define({
  name: 'My Evaluator',
  inputSchema,
  outputSchema: S.Unknown,
  scoreSchema: S.Struct({ scores: S.Array(S.Unknown) }),
}).evaluate(async ({ input, output }) => {
  const start = Date.now();
  // ... scoring logic ...
  const latencyMs = Date.now() - start;

  return {
    scores: [
      percentScore.make({ value: 85 }, { definePassed: (d) => d.value >= 50 }),
    ],
    metrics: [
      tokenCountMetric.make({
        input: input.prompt.length,
        output: input.prompt.length,
        inputCached: 0,
        outputCached: 0,
      }),
      latencyMetric.make({ ms: latencyMs }),
    ],
  };
});
```

## API

### `Evaluator.define(config)`

Defines an evaluator with typed schemas:

| Property | Description |
|----------|-------------|
| `name` | Display name for the evaluator |
| `inputSchema` | Effect schema for test case input |
| `outputSchema` | Effect schema for test case output (optional) |
| `scoreSchema` | Effect schema for the returned score object |

### `.evaluate(fn)`

Attaches the scoring function. The function receives:

- `input` — Validated test case input
- `output` — Validated test case output (if defined)
- `ctx` — Resolved context from middlewares (if any)

It must return an object with:

- `scores` — Array of score items (e.g. from `percentScore.make`, `binaryScore.make`)
- `metrics` — Array of metric items (e.g. from `tokenCountMetric.make`, `latencyMetric.make`)

## Middleware (context)

Use `Evaluator.use({ name, resolve })` to inject context (e.g. seed, API keys):

```ts
export const demoScoreEvaluator = Evaluator.use({
  name: 'withSeed',
  resolve: () => ({ seed: 7 }),
})
  .define({
    name: 'Demo Score Evaluator',
    inputSchema,
    outputSchema: S.Unknown,
    scoreSchema: S.Struct({ scores: S.Array(S.Unknown) }),
  })
  .evaluate(async ({ input, ctx, output }) => {
    // ctx.seed is available
    const rawScore = (promptHash + input.prompt.length * ctx.seed) % 101;
    // ...
  });
```

## Built-in scores and metrics

| Score | Description |
|-------|-------------|
| `percentScore` | 0–100 score with optional pass threshold |
| `binaryScore` | Pass/fail score |

| Metric | Description |
|--------|-------------|
| `tokenCountMetric` | Input/output token counts |
| `latencyMetric` | Latency in milliseconds |

## Full example

```ts
import {
  Evaluator,
  S,
  latencyMetric,
  percentScore,
  tokenCountMetric,
} from '@m4trix/evals';

const inputSchema = S.Struct({ prompt: S.String });

export const demoScoreEvaluator = Evaluator.use({
  name: 'withSeed',
  resolve: () => ({ seed: 7 }),
})
  .define({
    name: 'Demo Score Evaluator',
    inputSchema,
    outputSchema: S.Unknown,
    scoreSchema: S.Struct({ scores: S.Array(S.Unknown) }),
  })
  .evaluate(async ({ input, ctx, output }) => {
    const start = Date.now();
    const expectedMinScore =
      typeof output === 'object' &&
      output !== null &&
      'expectedMinScore' in output
        ? (output as { expectedMinScore?: number }).expectedMinScore
        : undefined;
    const rawScore =
      (Array.from(input.prompt).reduce((s, c) => s + c.charCodeAt(0), 0) +
        input.prompt.length * ctx.seed) %
      101;
    const value = Math.max(8, Math.min(100, rawScore));
    const latencyMs = Date.now() - start;

    return {
      scores: [
        percentScore.make(
          { value },
          { definePassed: (d) => d.value >= (expectedMinScore ?? 50) },
        ),
      ],
      metrics: [
        tokenCountMetric.make({
          input: input.prompt.length * 2,
          output: Math.floor(input.prompt.length * 1.5),
          inputCached: 0,
          outputCached: 0,
        }),
        latencyMetric.make({ ms: latencyMs }),
      ],
    };
  });
```
