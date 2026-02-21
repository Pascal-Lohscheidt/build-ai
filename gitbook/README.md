---
icon: chess-pawn-piece
---

# What is m4trix?

**m4trix** is a TypeScript library for building event-driven, type-safe AI agent networks — from a single agent to full multi-agent workflows, with built-in SSE streaming and framework adapters.

> **Alpha Release** — This project is in alpha. The API may change. Feedback welcome via [issues](https://github.com/Pascal-Lohscheidt/m4trix/issues) or [pascal@stepsailor.com](mailto:pascal@stepsailor.com).

## Architecture at a Glance

```text
HTTP Request
    │
    ▼
┌─────────────────────┐
│   expose() / API    │  ← Auth, payload extraction
└────────┬────────────┘
         │ start event
         ▼
┌─────────────────────┐
│    Main Channel     │  ← Events enter here
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│      Agent(s)       │  ← Logic runs, emits new events
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Client Channel    │  ← sink: httpStream()
└────────┬────────────┘
         │ SSE
         ▼
      Browser
```

## When to Use m4trix

- **Use it when** you want event-driven AI orchestration with full TypeScript inference, composable agents, and framework-agnostic HTTP APIs (Next.js, Express).
- **Use it when** you need typed events, schema validation, multi-agent patterns (chains, fan-out, routing), and SSE streaming out of the box.
- **Use it when** you prefer loose coupling and composability over rigid graph structures.

## When Not to Use m4trix

- **Avoid** if you need a visual workflow builder or drag-and-drop orchestration.
- **Avoid** if you require non-TypeScript runtimes or languages.
- **Avoid** if you need real-time WebSocket bidirectional streaming (m4trix focuses on SSE request→stream response).

## Golden Paths

1. **[Install](getting-started/install.md)** — Get `@m4trix/core` and run your first agent in under 10 minutes.
2. **[Hello World](getting-started/hello-world.md)** — Copy/paste a minimal example and see it run.
3. **[Concepts: Events & Channels](concepts/events.md)** — Understand the mental model before building more.
