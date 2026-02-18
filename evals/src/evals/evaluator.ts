import { Schema as S } from 'effect';

export interface EvalMiddleware<TCtx> {
  name: string;
  resolve: () => TCtx | Promise<TCtx>;
}

export interface EvaluateArgs<TInput, TCtx> {
  input: TInput;
  ctx: TCtx;
  output?: unknown;
}

type EvaluateFn<TInput, TScore, TCtx> = (
  args: EvaluateArgs<TInput, TCtx>,
) => TScore | Promise<TScore>;

interface EvaluatorConfig<TInput, TOutput, TScore, TCtx> {
  name?: string;
  inputSchema?: S.Schema.Any;
  outputSchema?: S.Schema.Any;
  scoreSchema?: S.Schema.Any;
  middlewares: ReadonlyArray<EvalMiddleware<unknown>>;
  evaluateFn?: EvaluateFn<TInput, TScore, TCtx>;
  passThreshold?: number;
  passCriterion?: (score: unknown) => boolean;
  /** Phantom field for TOutput type parameter */
  _outputType?: TOutput;
}

interface EvaluatorDefineConfig<
  TI extends S.Schema.Any,
  TO extends S.Schema.Any,
  TS extends S.Schema.Any,
> {
  name: string;
  inputSchema: TI;
  outputSchema: TO;
  scoreSchema: TS;
  passThreshold?: number;
  passCriterion?: (score: unknown) => boolean;
}

export class Evaluator<
  TInput = unknown,
  TOutput = unknown,
  TScore = unknown,
  TCtx = Record<string, never>,
> {
  private readonly _config: EvaluatorConfig<TInput, TOutput, TScore, TCtx>;

  private constructor(
    config: EvaluatorConfig<TInput, TOutput, TScore, TCtx>,
  ) {
    this._config = config;
  }

  private getState(): EvaluatorConfig<TInput, TOutput, TScore, TCtx> {
    return {
      name: this._config.name,
      inputSchema: this._config.inputSchema,
      outputSchema: this._config.outputSchema,
      scoreSchema: this._config.scoreSchema,
      middlewares: this._config.middlewares,
      evaluateFn: this._config.evaluateFn,
      passThreshold: this._config.passThreshold,
      passCriterion: this._config.passCriterion,
    };
  }

  static use<TCtx>(
    middleware: EvalMiddleware<TCtx>,
  ): Evaluator<unknown, unknown, unknown, TCtx> {
    return new Evaluator<unknown, unknown, unknown, TCtx>({
      middlewares: [middleware as EvalMiddleware<unknown>],
    });
  }

  use<TNew>(
    middleware: EvalMiddleware<TNew>,
  ): Evaluator<TInput, TOutput, TScore, TCtx & TNew> {
    const state = this.getState();
    return new Evaluator<TInput, TOutput, TScore, TCtx & TNew>({
      ...(state as unknown as EvaluatorConfig<
        TInput,
        TOutput,
        TScore,
        TCtx & TNew
      >),
      middlewares: [...state.middlewares, middleware as EvalMiddleware<unknown>],
    });
  }

  define<
    TI extends S.Schema.Any,
    TO extends S.Schema.Any,
    TS extends S.Schema.Any,
  >(
    config: EvaluatorDefineConfig<TI, TO, TS>,
  ): Evaluator<S.Schema.Type<TI>, S.Schema.Type<TO>, S.Schema.Type<TS>, TCtx> {
    const { middlewares } = this.getState();
    return new Evaluator<
      S.Schema.Type<TI>,
      S.Schema.Type<TO>,
      S.Schema.Type<TS>,
      TCtx
    >({
      name: config.name,
      inputSchema: config.inputSchema,
      outputSchema: config.outputSchema,
      scoreSchema: config.scoreSchema,
      middlewares,
      passThreshold: config.passThreshold,
      passCriterion: config.passCriterion,
    });
  }

  evaluate(
    fn: EvaluateFn<TInput, TScore, TCtx>,
  ): Evaluator<TInput, TOutput, TScore, TCtx> {
    return new Evaluator<TInput, TOutput, TScore, TCtx>({
      ...this.getState(),
      evaluateFn: fn,
    });
  }

  getName(): string | undefined {
    return this._config.name;
  }

  getInputSchema(): S.Schema.Any | undefined {
    return this._config.inputSchema;
  }

  getOutputSchema(): S.Schema.Any | undefined {
    return this._config.outputSchema;
  }

  getScoreSchema(): S.Schema.Any | undefined {
    return this._config.scoreSchema;
  }

  getMiddlewares(): ReadonlyArray<EvalMiddleware<unknown>> {
    return this._config.middlewares;
  }

  getEvaluateFn(): EvaluateFn<TInput, TScore, TCtx> | undefined {
    return this._config.evaluateFn;
  }

  getPassThreshold(): number | undefined {
    return this._config.passThreshold;
  }

  getPassCriterion(): ((score: unknown) => boolean) | undefined {
    return this._config.passCriterion;
  }

  async resolveContext(): Promise<TCtx> {
    const parts = await Promise.all(
      this._config.middlewares.map((mw) => mw.resolve()),
    );
    return Object.assign({}, ...parts) as TCtx;
  }
}
