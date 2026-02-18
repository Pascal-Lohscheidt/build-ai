import type { RunnerEvent } from '@m4trix/evals';
import { createRunner } from '@m4trix/evals';

async function runExample(): Promise<void> {
  const runner = createRunner();

  try {
    const dataset = await runner.resolveDatasetByName('Demo Dataset');
    if (!dataset) {
      throw new Error('Demo Dataset not found');
    }
    const evaluators = await runner.resolveEvaluatorsByNamePattern('*Score*');
    if (evaluators.length === 0) {
      throw new Error('No evaluator matched *Score*');
    }

    const done = new Promise<RunnerEvent>((resolve) => {
      const unsubscribe = runner.subscribeRunEvents((event) => {
        if (event.type === 'TestCaseProgress') {
          console.log(
            `[${event.completedTestCases}/${event.totalTestCases}] ${event.testCaseName} (${event.passed ? 'PASS' : 'FAIL'})`,
          );
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

    console.log(`Started run ${snapshot.runId} on ${snapshot.datasetName}`);
    const finalEvent = await done;
    if (finalEvent.type === 'RunFailed') {
      throw new Error(finalEvent.errorMessage);
    }

    console.log('Run completed');
    console.log(
      `Passed: ${finalEvent.passedTestCases}/${finalEvent.totalTestCases}; Failed: ${finalEvent.failedTestCases}`,
    );
    console.log(`Artifact: ${finalEvent.artifactPath}`);
  } finally {
    await runner.shutdown();
  }
}

void runExample().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Example failed');
  process.exit(1);
});
