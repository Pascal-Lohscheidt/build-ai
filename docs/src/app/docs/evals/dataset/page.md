---
title: Dataset
nextjs:
  metadata:
    title: Dataset
    description: Group test cases by tags and paths for evaluation
---

Datasets group test cases for evaluation runs. They filter test cases by tags and/or file paths.

## Basic usage

```ts
import { Dataset } from '@m4trix/evals';

export const demoDataset = Dataset.define({
  name: 'Demo Dataset',
  includedTags: ['demo'],
});
```

## API

### `Dataset.define(config)`

| Property | Description |
|----------|-------------|
| `name` | Display name for the dataset |
| `includedTags` | Tags that test cases must have (string or RegExp) |
| `excludedTags` | Tags that exclude a test case |
| `includedPaths` | File path patterns that must match (glob) |
| `excludedPaths` | File path patterns that exclude a test case |

### Tag matching

- **String**: Exact match — `'demo'` matches only the tag `demo`
- **RegExp**: Pattern match — `/^demo-/` matches `demo-short`, `demo-long`, etc.

### Path matching

- **Glob**: e.g. `**/demo/**` matches any file under a `demo` directory
- **RegExp**: Custom pattern for file paths

## Filtering logic

A test case is included if:

1. It is not excluded by `excludedTags` or `excludedPaths`
2. It matches `includedTags` (or `includedTags` is empty)
3. It matches `includedPaths` (or `includedPaths` is empty)

## Examples

### By tags only

```ts
export const demoDataset = Dataset.define({
  name: 'Demo Dataset',
  includedTags: ['demo'],
});
```

### By tags and paths

```ts
export const productionDataset = Dataset.define({
  name: 'Production Evals',
  includedTags: ['production'],
  includedPaths: ['**/evals/production/**'],
  excludedTags: ['skip'],
});
```

### Excluding certain cases

```ts
export const smokeDataset = Dataset.define({
  name: 'Smoke Tests',
  includedTags: ['smoke'],
  excludedTags: ['flaky'],
});
```

## Generate cases file

Use `eval-agents-simple generate --dataset "<dataset name>"` to produce a `.cases.json` file. This exports the dataset's test cases (name + input) for use in external tools or CI.

```bash
eval-agents-simple generate --dataset "Demo Dataset"
```

This creates `demo.dataset.cases.json` (or similar) next to your dataset file.
