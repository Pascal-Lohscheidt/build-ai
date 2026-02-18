import { Schema as S } from 'effect';

type InputOrBuilder<T> = T | (() => T);

interface TestCaseConfig<TInput> {
  name: string;
  tags: string[];
  inputSchema: S.Schema.Any;
  input: InputOrBuilder<TInput>;
}

interface TestCaseDescribeConfig<TI extends S.Schema.Any> {
  name: string;
  tags: string[];
  inputSchema: TI;
  input: InputOrBuilder<S.Schema.Type<TI>>;
}

function resolve<T>(value: InputOrBuilder<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

export class TestCase<TInput = unknown> {
  private readonly _config: TestCaseConfig<TInput>;

  private constructor(config: TestCaseConfig<TInput>) {
    this._config = config;
  }

  static describe<TI extends S.Schema.Any>(
    config: TestCaseDescribeConfig<TI>,
  ): TestCase<S.Schema.Type<TI>> {
    return new TestCase<S.Schema.Type<TI>>({
      name: config.name,
      tags: config.tags,
      inputSchema: config.inputSchema,
      input: config.input,
    });
  }

  getName(): string {
    return this._config.name;
  }

  getTags(): string[] {
    return this._config.tags;
  }

  getInputSchema(): S.Schema.Any {
    return this._config.inputSchema;
  }

  getInput(): TInput {
    return resolve(this._config.input);
  }
}
