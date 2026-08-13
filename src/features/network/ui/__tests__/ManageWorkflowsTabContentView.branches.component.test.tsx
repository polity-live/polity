/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ManageWorkflowsTabContentView,
  type ManageWorkflowsTabProps,
} from '../ManageWorkflowsTabContentView';

const harness = vi.hoisted(() => ({
  rejectSubmission: false,
  reset: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: ({ onRetry }: { onRetry: () => void }) => (
    <button data-testid="retry-submission" onClick={onRetry}>
      Retry
    </button>
  ),
  useActionSubmission: () => ({
    error: null,
    isActive: false,
    progressSteps: [],
    reset: harness.reset,
    retry: harness.retry,
    runActionWithSubmission: async (
      action: (context: object) => unknown,
      options: { onSuccess?: () => void }
    ) => {
      await action({ completeSuccess: vi.fn() });
      if (harness.rejectSubmission) {
        throw new Error('submission failed');
      }
      options.onSuccess?.();
    },
    status: 'idle',
  }),
}));

vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: ({
    columns,
    data,
  }: {
    columns: { id?: string; cell?: (args: { row: { original: unknown } }) => ReactNode }[];
    data: unknown[];
  }) => (
    <div data-testid="data-table">
      {data.flatMap((original, rowIndex) =>
        columns.map((column, columnIndex) => (
          <div key={`${rowIndex}-${column.id ?? columnIndex}`}>
            {column.cell?.({ row: { original } })}
          </div>
        ))
      )}
    </div>
  ),
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  DangerConfirmDialog: ({ trigger, onConfirm }: { trigger: ReactNode; onConfirm: () => void }) => (
    <div>
      {trigger}
      <button data-testid="confirm-delete" onClick={onConfirm}>
        Confirm delete
      </button>
    </div>
  ),
}));

vi.mock('@/features/shared/ui/form', () => ({
  ManagementSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  ManagementToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SearchField: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <input
      data-testid="workflow-search"
      value={value}
      onChange={event => onValueChange(event.target.value)}
    />
  ),
}));

vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterToggleGroupItem: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/ui/toggle-group', () => ({
  ToggleGroup: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => (
    <div>
      {children}
      <button data-testid="filter-empty" onClick={() => onValueChange('')}>
        Empty filter
      </button>
      {['all', 'pending_approval', 'active', 'rejected', 'archived'].map(value => (
        <button key={value} data-testid={`filter-${value}`} onClick={() => onValueChange(value)}>
          {value}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/features/shared/ui/status', () => ({
  RightBadge: () => <span>Right</span>,
  StatusBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('../GroupRelationshipFields', () => ({
  GroupRelationshipNameTag: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('../WorkflowEditor', () => ({
  WorkflowEditor: () => <div data-testid="workflow-editor" />,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { id?: string } }) => (
    <a href={params?.id ? `/group/${params.id}` : '#'}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? 'Active',
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

afterEach(() => {
  cleanup();
  harness.rejectSubmission = false;
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
    steps: [],
    ...overrides,
  };
}

function buildProps(overrides: Partial<ManageWorkflowsTabProps> = {}): ManageWorkflowsTabProps {
  return {
    canManageWorkflows: true,
    groupId: 'current-group',
    groupName: 'Current Group',
    allRelationships: [],
    incomingRequests: [],
    acceptedPendingRequests: [],
    outgoingRequests: [],
    activeRelevantWorkflows: [],
    isWorkflowEditorOpen: false,
    editingWorkflow: null,
    workflowDraftStartGroupId: '',
    onWorkflowDraftStartGroupIdChange: vi.fn(),
    workflowDraftName: '',
    onWorkflowDraftNameChange: vi.fn(),
    workflowDraftDescription: '',
    onWorkflowDraftDescriptionChange: vi.fn(),
    workflowDraftIsDefaultEntry: false,
    onWorkflowDraftIsDefaultEntryChange: vi.fn(),
    workflowDraftSteps: [],
    availableGroups: [],
    availableWorkflows: [],
    onOpenNewWorkflow: vi.fn(),
    onOpenEditWorkflow: vi.fn(),
    onCloseWorkflowEditor: vi.fn(),
    onAddWorkflowStep: vi.fn(),
    onUpdateWorkflowStep: vi.fn(),
    onRemoveWorkflowStep: vi.fn(),
    onMoveWorkflowStep: vi.fn(),
    onSaveWorkflow: vi.fn(),
    onDeleteWorkflow: vi.fn(),
    onApproveWorkflowApproval: vi.fn(),
    onRejectWorkflowApproval: vi.fn(),
    ...overrides,
  };
}

describe('ManageWorkflowsTabContentView branch states', () => {
  it('renders nullable workflow shapes and invokes every table action', async () => {
    const onOpenEditWorkflow = vi.fn();
    const onDeleteWorkflow = vi.fn();
    const onApproveWorkflowApproval = vi.fn();
    const onRejectWorkflowApproval = vi.fn();

    const incoming = buildWorkflow('incoming', {
      name: null,
      status: null,
      is_default_entry: true,
      group: null,
      group_id: 'current-group',
      start_group: null,
      start_group_id: null,
      approvals: [
        {
          id: 'incoming-approval',
          group_id: 'current-group',
          status: 'pending',
          group: null,
        },
      ],
      steps: [
        {
          id: null,
          group_id: null,
          order_index: null,
          label: null,
          group: null,
        },
        {
          id: 'second-null-order-step',
          group_id: null,
          order_index: null,
          label: null,
          group: null,
        },
      ],
    });
    const incomingWithoutApproval = buildWorkflow('incoming-without-approval', {
      approvals: undefined,
      steps: undefined,
    });
    const outgoing = buildWorkflow('outgoing', {
      status: null,
      start_group: null,
      start_group_id: 'start-id-only',
      approvals: [
        {
          id: 'approval-with-group',
          group_id: 'partner-group',
          status: 'accepted',
          group: { id: 'partner-group', name: 'Partner Group' },
        },
        {
          id: 'approval-with-id',
          group_id: 'id-only-group',
          status: 'pending',
          group: null,
        },
        {
          id: 'approval-without-group',
          group_id: null,
          status: 'pending',
          group: { id: null, name: null },
        },
        {
          id: 'approval-current',
          group_id: 'current-group',
          status: 'accepted',
          group: null,
        },
      ],
      steps: [
        {
          id: 'last-step',
          group_id: 'final-id-only',
          order_index: null,
          label: null,
          group: null,
        },
        {
          id: 'first-step',
          group_id: 'first-group',
          order_index: -1,
          label: 'First',
          group: { id: 'first-group', name: 'First Group' },
        },
      ],
    });
    const accepted = buildWorkflow('accepted', {
      start_group: null,
      start_group_id: null,
      group: { id: 'group-fallback', name: 'Group fallback' },
      approvals: undefined,
      steps: undefined,
    });
    const outgoingWithoutRelations = buildWorkflow('outgoing-without-relations', {
      group: null,
      group_id: 'owner-id-fallback',
      start_group: null,
      start_group_id: null,
      approvals: undefined,
      steps: undefined,
    });
    const finalRole = buildWorkflow('final-role', {
      group_id: 'current-group',
      start_group: null,
      start_group_id: null,
      group: null,
      steps: undefined,
    });
    const startRole = buildWorkflow('start-role', {
      group_id: 'other-final',
      start_group_id: 'current-group',
      steps: [
        {
          id: 'group-object-step',
          group_id: null,
          order_index: 0,
          label: 'Object label',
          group: { id: 'object-final', name: 'Object Final' },
        },
      ],
    });
    const coOwnerRole = buildWorkflow('co-owner-role', {
      group_id: 'other-final',
      start_group_id: 'other-start',
    });

    const props = buildProps({
      incomingRequests: [incoming, incomingWithoutApproval] as never,
      acceptedPendingRequests: [accepted] as never,
      outgoingRequests: [outgoing, outgoingWithoutRelations] as never,
      activeRelevantWorkflows: [finalRole, startRole, coOwnerRole] as never,
      onOpenEditWorkflow,
      onDeleteWorkflow,
      onApproveWorkflowApproval,
      onRejectWorkflowApproval,
    });
    render(<ManageWorkflowsTabContentView {...props} />);

    expect(screen.getAllByText('Group').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Partner Group: accepted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('id-only-group: pending').length).toBeGreaterThan(0);

    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '[data-action-id="network.workflow.pending.edit"], [data-action-id="network.workflow.active.edit"]'
    )) {
      fireEvent.click(button);
    }
    for (const button of screen.getAllByTestId('confirm-delete')) {
      fireEvent.click(button);
    }

    fireEvent.click(document.querySelector('[data-action-id="network.workflow.approval.accept"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.workflow.approval.reject"]')!);
    await waitFor(() => {
      expect(onApproveWorkflowApproval).toHaveBeenCalled();
      expect(onRejectWorkflowApproval).toHaveBeenCalled();
    });

    harness.rejectSubmission = true;
    fireEvent.click(document.querySelector('[data-action-id="network.workflow.approval.accept"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.workflow.approval.reject"]')!);
    await waitFor(() => expect(onRejectWorkflowApproval).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId('retry-submission'));
    expect(harness.retry).toHaveBeenCalledOnce();
    expect(onOpenEditWorkflow).toHaveBeenCalled();
    expect(onDeleteWorkflow).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('workflow-search'), {
      target: { value: 'definitely absent' },
    });
  });

  it('keeps an empty toggle value and exercises all table-presence states', () => {
    const outgoing = buildWorkflow('outgoing-only');
    const { rerender } = render(
      <ManageWorkflowsTabContentView {...buildProps({ outgoingRequests: [outgoing] as never })} />
    );

    fireEvent.click(screen.getByTestId('filter-empty'));
    for (const status of ['pending_approval', 'active', 'rejected', 'archived', 'all']) {
      fireEvent.click(screen.getByTestId(`filter-${status}`));
    }
    fireEvent.change(screen.getByTestId('workflow-search'), {
      target: { value: 'missing group' },
    });

    rerender(
      <ManageWorkflowsTabContentView
        {...buildProps({ acceptedPendingRequests: [outgoing] as never })}
      />
    );
    rerender(<ManageWorkflowsTabContentView {...buildProps()} />);

    expect(screen.queryByTestId('workflow-search')).toBeNull();
    expect(screen.getByText('features.network.workflows.emptyTitle')).toBeTruthy();
  });
});
