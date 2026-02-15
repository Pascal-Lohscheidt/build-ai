import { NextEndpoint } from '@m4trix/core/matrix';
import { network } from './agent';

const api = network.expose({
  protocol: 'sse',
  select: { channels: 'client' },
  startEventName: 'reasoning-request',
});

const handler = NextEndpoint.from(api).handler();
export const GET = handler;
export const POST = handler;
