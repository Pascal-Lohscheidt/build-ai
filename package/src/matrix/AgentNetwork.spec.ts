import { describe, expect, test, vitest } from 'vitest';
import { AgentNetwork } from './AgentNetwork';
import { Schema } from 'effect';
import { Agent } from './agent';

type AgentType = Agent<unknown, unknown, unknown>;

describe('AgentNetwork', () => {
  describe('setup', () => {
    test('should run the setup function when the network is run', () => {
      // Arrange
      const spy = vitest.fn();
      const agentNetwork = AgentNetwork.setup(
        Schema.Struct({ a: Schema.String }),
        ({ a }) => {
          spy(a);
        },
      );

      // Act
      agentNetwork.run({ a: 'a' });

      // Assert
      expect(spy).toHaveBeenCalledWith('a');
    });

    test('should throw an error if the input is invalid', () => {
      // Arrange
      const spy = vitest.fn();
      const agentNetwork = AgentNetwork.setup(
        Schema.Struct({ a: Schema.String }),
        spy,
      );

      // Act
      expect(() => agentNetwork.run({ a: 1 })).toThrowError();

      // Assert
      expect(spy).not.toHaveBeenCalled();
    });

    test('should connect two agents properly', () => {
      const invokeA = vitest.fn().mockReturnValue({ a: 'a' });
      const invokeB = vitest.fn();

      const agentA = {
        getId: () => 'agentA',
        invoke: invokeA,
      } as unknown as AgentType;

      const agentB = {
        getId: () => 'agentB',
        invoke: invokeB,
      } as unknown as AgentType;

      // Arrange
      const agentNetwork = AgentNetwork.setup(
        Schema.Any,
        async (_, context) => {
          const { connect, network } = context;

          connect(castTo<AgentType>(agentA)).to(castTo<AgentType>(agentB));
          await agentA.invoke({
            state: {},
            connectedNetwork: network,
          });
        },
      );

      agentNetwork.run({});
      expect(invokeA).toHaveBeenCalledWith({
        state: {},
        connectedNetwork: agentNetwork,
      });
      expect(invokeB).toHaveBeenCalledWith({
        state: { a: 'a' },
        connectedNetwork: agentNetwork,
      });
    });
  });
});

function castTo<T>(mocked: unknown): T {
  return mocked as unknown as T;
}
