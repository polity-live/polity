/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManageNetworkTab } from '../ManageNetworkTab';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('../../hooks/useHierarchyLinkConflicts', () => ({
  useHierarchyLinkConflicts: () => ({
    canActivateLink: () => false,
    getConflictUserIds: () => [],
    resolveConflictUsers: () => [],
    resolvePartnerUsers: () => [],
    isLinkCheckApplicable: () => true,
  }),
}));

vi.mock('../LinkGroupDialog', () => ({
  LinkGroupDialog: ({ initialTargetGroupId }: { initialTargetGroupId?: string }) => (
    <div
      data-testid={
        initialTargetGroupId
          ? `link-group-dialog-${initialTargetGroupId}`
          : 'link-group-dialog-create'
      }
    />
  ),
}));

vi.mock('../WorkflowEditor', () => ({
  WorkflowEditor: () => <div data-testid="workflow-editor" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildRelationship(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    group_id: 'partner-group',
    related_group_id: 'current-group',
    relationship_type: 'parent',
    with_right: 'informationRight',
    status: 'requested',
    initiator_group_id: 'partner-group',
    created_at: 0,
    group: {
      id: 'partner-group',
      name: 'Partner Group',
      group_type: 'base',
      sibling_membership_mode: null,
    },
    related_group: {
      id: 'current-group',
      name: 'Current Group',
      group_type: 'base',
      sibling_membership_mode: null,
    },
    ...overrides,
  } as const;
}

function renderManageNetworkTab(canManageRelationships: boolean) {
  const incomingRelationship = buildRelationship('incoming-rel');
  const outgoingRelationship = buildRelationship('outgoing-rel', {
    initiator_group_id: 'current-group',
  });

  return render(
    <ManageNetworkTab
      canManageRelationships={canManageRelationships}
      groupId="current-group"
      groupName="Current Group"
      currentGroupType="base"
      currentGroupSiblingMembershipMode={null}
      searchQuery=""
      onSearchQueryChange={() => undefined}
      directionFilter="all"
      onDirectionFilterChange={() => undefined}
      manageRightFilter={new Set(['informationRight'])}
      onToggleRightFilter={() => undefined}
      incomingRequests={[
        {
          group: incomingRelationship.group as never,
          rels: [incomingRelationship as never],
          type: 'parent',
        },
      ]}
      outgoingRequests={[
        {
          group: outgoingRelationship.group as never,
          rels: [outgoingRelationship as never],
          type: 'parent',
        },
      ]}
      filteredRelationships={[
        {
          group: incomingRelationship.group as never,
          rights: ['informationRight'],
          type: 'parent',
        },
      ]}
      allRelationships={[incomingRelationship, outgoingRelationship] as never[]}
      onAcceptRequest={vi.fn().mockResolvedValue(undefined)}
      onRejectRequest={vi.fn().mockResolvedValue(undefined)}
      onDeleteRelationship={vi.fn()}
      workflows={[{ id: 'workflow-1', name: 'Workflow' } as never]}
      workflowsLoading={false}
      isWorkflowEditorOpen={false}
      editingWorkflow={null}
      workflowDraftName=""
      onWorkflowDraftNameChange={() => undefined}
      workflowDraftDescription=""
      onWorkflowDraftDescriptionChange={() => undefined}
      workflowDraftSteps={[]}
      availableGroups={[]}
      onOpenNewWorkflow={() => undefined}
      onOpenEditWorkflow={() => undefined}
      onCloseWorkflowEditor={() => undefined}
      onAddWorkflowStep={() => undefined}
      onRemoveWorkflowStep={() => undefined}
      onMoveWorkflowStep={() => undefined}
      onSaveWorkflow={() => undefined}
      onDeleteWorkflow={() => undefined}
    />
  );
}

describe('ManageNetworkTab', () => {
  it('renders a read-only management view for users with only relationship view rights', () => {
    renderManageNetworkTab(false);

    expect(screen.queryAllByText('common.actions.actions')).toHaveLength(0);
    expect(screen.queryAllByText('common.network.manage')).toHaveLength(0);
    expect(screen.queryAllByText('common.actions.confirm')).toHaveLength(0);
    expect(screen.queryByTestId('link-group-dialog-create')).toBeNull();
    expect(screen.queryByTestId('workflow-editor')).toBeNull();
    expect(screen.queryAllByText('Partner Group').length).toBeGreaterThan(0);
  });

  it('shows create, row actions, and workflows for users with manage rights', () => {
    renderManageNetworkTab(true);

    expect(screen.queryAllByText('common.actions.actions').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('common.network.manage').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('link-group-dialog-create')).not.toBeNull();
    expect(screen.queryAllByTestId(/link-group-dialog-/).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByTestId('workflow-editor')).not.toBeNull();
  });
});
