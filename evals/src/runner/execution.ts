import { join } from 'node:path';

import { Effect, Queue } from 'effect';

import type { Dataset } from '../evals/dataset';
import type { Evaluator } from '../evals/evaluator';
import type { MetricItem } from '../evals/metric';
import type { ScoreItem } from '../evals/score';
import type { CollectedTestCase, RunSnapshot, RunnerEvent } from './events';
import type { PersistenceMessage } from './persistence';
import { toNumericScoreFromScores } from './score-utils';

function computeEvaluatorPassed(
  evaluator: Evaluator<unknown, unknown, unknown, unknown>,
  result: unknown,
  scores: ReadonlyArray<ScoreItem>,
): boolean {
  const scoresWithPassed = scores.filter((s) => 'passed' in s && s.passed !== undefined);
  if (scoresWithPassed.length > 0) {
    return scoresWithPassed.every((s) => s.passed === true);
  }
  const passCriterion = evaluator.getPassCriterion();
  if (passCriterion) {
    return passCriterion(result);
  }
  const passThreshold = evaluator.getPassThreshold();
  if (passThreshold !== undefined) {
    const numeric = toNumericScoreFromScores(scores);
    return numeric !== undefined && numeric >= passThreshold;
  }
  return true;
}

function normalizeResult(
  result: unknown,
): {
  scores: ReadonlyArray<ScoreItem>;
  metrics?: ReadonlyArray<MetricItem>;
} {
  if (typeof result !== 'object' || result === null) {
    return { scores: [] };
  }
  const obj = result as Record<string, unknown>;
  const scores = Array.isArray(obj.scores)
    ? (obj.scores as ReadonlyArray<ScoreItem>)
    : [];
  const metrics = Array.isArray(obj.metrics)
    ? (obj.metrics as ReadonlyArray<MetricItem>)
    : undefined;
  return { scores, metrics };
}

function readOutput(testCase: CollectedTestCase['testCase']): unknown {
  const candidate = testCase as unknown as { getOutput?: () => unknown };
  if (typeof candidate.getOutput !== 'function') {
    return undefined;
  }
  return candidate.getOutput();
}

export interface RunTask {
  runId: string;
  datasetId: string;
  dataset: Dataset;
  evaluators: ReadonlyArray<{
    id: string;
    evaluator: Evaluator<unknown, unknown, unknown, unknown>;
  }>;
  testCases: ReadonlyArray<CollectedTestCase>;
  snapshot: RunSnapshot;
}

function nowIsoForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function createArtifactPath(
  artifactDirectory: string,
  datasetId: string,
  runId: string,
): string {
  return join(
    artifactDirectory,
    `${datasetId}_${runId}_${nowIsoForFile()}.jsonl`,
  );
}

export const executeRunTask = (
  task: RunTask,
  publishEvent: (event: RunnerEvent) => Effect.Effect<void, never, never>,
  persistenceQueue: Queue.Queue<PersistenceMessage>,
  updateSnapshot: (
    runId: string,
    updater: (snapshot: RunSnapshot) => RunSnapshot,
  ) => void,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const startedAt = Date.now();
    updateSnapshot(task.runId, (snapshot) => ({
      ...snapshot,
      status: 'running',
      startedAt,
    }));
    yield* publishEvent({
      type: 'RunStarted',
      runId: task.runId,
      startedAt,
    });

    let completedTestCases = 0;
    let passedTestCases = 0;
    let failedTestCases = 0;

    for (const testCaseItem of task.testCases) {
      const started = Date.now();
      const evaluatorScores: Array<{
        evaluatorId: string;
        scores: ReadonlyArray<ScoreItem>;
        passed: boolean;
        metrics?: ReadonlyArray<MetricItem>;
      }> = [];
      let testCaseError: string | undefined;
      const output = readOutput(testCaseItem.testCase);

      for (const { id: evaluatorId, evaluator } of task.evaluators) {
        const evaluateFn = evaluator.getEvaluateFn();
        if (!evaluateFn) {
          continue;
        }

        try {
          const ctx = yield* Effect.promise(() =>
            Promise.resolve(evaluator.resolveContext()),
          );
          const result = yield* Effect.promise(() =>
            Promise.resolve(
              evaluateFn({
                input: testCaseItem.testCase.getInput(),
                ctx,
                output,
              }),
            ),
          );
          const { scores, metrics } = normalizeResult(result);
          const passed = computeEvaluatorPassed(evaluator, result, scores);
          evaluatorScores.push({ evaluatorId, scores, passed, metrics });
        } catch (error) {
          testCaseError =
            error instanceof Error
              ? error.message
              : 'Evaluator execution failed';
          evaluatorScores.push({
            evaluatorId,
            scores: [],
            passed: false,
          });
        }
      }

      const testCasePassed = evaluatorScores.every((s) => s.passed);
      completedTestCases += 1;
      if (testCasePassed) {
        passedTestCases += 1;
      } else {
        failedTestCases += 1;
      }

      const progressEvent: RunnerEvent = {
        type: 'TestCaseProgress',
        runId: task.runId,
        testCaseId: testCaseItem.id,
        testCaseName: testCaseItem.testCase.getName(),
        completedTestCases,
        totalTestCases: task.testCases.length,
        passed: testCasePassed,
        durationMs: Date.now() - started,
        evaluatorScores,
        output,
        errorMessage: testCaseError,
      };

      updateSnapshot(task.runId, (snapshot) => ({
        ...snapshot,
        completedTestCases,
        passedTestCases,
        failedTestCases,
      }));

      yield* publishEvent(progressEvent);
      yield* Queue.offer(persistenceQueue, {
        runId: task.runId,
        artifactPath: task.snapshot.artifactPath,
        payload: progressEvent,
      });
    }

    const finishedAt = Date.now();
    const completedEvent: RunnerEvent = {
      type: 'RunCompleted',
      runId: task.runId,
      finishedAt,
      passedTestCases,
      failedTestCases,
      totalTestCases: task.testCases.length,
      artifactPath: task.snapshot.artifactPath,
    };

    updateSnapshot(task.runId, (snapshot) => ({
      ...snapshot,
      status: 'completed',
      completedTestCases,
      passedTestCases,
      failedTestCases,
      finishedAt,
    }));

    yield* publishEvent(completedEvent);
    yield* Queue.offer(persistenceQueue, {
      runId: task.runId,
      artifactPath: task.snapshot.artifactPath,
      payload: completedEvent,
    });
    yield* publishEvent({
      type: 'ArtifactFlushed',
      runId: task.runId,
      artifactPath: task.snapshot.artifactPath,
    });
  });
