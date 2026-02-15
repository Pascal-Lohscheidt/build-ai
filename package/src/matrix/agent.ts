import { randomUUID } from 'crypto';

type LogicFn<TParams, TTriggerEvent, TEmitEvent> = (ctx: {
  params: TParams;
  triggerEvent: TTriggerEvent;
  emit: (event: TEmitEvent) => void;
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
  }): Promise<void> {
    const { triggerEvent, emit } = options ?? {};

    const emitFn =
      emit ??
      ((_event: TEmitEvent): void => {
        // no-op – will be wired by the network at runtime
      });

    await this.#logic({
      params: this.#params,
      triggerEvent: triggerEvent ?? (undefined as TTriggerEvent),
      emit: emitFn,
    });
  }

  getId(): string {
    return this.#id;
  }
}
