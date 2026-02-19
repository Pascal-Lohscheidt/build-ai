---
title: Evals Overview
nextjs:
  metadata:
    title: Evals Overview
    description: Define datasets, test cases, and evaluators for repeatable AI evaluation runs
---

`@m4trix/evals` helps you define datasets, test cases, and evaluators for repeatable AI evaluation runs.

{% quick-links %}

{% quick-link title="Setup" icon="installation" href="/docs/evals/setup" description="Install, configure, and run evals with config and CLI commands." /%}

{% quick-link title="Evaluator" icon="plugins" href="/docs/evals/evaluator" description="Define scoring logic for your test cases." /%}

{% quick-link title="Test Case" icon="presets" href="/docs/evals/test-case" description="Define input/output pairs for evaluation." /%}

{% quick-link title="Dataset" icon="theming" href="/docs/evals/dataset" description="Group test cases by tags and paths." /%}

{% /quick-links %}

## How it works

```mermaid
flowchart LR
  Dataset[Dataset]
  TestCase[Test Case]
  Evaluator[Evaluator]
  Run[CLI Run]
  Dataset --> TestCase
  TestCase --> Evaluator
  Evaluator --> Run
```

1. **Dataset** — Groups test cases by tags and/or file paths
2. **Test Case** — Defines input/output pairs (e.g. prompt + expected score threshold)
3. **Evaluator** — Applies scoring logic to each test case
4. **CLI Run** — Execute evals with `eval-agents-simple run --dataset "..." --evaluator "..."`

## Next steps

- [Setup](/docs/evals/setup) — Installation, config file, and CLI commands
- [Evaluator](/docs/evals/evaluator) — Building evaluators with schemas and metrics
- [Test Case](/docs/evals/test-case) — Defining test cases with tags
- [Dataset](/docs/evals/dataset) — Configuring datasets with tag and path filters
