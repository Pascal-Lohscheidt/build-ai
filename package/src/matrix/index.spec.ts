import { describe, it, expect } from 'vitest';
import { Context, Effect, pipe } from 'effect';

export function divide(
  a: number,
  b: number
): Effect.Effect<number, string, never> {
  if (b === 0) {
    return Effect.fail('Division by zero');
  }
  return Effect.succeed(a / b);
}

describe('Effect teaching', () => {
  it('divide > 4 / 2 = 2', () => {
    const result = Effect.runSync(divide(4, 2));

    expect(result).toBe(2); // 2
  });

  it('test', async () => {
    const start = Effect.succeed([4, 2]);

    const effect = pipe(
      start,
      Effect.map(([a, b]) => divide(a, b)),
      Effect.runSync,
      Effect.runSync
    );

    expect(effect).toBe(2);

    const result = pipe(
      Effect.succeed([4, 0]),
      Effect.flatMap(([a, b]) => divide(a, b)),
      Effect.match({
        onSuccess: (value) => 'Success: ' + value,
        onFailure: (error) => 'Failure: ' + error,
      }),
      Effect.runSync
    );

    expect(result).toBe('Failure: Division by zero');

    const square = (n: number): Effect.Effect<number, never, never> =>
      Effect.succeed(n * n);

    const getNumber = Effect.succeed(2);

    const squared = getNumber.pipe(Effect.flatMap(square), Effect.runSync);

    expect(squared).toBe(4);

    const squared2 = pipe(getNumber, Effect.flatMap(square), Effect.runSync);

    expect(squared2).toBe(4);
  });

  it('fibers', async () => {
    const delay = (ms: number): Effect.Effect<void, never, never> =>
      Effect.sleep(ms);

    const fetchUsers = pipe(
      delay(400),
      Effect.flatMap(() => Effect.sync(() => ['user1', 'user2', 'user3']))
    );

    const fetchSettings = pipe(
      delay(500),
      Effect.flatMap(() =>
        Effect.sync(() => ({
          theme: 'dark',
          language: 'en',
        }))
      )
    );

    const parallelFetches = pipe(
      Effect.all([fetchUsers, fetchSettings], { concurrency: 'unbounded' }),
      Effect.map(([users, settings]) => ({ users, ...settings }))
    );

    const result = await pipe(parallelFetches, Effect.runPromise);

    expect(result).toEqual({
      users: ['user1', 'user2', 'user3'],
      theme: 'dark',
      language: 'en',
    });
  });
});
