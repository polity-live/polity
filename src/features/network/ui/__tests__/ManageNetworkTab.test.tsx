/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManageNetworkTab } from '../ManageNetworkTab';
import type { GroupedRelationshipRequest } from '../../types/network.types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : key,
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'common.network.structureMembership': 'Structure / membership',
        'common.network.structureMembershipChange': 'Structure / membership change',
      };

      return labels[key] ?? (typeof fallback === 'string' ? fallback : key);
    },
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildRelationship(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    connection_id: 'connection-1',
    grant_id: 'grant-1',
    connection_request_id: 'request-1',
    group_id: 'partner-group',
    related_group_id: 'current-group',
    relationship_type: 'parent',
    connection_type: 'hierarchy',
    parent_group_id: 'partner-group',
    child_group_id: 'current-group',
    with_right: 'informationRight',
    status: 'requested',
    initiator_group_id: 'partner-group',
    created_at: 1,
    member_source_group_id: null,
    member_target_group_id: null,
    membership_mode: 'none',
    required_source_role_id: null,
    eligible_origin_group_ids: [],
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

function buildGroupedRequest(
  relationships: readonly ReturnType<typeof buildRelationship>[],
  overrides: Record<string, unknown> = {}
): GroupedRelationshipRequest {
  const rightRels = relationships.filter(rel => rel.grant_id && rel.with_right);
  const structureRel = relationships.find(rel => !rel.grant_id) ?? null;
  return {
    group: relationships[0].group as never,
    requestId: relationships[0].connection_request_id,
    allRels: relationships as never,
    rightRels: rightRels as never,
    structureRel: structureRel as never,
    rels: rightRels as never,
    type: 'parent' as const,
    membershipMode: relationships.find(rel => rel.membership_mode !== 'none')?.membership_mode,
    ...overrides,
  } as GroupedRelationshipRequest;
}

function renderManageNetworkTab(canManageRelationships: boolean) {
  const incomingRelationship = buildRelationship('incoming-rel');
  const outgoingRelationship = buildRelationship('outgoing-rel', {
    initiator_group_id: 'current-group',
    connection_request_id: 'request-outgoing',
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
      incomingRequests={[buildGroupedRequest([incomingRelationship])]}
      outgoingRequests={[buildGroupedRequest([outgoingRelationship])]}
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
    expect(screen.queryAllByText('Partner Group').length).toBeGreaterThan(0);
  });

  it('shows create, row actions, and workflows for users with manage rights', () => {
    renderManageNetworkTab(true);

    expect(screen.queryAllByText('common.actions.actions').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('common.network.manage').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('link-group-dialog-create')).not.toBeNull();
    expect(screen.queryAllByTestId(/link-group-dialog-/).length).toBeGreaterThanOrEqual(3);
  });

  it('renders only grant rows for a mixed structure and right request', () => {
    const structureRel = buildRelationship('request-structure', {
      grant_id: null,
      with_right: null,
      initiator_group_id: 'current-group',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'all_members',
    });
    const grantRel = buildRelationship('request-grant', {
      grant_id: 'grant-amendment',
      with_right: 'amendmentRight',
      initiator_group_id: 'current-group',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'all_members',
    });

    render(
      <ManageNetworkTab
        canManageRelationships
        groupId="current-group"
        groupName="Current Group"
        currentGroupType="base"
        currentGroupSiblingMembershipMode={null}
        searchQuery=""
        onSearchQueryChange={() => undefined}
        directionFilter="all"
        onDirectionFilterChange={() => undefined}
        manageRightFilter={new Set(['informationRight', 'amendmentRight'])}
        onToggleRightFilter={() => undefined}
        incomingRequests={[]}
        outgoingRequests={[buildGroupedRequest([structureRel, grantRel]) as never]}
        filteredRelationships={[]}
        allRelationships={[structureRel, grantRel] as never[]}
        onAcceptRequest={vi.fn().mockResolvedValue(undefined)}
        onRejectRequest={vi.fn().mockResolvedValue(undefined)}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.getByText('common.network.outgoingRequests (1)')).toBeTruthy();
    expect(screen.queryByText('Structure / membership change')).toBeNull();
    expect(screen.getAllByText('common.rights.amendment').length).toBeGreaterThan(0);
    expect(screen.queryByText('-')).toBeNull();
  });

  it('renders a named fallback row for structure-only requests', () => {
    const structureRel = buildRelationship('request-structure-only', {
      grant_id: null,
      with_right: null,
      initiator_group_id: 'current-group',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'all_members',
    });

    render(
      <ManageNetworkTab
        canManageRelationships
        groupId="current-group"
        groupName="Current Group"
        currentGroupType="base"
        currentGroupSiblingMembershipMode={null}
        searchQuery=""
        onSearchQueryChange={() => undefined}
        directionFilter="all"
        onDirectionFilterChange={() => undefined}
        manageRightFilter={new Set(['informationRight', 'amendmentRight'])}
        onToggleRightFilter={() => undefined}
        incomingRequests={[]}
        outgoingRequests={[buildGroupedRequest([structureRel]) as never]}
        filteredRelationships={[]}
        allRelationships={[structureRel] as never[]}
        onAcceptRequest={vi.fn().mockResolvedValue(undefined)}
        onRejectRequest={vi.fn().mockResolvedValue(undefined)}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.getByText('common.network.outgoingRequests (1)')).toBeTruthy();
    expect(screen.getAllByText('Structure / membership change').length).toBeGreaterThan(0);
    expect(screen.getByText('Structure / membership')).toBeTruthy();
    expect(screen.queryByText('-')).toBeNull();
  });
});
