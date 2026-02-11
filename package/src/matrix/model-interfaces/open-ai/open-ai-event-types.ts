// OpenAI streaming event types
export interface BaseOpenAiEvent {
  type: string;
  event_id?: string;
}

export interface ResponseTextDeltaEvent extends BaseOpenAiEvent {
  type: 'response.output_text.delta';
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

export interface ResponseDoneEvent extends BaseOpenAiEvent {
  type: 'response.done';
  response: {
    id: string;
    status: string;
    status_details?: unknown;
    output: Array<{
      id: string;
      type: string;
      content?: Array<{
        type: string;
        text: string;
      }>;
    }>;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
  };
}

export interface ErrorEvent extends BaseOpenAiEvent {
  type: 'error';
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
  };
}

// Union type for all possible OpenAI events
export type OpenAiEvent =
  | ResponseTextDeltaEvent
  | ResponseDoneEvent
  | ErrorEvent
  | BaseOpenAiEvent;
