import { diffString } from 'json-diff';

export interface DiffLogEntry {
  type: 'diff';
  label?: string;
  expected: unknown;
  actual: unknown;
  diff: string;
}

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
/**
 * Creates a DiffLogEntry for storage in run artifacts (plain text, no ANSI).
 */
export function createDiffLogEntry(
  expected: unknown,
  actual: unknown,
  options?: { label?: string },
): DiffLogEntry {
  const diff = diffString(expected, actual, { color: false });
  return {
    type: 'diff',
    label: options?.label,
    expected,
    actual,
    diff: diff || '(no differences)',
  };
}

/**
 * Returns the plain diff string from json-diff (no ANSI). Use for storage or
 * when applying colors separately.
 */
export function getDiffString(entry: DiffLogEntry): string {
  return diffString(entry.expected, entry.actual, { color: false }) || '(no differences)';
}

/**
 * Returns lines from the diff, each with a type for color application.
 * Uses json-diff for the actual diff algorithm.
 */
export function getDiffLines(entry: DiffLogEntry): Array<{ type: 'add' | 'remove' | 'context'; line: string }> {
  const raw = diffString(entry.expected, entry.actual, { color: false }) || '(no differences)';
  return raw.split('\n').map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('-') && !trimmed.startsWith('---')) {
      return { type: 'remove' as const, line };
    }
    if (trimmed.startsWith('+') && !trimmed.startsWith('+++')) {
      return { type: 'add' as const, line };
    }
    return { type: 'context' as const, line };
  });
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
