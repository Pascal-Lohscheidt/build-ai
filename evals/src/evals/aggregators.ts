/** Average of numeric `value` fields (e.g. for percentScore) */
export function aggregateAverage(values: ReadonlyArray<{ value: number }>): {
  value: number;
} {
  if (values.length === 0) {
    return { value: 0 };
  }
  const sum = values.reduce((s, v) => s + v.value, 0);
  return { value: sum / values.length };
}

/** All runs must pass (for binaryScore) */
export function aggregateAll(values: ReadonlyArray<{ passed: boolean }>): {
  passed: boolean;
} {
  return { passed: values.length > 0 && values.every((v) => v.passed) };
}

type TokenCountSum = {
  input: number;
  output: number;
  inputCached: number;
  outputCached: number;
};

/** Sum token counts across reruns */
export function aggregateTokenCountSum(
  values: ReadonlyArray<{
    input?: number;
    output?: number;
    inputCached?: number;
    outputCached?: number;
  }>,
): TokenCountSum {
  const initial: TokenCountSum = {
    input: 0,
    output: 0,
    inputCached: 0,
    outputCached: 0,
  };
  return values.reduce<TokenCountSum>(
    (acc, v) => ({
      input: acc.input + (v.input ?? 0),
      output: acc.output + (v.output ?? 0),
      inputCached: acc.inputCached + (v.inputCached ?? 0),
      outputCached: acc.outputCached + (v.outputCached ?? 0),
    }),
    initial,
  );
}

/** Average latency across reruns */
export function aggregateLatencyAverage(
  values: ReadonlyArray<{ ms: number }>,
): { ms: number } {
  if (values.length === 0) {
    return { ms: 0 };
  }
  const sum = values.reduce((s, v) => s + v.ms, 0);
  return { ms: sum / values.length };
}
