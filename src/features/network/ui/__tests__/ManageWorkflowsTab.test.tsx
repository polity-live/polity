/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManageWorkflowsTab } from '../ManageWorkflowsTab';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    ...props
  }: {
    children: ReactNode;
    params?: { id?: string };
    [key: string]: unknown;
  }) => (
    <a href={params?.id ? `/group/${params.id}` : '#'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : key,
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'common.actions.confirm': 'Confirm',
        'common.actions.reject': 'Reject',
        'features.network.workflows.activeRelevant': 'Active workflows',
        'features.network.workflows.create': 'New Workflow',
        'features.network.workflows.edit': 'Edit Workflow',
        'features.network.workflows.incomingRequests': 'Incoming requests',
        'features.network.workflows.outgoingRequests': 'Outgoing requests',
        'features.network.workflows.readOnlyNoPermission': 'Read-only without manage rights',
        'features.network.workflows.roleCoOwner': 'Co-owner',
        'features.network.workflows.roleFinalGroup': 'Final group',
      };

      return labels[key] ?? (typeof fallback === 'string' ? fallback : key);
    },
  }),
}));

vi.mock('../WorkflowEditor', () => ({
  WorkflowEditor: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="workflow-editor">Workflow Editor</div> : null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildWorkflow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Workflow ${id}`,
    group_id: 'owner-group',
    status: 'active',
    is_default_entry: false,
    group: { id: 'owner-group', name: 'Owner Group' },
    start_group_id: 'start-group',
    start_group: { id: 'start-group', name: 'Start Group' },
    approvals: [],
    steps: [
      {
        id: `${id}-step-1`,
        group_id: 'mid-group',
        order_index: 0,
        label: 'Committee',
        group: { id: 'mid-group', name: 'Committee Group' },
      },
      {
        id: `${id}-step-2`,
        group_id: 'owner-group',
        order_index: 1,
        label: 'Final vote',
        group: { id: 'owner-group', name: 'Owner Group' },
      },
    ],
    ...overrides,
  };
}

describe('ManageWorkflowsTab', () => {
  it('renders incoming approvals and lets accepted co-owners edit active workflows', () => {
    const onApproveWorkflowApproval = vi.fn();
    const onRejectWorkflowApproval = vi.fn();
    const onOpenEditWorkflow = vi.fn();

    const incomingWorkflow = buildWorkflow('incoming-workflow', {
      status: 'pending_approval',
      approvals: [
        {
          id: 'approval-1',
          group_id: 'current-group',
          status: 'pending',
          group: { id: 'current-group', name: 'Current Group' },
        },
      ],
    });

    const outgoingWorkflow = buildWorkflow('outgoing-workflow', {
      group_id: 'current-group',
      group: { id: 'current-group', name: 'Current Group' },
      status: 'pending_approval',
      approvals: [
        {
          id: 'approval-2',
          group_id: 'partner-group',
          status: 'pending',
          group: { id: 'partner-group', name: 'Partner Group' },
        },
      ],
    });

    const participantWorkflow = buildWorkflow('participant-workflow', {
      group_id: 'foreign-owner',
      group: { id: 'foreign-owner', name: 'Foreign Owner' },
      approvals: [
        {
          id: 'approval-3',
          group_id: 'current-group',
          status: 'accepted',
          group: { id: 'current-group', name: 'Current Group' },
        },
      ],
    });

    render(
      <ManageWorkflowsTab
        canManageWorkflows
        groupId="current-group"
        groupName="Current Group"
        allRelationships={[]}
        incomingRequests={[incomingWorkflow as never]}
        outgoingRequests={[outgoingWorkflow as never]}
        activeRelevantWorkflows={[outgoingWorkflow as never, participantWorkflow as never]}
        isWorkflowEditorOpen={false}
        editingWorkflow={null}
        workflowDraftStartGroupId="start-group"
        onWorkflowDraftStartGroupIdChange={vi.fn()}
        workflowDraftName=""
        onWorkflowDraftNameChange={vi.fn()}
        workflowDraftDescription=""
        onWorkflowDraftDescriptionChange={vi.fn()}
        workflowDraftIsDefaultEntry={false}
        onWorkflowDraftIsDefaultEntryChange={vi.fn()}
        workflowDraftSteps={[]}
        availableGroups={[]}
        availableWorkflows={[]}
        onOpenNewWorkflow={vi.fn()}
        onOpenEditWorkflow={onOpenEditWorkflow}
        onCloseWorkflowEditor={vi.fn()}
        onAddWorkflowStep={vi.fn()}
        onUpdateWorkflowStep={vi.fn()}
        onRemoveWorkflowStep={vi.fn()}
        onMoveWorkflowStep={vi.fn()}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onApproveWorkflowApproval={onApproveWorkflowApproval}
        onRejectWorkflowApproval={onRejectWorkflowApproval}
      />
    );

    expect(screen.getByText(/Incoming requests/)).toBeTruthy();
    expect(screen.getByText(/Outgoing requests/)).toBeTruthy();
    expect(screen.getByText(/Active workflows/)).toBeTruthy();
    expect(screen.getByText('Co-owner')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Start Group' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Committee Group' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Partner Group: pending' })).toBeTruthy();
    expect(screen.getAllByText('Final group').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Edit Workflow' })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Workflow' })[1]);

    expect(onApproveWorkflowApproval).toHaveBeenCalledWith('approval-1');
    expect(onRejectWorkflowApproval).toHaveBeenCalledWith('approval-1');
    expect(onOpenEditWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'outgoing-workflow' })
    );
  });

  it('hides management actions when workflow management is read-only', () => {
    const ownerWorkflow = buildWorkflow('owner-readonly');

    render(
      <ManageWorkflowsTab
        canManageWorkflows={false}
        groupId="owner-group"
        groupName="Owner Group"
        allRelationships={[]}
        incomingRequests={[]}
        outgoingRequests={[]}
        activeRelevantWorkflows={[ownerWorkflow as never]}
        isWorkflowEditorOpen={false}
        editingWorkflow={null}
        workflowDraftStartGroupId="start-group"
        onWorkflowDraftStartGroupIdChange={vi.fn()}
        workflowDraftName=""
        onWorkflowDraftNameChange={vi.fn()}
        workflowDraftDescription=""
        onWorkflowDraftDescriptionChange={vi.fn()}
        workflowDraftIsDefaultEntry={false}
        onWorkflowDraftIsDefaultEntryChange={vi.fn()}
        workflowDraftSteps={[]}
        availableGroups={[]}
        availableWorkflows={[]}
        onOpenNewWorkflow={vi.fn()}
        onOpenEditWorkflow={vi.fn()}
        onCloseWorkflowEditor={vi.fn()}
        onAddWorkflowStep={vi.fn()}
        onUpdateWorkflowStep={vi.fn()}
        onRemoveWorkflowStep={vi.fn()}
        onMoveWorkflowStep={vi.fn()}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onApproveWorkflowApproval={vi.fn()}
        onRejectWorkflowApproval={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'New Workflow' })).toBeNull();
    expect(screen.queryByText('Incoming requests')).toBeNull();
    expect(screen.queryByText('Outgoing requests')).toBeNull();
    expect(screen.getByText('Read-only without manage rights')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Workflow' })).toBeNull();
  });
});
