import { describe, expect, test } from 'vitest';
import { Schema as S } from 'effect';
import { TestCase } from './test-case';

describe('TestCase', () => {
  const inputSchema = S.Struct({ prompt: S.String });

  test('describe() creates a TestCase with static input', () => {
    const tc = TestCase.describe({
      name: 'generates a title',
      tags: ['agent', 'title-gen'],
      inputSchema,
      input: { prompt: 'hello world' },
    });

    expect(tc.getName()).toBe('generates a title');
    expect(tc.getTags()).toEqual(['agent', 'title-gen']);
    expect(tc.getInput()).toEqual({ prompt: 'hello world' });
  });

  test('describe() accepts builder functions for input', () => {
    const tc = TestCase.describe({
      name: 'dynamic input',
      tags: [],
      inputSchema,
      input: () => ({ prompt: 'built' }),
    });

    expect(tc.getInput()).toEqual({ prompt: 'built' });
  });

  test('describe() accepts outputSchema and output and exposes them', () => {
    const outputSchema = S.Struct({ expectedLabel: S.String });
    const tc = TestCase.describe({
      name: 'with expected output',
      tags: [],
      inputSchema,
      input: { prompt: 'hello' },
      outputSchema,
      output: { expectedLabel: 'greeting' },
    });

    expect(tc.getOutputSchema()).toBe(outputSchema);
    expect(tc.getOutput()).toEqual({ expectedLabel: 'greeting' });
  });

  test('output builder functions are lazy', () => {
    let counter = 0;
    const outputSchema = S.Struct({ expected: S.String });
    const tc = TestCase.describe({
      name: 'dynamic output',
      tags: [],
      inputSchema,
      input: { prompt: 'hello' },
      outputSchema,
      output: () => {
        counter += 1;
        return { expected: `call-${counter}` };
      },
    });

    expect(tc.getOutput()).toEqual({ expected: 'call-1' });
    expect(tc.getOutput()).toEqual({ expected: 'call-2' });
    expect(counter).toBe(2);
  });

  test('builder functions are called on each access (lazy)', () => {
    let counter = 0;
    const tc = TestCase.describe({
      name: 'lazy test',
      tags: [],
      inputSchema,
      input: () => {
        counter += 1;
        return { prompt: `call-${counter}` };
      },
    });

    expect(tc.getInput()).toEqual({ prompt: 'call-1' });
    expect(tc.getInput()).toEqual({ prompt: 'call-2' });
    expect(counter).toBe(2);
  });

  test('exposes input schema', () => {
    const tc = TestCase.describe({
      name: 'schema test',
      tags: [],
      inputSchema,
      input: { prompt: 'x' },
    });

    expect(tc.getInputSchema()).toBe(inputSchema);
  });

  test('returns an immutable instance', () => {
    const tc = TestCase.describe({
      name: 'immutable',
      tags: ['a'],
      inputSchema,
      input: { prompt: 'p' },
    });

    expect(tc).toBeInstanceOf(TestCase);
    expect(tc.getTags()).toEqual(['a']);
  });

  test('getInput returns type inferred from inputSchema', () => {
    const inputSchemaWithCount = S.Struct({ prompt: S.String, count: S.Number });
    const tc = TestCase.describe({
      name: 'typed',
      tags: [],
      inputSchema: inputSchemaWithCount,
      input: { prompt: 'x', count: 1 },
    });
    const input: { prompt: string; count: number } = tc.getInput();
    expect(input.prompt).toBe('x');
    expect(input.count).toBe(1);
  });

  test('getOutput returns inferred type when outputSchema provided', () => {
    const outputSchema = S.Struct({ expected: S.Number, label: S.String });
    const tc = TestCase.describe({
      name: 'typed output',
      tags: [],
      inputSchema,
      input: { prompt: 'x' },
      outputSchema,
      output: { expected: 42, label: 'ok' },
    });
    const output: { expected: number; label: string } | undefined =
      tc.getOutput();
    expect(output?.expected).toBe(42);
    expect(output?.label).toBe('ok');
  });

  test('getInput rejects assignment to wrong type', () => {
    const tc = TestCase.describe({
      name: 'reject wrong',
      tags: [],
      inputSchema,
      input: { prompt: 'x' },
    });
    // @ts-expect-error - getInput returns { prompt: string }, prompt is not number
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _: { prompt: number } = tc.getInput();
  });

  test('input config rejects wrong shape', () => {
    TestCase.describe({
      name: 'wrong input shape',
      tags: [],
      inputSchema,
      // @ts-expect-error - input must match inputSchema shape ({ prompt: string })
      input: { wrongKey: 'x' },
    });
  });
});
