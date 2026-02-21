# Eval Harness

Use `@m4trix/evals` to define datasets, test cases, and evaluators for repeatable AI evaluation runs.

## Location

```
examples/evals-example/
```

## How It Works

1. **Dataset** — Groups test cases by tags and/or file paths
2. **Test Case** — Defines input/output pairs (e.g. prompt + expected score threshold)
3. **Evaluator** — Applies scoring logic to each test case
4. **CLI Run** — Execute with `eval-agents-simple run --dataset "..." --evaluator "..."`

## Setup

```bash
pnpm add @m4trix/evals
```

Create files with suffixes:

- `*.dataset.ts` — Dataset definitions
- `*.evaluator.ts` — Evaluator definitions
- `*.test-case.ts` — Test case definitions

## Run Evals

```bash
eval-agents-simple run --dataset "Demo Dataset" --evaluator "Demo Score Evaluator"
```

With patterns:

```bash
eval-agents-simple run --dataset "*Demo*" --evaluator "*Score*"
```

## Key Files in evals-example

- `src/evals/demo.dataset.ts` — Dataset with `includedTags: ['demo']`
- `src/evals/demo.evaluator.ts` — Evaluators (score, length, multi-score, diff)
- `src/evals/demo.test-case.ts` — Test cases with prompts and expected outputs
- `m4trix-eval.config.ts` — Discovery and artifact paths

## Config

Optional `m4trix-eval.config.ts` at project root:

```ts
import { defineConfig, type ConfigType } from '@m4trix/evals';

export default defineConfig((): ConfigType => ({
  discovery: {
    rootDir: 'src/evals',
    datasetFilePatterns: ['.dataset.ts'],
    evaluatorFilePatterns: ['.evaluator.ts'],
    testCaseFilePatterns: ['.test-case.ts'],
    excludeDirectories: ['node_modules', 'dist'],
  },
  artifactDirectory: 'src/evals/.eval-results',
}));
```

## Next

- [Testing Guide](../guides/testing.md)
- [@m4trix/evals](https://github.com/Pascal-Lohscheidt/m4trix) package docs
