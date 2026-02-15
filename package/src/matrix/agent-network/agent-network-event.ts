import { Effect, Schema as S } from 'effect';
import type { ParseError } from 'effect/ParseResult';

/** Standard meta carried by every event */
export const EventMetaSchema = S.Struct({
  runId: S.String,
  contextId: S.optional(S.String),
  correlationId: S.optional(S.String),
  causationId: S.optional(S.String),
  ts: S.optional(S.Number),
});

export type EventMeta = S.Schema.Type<typeof EventMetaSchema>;

// Re-export Schema from effect for convenience
export { Schema as S } from 'effect';

export type AgentNetworkEventDef<
  EventName extends string,
  PayloadSchema extends S.Schema.Any,
> = {
  readonly _tag: 'AgentNetworkEventDef';
  readonly name: EventName;
  readonly payload: PayloadSchema;

  /** Decode unknown payload -> typed payload (Effect) */
  readonly decodePayload: (
    u: unknown,
  ) => Effect.Effect<S.Schema.Type<PayloadSchema>, ParseError>;

  /** Decode the full envelope (meta + payload) */
  readonly decode: (
    u: unknown,
  ) => Effect.Effect<
    { name: EventName; meta: EventMeta; payload: S.Schema.Type<PayloadSchema> },
    ParseError
  >;

  /**
   * Create an instantiated event from meta + payload (validated via schema).
   * Default API: sync, throws on validation error.
   */
  readonly make: (
    meta: unknown,
    payload: unknown,
  ) => {
    name: EventName;
    meta: EventMeta;
    payload: S.Schema.Type<PayloadSchema>;
  };

  /**
   * Effect version of make. Use when composing in Effect pipelines.
   */
  readonly makeEffect: (
    meta: unknown,
    payload: unknown,
  ) => Effect.Effect<
    { name: EventName; meta: EventMeta; payload: S.Schema.Type<PayloadSchema> },
    ParseError
  >;

  /**
   * Type guard: returns true if `u` is a valid event of this type.
   */
  readonly is: (u: unknown) => u is {
    name: EventName;
    meta: EventMeta;
    payload: S.Schema.Type<PayloadSchema>;
  };
};

type Envelope<EventName extends string, Meta, Payload> = {
  name: EventName;
  meta: Meta;
  payload: Payload;
};

export const AgentNetworkEvent = {
  of<const EventName extends string, PS extends S.Schema.Any>(
    name: EventName,
    payload: PS,
  ): AgentNetworkEventDef<EventName, PS> {
    const decodePayload = S.decodeUnknown(payload);
    const envelopeSchema = S.Struct({
      name: S.Literal(name),
      meta: EventMetaSchema,
      payload,
    });
    const decodeEnvelope = S.decodeUnknown(envelopeSchema);

    const make = (
      meta: unknown,
      payload: unknown,
    ): Envelope<EventName, EventMeta, S.Schema.Type<PS>> =>
      Effect.runSync(
        decodeEnvelope({ name, meta, payload }) as unknown as Effect.Effect<
          Envelope<EventName, EventMeta, S.Schema.Type<PS>>,
          ParseError
        >,
      );

    const makeEffect = (
      meta: unknown,
      payload: unknown,
    ): Effect.Effect<
      Envelope<EventName, EventMeta, S.Schema.Type<PS>>,
      ParseError
    > =>
      decodeEnvelope({ name, meta, payload }) as unknown as Effect.Effect<
        Envelope<EventName, EventMeta, S.Schema.Type<PS>>,
        ParseError
      >;

    const is = S.is(envelopeSchema) as unknown as (
      u: unknown,
    ) => u is Envelope<EventName, EventMeta, S.Schema.Type<PS>>;

    return {
      _tag: 'AgentNetworkEventDef' as const,
      name,
      payload,
      decodePayload: decodePayload as unknown as AgentNetworkEventDef<
        EventName,
        PS
      >['decodePayload'],
      decode: decodeEnvelope as unknown as AgentNetworkEventDef<
        EventName,
        PS
      >['decode'],
      make,
      makeEffect,
      is,
    };
  },
};
