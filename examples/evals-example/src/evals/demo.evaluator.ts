import {
  Evaluator,
  latencyMetric,
  percentScore,
  tokenCountMetric,
} from '@m4trix/evals';
import { Schema as S } from 'effect';

const inputSchema = S.Struct({ prompt: S.String });

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
    outputSchema: S.Unknown,
    scoreSchema: S.Struct({
      scores: S.Array(S.Unknown),
    }),
  })
  .evaluate(async (input, ctx) => {
    const start = Date.now();
    await sleep(150);
    const promptHash = Array.from(input.prompt).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const rawScore = (promptHash + input.prompt.length * ctx.seed) % 101;
    const value = Math.max(8, Math.min(100, rawScore));
    const latencyMs = Date.now() - start;
    return {
      scores: [
        percentScore.make({ value }, { definePassed: (d) => d.value >= 50 }),
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
    outputSchema: S.Unknown,
    scoreSchema: S.Struct({
      scores: S.Array(S.Unknown),
    }),
  })
  .evaluate(async (input, ctx) => {
    const start = Date.now();
    await sleep(100);
    const lengthScore = Math.min(100, input.prompt.length * 2 + ctx.bias);
    const latencyMs = Date.now() - start;
    return {
      scores: [
        percentScore.make(
          { value: lengthScore },
          {
            definePassed: (d) => d.value >= 60,
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
