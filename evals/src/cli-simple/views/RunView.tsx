/** @jsxImportSource react */
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { getMetricById, getScoreById } from '../../evals';
import type { ScoreItem } from '../../evals/score';
import type { RunnerApi, RunnerEvent } from '../../runner';
import {
  toNumericScore,
  toNumericScoreFromScores,
} from '../../runner/score-utils';
import { TextBar } from '../../cli/components/TextBar';
import { Banner } from './Banner';
import { Spinner } from './Spinner';

interface EvaluatorScoreRow {
  evaluatorId: string;
  evaluatorName: string;
  scores: ReadonlyArray<ScoreItem>;
  passed: boolean;
  metrics?: ReadonlyArray<{ id: string; data: unknown }>;
}

interface TestCaseProgress {
  name: string;
  completedTestCases: number;
  totalTestCases: number;
  durationMs: number;
  passed: boolean;
  averageScore?: number;
  evaluatorScores: EvaluatorScoreRow[];
}

interface EvaluatorAggregate {
  total: number;
  count: number;
  passed: number;
  failed: number;
}

function scoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

function createBar(value: number, max = 100, width = 20): string {
  const safe = Math.max(0, Math.min(max, value));
  const filled = Math.round((safe / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function formatScorePart(
  item: ScoreItem,
  scoreToColor: (n: number) => 'green' | 'yellow' | 'red',
): string {
  const def = getScoreById(item.id);
  if (!def) {
    const numeric = toNumericScore(item.data);
    return numeric !== undefined ? `${numeric.toFixed(2)}` : 'n/a';
  }
  const formatted = def.format(item.data);
  if (def.displayStrategy === 'bar') {
    const numeric =
      typeof item.data === 'object' &&
      item.data !== null &&
      'value' in item.data
        ? (item.data as { value: unknown }).value
        : toNumericScore(item.data);
    if (typeof numeric === 'number' && Number.isFinite(numeric)) {
      return `${formatted} ${createBar(numeric)}`;
    }
  }
  return formatted;
}

interface RunViewProps {
  runner: RunnerApi;
  datasetName: string;
  evaluatorPattern: string;
  onComplete: (error?: Error) => void;
}

export function RunView({
  runner,
  datasetName,
  evaluatorPattern,
  onComplete,
}: RunViewProps): React.ReactNode {
  const [phase, setPhase] = useState<'loading' | 'running' | 'completed'>(
    'loading',
  );
  const [runInfo, setRunInfo] = useState<{
    runId: string;
    datasetName: string;
    evaluatorNames: string[];
    totalTestCases: number;
  } | null>(null);
  const [testCases, setTestCases] = useState<TestCaseProgress[]>([]);
  const [summary, setSummary] = useState<{
    passedTestCases: number;
    failedTestCases: number;
    totalTestCases: number;
    overallScoreTotal: number;
    overallScoreCount: number;
    aggregates: Map<string, EvaluatorAggregate>;
    artifactPath: string;
  } | null>(null);
  const [evaluatorNameById, setEvaluatorNameById] = useState<
    Map<string, string>
  >(new Map());

  const runEval = useCallback(async () => {
    const dataset = await runner.resolveDatasetByName(datasetName);
    if (!dataset) {
      const known = await runner.collectDatasets();
      const available = known.map((item) => item.dataset.getName()).sort();
      onComplete(
        new Error(
          available.length > 0
            ? `Dataset "${datasetName}" not found. Available: ${available.join(', ')}`
            : `Dataset "${datasetName}" not found.`,
        ),
      );
      return;
    }

    const evaluators =
      await runner.resolveEvaluatorsByNamePattern(evaluatorPattern);
    if (evaluators.length === 0) {
      const known = await runner.collectEvaluators();
      const available = known
        .map((item) => item.evaluator.getName())
        .filter((name): name is string => typeof name === 'string')
        .sort();
      onComplete(
        new Error(
          available.length > 0
            ? `No evaluator matched "${evaluatorPattern}". Available: ${available.join(', ')}`
            : `No evaluator matched "${evaluatorPattern}".`,
        ),
      );
      return;
    }

    const nameById = new Map(
      evaluators.map((item) => [
        item.id,
        item.evaluator.getName() ?? item.id,
      ]),
    );
    setEvaluatorNameById(nameById);

    const aggregates = new Map<string, EvaluatorAggregate>();
    let overallScoreTotal = 0;
    let overallScoreCount = 0;

    const done = new Promise<RunnerEvent>((resolve) => {
      const unsubscribe = runner.subscribeRunEvents((event) => {
        if (event.type === 'TestCaseProgress') {
          const numericScores = event.evaluatorScores
            .map((item) => toNumericScoreFromScores(item.scores))
            .filter((item): item is number => item !== undefined);
          const averageScore =
            numericScores.length > 0
              ? numericScores.reduce((sum, v) => sum + v, 0) / numericScores.length
              : undefined;

          for (const item of event.evaluatorScores) {
            const numeric = toNumericScoreFromScores(item.scores);
            if (numeric !== undefined) {
              const current = aggregates.get(item.evaluatorId) ?? {
                total: 0,
                count: 0,
                passed: 0,
                failed: 0,
              };
              aggregates.set(item.evaluatorId, {
                total: current.total + numeric,
                count: current.count + 1,
                passed: current.passed + (item.passed ? 1 : 0),
                failed: current.failed + (item.passed ? 0 : 1),
              });
              overallScoreTotal += numeric;
              overallScoreCount += 1;
            }
          }

          setTestCases((prev) => [
            ...prev,
            {
              name: event.testCaseName,
              completedTestCases: event.completedTestCases,
              totalTestCases: event.totalTestCases,
              durationMs: event.durationMs,
              passed: event.passed,
              averageScore,
              evaluatorScores: event.evaluatorScores.map((item) => ({
                evaluatorId: item.evaluatorId,
                evaluatorName: nameById.get(item.evaluatorId) ?? item.evaluatorId,
                scores: item.scores,
                passed: item.passed,
                metrics: item.metrics,
              })),
            },
          ]);
        }
        if (event.type === 'RunCompleted' || event.type === 'RunFailed') {
          unsubscribe();
          resolve(event);
        }
      });
    });

    const snapshot = await runner.runDatasetWith({
      datasetId: dataset.id,
      evaluatorIds: evaluators.map((item) => item.id),
    });

    setRunInfo({
      runId: snapshot.runId,
      datasetName: snapshot.datasetName,
      evaluatorNames: evaluators.map(
        (e) => e.evaluator.getName() ?? e.id,
      ),
      totalTestCases: snapshot.totalTestCases,
    });
    setPhase('running');

    const finalEvent = await done;

    if (finalEvent.type === 'RunFailed') {
      onComplete(new Error(`Run failed: ${finalEvent.errorMessage}`));
      return;
    }

    setSummary({
      passedTestCases: finalEvent.passedTestCases,
      failedTestCases: finalEvent.failedTestCases,
      totalTestCases: finalEvent.totalTestCases,
      overallScoreTotal,
      overallScoreCount,
      aggregates: new Map(aggregates),
      artifactPath: finalEvent.artifactPath,
    });
    setPhase('completed');
    setTimeout(() => onComplete(), 200);
  }, [runner, datasetName, evaluatorPattern, onComplete]);

  useEffect(() => {
    void runEval();
  }, [runEval]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Banner />
      </Box>

      {runInfo && (
        <Box flexDirection="column" marginBottom={1}>
          <Text>
            <Text color="cyan" bold>Run </Text>
            <Text color="gray">{runInfo.runId}</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Dataset </Text>
            {runInfo.datasetName}
          </Text>
          <Text>
            <Text color="cyan" bold>Evaluators </Text>
            {runInfo.evaluatorNames.join(', ')}
          </Text>
          <Text>
            <Text color="cyan" bold>Test cases </Text>
            {runInfo.totalTestCases}
          </Text>
        </Box>
      )}

      {phase === 'running' && (
        <Box marginBottom={1}>
          <Spinner
            label={`Evaluations ${testCases.length}/${runInfo?.totalTestCases ?? 0}`}
          />
        </Box>
      )}

      {testCases.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {testCases.map((tc, i) => (
            <Box key={i} flexDirection="column" marginBottom={0}>
              <Text>
                <Text color="cyan">[{tc.completedTestCases}/{tc.totalTestCases}]</Text>
                {' '}
                {tc.name}
                <Text color="gray"> ({tc.durationMs}ms)</Text>
              </Text>
              {tc.evaluatorScores.map((item) => (
                <Box key={item.evaluatorId} marginLeft={2}>
                  <Text>
                    {item.evaluatorName}:{' '}
                    <Text color={item.passed ? 'green' : 'red'} bold>
                      {item.passed ? 'PASS' : 'FAIL'}
                    </Text>
                    {' '}
                    {item.scores.map((s) => (
                      <Text key={s.id} color={scoreColor(toNumericScore(s.data) ?? 0)}>
                        {formatScorePart(s, scoreColor)}{' '}
                      </Text>
                    ))}
                    {item.metrics?.map((m) => {
                      const def = getMetricById(m.id);
                      if (!def) return null;
                      const formatted = def.format(m.data);
                      return (
                        <Text key={m.id} color="gray">
                          [{def.name ? `${def.name}: ` : ''}{formatted}]{' '}
                        </Text>
                      );
                    })}
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )}

      {phase === 'completed' && summary && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Run Summary
          </Text>
          <Box marginTop={1}>
            <Text color="green">passed</Text>
            <Text> {summary.passedTestCases}/{summary.totalTestCases}</Text>
          </Box>
          <Box>
            <Text color={summary.failedTestCases > 0 ? 'red' : 'gray'}>
              failed
            </Text>
            <Text> {summary.failedTestCases}/{summary.totalTestCases}</Text>
          </Box>
          {summary.overallScoreCount > 0 && (
            <Box marginTop={1}>
              <TextBar
                label="overall avg"
                value={summary.overallScoreTotal / summary.overallScoreCount}
                barWidth={20}
                format={(v) => v.toFixed(2)}
              />
            </Box>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text color="magenta">evaluator averages</Text>
            {Array.from(evaluatorNameById.entries()).map(([id, name]) => {
              const agg = summary.aggregates.get(id);
              if (!agg || agg.count === 0) {
                return (
                  <Text key={id} color="gray">
                    - {name.padEnd(28)} no numeric scores
                  </Text>
                );
              }
              const mean = agg.total / agg.count;
              return (
                <Text key={id}>
                  - {name.padEnd(28)} avg=
                  <Text color={scoreColor(mean)}>{mean.toFixed(2)}</Text> passed=
                  {agg.passed} failed={agg.failed}
                </Text>
              );
            })}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color="magenta">test case scores</Text>
            {testCases.map((tc, i) => (
              <Box key={i}>
                <Text color={tc.passed ? 'green' : 'red'}>
                  {tc.passed ? 'PASS' : 'FAIL'}
                </Text>
                <Text> {tc.name.padEnd(24)}</Text>
                {tc.averageScore !== undefined ? (
                  <>
                    <Text color={scoreColor(tc.averageScore)}>
                      score={tc.averageScore.toFixed(2)}
                    </Text>
                    <Text color="gray">{' '}{createBar(tc.averageScore, 100, 14)}</Text>
                  </>
                ) : (
                  <Text color="gray">score=n/a</Text>
                )}
                <Text color="gray"> ({tc.durationMs}ms)</Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text color="gray">artifact: {summary.artifactPath}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
