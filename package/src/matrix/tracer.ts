/**
 * Lightweight tracer for agent logic. Uses @opentelemetry/api when available
 * so spans nest under the active Effect span. Falls back to no-op when not installed.
 */
export type AgentTracer = {
  withSpan: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
};

function createTracerWithOtel(): AgentTracer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer('agent-network');
  return {
    withSpan: <T>(name: string, fn: () => Promise<T>): Promise<T> =>
      tracer.startActiveSpan(name, async (span: { end: () => void }) => {
        try {
          return await fn();
        } finally {
          span.end();
        }
      }),
  };
}

function createNoopTracer(): AgentTracer {
  return {
    withSpan: <T>(_name: string, fn: () => Promise<T>) => fn(),
  };
}

/**
 * Creates a tracer for use in agent logic. When @opentelemetry/api is installed,
 * spans created via withSpan nest under the active Effect span. Otherwise returns
 * a no-op tracer.
 */
export function createAgentTracer(): AgentTracer {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('@opentelemetry/api');
    return createTracerWithOtel();
  } catch {
    return createNoopTracer();
  }
}
