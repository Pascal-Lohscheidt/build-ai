import { describe, expect, test } from 'vitest';
import { Effect } from 'effect';
import { AgentNetworkEvent } from './agent-network-event';
import { Schema as S } from 'effect';

describe('AgentNetworkEvent', () => {
  test('should create an event definition', () => {
    const event = AgentNetworkEvent.of('test', S.String);

    expect(event.name).toBe('test');
    expect(event.payload).toBe(S.String);
  });

  test('make (sync) creates and validates an instantiated event', () => {
    const AddTask = AgentNetworkEvent.of(
      'add-task',
      S.Struct({ title: S.String }),
    );

    const result = AddTask.make({ runId: 'run-1' }, { title: 'Do the thing' });

    expect(result).toEqual({
      name: 'add-task',
      meta: { runId: 'run-1' },
      payload: { title: 'Do the thing' },
    });
  });

  test('makeEffect returns Effect for Effect pipelines', () => {
    const AddTask = AgentNetworkEvent.of(
      'add-task',
      S.Struct({ title: S.String }),
    );

    const result = Effect.runSync(
      AddTask.makeEffect({ runId: 'run-1' }, { title: 'Do the thing' }),
    );

    expect(result).toEqual({
      name: 'add-task',
      meta: { runId: 'run-1' },
      payload: { title: 'Do the thing' },
    });
  });

  test('is type guard narrows unknown to event', () => {
    const AddTask = AgentNetworkEvent.of(
      'add-task',
      S.Struct({ title: S.String }),
    );

    const valid = {
      name: 'add-task' as const,
      meta: { runId: 'r1' },
      payload: { title: 'x' },
    };
    const invalid = { name: 'other', meta: {}, payload: {} };

    expect(AddTask.is(valid)).toBe(true);
    expect(AddTask.is(invalid)).toBe(false);

    const unknown: unknown = valid;
    if (AddTask.is(unknown)) {
      expect(unknown.payload.title).toBe('x');
    }
  });
});
