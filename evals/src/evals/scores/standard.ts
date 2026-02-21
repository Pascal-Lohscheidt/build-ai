import { aggregateAll, aggregateAverageWithVariance } from '../aggregators';
import { Score } from '../score';

export interface PercentScoreData {
  value: number;
  stdDev?: number;
  count?: number;
}

export const percentScore = Score.of<PercentScoreData>({
  id: 'percent',
  name: 'Score',
  displayStrategy: 'bar',
  format: (data, options) => {
    if (options?.isAggregated) {
      return data.stdDev != null
        ? `Avg: ${data.value.toFixed(2)} ± ${data.stdDev.toFixed(2)}`
        : `Avg: ${data.value.toFixed(2)}`;
    }
    return data.value.toFixed(2);
  },
  aggregate: aggregateAverageWithVariance,
});

export interface BinaryScoreData {
  passed: boolean;
  passedCount?: number;
  totalCount?: number;
}

export const binaryScore = Score.of<BinaryScoreData>({
  id: 'binary',
  name: 'Result',
  displayStrategy: 'passFail',
  format: (data, options) => {
    if (options?.isAggregated) {
      const base = data.passed ? 'All: PASSED' : 'Some: FAILED';
      if (
        data.passedCount != null &&
        data.totalCount != null &&
        data.totalCount > 1
      ) {
        return `${base} (${data.passedCount}/${data.totalCount})`;
      }
      return base;
    }
    return data.passed ? 'PASSED' : 'NOT PASSED';
  },
  aggregate: aggregateAll,
});
