import OpenAI from 'openai';
import {
  AgentFactory,
  AgentNetwork,
  AgentNetworkEvent,
  ConfiguredChannel,
  S,
  Sink,
} from '@m4trix/core/matrix';

export const MessageEvent = AgentNetworkEvent.of(
  'message',
  S.Struct({ message: S.String, role: S.String }),
);
const MessageStreamChunkEvent = AgentNetworkEvent.of(
  'message-stream-chunk',
  S.Struct({ chunk: S.String, isFinal: S.Boolean, role: S.String }),
);

const reasoningAgent = AgentFactory.run()
  .listensTo([MessageEvent])
  .emits([MessageStreamChunkEvent, MessageEvent])
  .logic(async ({ triggerEvent, emit, contextEvents }) => {
    if (!MessageEvent.is(triggerEvent)) {
      return;
    }

    const message = triggerEvent.payload.message;
    const role = triggerEvent.payload.role as 'user' | 'assistant';
    const messageHistory = contextEvents.all.filter(MessageEvent.is);

    console.log(messageHistory);

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
        ...messageHistory.map((event) => ({
          role: event.payload.role as 'user' | 'assistant',
          content: event.payload.message,
        })),
        { role, content: message },
      ],
    });

    let finalResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      finalResponse += content;
      if (content) {
        emit(
          MessageStreamChunkEvent.make({
            chunk: content,
            isFinal: false,
            role: 'assistant',
          }),
        );
      }
    }
    emit(
      MessageStreamChunkEvent.make({
        chunk: '',
        isFinal: true,
        role: 'assistant',
      }),
    );
    emit(
      MessageEvent.make({
        message: finalResponse,
        role: 'assistant',
      }),
    );
  })
  .produce({});

export const network = AgentNetwork.setup(
  ({ mainChannel, createChannel, sink, registerAgent }) => {
    const main = mainChannel('main');
    const client = createChannel('client').sink(sink.httpStream());

    registerAgent(reasoningAgent).subscribe(main).publishTo(client);
  },
);
