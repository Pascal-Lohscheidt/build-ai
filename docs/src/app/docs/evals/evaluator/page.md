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
- `logDiff` — Callback to record expected vs actual diffs (stored in run artifact, shown by CLI)
- `log` — Callback to log messages or objects (stored in run artifact, shown by CLI)

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

## Showing expected vs actual with logDiff

Use `logDiff` (passed to your evaluate function) to record diffs between expected and actual output. Diffs are stored in the run artifact (JSONL) and displayed by the eval CLI for failed evaluators:

```ts
import { Evaluator, S, percentScore } from '@m4trix/evals';

const outputSchema = S.Struct({ expectedResponse: S.String });

export const diffEvaluator = Evaluator.use({
  name: 'noop',
  resolve: () => ({}),
})
  .define({
    name: 'Diff Evaluator',
    inputSchema: S.Struct({ prompt: S.String }),
    outputSchema,
    scoreSchema: S.Struct({ scores: S.Array(S.Unknown) }),
  })
  .evaluate(async ({ input, output, logDiff }) => {
    const expected = output?.expectedResponse;
    const actual = await fetchModelOutput(input.prompt); // Your LLM/system call

    const matches = actual === expected;
    if (!matches && expected) {
      logDiff(expected, actual);
    }

    return {
      scores: [
        percentScore.make(
          { value: matches ? 100 : 0 },
          { definePassed: (d) => d.value >= 80 },
        ),
      ],
      metrics: [],
    };
  });
```

`logDiff(expected, actual, options?)` accepts objects or strings. The diff uses [json-diff](https://www.npmjs.com/package/json-diff), so object property order is ignored—only actual value differences are shown. The diff is stored as plain text in the run artifact.

You can customize the diff via options:

```ts
logDiff(expected, actual, { label: 'response', sort: true });
```

| Option | Description |
|--------|-------------|
| `label` | Label for the diff entry |
| `sort` | Sort array elements before comparing |
| `full` | Include unchanged sections, not just deltas |
| `keysOnly` | Compare only keys, ignore values |
| `outputKeys` | Always show these keys when parent has changes |
| `excludeKeys` | Exclude keys from comparison |
| `precision` | Round floats to N decimals before comparing |

For ad-hoc debugging, use `printJsonDiff` from `@m4trix/evals` to print a colorized diff to stdout.

## Logging with log

Use `log` (passed to your evaluate function) to record messages or objects for failed evaluators. Logs are stored in the run artifact and displayed by the CLI alongside diffs:

```ts
.evaluate(async ({ input, output, log, logDiff }) => {
  const result = await fetchModelOutput(input.prompt);
  if (!matches) {
    log({ prompt: input.prompt, result }, { label: 'debug' });
    logDiff(expected, result);
  }
  return { scores: [...] };
});
```

`log(message, options?)` accepts strings or objects (objects are pretty-printed as JSON). Use it to capture context when a test fails.

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
