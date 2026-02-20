import { aggregateAll, aggregateAverage } from '../aggregators';
import { Score } from '../score';

export interface PercentScoreData {
  value: number;
}

export const percentScore = Score.of<PercentScoreData>({
  id: 'percent',
  name: 'Score',
  displayStrategy: 'bar',
  format: (data, options) =>
    options?.isAggregated ? `Avg: ${data.value.toFixed(2)}` : data.value.toFixed(2),
  aggregate: aggregateAverage,
});

export interface BinaryScoreData {
  passed: boolean;
}

export const binaryScore = Score.of<BinaryScoreData>({
  id: 'binary',
  name: 'Result',
  displayStrategy: 'passFail',
  format: (data, options) =>
    options?.isAggregated
      ? (data.passed ? 'All: PASSED' : 'Some: FAILED')
      : (data.passed ? 'PASSED' : 'NOT PASSED'),
  aggregate: aggregateAll,
});
