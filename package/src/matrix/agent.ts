import { randomUUID } from 'crypto';
import type {
  ContextEvents,
  RunEvents,
} from './agent-network/agent-network-event';
import { createAgentTracer, type AgentTracer } from './tracer';

type LogicFn<TParams, TTriggerEvent, TEmitEvent> = (ctx: {
  params: TParams;
  triggerEvent: TTriggerEvent;
  emit: (event: TEmitEvent) => void;
  runEvents: RunEvents;
  contextEvents: ContextEvents;
  tracer: AgentTracer;
}) => Promise<void>;

export class Agent<TParams, TTriggerEvent = never, TEmitEvent = never> {
  #params: TParams;
  #logic: LogicFn<TParams, TTriggerEvent, TEmitEvent>;
  #id: string;
  #listensTo: readonly string[];

  constructor(
    logic: LogicFn<TParams, TTriggerEvent, TEmitEvent>,
    params: TParams,
    listensTo?: readonly string[],
  ) {
    this.#logic = logic;
    this.#params = params;
    this.#id = `agent-${randomUUID()}`;
    this.#listensTo = listensTo ?? [];
  }

  getListensTo(): readonly string[] {
    return this.#listensTo;
  }

  async invoke(options?: {
    triggerEvent?: TTriggerEvent;
    emit?: (event: TEmitEvent) => void;
    runEvents?: RunEvents;
    contextEvents?: ContextEvents;
    tracer?: AgentTracer;
  }): Promise<void> {
    const { triggerEvent, emit, runEvents, contextEvents, tracer } =
      options ?? {};

    const emitFn =
      emit ??
      ((_event: TEmitEvent): void => {
        // no-op – will be wired by the network at runtime
      });

    const tracerFn = tracer ?? createAgentTracer();

    await this.#logic({
      params: this.#params,
      triggerEvent: triggerEvent ?? (undefined as TTriggerEvent),
      emit: emitFn,
      runEvents: runEvents ?? [],
      contextEvents: contextEvents ?? {
        all: [],
        byRun: () => [],
        map: new Map(),
      },
      tracer: tracerFn,
    });
  }

  getId(): string {
    return this.#id;
  }
}
