import { Schema as S } from 'effect';

type LogicFn<TState, InternalState, TParams> = (ctx: {
  state: TState;
  internalState: InternalState;
  params: TParams;
}) => TState;

type BaseSchemaDefintion = S.Schema.Any;

export class Agent<TState, TInternalState, TParams> {
  private _params: TParams;
  private _defaultInternalState: TInternalState;
  private logic: LogicFn<TState, TInternalState, TParams>;

  constructor(
    logic: LogicFn<TState, TInternalState, TParams>,
    defaultInternalState: TInternalState,
    params: TParams
  ) {
    this.logic = logic;
    this._defaultInternalState = defaultInternalState;
    this._params = params;
  }

  invoke({ state }: { state: TState; internalState: TInternalState }): TState {
    return this.logic({
      state,
      internalState: this._defaultInternalState,
      params: this._params,
    });
  }
}

type ContructorParams<TState, TInternalState, TParams> = {
  internalStateSchema?: BaseSchemaDefintion;
  internalState?: TInternalState;
  logic?: LogicFn<TState, TInternalState, TParams>;
  paramsSchema?: BaseSchemaDefintion;
};

export class AgentFactory<
  TState = unknown,
  TInternalState = unknown,
  TParams = unknown,
> {
  private _internalStateSchema: BaseSchemaDefintion | undefined;
  private _internalState: TInternalState | undefined;
  private _logic: LogicFn<TState, TInternalState, TParams> | undefined;
  private _paramsSchema: BaseSchemaDefintion | undefined;

  private constructor({
    internalState,
    logic,
    internalStateSchema,
    paramsSchema,
  }: ContructorParams<TState, TInternalState, TParams>) {
    this._internalState = internalState;
    this._logic = logic;
    this._internalStateSchema = internalStateSchema;
    this._paramsSchema = paramsSchema;
  }

  private getContructorState(): ContructorParams<
    TState,
    TInternalState,
    TParams
  > {
    return {
      internalState: this._internalState,
      logic: this._logic,
      internalStateSchema: this._internalStateSchema,
      paramsSchema: this._paramsSchema,
    };
  }

  getLogic(): LogicFn<TState, TInternalState, TParams> | undefined {
    return this._logic;
  }

  static start(): AgentFactory<unknown, unknown, unknown> {
    return new AgentFactory<unknown, unknown, unknown>({});
  }

  params<TSchema extends BaseSchemaDefintion>(
    params: TSchema
  ): AgentFactory<TState, TInternalState, TSchema['Type']> {
    const { logic, ...rest } = this.getContructorState();

    return new AgentFactory({
      ...rest,
      logic: logic as LogicFn<TState, TInternalState, TSchema['Type']>,
      paramsSchema: params,
    });
  }

  internalState<TSchema extends BaseSchemaDefintion>(
    internalStateSchema: TSchema,
    defaultValue: TSchema['Type']
  ): AgentFactory<TState, TSchema['Type'], TParams> {
    const { logic, ...rest } = this.getContructorState();

    return new AgentFactory<TState, TSchema['Type'], TParams>({
      ...rest,
      internalStateSchema: internalStateSchema,
      internalState: defaultValue,
      logic: logic as LogicFn<TState, BaseSchemaDefintion, TParams>,
    });
  }

  logic(
    fn: LogicFn<TState, TInternalState, TParams>
  ): AgentFactory<TState, TInternalState, TParams> {
    return new AgentFactory<TState, TInternalState, TParams>({
      ...this.getContructorState(),
      logic: fn,
    });
  }

  produce(params: TParams): Agent<TState, TInternalState, TParams> {
    return new Agent<TState, TInternalState, TParams>(
      this._logic!,
      this._internalState!,
      params
    );
  }
}
