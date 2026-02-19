import { AgentNetworkEvent, S } from '@m4trix/core/matrix';

export const MessageEvent = AgentNetworkEvent.of(
  'message',
  S.Struct({ message: S.String, role: S.String }),
);
export const MessageStreamChunkEvent = AgentNetworkEvent.of(
  'message-stream-chunk',
  S.Struct({ chunk: S.String, isFinal: S.Boolean, role: S.String }),
);
