import OpenAI from 'openai';
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
  NextEndpoint,
  S,
} from '@m4trix/core/matrix';

const reasoningRequestEvent = AgentNetworkEvent.of(
  'reasoning-request',
  S.Struct({ request: S.String }),
);

const reasoningResponseEvent = AgentNetworkEvent.of(
  'reasoning-response',
  S.Struct({ response: S.String, isFinal: S.Boolean }),
);

const reasoningAgent = AgentFactory.run()
  .listensTo([reasoningRequestEvent])
  .emits([reasoningResponseEvent])
  .logic(async ({ triggerEvent, emit }) => {
    const request = (triggerEvent.payload as { request: string }).request;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      emit({
        name: 'reasoning-response',
        payload: {
          response: 'Error: OPENAI_API_KEY is not set. Add it to .env.local',
          isFinal: true,
        },
      });
      return;
    }

    const openai = new OpenAI({ apiKey });
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Think step by step and explain your reasoning.',
        },
        { role: 'user', content: request },
      ],
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        emit({
          name: 'reasoning-response',
          payload: { response: content, isFinal: false },
        });
      }
    }
    emit({
      name: 'reasoning-response',
      payload: { response: '', isFinal: true },
    });
  })
  .produce({});

const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());

    registerAgent(reasoningAgent).subscribe(main).publishTo(client);
  },
);

const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'reasoning-request',
});

const handler = NextEndpoint.from(api).handler();
export const GET = handler;
export const POST = handler;
