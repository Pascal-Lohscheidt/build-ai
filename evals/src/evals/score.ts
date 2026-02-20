const registry = new Map<string, ScoreDef<unknown>>();

export type ScoreDisplayStrategy = 'bar' | 'number' | 'passFail';

export interface ScoreItem<TData = unknown> {
  readonly id: string;
  readonly data: TData;
  readonly passed?: boolean;
}

export interface FormatScoreOptions {
  isAggregated?: boolean;
}

export interface ScoreDef<TData = unknown> {
  readonly id: string;
  readonly name?: string;
  readonly displayStrategy: ScoreDisplayStrategy;
  readonly aggregate?: (values: ReadonlyArray<TData>) => TData;
  format(data: TData, options?: FormatScoreOptions): string;
  make(
    data: TData,
    options?: { definePassed?: (data: TData) => boolean },
  ): ScoreItem<TData>;
}

export const Score = {
  of<TData>(config: {
    id: string;
    name?: string;
    displayStrategy: ScoreDisplayStrategy;
    format: (data: TData, options?: FormatScoreOptions) => string;
    aggregate?: (values: ReadonlyArray<TData>) => TData;
  }): ScoreDef<TData> {
    const def: ScoreDef<TData> = {
      id: config.id,
      name: config.name,
      displayStrategy: config.displayStrategy,
      aggregate: config.aggregate,
      format: config.format,
      make: (data: TData, options?: { definePassed?: (data: TData) => boolean }) => {
        const passed =
          options?.definePassed !== undefined
            ? options.definePassed(data)
            : undefined;
        return {
          id: config.id,
          data,
          ...(passed !== undefined && { passed }),
        };
      },
    };
    registry.set(config.id, def as ScoreDef<unknown>);
    return def;
  },
};

export function getScoreById(id: string): ScoreDef<unknown> | undefined {
  return registry.get(id);
}
