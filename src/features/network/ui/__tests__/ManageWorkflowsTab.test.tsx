/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManageWorkflowsTab } from '../ManageWorkflowsTab';

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: () => null,
  useActionSubmission: () => ({
    error: null,
    isActive: false,
    progressSteps: [],
    reset: vi.fn(),
    retry: vi.fn(),
    runActionWithSubmission: async (action: (context: object) => unknown) =>
      action({ completeSuccess: vi.fn() }),
    status: 'idle',
  }),
}));

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
        'features.network.workflows.acceptedPending': 'Accepted, waiting for others',
        'features.network.workflows.activeRelevant': 'Active workflows',
        'features.network.workflows.create': 'New Workflow',
        'features.network.workflows.edit': 'Edit Workflow',
        'features.network.workflows.filters.active': 'Active',
        'features.network.workflows.filters.allStatuses': 'All statuses',
        'features.network.workflows.filters.archived': 'Archived',
        'features.network.workflows.filters.emptyTitle': 'No matching workflows',
        'features.network.workflows.filters.groupSearchPlaceholder': 'Search involved groups...',
        'features.network.workflows.filters.pendingApproval': 'Pending approval',
        'features.network.workflows.filters.rejected': 'Rejected',
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
  it('renders incoming approvals and lets accepted co-owners edit active workflows', async () => {
    const onApproveWorkflowApproval = vi.fn(
      (_id: string, context?: { completeSuccess?: () => void }) => context?.completeSuccess?.()
    );
    const onRejectWorkflowApproval = vi.fn(
      (_id: string, context?: { completeSuccess?: () => void }) => context?.completeSuccess?.()
    );
    const onOpenEditWorkflow = vi.fn();
    const onOpenNewWorkflow = vi.fn();

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

    const acceptedPendingWorkflow = buildWorkflow('accepted-pending-workflow', {
      group_id: 'foreign-owner',
      group: { id: 'foreign-owner', name: 'Foreign Owner' },
      status: 'pending_approval',
      approvals: [
        {
          id: 'approval-accepted-current',
          group_id: 'current-group',
          status: 'accepted',
          group: { id: 'current-group', name: 'Current Group' },
        },
        {
          id: 'approval-waiting-partner',
          group_id: 'partner-group',
          status: 'pending',
          group: { id: 'partner-group', name: 'Partner Group' },
        },
      ],
    });

    const { container } = render(
      <ManageWorkflowsTab
        canManageWorkflows
        groupId="current-group"
        groupName="Current Group"
        allRelationships={[]}
        incomingRequests={[incomingWorkflow as never]}
        acceptedPendingRequests={[acceptedPendingWorkflow as never]}
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
        onOpenNewWorkflow={onOpenNewWorkflow}
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
    expect(screen.getByText(/Accepted, waiting for others/)).toBeTruthy();
    expect(screen.getByText(/Outgoing requests/)).toBeTruthy();
    expect(screen.getByText(/Active workflows/)).toBeTruthy();
    expect(screen.getByText('Co-owner')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Start Group' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Committee Group' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Partner Group: pending' }).length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('Final group').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Edit Workflow' })).toHaveLength(3);
    expect(container.querySelector('[data-slot="management-toolbar"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="management-section"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-slot="data-table-surface"]')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onApproveWorkflowApproval.mock.calls[0]?.[0]).toBe('approval-1'));
    fireEvent.click(document.querySelector('[data-action-id="network.workflow.approval.reject"]')!);
    await waitFor(() =>
      expect(onRejectWorkflowApproval).toHaveBeenCalledWith('approval-1', expect.anything())
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Workflow' })[1]);
    fireEvent.click(document.querySelector('[data-action-id="network.workflow.create.open"]')!);

    expect(onOpenEditWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'outgoing-workflow' })
    );
    expect(onOpenNewWorkflow).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-action-id="network.workflow.delete.open"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="network.workflow.pending.edit"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="network.workflow.active.edit"]')).toBeTruthy();
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
        acceptedPendingRequests={[]}
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

  it('keeps accepted pending workflows visible and filters sections by status', () => {
    const acceptedPendingWorkflow = buildWorkflow('accepted-pending-filter', {
      status: 'pending_approval',
      approvals: [
        {
          id: 'approval-current-accepted',
          group_id: 'current-group',
          status: 'accepted',
          group: { id: 'current-group', name: 'Current Group' },
        },
        {
          id: 'approval-partner-pending',
          group_id: 'partner-group',
          status: 'pending',
          group: { id: 'partner-group', name: 'Partner Group' },
        },
      ],
    });
    const activeWorkflow = buildWorkflow('active-filter', {
      status: 'active',
      approvals: [
        {
          id: 'approval-current-active',
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
        incomingRequests={[]}
        acceptedPendingRequests={[acceptedPendingWorkflow as never]}
        outgoingRequests={[]}
        activeRelevantWorkflows={[activeWorkflow as never]}
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

    expect(screen.getByText(/Accepted, waiting for others/)).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));

    expect(screen.queryByText(/Accepted, waiting for others/)).toBeNull();
    expect(screen.getByText(/Active workflows/)).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Pending approval' }));

    expect(screen.getByText(/Accepted, waiting for others/)).toBeTruthy();
    expect(screen.queryByText(/Active workflows/)).toBeNull();
  });

  it('filters workflows by involved group names and shows a filter empty state', () => {
    const acceptedPendingWorkflow = buildWorkflow('accepted-pending-search', {
      status: 'pending_approval',
      approvals: [
        {
          id: 'approval-current-accepted',
          group_id: 'current-group',
          status: 'accepted',
          group: { id: 'current-group', name: 'Current Group' },
        },
        {
          id: 'approval-review-board',
          group_id: 'review-board',
          status: 'pending',
          group: { id: 'review-board', name: 'Review Board' },
        },
      ],
      steps: [
        {
          id: 'accepted-pending-search-step-1',
          group_id: 'review-board',
          order_index: 0,
          label: 'Review',
          group: { id: 'review-board', name: 'Review Board' },
        },
        {
          id: 'accepted-pending-search-step-2',
          group_id: 'owner-group',
          order_index: 1,
          label: 'Final vote',
          group: { id: 'owner-group', name: 'Owner Group' },
        },
      ],
    });
    const activeWorkflow = buildWorkflow('active-search', {
      status: 'active',
      approvals: [
        {
          id: 'approval-current-active',
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
        incomingRequests={[]}
        acceptedPendingRequests={[acceptedPendingWorkflow as never]}
        outgoingRequests={[]}
        activeRelevantWorkflows={[activeWorkflow as never]}
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

    const searchInput = screen.getByPlaceholderText('Search involved groups...');

    fireEvent.change(searchInput, { target: { value: 'Review Board' } });

    expect(screen.getByText(/Accepted, waiting for others/)).toBeTruthy();
    expect(screen.queryByText(/Active workflows/)).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'No matching group' } });

    expect(screen.getByText('No matching workflows')).toBeTruthy();
  });
});
