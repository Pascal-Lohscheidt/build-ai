/** @jsxImportSource react */
import React from 'react';
import { Box, Text } from 'ink';
import type { CliState, EvalDataset, EvalRun } from '../../types';
import {
  Pane,
  RunsSidebar,
  SectionHeader,
  Sparkline,
  TextBar,
} from '../../components';

const DETAILS_PAGE_SIZE = 20;

interface RunDetailsViewProps {
  state: CliState;
  dataset: EvalDataset | undefined;
  selectedRun: EvalRun | undefined;
}

function CheckRow({
  name,
  passed,
  detail,
}: {
  name: string;
  passed: boolean;
  detail?: string;
}): React.ReactNode {
  const status = passed ? 'PASSED' : 'FAILED';
  const color = passed ? 'green' : 'red';
  return (
    <Text>
      <Text color="gray">{name.padEnd(14)}</Text>
      {' '}
      <Text color={color} bold>{status}</Text>
      {detail ? <Text color="gray">  ({detail})</Text> : null}
    </Text>
  );
}

function buildDetailRows(run: EvalRun): React.ReactNode[] {
  const { performance, dimensions, checks, failures, meta } = run;
  const latencyHistory = performance.latencyHistoryMs ?? [
    performance.latencyAvgMs - 40,
    performance.latencyAvgMs - 10,
    performance.latencyAvgMs + 20,
    performance.latencyP95Ms - 80,
    performance.latencyP95Ms,
  ];

  const rows: React.ReactNode[] = [
    <SectionHeader key="meta-h">Meta</SectionHeader>,
    <Text key="meta-1" color="gray">
      Model: {meta.model}   Provider: {meta.provider}
    </Text>,
    <Text key="meta-2" color="gray">
      Commit: {meta.commit}  Branch: {meta.branch}  Seed: {meta.seed}
    </Text>,
    <Text key="meta-3" color="gray">
      Duration: {meta.duration}   Concurrency: {meta.concurrency}
    </Text>,
    <Text key="meta-4" color="gray">Artifact: {meta.artifact}</Text>,
    <Text key="sp1"> </Text>,
    <SectionHeader key="scores-h">Scores (0–100)</SectionHeader>,
    ...dimensions.map((d) => (
      <TextBar key={`dim-${d.name}`} label={d.name} value={d.score} />
    )),
    <Text key="sp2"> </Text>,
    <SectionHeader key="checks-h">Checks (boolean)</SectionHeader>,
    ...checks.map((c) => (
      <CheckRow key={`chk-${c.name}`} name={c.name} passed={c.passed} detail={c.detail} />
    )),
    <Text key="sp3"> </Text>,
    <SectionHeader key="perf-h">Performance</SectionHeader>,
    <TextBar
      key="perf-rate"
      label="pass rate"
      value={performance.passRate}
      format={(v) => `${v}%`}
    />,
    <Text key="perf-lat" color="gray">
      latency avg     {performance.latencyAvgMs}ms   p95 {performance.latencyP95Ms}ms
    </Text>,
    <Text key="perf-tok" color="gray">
      tokens avg      {performance.tokensAvg}   p95 {performance.tokensP95}
    </Text>,
    <Text key="sp4"> </Text>,
    <SectionHeader key="spark-h">Latency trend</SectionHeader>,
    <Sparkline key="spark" data={latencyHistory} width={20} />,
  ];

  if (failures.length > 0) {
    rows.push(<Text key="sp5"> </Text>);
    rows.push(<SectionHeader key="fail-h">Failures (top)</SectionHeader>);
    failures.forEach((f, i) => {
      rows.push(
        <Text key={`fail-${i}`} color="red">
          {i + 1}) {f.title}
        </Text>,
      );
    });
  }

  return rows;
}

export function RunDetailsView({
  state,
  dataset,
  selectedRun,
}: RunDetailsViewProps): React.ReactNode {
  const runs = dataset?.runs ?? [];
  const rightFocused = state.focus === 'right';

  if (!selectedRun) {
    return (
      <>
        <RunsSidebar state={state} dataset={dataset} runs={runs} />
        <Pane flexGrow={1} marginLeft={1} focused={rightFocused}>
          <Text color="gray">Select a run to inspect details.</Text>
        </Pane>
      </>
    );
  }

  const rows = buildDetailRows(selectedRun);
  const offset = Math.max(0, state.detailsScrollOffset);
  const visible = rows.slice(offset, offset + DETAILS_PAGE_SIZE);

  return (
    <>
      <RunsSidebar state={state} dataset={dataset} runs={runs} />
      <Pane flexGrow={1} marginLeft={1} focused={rightFocused}>
        <Box flexDirection="column">
          {visible.map((row, i) => (
            <React.Fragment key={i}>{row}</React.Fragment>
          ))}
        </Box>
      </Pane>
    </>
  );
}
