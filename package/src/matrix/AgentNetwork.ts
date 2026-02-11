import { Effect, Schema } from 'effect';
import { BaseSchemaDefintion } from './types';
import { ParseError } from 'effect/ParseResult';
import { Agent } from './agent';

type SetupCallback<TInput> = (
  input: TInput,
  context: NetworkContext
) => Promise<void>;

type ConnectCallback = (from: Agent<unknown, unknown, unknown>) => {
  to: (to: Agent<unknown, unknown, unknown>) => void;
};

type NetworkContext = {
  channels: unknown;
  connect: ConnectCallback;
  network: AgentNetwork;
};

type ConnectionMatrix = {
  [key: string]: {
    [key: string]: boolean;
  };
};

export class AgentNetwork<
  TInput extends BaseSchemaDefintion = Schema.Schema<unknown>,
> {
  private setupCallback: SetupCallback<TInput>;
  private inputSchema: TInput['Type'];
  private connectionMatrix: ConnectionMatrix = {};
  private agents: Map<string, Agent<unknown, unknown, unknown>> = new Map();

  constructor(inputSchema: TInput, setupCallback: SetupCallback<TInput>) {
    this.inputSchema = inputSchema;
    this.setupCallback = setupCallback;
  }

  static setup<TSchema extends BaseSchemaDefintion>(
    inputSchema: TSchema,
    setupCallback: SetupCallback<TSchema['Type']>
  ): AgentNetwork<TSchema['Type']> {
    return new AgentNetwork(inputSchema, setupCallback);
  }

  connect(
    fromAgent: Agent<unknown, unknown, unknown>
  ): ReturnType<ConnectCallback> {
    const to = (toAgent: Agent<unknown, unknown, unknown>): void => {
      const fromId = fromAgent.getId();
      const toId = toAgent.getId();
      this.connectionMatrix[fromId] ??= {};
      this.connectionMatrix[fromId][toId] = true;
    };
    return { to };
  }

  register(agent: Agent<unknown, unknown, unknown>): void {
    if (!this.agents.has(agent.getId())) {
      this.agents.set(agent.getId(), agent);
    }
  }

  notifyAboutExecution(
    agent: Agent<unknown, unknown, unknown>,
    output: unknown
  ): void {
    const agentsToNotify = Object.entries(
      this.connectionMatrix[agent.getId()]
    ).filter(([_, connected]) => connected);

    agentsToNotify.forEach(([agentToNotifyId]) => {
      const agentToNotify = this.agents.get(agentToNotifyId)!;

      agentToNotify.invoke({
        state: output,
        connectedNetwork: this as unknown as AgentNetwork,
      });
    });
  }

  run(input: TInput['Type']): void {
    const validationOfInput = Schema.decode<TInput['Type'], ParseError, never>(
      this.inputSchema satisfies Schema.Schema<TInput['Type']>
    )(input);

    const validatedInput = Effect.runSync(validationOfInput);

    this.setupCallback(validatedInput, {
      channels: {},
      connect: this.connect.bind(this),
      network: this as unknown as AgentNetwork,
    });
  }
}
