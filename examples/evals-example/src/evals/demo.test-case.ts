import { TestCase } from '@m4trix/evals';
import { Schema as S } from 'effect';

const inputSchema = S.Struct({ prompt: S.String });

export const shortPromptCase = TestCase.describe({
  name: 'Summarize product description for search',
  tags: ['demo', 'short'],
  inputSchema,
  input: { prompt: 'Hello from evals example' },
});

export const longPromptCase = TestCase.describe({
  name: 'Classify customer support ticket intent',
  tags: ['demo', 'long'],
  inputSchema,
  input: {
    prompt:
      'This is a longer fake prompt to demonstrate score differences in a tiny example project.',
  },
});

export const greetingCase = TestCase.describe({
  name: 'Extract key entities from news article',
  tags: ['demo', 'greeting'],
  inputSchema,
  input: { prompt: 'Hey there!' },
});

export const questionCase = TestCase.describe({
  name: 'Generate FAQ response for pricing',
  tags: ['demo', 'question'],
  inputSchema,
  input: { prompt: 'What is the weather like on Mars today?' },
});

export const tinyPromptCase = TestCase.describe({
  name: 'Answer factual question about history',
  tags: ['demo', 'tiny'],
  inputSchema,
  input: { prompt: 'ok' },
});

export const mediumPromptCase = TestCase.describe({
  name: 'Rewrite technical text for clarity',
  tags: ['demo', 'medium'],
  inputSchema,
  input: {
    prompt: 'Write a short summary about testing and observability in one sentence.',
  },
});

export const storyPromptCase = TestCase.describe({
  name: 'Generate creative marketing headline',
  tags: ['demo', 'story'],
  inputSchema,
  input: {
    prompt:
      'Tell a creative story about a lighthouse keeper who tracks every storm in a detailed journal.',
  },
});

export const codingPromptCase = TestCase.describe({
  name: 'Explain coding concept with examples',
  tags: ['demo', 'coding'],
  inputSchema,
  input: {
    prompt:
      'Explain the difference between unit tests, integration tests, and end-to-end tests with examples.',
  },
});
