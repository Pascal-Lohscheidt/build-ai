export interface RunnerDiscoveryConfig {
  rootDir: string;
  datasetSuffixes: ReadonlyArray<string>;
  evaluatorSuffixes: ReadonlyArray<string>;
  testCaseSuffixes: ReadonlyArray<string>;
  excludeDirectories: ReadonlyArray<string>;
}

export interface RunnerConfig {
  discovery: RunnerDiscoveryConfig;
  artifactDirectory: string;
}

export const defaultRunnerConfig: RunnerConfig = {
  discovery: {
    rootDir: process.cwd(),
    datasetSuffixes: ['.dataset.ts', '.dataset.tsx', '.dataset.js', '.dataset.mjs'],
    evaluatorSuffixes: [
      '.evaluator.ts',
      '.evaluator.tsx',
      '.evaluator.js',
      '.evaluator.mjs',
    ],
    testCaseSuffixes: [
      '.test-case.ts',
      '.test-case.tsx',
      '.test-case.js',
      '.test-case.mjs',
    ],
    excludeDirectories: ['node_modules', 'dist', '.next', '.git', '.pnpm-store'],
  },
  artifactDirectory: '.eval-results',
};

export function withRunnerConfig(overrides?: Partial<RunnerConfig>): RunnerConfig {
  if (!overrides) {
    return defaultRunnerConfig;
  }
  const discovery = overrides.discovery
    ? {
        ...defaultRunnerConfig.discovery,
        ...overrides.discovery,
      }
    : defaultRunnerConfig.discovery;

  return {
    ...defaultRunnerConfig,
    ...overrides,
    discovery,
  };
}
