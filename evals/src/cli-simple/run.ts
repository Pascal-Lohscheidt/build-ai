import React from 'react';
import { render } from 'ink';
import { getDiffLines, getMetricById, getScoreById } from '../evals';
import type { ScoreItem } from '../evals/score';
import type { RunnerApi, RunnerEvent } from '../runner';
import {
  aggregateMetricItems,
  aggregateScoreItems,
  toNumericScore,
  toNumericScoreFromScores,
} from '../runner/score-utils';
import { RunView } from './views/RunView';

interface EvaluatorAggregate {
  total: number;
  sumSq: number;
  count: number;
  passed: number;
  failed: number;
}

function sampleStdDev(sum: number, sumSq: number, n: number): number | undefined {
  if (n < 2) return undefined;
  const mean = sum / n;
  const variance = (sumSq - n * mean * mean) / (n - 1);
  return variance > 0 ? Math.sqrt(variance) : 0;
}

interface TestCaseScoreSummary {
  name: string;
  averageScore?: number;
  stdDev?: number;
  aggregatedScoreItem?: ScoreItem;
  isAggregated: boolean;
  durationMs: number;
  passed: boolean;
}

interface TestCaseEventAcc {
  name: string;
  events: Array<{
    averageScore?: number;
    passed: boolean;
    durationMs: number;
    evaluatorScores: ReadonlyArray<{
      evaluatorId: string;
      scores: ReadonlyArray<ScoreItem>;
      passed: boolean;
      metrics?: ReadonlyArray<{ id: string; data: unknown }>;
    }>;
  }>;
}

function buildTestCaseSummaries(
  byId: Map<string, TestCaseEventAcc>,
): TestCaseScoreSummary[] {
  const summaries: TestCaseScoreSummary[] = [];
  for (const { name, events } of byId.values()) {
    const passed = events.every((e) => e.passed);
    const durationMs = events.reduce((sum, e) => sum + e.durationMs, 0);
    const isAggregated = events.length > 1;
    const allScores = events.flatMap((ev) =>
      ev.evaluatorScores
        .map((es) => toNumericScoreFromScores(es.scores))
        .filter((n): n is number => n !== undefined),
    );
    const averageScore =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : undefined;
    const sumSq =
      allScores.length > 0 ? allScores.reduce((s, v) => s + v * v, 0) : 0;
    const total = allScores.reduce((a, b) => a + b, 0);
    const stdDev = sampleStdDev(total, sumSq, allScores.length);
    let firstAggregatedScore: ScoreItem | undefined;
    for (const evaluatorScores of events[0]?.evaluatorScores ?? []) {
      const scoreIdToItems = new Map<string, ScoreItem[]>();
      for (const ev of events) {
        const es = ev.evaluatorScores.find(
          (x) => x.evaluatorId === evaluatorScores.evaluatorId,
        );
        for (const s of es?.scores ?? []) {
          const list = scoreIdToItems.get(s.id) ?? [];
          list.push(s);
          scoreIdToItems.set(s.id, list);
        }
      }
      for (const items of scoreIdToItems.values()) {
        const agg = aggregateScoreItems(items);
        if (agg && firstAggregatedScore === undefined) {
          firstAggregatedScore = agg;
          break;
        }
      }
      if (firstAggregatedScore !== undefined) break;
    }
    summaries.push({
      name,
      averageScore,
      stdDev: stdDev ?? undefined,
      aggregatedScoreItem: firstAggregatedScore,
      isAggregated,
      durationMs,
      passed,
    });
  }
  return summaries;
}

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
} as const;

function colorize(text: string, color: string): string {
  return `${color}${text}${ansi.reset}`;
}

function scoreToColor(score: number): string {
  if (score >= 80) {
    return ansi.green;
  }
  if (score >= 50) {
    return ansi.yellow;
  }
  return ansi.red;
}

function getEvaluatorSummaryLine(
  evaluatorName: string,
  aggregate: EvaluatorAggregate | undefined,
): string {
  if (!aggregate || aggregate.count === 0) {
    return `- ${evaluatorName.padEnd(28)} no numeric scores`;
  }
  const mean = aggregate.total / aggregate.count;
  const sd = sampleStdDev(aggregate.total, aggregate.sumSq, aggregate.count);
  const meanStr =
    sd !== undefined
      ? `${mean.toFixed(2)} ± ${sd.toFixed(2)}`
      : mean.toFixed(2);
  return `- ${evaluatorName.padEnd(28)} avg=${colorize(meanStr, scoreToColor(mean))} passed=${aggregate.passed} failed=${aggregate.failed}`;
}

function createBar(value: number, max = 100, width = 20): string {
  const safe = Math.max(0, Math.min(max, value));
  const filled = Math.round((safe / max) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function aggregateEvaluatorScoresFromEvents(
  events: TestCaseEventAcc['events'],
  evaluatorNameById: Map<string, string>,
): Array<{
  evaluatorId: string;
  scores: ReadonlyArray<ScoreItem>;
  passed: boolean;
  metrics?: ReadonlyArray<{ id: string; data: unknown }>;
}> {
  if (events.length === 0) return [];
  const evaluatorIds = new Set(
    events.flatMap((e) => e.evaluatorScores.map((x) => x.evaluatorId)),
  );
  const result: Array<{
    evaluatorId: string;
    scores: ReadonlyArray<ScoreItem>;
    passed: boolean;
    metrics?: ReadonlyArray<{ id: string; data: unknown }>;
  }> = [];
  for (const evaluatorId of evaluatorIds) {
    const scoreIdToItems = new Map<string, ScoreItem[]>();
    const metricIdToItems = new Map<string, Array<{ id: string; data: unknown }>>();
    for (const ev of events) {
      const es = ev.evaluatorScores.find((x) => x.evaluatorId === evaluatorId);
      for (const s of es?.scores ?? []) {
        const list = scoreIdToItems.get(s.id) ?? [];
        list.push(s);
        scoreIdToItems.set(s.id, list);
      }
      for (const m of es?.metrics ?? []) {
        const list = metricIdToItems.get(m.id) ?? [];
        list.push(m);
        metricIdToItems.set(m.id, list);
      }
    }
    const aggregatedScores: ScoreItem[] = [];
    for (const items of scoreIdToItems.values()) {
      const agg = aggregateScoreItems(items);
      if (agg) aggregatedScores.push(agg);
    }
    const aggregatedMetrics = Array.from(metricIdToItems.entries())
      .map(([, items]) => aggregateMetricItems(items as never))
      .filter((m): m is { id: string; data: unknown } => m !== undefined);
    const passed = events.every((ev) => {
      const es = ev.evaluatorScores.find((x) => x.evaluatorId === evaluatorId);
      return es?.passed ?? false;
    });
    result.push({
      evaluatorId,
      scores: aggregatedScores,
      passed,
      metrics:
        aggregatedMetrics.length > 0 ? aggregatedMetrics : undefined,
    });
  }
  return result;
}

function formatEvaluatorScoreLine(
  name: string,
  scores: ReadonlyArray<ScoreItem>,
  passed: boolean,
  metrics?: ReadonlyArray<{ id: string; data: unknown }>,
  options?: { isAggregated?: boolean },
): string {
  const passLabel = passed
    ? colorize('PASS', `${ansi.bold}${ansi.green}`)
    : colorize('FAIL', `${ansi.bold}${ansi.red}`);
  const scoreParts: string[] = [];
  for (const item of scores) {
    const def = getScoreById(item.id);
    if (!def) {
      const numeric = toNumericScore(item.data);
      scoreParts.push(
        numeric !== undefined
          ? colorize(numeric.toFixed(2), scoreToColor(numeric))
          : 'n/a',
      );
      continue;
    }
    const formatted = def.format(item.data, options);
    switch (def.displayStrategy) {
      case 'bar': {
        const numeric =
          typeof item.data === 'object' &&
          item.data !== null &&
          'value' in item.data
            ? (item.data as { value: unknown }).value
            : toNumericScore(item.data);
        if (typeof numeric === 'number' && Number.isFinite(numeric)) {
          scoreParts.push(
            `${colorize(formatted, scoreToColor(numeric))} ${colorize(createBar(numeric), ansi.dim)}`,
          );
        } else {
          scoreParts.push(formatted);
        }
        break;
      }
      case 'number':
        scoreParts.push(formatted);
        break;
      case 'passFail':
        scoreParts.push(
          colorize(
            formatted,
            item.passed === true
              ? `${ansi.bold}${ansi.green}`
              : item.passed === false
                ? `${ansi.bold}${ansi.red}`
                : ansi.dim,
          ),
        );
        break;
    }
  }
  const scoreStr = scoreParts.length > 0 ? scoreParts.join(' ') : 'n/a';
  let line = `   ${name}: ${passLabel} ${scoreStr}`;
  if (metrics && metrics.length > 0) {
    const metricParts: string[] = [];
    for (const { id, data } of metrics) {
      const def = getMetricById(id);
      if (def) {
        const formatted = def.format(data, options);
        metricParts.push(
          def.name ? `[${def.name}: ${formatted}]` : `[${formatted}]`,
        );
      }
    }
    if (metricParts.length > 0) {
      line += ` ${metricParts.join(' ')}`;
    }
  }
  return line;
}

export async function runSimpleEvalCommandPlain(
  runner: RunnerApi,
  datasetName: string,
  evaluatorPattern: string,
): Promise<void> {
  const dataset = await runner.resolveDatasetByName(datasetName);
  if (!dataset) {
    const known = await runner.collectDatasets();
    const available = known.map((item) => item.dataset.getName()).sort();
    throw new Error(
      available.length > 0
        ? `Dataset "${datasetName}" not found. Available datasets: ${available.join(', ')}`
        : `Dataset "${datasetName}" not found and no datasets were discovered.`,
    );
  }

  const evaluators =
    await runner.resolveEvaluatorsByNamePattern(evaluatorPattern);
  if (evaluators.length === 0) {
    const known = await runner.collectEvaluators();
    const available = known
      .map((item) => item.evaluator.getName())
      .filter((name): name is string => typeof name === 'string')
      .sort();
    throw new Error(
      available.length > 0
        ? `No evaluator matched "${evaluatorPattern}". Available evaluators: ${available.join(', ')}`
        : `No evaluator matched "${evaluatorPattern}" and no evaluators were discovered.`,
    );
  }

  const evaluatorNameById = new Map(
    evaluators.map((item) => [item.id, item.evaluator.getName() ?? item.id]),
  );
  const aggregates = new Map<string, EvaluatorAggregate>();
  const testCaseByTestId = new Map<string, TestCaseEventAcc>();
  let overallScoreTotal = 0;
  let overallScoreSumSq = 0;
  let overallScoreCount = 0;
  let completedCount = 0;
  let totalCount = 0;
  let runFinished = false;
  const spinnerFrames = ['⠋', '⠙', '⠸', '⠴', '⠦', '⠇'];
  let spinnerIndex = 0;

  function clearLine(): void {
    if (!process.stdout.isTTY) {
      return;
    }
    process.stdout.write('\r\x1b[2K');
  }

  function cursorUp(n: number): void {
    if (!process.stdout.isTTY || n <= 0) return;
    process.stdout.write(`\x1b[${n}A`);
  }

  function drawSpinner(): void {
    if (!process.stdout.isTTY || runFinished) {
      return;
    }
    const frame = spinnerFrames[spinnerIndex % spinnerFrames.length];
    spinnerIndex += 1;
    process.stdout.write(
      `\r${colorize(frame, ansi.cyan)} Running evaluations ${colorize(
        `${completedCount}/${totalCount}`,
        ansi.bold,
      )} ${colorize('(live)', ansi.dim)}`,
    );
  }

  let lastPrintedTestCaseId: string | null = null;
  let lastPrintedLineCount = 0;

  let spinnerTimer: NodeJS.Timeout | undefined;
  const done = new Promise<RunnerEvent>((resolve) => {
    const unsubscribe = runner.subscribeRunEvents((event) => {
      if (event.type === 'TestCaseProgress') {
        completedCount = event.completedTestCases;
        const numericScores = event.evaluatorScores
          .map((item) => toNumericScoreFromScores(item.scores))
          .filter((item): item is number => item !== undefined);
        const averageScore =
          numericScores.length > 0
            ? numericScores.reduce((sum, value) => sum + value, 0) /
              numericScores.length
            : undefined;

        const testCaseId = event.testCaseId;
        const existing = testCaseByTestId.get(testCaseId) ?? {
          name: event.testCaseName,
          events: [],
        };
        existing.events.push({
          averageScore,
          passed: event.passed,
          durationMs: event.durationMs,
          evaluatorScores: event.evaluatorScores,
        });
        testCaseByTestId.set(testCaseId, existing);

        for (const item of event.evaluatorScores) {
          const numeric = toNumericScoreFromScores(item.scores);
          if (numeric !== undefined) {
            const current = aggregates.get(item.evaluatorId) ?? {
              total: 0,
              sumSq: 0,
              count: 0,
              passed: 0,
              failed: 0,
            };
            aggregates.set(item.evaluatorId, {
              total: current.total + numeric,
              sumSq: current.sumSq + numeric * numeric,
              count: current.count + 1,
              passed: current.passed + (item.passed ? 1 : 0),
              failed: current.failed + (item.passed ? 0 : 1),
            });
            overallScoreTotal += numeric;
            overallScoreSumSq += numeric * numeric;
            overallScoreCount += 1;
          }
        }

        const isSameTestCase = lastPrintedTestCaseId === testCaseId;
        const isLastRerun = event.rerunIndex >= event.rerunTotal;
        const isNonTty = !process.stdout.isTTY;
        // When not TTY and we have reruns, only print the final aggregated block
        const skipPrintNonTty =
          isNonTty && event.rerunTotal > 1 && !isLastRerun;

        if (isSameTestCase && lastPrintedLineCount > 0 && !skipPrintNonTty) {
          cursorUp(lastPrintedLineCount);
        }

        const aggregatedScores = aggregateEvaluatorScoresFromEvents(
          existing.events,
          evaluatorNameById,
        );
        const isAggregated = existing.events.length > 1;
        const durationMs = existing.events.reduce(
          (s, e) => s + e.durationMs,
          0,
        );
        const passed = existing.events.every((e) => e.passed);

        const lines: string[] = [];
        lines.push(
          `${colorize(`[${event.completedTestCases}/${event.totalTestCases}]`, ansi.cyan)} ${event.testCaseName} ${colorize(`(${event.rerunIndex}/${event.rerunTotal})`, ansi.cyan)} ${colorize(`(${durationMs}ms)`, ansi.dim)}`,
        );
        for (const item of aggregatedScores) {
          const name =
            evaluatorNameById.get(item.evaluatorId) ?? item.evaluatorId;
          lines.push(
            formatEvaluatorScoreLine(
              name,
              item.scores,
              item.passed,
              item.metrics,
              { isAggregated },
            ),
          );
          const lastEvent = existing.events[existing.events.length - 1];
          const lastEs = lastEvent?.evaluatorScores.find(
            (x) => x.evaluatorId === item.evaluatorId,
          );
          if (!item.passed && lastEs?.logs && lastEs.logs.length > 0) {
            for (const log of lastEs.logs) {
              if (log.type === 'diff') {
                const useColor = process.stdout.isTTY;
                for (const { type, line } of getDiffLines(log)) {
                  const colored =
                    useColor && type === 'remove'
                      ? colorize(`      ${line}`, ansi.red)
                      : useColor && type === 'add'
                        ? colorize(`      ${line}`, ansi.green)
                        : `      ${line}`;
                  lines.push(colored);
                }
              }
            }
          }
        }

        if (!skipPrintNonTty) {
          for (let i = 0; i < lines.length; i++) {
            process.stdout.write(`\r\x1b[2K${lines[i]}\n`);
          }
          lastPrintedTestCaseId = testCaseId;
          lastPrintedLineCount = lines.length;
        }

        drawSpinner();
      }
      if (event.type === 'RunCompleted' || event.type === 'RunFailed') {
        runFinished = true;
        clearLine();
        unsubscribe();
        resolve(event);
      }
    });
  });

  const snapshot = await runner.runDatasetWith({
    datasetId: dataset.id,
    evaluatorIds: evaluators.map((item) => item.id),
  });
  totalCount = snapshot.totalTestCases;

  console.log(colorize('=== Eval Run Started ===', `${ansi.bold}${ansi.cyan}`));
  console.log(`Run: ${colorize(snapshot.runId, ansi.cyan)}`);
  console.log(`Dataset: ${colorize(snapshot.datasetName, ansi.bold)}`);
  console.log(
    `Evaluators: ${evaluators
      .map((item) => item.evaluator.getName() ?? item.id)
      .join(', ')}`,
  );
  console.log(
    `Total test cases: ${colorize(String(snapshot.totalTestCases), ansi.bold)}`,
  );
  console.log('');
  drawSpinner();
  spinnerTimer = setInterval(drawSpinner, 100);

  const finalEvent = await done;
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
  }

  if (finalEvent.type === 'RunFailed') {
    throw new Error(`Run failed: ${finalEvent.errorMessage}`);
  }

  console.log('');
  console.log(colorize('=== Run Summary ===', `${ansi.bold}${ansi.cyan}`));
  console.log(
    `- passed: ${colorize(
      `${finalEvent.passedTestCases}/${finalEvent.totalTestCases}`,
      ansi.green,
    )}`,
  );
  console.log(
    `- failed: ${colorize(
      `${finalEvent.failedTestCases}/${finalEvent.totalTestCases}`,
      finalEvent.failedTestCases > 0 ? ansi.red : ansi.dim,
    )}`,
  );
  if (overallScoreCount > 0) {
    const overallAverage = overallScoreTotal / overallScoreCount;
    const overallSd = sampleStdDev(
      overallScoreTotal,
      overallScoreSumSq,
      overallScoreCount,
    );
    const avgStr =
      overallSd !== undefined
        ? `${overallAverage.toFixed(2)} ± ${overallSd.toFixed(2)}`
        : overallAverage.toFixed(2);
    console.log(
      `- overall avg score: ${colorize(
        avgStr,
        scoreToColor(overallAverage),
      )} ${colorize(createBar(overallAverage), ansi.dim)}`,
    );
  }
  console.log(colorize('- evaluator averages:', ansi.magenta));
  for (const [evaluatorId, evaluatorName] of evaluatorNameById.entries()) {
    console.log(
      getEvaluatorSummaryLine(evaluatorName, aggregates.get(evaluatorId)),
    );
  }
  const testCaseSummaries = buildTestCaseSummaries(testCaseByTestId);
  if (testCaseSummaries.length > 0) {
    console.log(colorize('- test case scores:', ansi.magenta));
    for (const summary of testCaseSummaries) {
      const status = summary.passed
        ? colorize('PASS', ansi.green)
        : colorize('FAIL', ansi.red);
      if (summary.averageScore === undefined) {
        console.log(
          `  ${status} ${summary.name.padEnd(24)} score=n/a ${colorize(`(${summary.durationMs}ms)`, ansi.dim)}`,
        );
        continue;
      }
      const scoreLabel =
        summary.isAggregated && summary.aggregatedScoreItem
          ? getScoreById(summary.aggregatedScoreItem.id)?.format(
              summary.aggregatedScoreItem.data,
              { isAggregated: true },
            ) ?? summary.averageScore.toFixed(2)
          : summary.stdDev !== undefined && summary.isAggregated
            ? `${summary.averageScore.toFixed(2)} ± ${summary.stdDev.toFixed(2)}`
            : summary.averageScore.toFixed(2);
      console.log(
        `  ${status} ${summary.name.padEnd(24)} score=${colorize(
          scoreLabel,
          scoreToColor(summary.averageScore),
        )} ${colorize(createBar(summary.averageScore, 100, 14), ansi.dim)} ${colorize(`(${summary.durationMs}ms)`, ansi.dim)}`,
      );
    }
  }
  console.log(`- artifact: ${colorize(finalEvent.artifactPath, ansi.dim)}`);
}

export async function runSimpleEvalCommandInk(
  runner: RunnerApi,
  datasetName: string,
  evaluatorPattern: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const app = render(
      React.createElement(RunView, {
        runner,
        datasetName,
        evaluatorPattern,
        onComplete: (err) => {
          app.unmount();
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      }),
    );
  });
}
