import type { ScoreItem } from '../evals/score';
import { getScoreById } from '../evals';

export function toNumericScoreFromScores(
  scores: ReadonlyArray<ScoreItem>,
): number | undefined {
  for (const item of scores) {
    const def = getScoreById(item.id);
    if (def && def.displayStrategy === 'bar' && typeof item.data === 'object' && item.data !== null && 'value' in item.data) {
      const value = (item.data as { value: unknown }).value;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }
    const numeric = toNumericScore(item.data);
    if (numeric !== undefined) {
      return numeric;
    }
  }
  return undefined;
}

export function toNumericScore(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  if (
    'score' in obj &&
    typeof obj.score === 'number' &&
    Number.isFinite(obj.score)
  ) {
    return obj.score;
  }
  const numberValues = Object.values(value).filter(
    (entry): entry is number =>
      typeof entry === 'number' && Number.isFinite(entry),
  );
  if (numberValues.length === 0) {
    return undefined;
  }
  return (
    numberValues.reduce((sum, entry) => sum + entry, 0) / numberValues.length
  );
}
