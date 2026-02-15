import { describe, expect, test } from 'vitest';
import { Effect } from 'effect';
import { Schema as S } from 'effect';
import { AgentNetwork } from '../agent-network/agent-network';
import { AgentNetworkEvent } from '../agent-network/agent-network-event';
import { AgentFactory } from '../agent-factory';
import { ExposeAuthError } from './expose';

async function takeFirst(stream: AsyncIterable<unknown>): Promise<unknown> {
  for await (const e of stream) return e;
  return undefined;
}

async function takeN(
  stream: AsyncIterable<unknown>,
  n: number,
): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const e of stream) {
    out.push(e);
    if (out.length >= n) return out;
  }
  return out;
}

/** Create a mock POST Request with JSON body */
function mockPostRequest(payload: unknown): Request {
  return new Request('http://test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: new AbortController().signal,
  });
}

/** Create a mock GET Request (no body) */
function mockGetRequest(url = 'http://test/api'): Request {
  return new Request(url, {
    method: 'GET',
    signal: new AbortController().signal,
  });
}

/** Take first event or undefined when the stream ends/aborts without yielding */
async function takeFirstOrTimeout(
  stream: AsyncIterable<unknown>,
): Promise<unknown> {
  try {
    for await (const e of stream) return e;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return undefined;
    throw e;
  }
  return undefined;
}

describe('expose integration', () => {
  describe('emitStartEvent default (pass-through)', () => {
    test('POST with JSON body triggers agent and streams response', async () => {
      const requestEvent = AgentNetworkEvent.of(
        'reasoning-request',
        S.Struct({ request: S.String }),
      );
      const responseEvent = AgentNetworkEvent.of(
        'reasoning-response',
        S.Struct({ response: S.String }),
      );

      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvent])
              .emits([responseEvent])
              .logic(async ({ triggerEvent, emit }) => {
                const req = (triggerEvent.payload as { request: string })
                  .request;
                emit({
                  name: 'reasoning-response',
                  payload: { response: `Echo: ${req}` },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client' },
          startEventName: 'reasoning-request',
          onRequest: ({ emitStartEvent, payload }) => emitStartEvent(payload),
        });

        const req = mockPostRequest({ request: 'What is 2+2?' });
        return yield* Effect.tryPromise(() =>
          api.createStream({ request: req }, (stream) => takeFirst(stream)),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toMatchObject({
        name: 'reasoning-response',
        payload: { response: 'Echo: What is 2+2?' },
      });
    });

    test('uses default startEventName "request" when not specified', async () => {
      const requestEvt = AgentNetworkEvent.of(
        'request',
        S.Struct({ foo: S.String }),
      );
      const responseEvt = AgentNetworkEvent.of(
        'response',
        S.Struct({ ok: S.Boolean }),
      );
      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvt])
              .emits([responseEvt])
              .logic(async ({ triggerEvent, emit }) => {
                emit({
                  name: 'response',
                  payload: { ok: true },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client' },
          onRequest: ({ emitStartEvent, payload }) => emitStartEvent(payload),
        });

        const req = mockPostRequest({ foo: 'bar' });
        return yield* Effect.tryPromise(() =>
          api.createStream({ request: req }, (stream) => takeFirst(stream)),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toMatchObject({
        name: 'response',
        payload: { ok: true },
      });
    });

    test('default path (no plane, no onRequest) triggers agent via auto-publish', async () => {
      const requestEvt = AgentNetworkEvent.of(
        'reasoning-request',
        S.Struct({ request: S.String }),
      );
      const responseEvt = AgentNetworkEvent.of(
        'reasoning-response',
        S.Struct({ response: S.String }),
      );
      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvt])
              .emits([responseEvt])
              .logic(async ({ triggerEvent, emit }) => {
                const req = (triggerEvent.payload as { request: string })
                  .request;
                emit({
                  name: 'reasoning-response',
                  payload: { response: `Echo: ${req}` },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const api = network.expose({
        protocol: 'sse',
        select: { channels: 'client' },
        startEventName: 'reasoning-request',
      });

      const req = mockPostRequest({ request: 'What is 2+2?' });
      const received = await api.createStream({ request: req }, (stream) =>
        takeFirst(stream),
      );

      expect(received).toMatchObject({
        name: 'reasoning-response',
        payload: { response: 'Echo: What is 2+2?' },
      });
    });
  });

  describe('onRequest override', () => {
    test('onRequest can map payload before emitting', async () => {
      const requestEvent = AgentNetworkEvent.of(
        'task-request',
        S.Struct({ task: S.String }),
      );
      const taskDoneEvent = AgentNetworkEvent.of(
        'task-done',
        S.Struct({ result: S.String }),
      );

      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvent])
              .emits([taskDoneEvent])
              .logic(async ({ triggerEvent, emit }) => {
                const task = (triggerEvent.payload as { task: string }).task;
                emit({
                  name: 'task-done',
                  payload: { result: `Done: ${task}` },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client' },
          startEventName: 'task-request',
          onRequest: ({ emitStartEvent, payload }) => {
            const body = payload as { raw?: string };
            emitStartEvent({ task: body.raw ?? 'default' } as Parameters<
              typeof emitStartEvent
            >[0]);
          },
        });

        const req = mockPostRequest({ raw: 'custom-task' });
        return yield* Effect.tryPromise(() =>
          api.createStream({ request: req }, (stream) => takeFirst(stream)),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toMatchObject({
        name: 'task-done',
        payload: { result: 'Done: custom-task' },
      });
    });

    test('onRequest can map from query params (GET)', async () => {
      const requestEvent = AgentNetworkEvent.of(
        'query-request',
        S.Struct({ q: S.String }),
      );
      const queryResultEvent = AgentNetworkEvent.of(
        'query-result',
        S.Struct({ answer: S.String }),
      );

      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvent])
              .emits([queryResultEvent])
              .logic(async ({ triggerEvent, emit }) => {
                const q = (triggerEvent.payload as { q: string }).q;
                emit({
                  name: 'query-result',
                  payload: { answer: q },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client' },
          startEventName: 'query-request',
          onRequest: ({ emitStartEvent, req }) => {
            const url = req.request?.url;
            if (url) {
              const q = new URL(url).searchParams.get('q') ?? '';
              emitStartEvent({ q } as Parameters<typeof emitStartEvent>[0]);
            }
          },
        });

        const req = mockGetRequest('http://test/api?q=hello');
        return yield* Effect.tryPromise(() =>
          api.createStream({ request: req }, (stream) => takeFirst(stream)),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toMatchObject({
        name: 'query-result',
        payload: { answer: 'hello' },
      });
    });

    test('onRequest can skip emitting', async () => {
      const requestEvt = AgentNetworkEvent.of(
        'request',
        S.Struct({ request: S.String }),
      );
      const responseEvt = AgentNetworkEvent.of(
        'response',
        S.Struct({ ok: S.Boolean }),
      );
      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvt])
              .emits([responseEvt])
              .logic(async ({ emit }) => {
                emit({
                  name: 'response',
                  payload: { ok: true },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client' },
          onRequest: () => {
            // Intentionally not calling emitStartEvent
          },
        });

        const controller = new AbortController();
        setTimeout(() => controller.abort(), 100);
        const req = new Request('http://test/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request: 'ignored' }),
          signal: controller.signal,
        });

        return yield* Effect.tryPromise(() =>
          api.createStream({ request: req }, (stream) =>
            takeFirstOrTimeout(stream),
          ),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));
      expect(received).toBeUndefined();
    });
  });

  describe('auth', () => {
    test('auth rejects request with ExposeAuthError', async () => {
      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink }) => {
          mainChannel('main');
          createChannel('client').sink(sink.httpStream());
        },
      );

      const api = network.expose({
        protocol: 'sse',
        select: { channels: 'client' },
        auth: () => ({ allowed: false, status: 403, message: 'Forbidden' }),
      });

      const req = mockPostRequest({});
      await expect(
        api.createStream({ request: req }, (stream) => takeFirst(stream)),
      ).rejects.toThrow(ExposeAuthError);

      let err: ExposeAuthError;
      try {
        await api.createStream({ request: mockPostRequest({}) }, (stream) =>
          takeFirst(stream),
        );
        throw new Error('Expected ExposeAuthError');
      } catch (e) {
        err = e as ExposeAuthError;
      }
      expect(err.status).toBe(403);
      expect(err.message).toBe('Forbidden');
    });

    test('auth allows request when returning allowed: true', async () => {
      const requestEvt = AgentNetworkEvent.of(
        'request',
        S.Struct({ x: S.Number }),
      );
      const responseEvt = AgentNetworkEvent.of(
        'response',
        S.Struct({ ok: S.Boolean }),
      );
      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvt])
              .emits([responseEvt])
              .logic(async ({ emit }) => {
                emit({
                  name: 'response',
                  payload: { ok: true },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client' },
          auth: () => ({ allowed: true }),
          onRequest: ({ emitStartEvent, payload }) => emitStartEvent(payload),
        });

        const req = mockPostRequest({});
        return yield* Effect.tryPromise(() =>
          api.createStream({ request: req }, (stream) => takeFirst(stream)),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toMatchObject({
        name: 'response',
        payload: { ok: true },
      });
    });
  });

  describe('Express req.body', () => {
    test('extracts payload from Express req.body when present', async () => {
      const requestEvt = AgentNetworkEvent.of(
        'request',
        S.Struct({ x: S.Number }),
      );
      const responseEvt = AgentNetworkEvent.of(
        'response',
        S.Struct({ doubled: S.Number }),
      );
      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvt])
              .emits([responseEvt])
              .logic(async ({ triggerEvent, emit }) => {
                const p = triggerEvent.payload as { x: number };
                emit({
                  name: 'response',
                  payload: { doubled: p.x * 2 },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client' },
          startEventName: 'request',
          onRequest: ({ emitStartEvent, payload }) => emitStartEvent(payload),
        });

        const exposeReq = {
          request: { signal: new AbortController().signal } as Request,
          req: { body: { x: 21 } },
        };

        return yield* Effect.tryPromise(() =>
          api.createStream(exposeReq, (stream) => takeFirst(stream)),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toMatchObject({
        name: 'response',
        payload: { doubled: 42 },
      });
    });
  });

  describe('event filter', () => {
    test('select.events filters streamed events', async () => {
      const requestEvt = AgentNetworkEvent.of(
        'request',
        S.Struct({ x: S.Number }),
      );
      const aEvt = AgentNetworkEvent.of('a', S.Struct({ v: S.Number }));
      const bEvt = AgentNetworkEvent.of('b', S.Struct({ v: S.Number }));
      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, sink, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client').sink(sink.httpStream());
          registerAgent(
            AgentFactory.run()
              .listensTo([requestEvt])
              .emits([aEvt, bEvt])
              .logic(async ({ triggerEvent, emit }) => {
                emit({
                  name: 'a',
                  payload: { v: 1 },
                });
                emit({
                  name: 'b',
                  payload: { v: 2 },
                });
              })
              .produce({}),
          )
            .subscribe(main)
            .publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* network.run();
        yield* Effect.sleep('10 millis');

        const api = network.expose({
          protocol: 'sse',
          plane,
          select: { channels: 'client', events: ['b'] },
          onRequest: ({ emitStartEvent, payload }) => emitStartEvent(payload),
        });

        const req = mockPostRequest({});
        return yield* Effect.tryPromise(() =>
          api.createStream({ request: req }, (stream) => takeN(stream, 1)),
        );
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toHaveLength(1);
      expect(received![0]).toMatchObject({ name: 'b', payload: { v: 2 } });
    });
  });
});
