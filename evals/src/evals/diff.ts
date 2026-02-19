import { diffString } from 'json-diff';

export interface PrintJsonDiffOptions {
  /** Enable ANSI colors (default: true) */
  color?: boolean;
}

/**
 * Prints a colorized JSON diff between two values to stdout.
 * Useful in evaluators to show expected vs actual output differences.
 * @param expected - The expected/reference value (shown as removed with -)
 * @param actual - The actual value (shown as added with +)
 * @returns The diff string (also printed to console)
 */
export function printJsonDiff(
  expected: unknown,
  actual: unknown,
  options: PrintJsonDiffOptions = {},
): string {
  const { color = true } = options;
  const diff = diffString(expected, actual, { color });
  console.log(diff || '(no differences)');
  return diff;
}
