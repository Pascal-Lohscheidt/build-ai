/** @jsxImportSource react */
import React from 'react';
import { Text } from 'ink';
import type { CliState, EvalDataset } from '../../types';
import { ListItem, Pane, SectionHeader } from '../../components';

const LEFT_PANE_WIDTH = 44;

interface DatasetsViewProps {
  state: CliState;
  filteredDatasets: EvalDataset[];
  selectedDataset: EvalDataset | undefined;
}

export function DatasetsView({
  state,
  filteredDatasets,
  selectedDataset,
}: DatasetsViewProps): React.ReactNode {
  const leftFocused = state.focus === 'left';
  const rightFocused = state.focus === 'right';

  return (
    <>
      <Pane width={LEFT_PANE_WIDTH} focused={leftFocused}>
        <SectionHeader>Datasets</SectionHeader>
        <ListItem
          selected={state.datasetMenuIndex === 0}
          label="New evaluation"
          itemKey="datasets-new-eval"
        />
        {filteredDatasets.map((dataset, index) => (
          <ListItem
            key={dataset.id}
            selected={state.datasetMenuIndex === index + 1}
            label={dataset.name}
            itemKey={`dataset-${dataset.id}`}
          />
        ))}
      </Pane>
      <Pane flexGrow={1} marginLeft={1} focused={rightFocused}>
        <SectionHeader>Overview</SectionHeader>
        <Text color="gray">
          {selectedDataset?.overview ??
            'Select a dataset to inspect prior runs.'}
        </Text>
      </Pane>
    </>
  );
}
