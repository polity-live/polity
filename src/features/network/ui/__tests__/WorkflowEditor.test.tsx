/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowEditor } from '../WorkflowEditor';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('../GroupNetworkFlow', () => ({
  GroupNetworkFlow: () => <div data-testid="group-network-flow" />,
}));

vi.mock('../WorkflowFlowVisualization', () => ({
  WorkflowFlowVisualization: ({
    workflow,
  }: {
    workflow: {
      name: string | null;
      startGroup?: { id: string; name: string | null } | null;
      steps: unknown[];
    };
  }) => (
    <div data-testid="workflow-flow-visualization">
      {workflow.name ?? 'Untitled'}:{workflow.startGroup?.name ?? 'No Start'}:
      {workflow.steps.length}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkflowEditor', () => {
  it('reuses the shared workflow visualization for the current flow preview', () => {
    render(
      <WorkflowEditor
        currentGroupId="current-group"
        currentGroupName="Current Group"
        allRelationships={[]}
        isOpen
        editingWorkflow={null}
        draftStartGroupId="start-group"
        setDraftStartGroupId={vi.fn()}
        draftName="Draft process"
        setDraftName={vi.fn()}
        draftDescription=""
        setDraftDescription={vi.fn()}
        draftIsDefaultEntry={false}
        setDraftIsDefaultEntry={vi.fn()}
        draftSteps={[
          {
            id: 'draft-step-1',
            group_id: 'current-group',
            label: 'Final vote',
            step_kind: 'group_vote',
            selection_mode: 'default_target_workflow',
            merge_strategy: null,
            event_rule: null,
            auto_task_on_missing_event: true,
            target_workflow_id: null,
          },
        ]}
        availableGroups={[
          { id: 'start-group', name: 'Start Group' },
          { id: 'current-group', name: 'Current Group' },
        ]}
        availableWorkflows={[]}
        onClose={vi.fn()}
        onAddStep={vi.fn()}
        onUpdateStep={vi.fn()}
        onRemoveStep={vi.fn()}
        onMoveStep={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByTestId('workflow-flow-visualization').textContent).toBe(
      'Draft process:Start Group:1'
    );
  });
});
