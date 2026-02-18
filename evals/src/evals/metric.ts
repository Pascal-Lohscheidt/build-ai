const registry = new Map<string, MetricDef<unknown>>();

export interface MetricItem<TData = unknown> {
  readonly id: string;
  readonly data: TData;
}

export interface MetricDef<TData = unknown> {
  readonly id: string;
  readonly name?: string;
  format(data: TData): string;
  make(data: TData): MetricItem<TData>;
}

export const Metric = {
  of<TData>(config: {
    id: string;
    name?: string;
    format: (data: TData) => string;
  }): MetricDef<TData> {
    const def: MetricDef<TData> = {
      id: config.id,
      name: config.name,
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
