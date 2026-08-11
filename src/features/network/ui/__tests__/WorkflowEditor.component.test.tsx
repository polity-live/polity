import { featureThemeClassName } from '@/features/shared/theme';
/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowEditor } from '../WorkflowEditor';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : key,
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'features.network.workflows.searchConnectedGroup': 'Search connected group...',
      };

      return labels[key] ?? (typeof fallback === 'string' ? fallback : key);
    },
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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function hasButtonText(text: string) {
  return screen
    .getAllByRole('button')
    .some(element => element.textContent?.replace(/\s+/g, ' ').includes(text));
}

describe('WorkflowEditor', () => {
  it('selects workflow graph start and target modes through stable controls', async () => {
    render(
      <WorkflowEditor
        currentGroupId="current-group"
        currentGroupName="Current Group"
        allRelationships={[]}
        isOpen
        editingWorkflow={null}
        draftStartGroupId="current-group"
        setDraftStartGroupId={vi.fn()}
        draftName="Draft process"
        setDraftName={vi.fn()}
        draftDescription=""
        setDraftDescription={vi.fn()}
        draftIsDefaultEntry={false}
        setDraftIsDefaultEntry={vi.fn()}
        draftSteps={[]}
        availableGroups={[{ id: 'current-group', name: 'Current Group' }]}
        availableWorkflows={[]}
        onClose={vi.fn()}
        onAddStep={vi.fn()}
        onUpdateStep={vi.fn()}
        onRemoveStep={vi.fn()}
        onMoveStep={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.mouseDown(
      document.querySelector('[data-action-id="network.workflow-editor.builder.graph.select"]')!,
      { button: 0, ctrlKey: false }
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-action-id="network.workflow-editor.graph.start.select"]')
      ).toBeTruthy()
    );
    const start = document.querySelector(
      '[data-action-id="network.workflow-editor.graph.start.select"]'
    )!;
    const target = document.querySelector(
      '[data-action-id="network.workflow-editor.graph.target.select"]'
    )!;

    fireEvent.click(start);
    expect(start.className).toContain('bg-primary');
    fireEvent.click(target);
    expect(target.className).toContain('bg-primary');
  });

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
    expect(document.querySelector('[data-slot="management-dialog-header"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="management-dialog-body"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="management-dialog-footer"]')).toBeTruthy();
  });

  it(featureThemeClassName('networkWorkflowEditorThemedGradientSurface'), async () => {
    render(
      <WorkflowEditor
        currentGroupId="H2"
        currentGroupName="H2"
        allRelationships={
          [
            {
              id: 'grant-b2-h2',
              connection_id: 'connection-b2-h2',
              grant_id: 'grant-b2-h2',
              group_id: 'B2',
              related_group_id: 'H2',
              relationship_type: 'child',
              connection_type: 'hierarchy',
              parent_group_id: 'H2',
              child_group_id: 'B2',
              with_right: 'amendmentRight',
              status: 'active',
              initiator_group_id: null,
              created_at: Date.now(),
              member_source_group_id: null,
              member_target_group_id: null,
              membership_mode: 'none',
              required_source_role_id: null,
              eligible_origin_group_ids: [],
              group: { id: 'B2', name: 'B2' },
              related_group: { id: 'H2', name: 'H2' },
            },
            {
              id: 'grant-h2-k2',
              connection_id: 'connection-h2-k2',
              grant_id: 'grant-h2-k2',
              group_id: 'H2',
              related_group_id: 'K2',
              relationship_type: 'child',
              connection_type: 'hierarchy',
              parent_group_id: 'K2',
              child_group_id: 'H2',
              with_right: 'amendmentRight',
              status: 'active',
              initiator_group_id: null,
              created_at: Date.now(),
              member_source_group_id: null,
              member_target_group_id: null,
              membership_mode: 'none',
              required_source_role_id: null,
              eligible_origin_group_ids: [],
              group: { id: 'H2', name: 'H2' },
              related_group: { id: 'K2', name: 'K2' },
            },
          ] as never
        }
        isOpen
        editingWorkflow={null}
        draftStartGroupId="B2"
        setDraftStartGroupId={vi.fn()}
        draftName="Draft process"
        setDraftName={vi.fn()}
        draftDescription=""
        setDraftDescription={vi.fn()}
        draftIsDefaultEntry={false}
        setDraftIsDefaultEntry={vi.fn()}
        draftSteps={[]}
        availableGroups={[
          { id: 'B2', name: 'B2' },
          { id: 'H2', name: 'H2' },
          { id: 'K2', name: 'K2' },
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

    const targetSearchInput = screen.getByPlaceholderText('Search connected group...');
    fireEvent.focus(targetSearchInput);
    fireEvent.change(targetSearchInput, { target: { value: 'H2' } });
    await waitFor(() => expect(hasButtonText('H2')).toBe(true));

    fireEvent.change(targetSearchInput, { target: { value: 'K2' } });
    await waitFor(() => expect(hasButtonText('K2')).toBe(false));

    fireEvent.change(targetSearchInput, { target: { value: 'B2' } });
    await waitFor(() => expect(hasButtonText('B2')).toBe(false));
  });
});
