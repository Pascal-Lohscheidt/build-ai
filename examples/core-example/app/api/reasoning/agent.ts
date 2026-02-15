import OpenAI from 'openai';
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
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

const evaluationRequestEvent = AgentNetworkEvent.of(
  'evaluation-request',
  S.Struct({ request: S.String, originalRequest: S.String }),
);

const evaluationResponseEvent = AgentNetworkEvent.of(
  'evaluation-response',
  S.Struct({ response: S.String, isFinal: S.Boolean }),
);

const reasoningAgent = AgentFactory.run()
  .listensTo([reasoningRequestEvent])
  .emits([reasoningResponseEvent,evaluationRequestEvent]) 
  .logic(async ({ triggerEvent, emit }) => {
    const request = (triggerEvent.payload as { request: string }).request;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

    let finalResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      finalResponse += content;
      if (content) {
        emit(reasoningResponseEvent.make({ response: content, isFinal: false }));
      }
    }

    emit(evaluationRequestEvent.make({ request: finalResponse, originalRequest: request }));
    emit(reasoningResponseEvent.make({ response: '', isFinal: true }));
  })
  .produce({});

const evaluationAgent = AgentFactory.run()
  .listensTo([evaluationRequestEvent])
  .emits([evaluationResponseEvent])
  .logic(async ({ triggerEvent, emit }) => {
    if (!evaluationRequestEvent.is(triggerEvent)) {
      return;
    }
    const request = triggerEvent.payload.request;
    const originalRequest = triggerEvent.payload.originalRequest;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const evaluation = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Think step by step and explain your reasoning.',
        },
        {
          role: 'user',
          content: `Evaluate the following response: ${request} given the original request: ${originalRequest}`,
        },
      ],
    });
    emit(
      evaluationResponseEvent.make({
        response: evaluation.choices[0]?.message?.content ?? 'No response',
        isFinal: true,
      }),
    );
  })
  .produce({});

export const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());

    registerAgent(reasoningAgent).subscribe(main).publishTo(client);
    registerAgent(evaluationAgent).subscribe(client).publishTo(client);
  },
);
