import { describe, expect, test, vitest } from 'vitest';
import { Effect, Fiber, Queue } from 'effect';
import { Schema as S } from 'effect';
import { AgentFactory } from '../agent-factory';
import { AgentNetwork } from './agent-network';
import { AgentNetworkEvent, EventMeta } from './agent-network-event';
import { createEventPlane, run, runSubscriber } from './event-plane';
import { ChannelName } from './channel';

const meta = { runId: 'test-run' };

describe('EventPlane', () => {
  describe('createEventPlane', () => {
    test('creates a plane with one PubSub per channel', async () => {
      const network = AgentNetwork.setup(({ mainChannel, createChannel }) => {
        mainChannel('main');
        createChannel('client');
      });

      const plane = await Effect.runPromise(createEventPlane(network));

      expect(plane.publish).toBeDefined();
      expect(plane.subscribe).toBeDefined();
      expect(plane.publishToChannels).toBeDefined();
      expect(plane.shutdown).toBeDefined();
    });

    test('accepts custom capacity', async () => {
      const network = AgentNetwork.setup(({ mainChannel }) => {
        mainChannel('main');
      });

      await Effect.runPromise(createEventPlane(network, 32));
    });
  });

  describe('publish and subscribe', () => {
    test('subscriber receives published message', async () => {
      const network = AgentNetwork.setup(({ mainChannel }) => {
        mainChannel('main');
      });

      const program = Effect.gen(function* () {
        const plane = yield* createEventPlane(network);
        const dequeue = yield* plane.subscribe(ChannelName('main'));
        yield* plane.publish(ChannelName('main'), {
          name: 'test-event',
          meta,
          payload: { value: 42 },
        });
        const received = yield* Queue.take(dequeue);
        return received;
      });

      const received = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(received).toEqual({
        name: 'test-event',
        meta,
        payload: { value: 42 },
      });
    });

    test('multiple subscribers each receive the same message (broadcast)', async () => {
      const network = AgentNetwork.setup(({ mainChannel }) => {
        mainChannel('main');
      });

      const program = Effect.gen(function* () {
        const plane = yield* createEventPlane(network);
        const dequeue1 = yield* plane.subscribe(ChannelName('main'));
        const dequeue2 = yield* plane.subscribe(ChannelName('main'));

        yield* plane.publish(ChannelName('main'), {
          name: 'broadcast',
          meta,
          payload: {},
        });

        const [r1, r2] = yield* Effect.all([
          Queue.take(dequeue1),
          Queue.take(dequeue2),
        ]);
        return [r1, r2];
      });

      const [r1, r2] = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(r1).toEqual(r2);
      expect(r1).toMatchObject({ name: 'broadcast', meta });
    });
  });

  describe('publishToChannels', () => {
    test('publishes to all target channels', async () => {
      const network = AgentNetwork.setup(({ mainChannel, createChannel }) => {
        mainChannel('main');
        createChannel('client');
        createChannel('logs');
      });

      const program = Effect.gen(function* () {
        const plane = yield* createEventPlane(network);
        const channels = network.getChannels();
        const mainCh = channels.get('main')!;
        const clientCh = channels.get('client')!;
        const logsCh = channels.get('logs')!;

        const clientDequeue = yield* plane.subscribe(ChannelName('client'));
        const logsDequeue = yield* plane.subscribe(ChannelName('logs'));

        yield* plane.publishToChannels([clientCh, logsCh], {
          name: 'multi',
          meta,
          payload: { x: 1 },
        });

        const [fromClient, fromLogs] = yield* Effect.all([
          Queue.take(clientDequeue),
          Queue.take(logsDequeue),
        ]);

        return { fromClient, fromLogs, mainCh };
      });

      const { fromClient, fromLogs } = await Effect.runPromise(
        program.pipe(Effect.scoped),
      );

      expect(fromClient).toMatchObject({ name: 'multi', payload: { x: 1 } });
      expect(fromLogs).toMatchObject({ name: 'multi', payload: { x: 1 } });
    });
  });

  describe('runSubscriber', () => {
    test('invokes agent with envelope and wires emit to publish', async () => {
      const weatherSet = AgentNetworkEvent.of(
        'weather-set',
        S.Struct({ temp: S.Number }),
      );
      const weatherForecast = AgentNetworkEvent.of(
        'weather-forecast-created',
        S.Struct({ forecast: S.String }),
      );

      const logicSpy = vitest.fn<
        [
          {
            triggerEvent: { meta: EventMeta; payload: { temp: number } };
            emit: (e: unknown) => void;
          },
        ],
        Promise<void>
      >(async ({ triggerEvent, emit }) => {
        emit({
          name: 'weather-forecast-created',
          payload: { forecast: `Temp was ${triggerEvent.payload.temp}` },
        });
      });

      const WeatherAgent = AgentFactory.run()
        .listensTo([weatherSet])
        .emits([weatherForecast])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .logic(logicSpy as any);

      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client');
          const agent = WeatherAgent.produce({});
          registerAgent(agent).subscribe(main).publishTo(client);
          return { main, client };
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* createEventPlane(network);
        const [reg] = [...network.getAgentRegistrations().values()];
        const dequeue = yield* plane.subscribe(reg!.subscribedTo[0]!.name);

        const fiber = yield* runSubscriber(
          reg!.agent,
          reg!.publishesTo,
          dequeue,
          plane,
        );

        yield* plane.publish(reg!.subscribedTo[0]!.name, {
          name: 'weather-set',
          meta,
          payload: { temp: 25 },
        });

        const clientDequeue = yield* plane.subscribe(reg!.publishesTo[0]!.name);
        const emitted = yield* Queue.take(clientDequeue);

        yield* Fiber.interrupt(fiber);

        return { emitted, logicSpy };
      });

      const { emitted, logicSpy: subscriberSpy } = await Effect.runPromise(
        program.pipe(Effect.scoped),
      );

      expect(emitted).toMatchObject({
        name: 'weather-forecast-created',
        payload: { forecast: 'Temp was 25' },
      });
      expect(subscriberSpy).toHaveBeenCalledTimes(1);
      expect(subscriberSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerEvent: expect.objectContaining({
            name: 'weather-set',
            payload: { temp: 25 },
          }),
        }),
      );
    });

    test('does NOT invoke agent when event name is not in listensTo', async () => {
      const weatherSet = AgentNetworkEvent.of(
        'weather-set',
        S.Struct({ temp: S.Number }),
      );

      const filterSpy = vitest.fn().mockResolvedValue(undefined);

      const WeatherAgent = AgentFactory.run()
        .listensTo([weatherSet])
        .logic(filterSpy);

      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client');
          const agent = WeatherAgent.produce({});
          registerAgent(agent).subscribe(main).publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* createEventPlane(network);
        const [reg] = [...network.getAgentRegistrations().values()];
        const dequeue = yield* plane.subscribe(reg!.subscribedTo[0]!.name);

        const fiber = yield* runSubscriber(
          reg!.agent,
          reg!.publishesTo,
          dequeue,
          plane,
        );

        yield* plane.publish(reg!.subscribedTo[0]!.name, {
          name: 'other-event',
          meta,
          payload: { ignored: true },
        });

        yield* Effect.sleep('20 millis');
        yield* Fiber.interrupt(fiber);

        return filterSpy;
      });

      const spy = await Effect.runPromise(program.pipe(Effect.scoped));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    test('agents receive and process published events', async () => {
      const weatherSet = AgentNetworkEvent.of(
        'weather-set',
        S.Struct({ temp: S.Number }),
      );
      const weatherForecast = AgentNetworkEvent.of(
        'weather-forecast-created',
        S.Struct({ forecast: S.String }),
      );

      const runLogicSpy = vitest.fn<
        [
          {
            triggerEvent: { meta: EventMeta; payload: { temp: number } };
            emit: (e: unknown) => void;
          },
        ],
        Promise<void>
      >(async ({ triggerEvent, emit }) => {
        emit({
          name: 'weather-forecast-created',
          payload: { forecast: `Temp was ${triggerEvent.payload.temp}` },
        });
      });

      const WeatherAgent = AgentFactory.run()
        .listensTo([weatherSet])
        .emits([weatherForecast])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .logic(runLogicSpy as any);

      const network = AgentNetwork.setup(
        ({ mainChannel, createChannel, registerAgent }) => {
          const main = mainChannel('main');
          const client = createChannel('client');
          const agent = WeatherAgent.produce({});
          registerAgent(agent).subscribe(main).publishTo(client);
        },
      );

      const program = Effect.gen(function* () {
        const plane = yield* createEventPlane(network);
        const mainCh = network.getMainChannel()!;
        const clientCh = network.getChannels().get('client')!;

        const runFiber = yield* Effect.fork(
          run(network, plane).pipe(Effect.scoped),
        );

        yield* Effect.sleep('10 millis');

        const clientDequeue = yield* plane.subscribe(clientCh.name);
        yield* plane.publish(mainCh.name, {
          name: 'weather-set',
          meta,
          payload: { temp: 30 },
        });

        const emitted = yield* Queue.take(clientDequeue);

        yield* Fiber.interrupt(runFiber);

        return { emitted, runLogicSpy };
      });

      const { emitted, runLogicSpy: spy } = await Effect.runPromise(
        program.pipe(Effect.scoped),
      );

      expect(emitted).toMatchObject({
        name: 'weather-forecast-created',
        payload: { forecast: 'Temp was 30' },
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerEvent: expect.objectContaining({
            name: 'weather-set',
            payload: { temp: 30 },
          }),
        }),
      );
    });
  });

  describe('shutdown', () => {
    test('shuts down all PubSubs', async () => {
      const network = AgentNetwork.setup(({ mainChannel }) => {
        mainChannel('main');
      });

      const program = Effect.gen(function* () {
        const plane = yield* createEventPlane(network);
        yield* plane.shutdown;
      });

      await Effect.runPromise(program);
    });
  });
});
