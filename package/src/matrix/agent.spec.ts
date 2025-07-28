import { describe, expect, test, vitest } from 'vitest';
import { AgentFactory } from './agent';
import { Schema as S } from 'effect';

const internalStateSchema = S.Struct({
  loopCounter: S.Number,
});

const paramsSchema = S.Struct({
  maxLoops: S.Number,
});

describe('AgentFactory', () => {
  test('should create an agent that works with basic setup', () => {
    const spy = vitest.fn();

    const agent = AgentFactory.start()
      .internalState(internalStateSchema, { loopCounter: 0 })
      .params(paramsSchema)
      .logic(({ params }) => {
        const { maxLoops } = params;

        for (let i = 0; i < maxLoops; i++) {
          spy();
        }

        return { loopCounter: 0 };
      })
      .produce({ maxLoops: 10 });

    agent.invoke({
      state: {},
      internalState: { loopCounter: 0 },
    });

    expect(spy).toHaveBeenCalledTimes(10);
  });
});
