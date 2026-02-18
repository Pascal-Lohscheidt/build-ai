import { writeFile } from 'node:fs/promises';
import { join, parse, resolve } from 'node:path';

import type { RunnerApi } from '../runner';

interface GeneratedDatasetCase {
  name: string;
  input: unknown;
}

function createOutputPath(datasetFilePath: string): string {
  const parsed = parse(datasetFilePath);
  return join(parsed.dir, `${parsed.name}.cases.json`);
}

export async function generateDatasetJsonCommand(
  runner: RunnerApi,
  datasetName: string,
): Promise<void> {
  const dataset = await runner.resolveDatasetByName(datasetName);
  if (!dataset) {
    throw new Error(`Dataset "${datasetName}" not found.`);
  }

  const testCases = await runner.collectDatasetTestCases(dataset.id);
  const payload: GeneratedDatasetCase[] = testCases.map((item) => ({
    name: item.testCase.getName(),
    input: item.testCase.getInput(),
  }));

  const absoluteDatasetPath = resolve(process.cwd(), dataset.filePath);
  const outputPath = createOutputPath(absoluteDatasetPath);

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Generated ${payload.length} test cases for dataset "${dataset.dataset.getName()}".`);
  console.log(`Wrote ${outputPath}`);
}
