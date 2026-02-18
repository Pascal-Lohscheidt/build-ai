[![CircleCI](https://dl.circleci.com/status-badge/img/gh/Pascal-Lohscheidt/build-ai/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/Pascal-Lohscheidt/build-ai/tree/main)
[![npm version](https://img.shields.io/npm/v/@m4trix%2Fevals)](https://www.npmjs.com/package/@m4trix/evals)
[![license](https://img.shields.io/npm/l/@m4trix%2Fevals)](https://www.npmjs.com/package/@m4trix/evals)

# @m4trix/evals

`@m4trix/evals` helps you define datasets, test cases, and evaluators for repeatable AI evaluation runs.

## Quick Start

From the repository root:

```bash
pnpm install
pnpm run evals:build
```

Run the bundled example project:

```bash
cd examples/evals-example
pnpm run eval:run
```

Generate a dataset case file from the example:

```bash
pnpm run eval:generate
```

## Set Up Your First Eval

Create files under your project (for example, `src/evals/`) with these suffixes:

- `*.dataset.ts`
- `*.evaluator.ts`
- `*.test-case.ts`

### 1) Dataset

```ts
import { Dataset } from '@m4trix/evals';

export const myDataset = Dataset.define({
  name: 'My Dataset',
  includedTags: ['demo'],
});
```

### 2) Evaluator

```ts
import { Evaluator, latencyMetric, percentScore, tokenCountMetric } from '@m4trix/evals';
import { Schema as S } from 'effect';

const inputSchema = S.Struct({ prompt: S.String });

export const myEvaluator = Evaluator.define({
  name: 'My Evaluator',
  inputSchema,
  outputSchema: S.Unknown,
  scoreSchema: S.Struct({ scores: S.Array(S.Unknown) }),
}).evaluate(async (input) => {
  const start = Date.now();
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

### 3) Test Case

```ts
import { TestCase } from '@m4trix/evals';
import { Schema as S } from 'effect';

export const myTestCase = TestCase.describe({
  name: 'my test case',
  tags: ['demo'],
  inputSchema: S.Struct({ prompt: S.String }),
  input: { prompt: 'Hello from my first eval' },
});
```

### 4) Run

```bash
eval-agents-simple run --dataset "My Dataset" --evaluator "My Evaluator"
```

You can also use patterns:

```bash
eval-agents-simple run --dataset "*My*" --evaluator "*My*"
```

## CLI Commands

- `eval-agents`: interactive CLI
- `eval-agents-simple run --dataset "<name or pattern>" --evaluator "<name or pattern>"`
- `eval-agents-simple generate --dataset "<dataset name>"`

## Default Discovery and Artifacts

By default, the runner uses `process.cwd()` as discovery root and scans for:

- Datasets: `.dataset.ts`, `.dataset.tsx`, `.dataset.js`, `.dataset.mjs`
- Evaluators: `.evaluator.ts`, `.evaluator.tsx`, `.evaluator.js`, `.evaluator.mjs`
- Test cases: `.test-case.ts`, `.test-case.tsx`, `.test-case.js`, `.test-case.mjs`

Results are written to `.eval-results`.

## License

MIT
