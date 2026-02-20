const registry = new Map<string, MetricDef<unknown>>();

export interface MetricItem<TData = unknown> {
  readonly id: string;
  readonly data: TData;
}

export interface FormatMetricOptions {
  isAggregated?: boolean;
}

export interface MetricDef<TData = unknown> {
  readonly id: string;
  readonly name?: string;
  readonly aggregate?: (values: ReadonlyArray<TData>) => TData;
  format(data: TData, options?: FormatMetricOptions): string;
  make(data: TData): MetricItem<TData>;
}

export const Metric = {
  of<TData>(config: {
    id: string;
    name?: string;
    format: (data: TData, options?: FormatMetricOptions) => string;
    aggregate?: (values: ReadonlyArray<TData>) => TData;
  }): MetricDef<TData> {
    const def: MetricDef<TData> = {
      id: config.id,
      name: config.name,
      aggregate: config.aggregate,
      format: config.format,
      make: (data: TData) => ({ id: config.id, data }),
    };
    registry.set(config.id, def as MetricDef<unknown>);
    return def;
  },
};

export function getMetricById(id: string): MetricDef<unknown> | undefined {
  return registry.get(id);
}
