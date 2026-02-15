---
title: Managing Context with TransformMessages
nextjs:
  metadata:
    title: Managing Context with TransformMessages
    description: Slice, filter, and format LangGraph chat messages safely using the TransformMessages helper.
---

Transforming and pruning your chat history is a common requirement when building **LangGraph**-powered agents.  
The `TransformMessages` helper provides a fluent, functional API for filtering, windowing, and formatting `BaseMessage` arrays while taking extra care not to break _tool-call_ sequences.

---

## Why use `TransformMessages`?

* Keep prompts under the model's context window by **safely slicing** the last _n_ messages.
* **Filter** by role (`Human`, `AI`, `Tool`) or by custom `tags` you attach to the messages.
* Convert the window into different **formats** (concise, verbose, JSON, redacted …) before feeding it back into the graph.
* Chainable, lazy API built on [`effect`](https://effect.website/) ‑ run the pipeline only when you need the result.

---

## Basic workflow

```ts
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { TransformMessages, FormatType, MessageFilterType } from "@m4trix/core/helper";

async function demo() {
  const messages = [
    new HumanMessage("Hello, world!"),
    new AIMessage("Hi there 👋"),
    new ToolMessage("get_weather", "It's sunny ☀️"),
  ];

  // Grab the last two messages
  const lastTwo = await TransformMessages.from(messages)
    .last(2)
    .toArray();

  console.log(lastTwo);
}

demo();
```

The same pipeline can be embedded in a LangGraph node:

```ts
import { NodeHandler } from "langgraph";
import { Effect } from "effect";

export const limitContext: NodeHandler = async (state) => {
  // state.messages is an Array<BaseMessage>
  const contextWindow = await Effect.runPromise(
    TransformMessages.from(state.messages)
      .safelyTakeLast(10)
      .format(FormatType.Concise)
  );

  return { ...state, prompt: contextWindow };
};
```

---

## Filtering strategies

`TransformMessages` ships with a small DSL for filters.  
Import the presets or supply your own predicate:

```ts
import { MessageFilterType } from "@m4trix/core/helper";

const humanAndAiOnly = TransformMessages.from(state.messages)
  .filter(MessageFilterType.HumanAndAI);

const withoutTag = TransformMessages.from(state.messages)
  .filter(MessageFilterType.ExcludingTags, ["debug"]);
```

---

## Safe windowing with `safelyTakeLast` 

Tool calls in LangGraph are represented as an `AIMessage` followed by one or more `ToolMessage`s.  
Calling `safelyTakeLast(n)` guarantees that these pairs stay _adjacent_ – the method will back-track until it finds the matching `AIMessage` if the slice starts with a `ToolMessage`.

```ts
const context = await TransformMessages.from(state.messages)
  .safelyTakeLast(20)           // never splits tool-call bundles
  .toArray();
```

If you fear long chains of tool calls you can **prune** the search with the optional second parameter:

```ts
// Stop looking back after overshooting more than 5 messages
.safelyTakeLast(20, 5)
```

---

## Formatting options

Need different representations of the same window?  
Just append `.format(...)` to the chain:

```ts
import { Effect } from "effect";

const jsonOutput = await Effect.runPromise(
  TransformMessages.from(state.messages)
    .safelyTakeLast(8)
    .format(FormatType.JSON)     // returns JSON string
);
```

Available formats:

* `Concise` – short role prefixes (`H:`, `A:`)
* `Verbose` – full human-readable chat transcript
* `RedactAi` / `RedactHuman` – remove either side for focused prompting
* `JSON` – serialisable structures for storage or model function-calling

---

## Chaining everything together

```ts
import { Effect } from "effect";

const summarise = async (allMessages: BaseMessage[]) =>
  Effect.runPromise(
    TransformMessages.from(allMessages)
      .filter(MessageFilterType.HumanAndAI)
      .safelyTakeLast(15)
      .map((msg) => /* do something with each message */ msg)
      .count()                       // any sink: toArray, toString, count …
  );
```

---

## Conclusion

`TransformMessages` offers a type-safe, composable way to keep your LangGraph agents within the model context limit while preserving the integrity of tool-call interactions.  
Combine it with LangGraph nodes to create robust, maintainable conversation pipelines. 