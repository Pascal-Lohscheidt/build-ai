import { Cause, Effect, Fiber, PubSub, Queue, Scope } from 'effect';
import type { AgentNetwork, AnyAgent } from './agent-network';
import type { EventMeta } from './agent-network-event';
import type { ChannelName, ConfiguredChannel } from './channel';

/* ─── Envelope ─── */

export type Envelope = {
  name: string;
  meta: EventMeta;
  payload: unknown;
};

/* ─── EventPlane ─── */

export type EventPlane = {
  readonly publish: (
    channel: ChannelName,
    envelope: Envelope,
  ) => Effect.Effect<boolean>;
  readonly publishToChannels: (
    channels: readonly ConfiguredChannel[],
    envelope: Envelope,
  ) => Effect.Effect<boolean>;
  readonly subscribe: (
    channel: ChannelName,
  ) => Effect.Effect<Queue.Dequeue<Envelope>, never, Scope.Scope>;
  readonly shutdown: Effect.Effect<void>;
};

/* ─── Create EventPlane ─── */

const DEFAULT_CAPACITY = 16;

/**
 * Creates an EventPlane from an AgentNetwork. One PubSub per channel with
 * bounded back-pressure. Use `Effect.scoped` when running to ensure proper
 * cleanup.
 */
export const createEventPlane = (
  network: AgentNetwork,
  capacity: number = DEFAULT_CAPACITY,
): Effect.Effect<EventPlane> =>
  Effect.gen(function* () {
    const channels = network.getChannels();
    const pubsubs = new Map<ChannelName, PubSub.PubSub<Envelope>>();

    for (const channel of channels.values()) {
      const pubsub = yield* PubSub.bounded<Envelope>(capacity);
      pubsubs.set(channel.name, pubsub);
    }

    const getPubsub = (channel: ChannelName): PubSub.PubSub<Envelope> => {
      const p = pubsubs.get(channel);
      if (!p) throw new Error(`Channel not found: ${channel}`);
      return p;
    };

    const publish = (
      channel: ChannelName,
      envelope: Envelope,
    ): Effect.Effect<boolean> => PubSub.publish(getPubsub(channel), envelope);

    const publishToChannels = (
      targetChannels: readonly ConfiguredChannel[],
      envelope: Envelope,
    ): Effect.Effect<boolean> =>
      Effect.all(
        targetChannels.map((c) => publish(c.name, envelope)),
        { concurrency: 'unbounded' },
      ).pipe(Effect.map((results) => results.every(Boolean)));

    const subscribe = (
      channel: ChannelName,
    ): Effect.Effect<Queue.Dequeue<Envelope>, never, Scope.Scope> =>
      PubSub.subscribe(getPubsub(channel));

    const shutdown = Effect.all([...pubsubs.values()].map(PubSub.shutdown), {
      concurrency: 'unbounded',
    }).pipe(Effect.asVoid);

    return {
      publish,
      publishToChannels,
      subscribe,
      shutdown,
    };
  });

/* ─── Run Subscriber Loop ─── */

/**
 * Runs a single agent's subscription loop on one channel. Takes messages from
 * the dequeue, invokes the agent with the envelope as triggerEvent when the
 * event name matches the agent's listensTo, and wires emit to publish to the
 * agent's output channels.
 */
type EmitQueue = Queue.Queue<{
  channels: readonly ConfiguredChannel[];
  envelope: Envelope;
}>;

export const runSubscriber = (
  agent: AnyAgent,
  publishesTo: readonly ConfiguredChannel[],
  dequeue: Queue.Dequeue<Envelope>,
  plane: EventPlane,
  emitQueue?: EmitQueue,
): Effect.Effect<Fiber.RuntimeFiber<void, never>> =>
  Effect.gen(function* () {
    const listensTo = agent.getListensTo?.() ?? [];

    const processOne = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const envelope = yield* Queue.take(dequeue);
        if (listensTo.length > 0 && !listensTo.includes(envelope.name)) {
          return;
        }
        yield* Effect.tryPromise({
          try: () =>
            agent.invoke({
              triggerEvent: envelope,
              emit: (userEvent: { name: string; payload: unknown }) => {
                const fullEnvelope: Envelope = {
                  name: userEvent.name,
                  meta: envelope.meta,
                  payload: userEvent.payload,
                };
                if (emitQueue) {
                  Effect.runPromise(
                    Queue.offer(emitQueue, {
                      channels: publishesTo,
                      envelope: fullEnvelope,
                    }),
                  ).catch(() => {});
                } else {
                  Effect.runFork(
                    plane.publishToChannels(publishesTo, fullEnvelope),
                  );
                }
              },
            }),
          catch: (e) => e,
        });
      }).pipe(
        Effect.catchAllCause((cause) =>
          Cause.isInterrupted(cause)
            ? Effect.void
            : Effect.sync(() => {
                console.error(`Agent ${agent.getId()} failed:`, cause);
              }).pipe(Effect.asVoid),
        ),
      );

    const loop = (): Effect.Effect<void, never, never> =>
      processOne().pipe(Effect.flatMap(() => loop()));

    return yield* Effect.fork(loop());
  });

/* ─── Run Network ─── */

export type RunOptions = {
  /** When provided, agent emits are queued and published by a drain fiber in the same Effect context. Use when run is forked from expose without a shared plane. */
  emitQueue?: EmitQueue;
};

/**
 * Runs the event plane: starts a subscriber loop for each (agent, channel)
 * pair. Runs until the scope ends (e.g. on interrupt). Use Effect.scoped
 * to ensure subscriptions are properly cleaned up.
 */
export const run = (
  network: AgentNetwork,
  plane: EventPlane,
  options?: RunOptions,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const registrations = network.getAgentRegistrations();
    const emitQueue = options?.emitQueue;

    for (const reg of registrations.values()) {
      for (const channel of reg.subscribedTo) {
        const dequeue = yield* plane.subscribe(channel.name);
        yield* runSubscriber(
          reg.agent,
          reg.publishesTo,
          dequeue,
          plane,
          emitQueue,
        );
      }
    }

    yield* Effect.never;
  });
