import { Effect, Stream } from 'effect';
import { ChatPrompt, SimplePrompt } from '../formattables/Prompt';
import {
  createOpenAIEventStream,
  isDeltaTextEvent,
  type StreamConfig,
} from './open-ai/stream-helper';

// Streaming chunk response format from OpenAI
export interface OpenAiStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Complete response format (for non-streaming)
export interface OpenAiModelResponse {
  id: string;
  object: string;
  created_at: number;
  status: string;
  error: string | null;
  incomplete_details: unknown | null;
  instructions: unknown | null;
  max_output_tokens: number | null;
  model: string;
  output: Array<{
    type: string;
    id: string;
    status: string;
    role: string;
    content: Array<{
      type: string;
      text: string;
      annotations: unknown[];
    }>;
  }>;
  parallel_tool_calls: boolean;
  previous_response_id: string | null;
  reasoning: {
    effort: unknown | null;
    summary: unknown | null;
  };
  store: boolean;
  temperature: number;
  text: {
    format: {
      type: string;
    };
  };
  tool_choice: string;
  tools: unknown[];
  top_p: number;
  truncation: string;
  usage: {
    input_tokens: number;
    input_tokens_details: {
      cached_tokens: number;
    };
    output_tokens: number;
    output_tokens_details: {
      reasoning_tokens: number;
    };
    total_tokens: number;
  };
  user: string | null;
  metadata: Record<string, unknown>;
}

export interface ModelInterface {
  // Non-streaming methods (return complete responses)
  chat(prompt: ChatPrompt): Effect.Effect<OpenAiModelResponse, Error>;
  run(prompt: SimplePrompt): Effect.Effect<OpenAiModelResponse, Error>;

  // Streaming methods (return Effect Streams)
  streamChat(
    prompt: ChatPrompt,
    includeUsage?: boolean
  ): Stream.Stream<OpenAiStreamChunk, Error>;
  streamRun(
    prompt: SimplePrompt,
    includeUsage?: boolean
  ): Stream.Stream<OpenAiStreamChunk, Error>;
}

export class OpenAIModel implements ModelInterface {
  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://api.openai.com',
    private endpoint: string = '/v1/responses',
    private model: string = 'gpt-4o-mini'
  ) {}

  chat(prompt: ChatPrompt): Effect.Effect<OpenAiModelResponse, Error> {
    const messages = prompt.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    return this.makeRequest(messages);
  }

  run(prompt: SimplePrompt): Effect.Effect<OpenAiModelResponse, Error> {
    const messages = [{ role: 'user', content: prompt.format() }];
    return this.makeRequest(messages);
  }

  streamChat(
    prompt: ChatPrompt,
    includeUsage = false
  ): Stream.Stream<OpenAiStreamChunk, Error> {
    const input = prompt.messages.map((msg) => msg.content).join('\n');
    return this.createStreamingResponse(input, includeUsage);
  }

  streamRun(
    prompt: SimplePrompt,
    includeUsage = false
  ): Stream.Stream<OpenAiStreamChunk, Error> {
    return this.createStreamingResponse(prompt.format(), includeUsage);
  }

  private makeRequest(
    messages: Array<{ role: string; content: string }>
  ): Effect.Effect<OpenAiModelResponse, Error> {
    const requestBody = {
      model: this.model,
      messages: messages,
      stream: false,
    };

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    };

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(
          `${this.baseUrl}/v1/chat/completions`,
          requestOptions
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return this.convertToOpenAiModelResponse(data);
      },
      catch: (error) =>
        new Error(`Failed to call OpenAI API: ${String(error)}`),
    });
  }

  private createStreamingResponse(
    input: string,
    includeUsage: boolean
  ): Stream.Stream<OpenAiStreamChunk, Error> {
    const config: StreamConfig = {
      url: `${this.baseUrl}${this.endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: {
        model: this.model,
        instructions: 'You are a helpful assistant',
        input: input,
        stream: true,
        ...(includeUsage && { stream_options: { include_usage: true } }),
      },
    };

    // Get the raw event stream and transform it to our chunk format
    return createOpenAIEventStream(config).pipe(
      Stream.filter(isDeltaTextEvent),
      Stream.map((event) => this.convertToStreamChunk(event))
    );
  }

  private convertToStreamChunk(
    event: import('./open-ai/open-ai-event-types').ResponseTextDeltaEvent
  ): OpenAiStreamChunk {
    return {
      id: event.item_id || 'unknown',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      choices: [
        {
          index: event.output_index || 0,
          delta: {
            content: event.delta,
          },
          finish_reason: null,
        },
      ],
    };
  }

  // Convert OpenAI chat completion response to our expected format
  private convertToOpenAiModelResponse(chatCompletion: {
    id?: string;
    created?: number;
    model?: string;
    choices?: Array<{
      message?: {
        role?: string;
        content?: string;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  }): OpenAiModelResponse {
    const message = chatCompletion.choices?.[0]?.message;
    const now = Math.floor(Date.now() / 1000);

    return {
      id:
        chatCompletion.id ||
        `resp_${Math.random().toString(36).substring(2, 15)}`,
      object: 'response',
      created_at: chatCompletion.created || now,
      status: 'completed',
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: null,
      model: chatCompletion.model || this.model,
      output: [
        {
          type: 'message',
          id: `msg_${Math.random().toString(36).substring(2, 15)}`,
          status: 'completed',
          role: message?.role || 'assistant',
          content: [
            {
              type: 'text',
              text: message?.content || '',
              annotations: [],
            },
          ],
        },
      ],
      parallel_tool_calls: false,
      previous_response_id: null,
      reasoning: {
        effort: null,
        summary: null,
      },
      store: false,
      temperature: 1.0,
      text: {
        format: {
          type: 'text',
        },
      },
      tool_choice: 'auto',
      tools: [],
      top_p: 1.0,
      truncation: 'auto',
      usage: {
        input_tokens: chatCompletion.usage?.prompt_tokens || 0,
        input_tokens_details: {
          cached_tokens: 0,
        },
        output_tokens: chatCompletion.usage?.completion_tokens || 0,
        output_tokens_details: {
          reasoning_tokens: 0,
        },
        total_tokens: chatCompletion.usage?.total_tokens || 0,
      },
      user: null,
      metadata: {},
    };
  }
}

// Utility function to accumulate Effect streams into a complete response
export const accumulateStreamChunks = (
  stream: Stream.Stream<OpenAiStreamChunk, Error>
): Effect.Effect<OpenAiModelResponse, Error> => {
  return Stream.runFold(
    stream,
    {
      content: '',
      lastChunk: null as OpenAiStreamChunk | null,
      usage: null as {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      } | null,
    },
    (acc, chunk) => ({
      content: acc.content + (chunk.choices[0]?.delta?.content || ''),
      lastChunk: chunk,
      usage: chunk.usage || acc.usage,
    })
  ).pipe(
    Effect.map(({ content, lastChunk, usage }) => {
      if (!lastChunk) {
        throw new Error('No chunks received from stream');
      }

      const now = Math.floor(Date.now() / 1000);

      return {
        id: lastChunk.id,
        object: 'response',
        created_at: now,
        status: 'completed',
        error: null,
        incomplete_details: null,
        instructions: null,
        max_output_tokens: null,
        model: lastChunk.model,
        output: [
          {
            type: 'message',
            id: `msg_${Math.random().toString(36).substring(2, 15)}`,
            status: 'completed',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: content,
                annotations: [],
              },
            ],
          },
        ],
        parallel_tool_calls: false,
        previous_response_id: null,
        reasoning: {
          effort: null,
          summary: null,
        },
        store: false,
        temperature: 1.0,
        text: {
          format: {
            type: 'text',
          },
        },
        tool_choice: 'auto',
        tools: [],
        top_p: 1.0,
        truncation: 'auto',
        usage: usage
          ? {
              input_tokens: usage.prompt_tokens || 0,
              input_tokens_details: {
                cached_tokens: 0,
              },
              output_tokens: usage.completion_tokens || 0,
              output_tokens_details: {
                reasoning_tokens: 0,
              },
              total_tokens: usage.total_tokens || 0,
            }
          : {
              input_tokens: 0,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens: 0,
              output_tokens_details: { reasoning_tokens: 0 },
              total_tokens: 0,
            },
        user: null,
        metadata: {},
      };
    })
  );
};
