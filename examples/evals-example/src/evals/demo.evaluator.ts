import {
  Evaluator,
  S,
  latencyMetric,
  percentScore,
  tokenCountMetric,
} from '@m4trix/evals';

const inputSchema = S.Struct({ prompt: S.String });
const outputSchema = S.Struct({ expectedMinScore: S.Number });
const diffOutputSchema = S.Struct({
  expectedMinScore: S.Number,
  expectedResponse: S.optional(S.String),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const demoScoreEvaluator = Evaluator.use({
  name: 'withSeed',
  resolve: () => ({ seed: 7 }),
})
  .define({
    name: 'Demo Score Evaluator',
    inputSchema,
    outputSchema,
    scoreSchema: S.Struct({
      scores: S.Array(S.Unknown),
    }),
  })
  .evaluate(async ({ input, ctx, output }) => {
    const start = Date.now();
    await sleep(150);
    const promptHash = Array.from(input.prompt).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const rawScore = (promptHash + input.prompt.length * ctx.seed) % 101;
    const expectedMinScore = output?.expectedMinScore;
    const value = Math.max(8, Math.min(100, rawScore));
    const latencyMs = Date.now() - start;
    return {
      scores: [
        percentScore.make(
          { value },
          {
            definePassed: (d) => d.value >= (expectedMinScore ?? 50),
          },
        ),
      ],
      metrics: [
        tokenCountMetric.make({
          input: input.prompt.length * 2,
          output: Math.floor(input.prompt.length * 1.5),
          inputCached: 0,
          outputCached: 0,
        }),
        latencyMetric.make({ ms: latencyMs }),
      ],
    };
  });

export const demoLengthEvaluator = Evaluator.use({
  name: 'withBias',
  resolve: () => ({ bias: 10 }),
})
  .define({
    name: 'Demo Length Evaluator',
    inputSchema,
    outputSchema,
    scoreSchema: S.Struct({
      scores: S.Array(S.Unknown),
    }),
  })
  .evaluate(async ({ input, ctx, output }) => {
    const start = Date.now();
    await sleep(100);
    const expectedMinScore = output?.expectedMinScore;
    const lengthScore = Math.min(100, input.prompt.length * 2 + ctx.bias);
    const latencyMs = Date.now() - start;
    return {
      scores: [
        percentScore.make(
          { value: lengthScore },
          {
            definePassed: (d) => d.value >= (expectedMinScore ?? 60),
          },
        ),
      ],
      metrics: [
        tokenCountMetric.make({
          input: input.prompt.length,
          output: input.prompt.length,
          inputCached: 0,
          outputCached: 0,
        }),
        latencyMetric.make({ ms: latencyMs }),
      ],
    };
  });

/**
 * Demo evaluator that uses logDiff to record expected vs actual output.
 * Diffs are stored in the run artifact and shown by the CLI.
 * Simulates a mock "actual" response (in real evals this would come from your model).
 */
export const demoDiffEvaluator = Evaluator.use({
  name: 'noop',
  resolve: () => ({}),
})
  .define({
    name: 'Demo Diff Evaluator',
    inputSchema,
    outputSchema: diffOutputSchema,
    scoreSchema: S.Struct({ scores: S.Array(S.Unknown) }),
  })
  .evaluate(async ({ input, output, logDiff }) => {
    const expected = output?.expectedResponse;
    if (expected === undefined) {
      return {
        scores: [
          percentScore.make({ value: 0 }, { definePassed: () => false }),
        ],
        metrics: [],
      };
    }

    // Simulate model output (in real evals, this would be your LLM/system response)
    const actual = input.prompt.includes('France')
      ? 'The capital of France is Lyon.' // Wrong on purpose to show diff
      : input.prompt.includes('colors')
        ? JSON.stringify({ colors: ['red', 'green', 'blue'] }) // Different structure
        : expected; // Match for other prompts

    const matches = actual === expected;
    if (!matches) {
      const expectedParsed = (() => {
        try {
          return JSON.parse(expected) as unknown;
        } catch {
          return expected;
        }
      })();
      const actualParsed = (() => {
        try {
          return JSON.parse(actual) as unknown;
        } catch {
          return actual;
        }
      })();
      logDiff(expectedParsed, actualParsed);
    }

    return {
      scores: [
        percentScore.make(
          { value: matches ? 100 : 0 },
          { definePassed: (d) => d.value >= (output?.expectedMinScore ?? 50) },
        ),
      ],
      metrics: [],
    };
  });
