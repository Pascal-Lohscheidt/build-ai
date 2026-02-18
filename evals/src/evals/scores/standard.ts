import { Score } from '../score';

export interface PercentScoreData {
  value: number;
}

export const percentScore = Score.of<PercentScoreData>({
  id: 'percent',
  name: 'Score',
  displayStrategy: 'bar',
  format: (data) => data.value.toFixed(2),
});

export interface BinaryScoreData {
  passed: boolean;
}

export const binaryScore = Score.of<BinaryScoreData>({
  id: 'binary',
  name: 'Result',
  displayStrategy: 'passFail',
  format: (data) => (data.passed ? 'PASSED' : 'NOT PASSED'),
});
