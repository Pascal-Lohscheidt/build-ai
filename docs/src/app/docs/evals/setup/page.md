---
title: Evals Setup
nextjs:
  metadata:
    title: Evals Setup
    description: Install, configure, and run @m4trix/evals with config and CLI commands
---

## Installation

```bash
pnpm add @m4trix/evals
```

## File conventions

Create files under your project (for example, `src/evals/`) with these suffixes:

- `*.dataset.ts` — Dataset definitions
- `*.evaluator.ts` — Evaluator definitions
- `*.test-case.ts` — Test case definitions

## Config file

Optional: create `m4trix-eval.config.ts` at your project root to customize discovery and output paths.

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

### Config options

| Key | Description |
|-----|-------------|
| `discovery.rootDir` | Root directory for file discovery (default: `process.cwd()`) |
| `discovery.datasetFilePatterns` | Suffixes for dataset files (e.g. `['.dataset.ts']`) |
| `discovery.evaluatorFilePatterns` | Suffixes for evaluator files |
| `discovery.testCaseFilePatterns` | Suffixes for test case files |
| `discovery.excludeDirectories` | Directories to exclude from discovery |
| `artifactDirectory` | Where to write eval results (default: `.eval-results`) |

You can also use `datasetSuffixes`, `evaluatorSuffixes`, and `testCaseSuffixes` instead of `*FilePatterns`.

### Config precedence

1. Built-in defaults
2. `m4trix-eval.config.ts` (loaded from `process.cwd()`)
3. Explicit `createRunner({...})` overrides

## CLI commands

| Command | Description |
|---------|-------------|
| `eval-agents` | Interactive CLI |
| `eval-agents-simple run --dataset "<name or pattern>" --evaluator "<name or pattern>"` | Run evals |
| `eval-agents-simple generate --dataset "<dataset name>"` | Generate `.cases.json` from test cases |

### Examples

Run with exact names:

```bash
eval-agents-simple run --dataset "Demo Dataset" --evaluator "Demo Score Evaluator"
```

Run with patterns:

```bash
eval-agents-simple run --dataset "*Demo*" --evaluator "*Score*"
```

Generate dataset cases:

```bash
eval-agents-simple generate --dataset "Demo Dataset"
```

### npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "eval:run": "eval-agents-simple run --dataset \"Demo Dataset\" --evaluator \"*Demo*\"",
    "eval:generate": "eval-agents-simple generate --dataset \"Demo Dataset\""
  }
}
```

## Default discovery

Without a config file, the runner uses `process.cwd()` as the discovery root and scans for:

- Datasets: `.dataset.ts`, `.dataset.tsx`, `.dataset.js`, `.dataset.mjs`
- Evaluators: `.evaluator.ts`, `.evaluator.tsx`, `.evaluator.js`, `.evaluator.mjs`
- Test cases: `.test-case.ts`, `.test-case.tsx`, `.test-case.js`, `.test-case.mjs`

Results are written to `.eval-results`.
