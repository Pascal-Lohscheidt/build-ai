import { diffLines } from 'diff';

function toJsonLines(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDiffString(
  changes: Array<{ value: string; added?: boolean; removed?: boolean }>,
): string {
  const lines: string[] = [];
  for (const part of changes) {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const partLines = part.value.split('\n');
    if (partLines[partLines.length - 1] === '') {
      partLines.pop();
    }
    for (const line of partLines) {
      lines.push(`${prefix} ${line}`);
    }
  }
  return lines.join('\n');
}

function createDiffString(expected: unknown, actual: unknown): string {
  const expectedStr = toJsonLines(expected);
  const actualStr = toJsonLines(actual);
  const changes = diffLines(expectedStr, actualStr);
  return formatDiffString(changes);
}

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
 * Creates a DiffLogEntry for storage in run artifacts (plain text, no ANSI).
 */
export function createDiffLogEntry(
  expected: unknown,
  actual: unknown,
  options?: { label?: string },
): DiffLogEntry {
  const diff = createDiffString(expected, actual);
  return {
    type: 'diff',
    label: options?.label,
    expected,
    actual,
    diff: diff || '(no differences)',
  };
}

/**
 * Returns the plain diff string. Use for storage or when applying colors separately.
 */
export function getDiffString(entry: DiffLogEntry): string {
  return createDiffString(entry.expected, entry.actual) || '(no differences)';
}

/**
 * Returns lines from the diff, each with a type for color application.
 */
export function getDiffLines(entry: DiffLogEntry): Array<{ type: 'add' | 'remove' | 'context'; line: string }> {
  const raw = createDiffString(entry.expected, entry.actual) || '(no differences)';
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
  const diff = createDiffString(expected, actual);
  if (options.color) {
    const lines = diff.split('\n').map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('-') && !trimmed.startsWith('---')) {
        return `\x1b[31m${line}\x1b[0m`;
      }
      if (trimmed.startsWith('+') && !trimmed.startsWith('+++')) {
        return `\x1b[32m${line}\x1b[0m`;
      }
      return line;
    });
    const colored = lines.join('\n');
    console.log(colored || '(no differences)');
    return colored;
  }
  console.log(diff || '(no differences)');
  return diff;
}
