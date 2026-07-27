/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManageNetworkTab } from '../ManageNetworkTab';
import type {
  GroupedRelationshipRequest,
  NormalizedGroupRelationship,
} from '../../types/network.types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string | Record<string, unknown>) => {
    const labels: Record<string, string> = {
      'features.network.membershipModes.role_members': 'Members with selected role',
    };
    return labels[key] ?? (typeof fallback === 'string' ? fallback : key);
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'common.network.structureMembership': 'Structure / membership',
        'common.network.structureMembershipChange': 'Structure / membership change',
        'common.network.membershipLabel': 'Membership',
        'common.network.membershipRequestAllMembersSentence':
          'All members of {{source}} are added to {{target}}',
        'common.network.membershipRequestRoleSentence':
          'Members of {{source}} with role {{role}} are added to {{target}}',
        'common.network.membershipRequestSourceGroupsSentence':
          'Members from selected source groups of {{source}} are added to {{target}}',
        'common.network.selectedRole': 'selected role',
        'common.network.directionHas': 'has',
        'common.network.directionIn': 'in',
        'common.network.rightInfo': 'Information Right',
        'common.network.rightAmendment': 'Amendment Right',
        'common.network.asParentGroupOf': 'as parent group of',
        'common.rights.information': 'Info',
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

function buildRelationship(
  id: string,
  overrides: Partial<NormalizedGroupRelationship> = {}
): NormalizedGroupRelationship {
  return {
    id,
    connection_id: 'connection-1',
    grant_id: 'grant-1',
    connection_request_id: 'request-1',
    membership_request_id: null,
    request_item_kind: 'right',
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
  };
}

function buildGroupedRequest(
  relationships: readonly NormalizedGroupRelationship[],
  overrides: Record<string, unknown> = {}
): GroupedRelationshipRequest {
  const rightRels = relationships.filter(rel => rel.request_item_kind === 'right');
  const membershipRels = relationships.filter(rel => rel.request_item_kind === 'membership');
  const structureRel = relationships.find(rel => rel.request_item_kind === 'structure') ?? null;
  return {
    group: relationships[0].group as never,
    requestId: relationships[0].connection_request_id,
    allRels: relationships as never,
    rightRels: rightRels as never,
    membershipRels: membershipRels as never,
    structureRel: structureRel as never,
    rels: [...membershipRels, ...rightRels] as never,
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
  it('exposes an active relationship as the confirmed tutorial link', () => {
    const { container } = renderManageNetworkTab(true);

    expect(
      container.querySelector('[data-tutorial-anchor="tutorial-network-confirmed"]')
    ).not.toBeNull();
  });

  it('renders a read-only management view for users with only relationship view rights', () => {
    const { container } = renderManageNetworkTab(false);

    expect(screen.queryAllByText('common.actions.actions')).toHaveLength(0);
    expect(screen.queryAllByText('common.network.manage')).toHaveLength(0);
    expect(screen.queryAllByText('common.actions.confirm')).toHaveLength(0);
    expect(screen.queryByTestId('link-group-dialog-create')).toBeNull();
    expect(screen.queryAllByText('Partner Group').length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain('var(--entity-group-bg)');
    expect(container.innerHTML).toContain('var(--badge-info-bg)');
    expect(container.innerHTML).not.toContain('bg-gradient');
    expect(container.innerHTML).not.toContain('text-transparent');
    expect(container.innerHTML).not.toContain('text-white');

    const relationshipBadge = screen
      .getAllByText('as parent group of')
      .find(element => element.className.includes('var(--badge-warning-bg)'));
    const infoRightBadge = screen
      .getAllByText('Info')
      .find(
        element =>
          element.className.includes('var(--badge-info-bg)') &&
          !element.className.includes('cursor-pointer')
      );

    expect(relationshipBadge).toBeTruthy();
    expect(relationshipBadge?.className).toContain('hover:bg-accent');
    expect(relationshipBadge?.className).toContain('hover:text-accent-foreground');
    expect(relationshipBadge?.className).not.toContain('hover:bg-primary');
    expect(infoRightBadge).toBeTruthy();
    expect(infoRightBadge?.className).toContain('hover:bg-accent');
    expect(infoRightBadge?.className).toContain('hover:text-accent-foreground');
    expect(infoRightBadge?.className).not.toContain('hover:bg-primary');

    const toolbar = container.querySelector('[data-slot="management-toolbar"]');
    const sections = container.querySelectorAll('[data-slot="management-section"]');
    const tableSurfaces = container.querySelectorAll('[data-slot="data-table-surface"]');
    expect(toolbar).toBeTruthy();
    expect(sections.length).toBe(3);
    expect(tableSurfaces.length).toBe(3);
    sections.forEach(section => {
      const header = section.querySelector('[data-slot="management-section-header"]');
      expect(header).toBeTruthy();
      expect(header?.closest('[data-slot="data-table-surface"]')).toBeNull();
    });
  });

  it('shows create, row actions, and workflows for users with manage rights', () => {
    renderManageNetworkTab(true);

    expect(screen.queryAllByText('common.actions.actions').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('common.network.manage').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('link-group-dialog-create')).not.toBeNull();
    expect(screen.queryAllByTestId(/link-group-dialog-/).length).toBeGreaterThanOrEqual(3);
  });

  it('renders the selected role tag for active role-members relationships', () => {
    const activeRelationship = buildRelationship('active-role-membership', {
      status: 'active',
      request_item_kind: 'right',
      membership_mode: 'role_members',
      required_source_role_id: 'role-admin',
      required_source_role: { id: 'role-admin', name: 'Admin' },
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
        manageRightFilter={new Set(['informationRight', 'membership'])}
        onToggleRightFilter={() => undefined}
        incomingRequests={[]}
        outgoingRequests={[]}
        filteredRelationships={[
          {
            group: activeRelationship.group as never,
            rights: ['informationRight'],
            type: 'sibling',
            membershipMode: 'role_members',
            requiredSourceRoleId: 'role-admin',
            requiredSourceRoleName: 'Admin',
          },
        ]}
        allRelationships={[activeRelationship] as never[]}
        onAcceptRequest={vi.fn().mockResolvedValue(undefined)}
        onRejectRequest={vi.fn().mockResolvedValue(undefined)}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.getByText('Members with selected role')).toBeTruthy();
    expect(screen.getByText('Admin').closest('[data-role-key="role-admin"]')).toBeTruthy();
  });

  it('renders membership and grant rows for a mixed request', () => {
    const structureRel = buildRelationship('request-structure', {
      grant_id: null,
      membership_request_id: null,
      request_item_kind: 'structure',
      with_right: null,
      initiator_group_id: 'current-group',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'all_members',
    });
    const membershipRel = buildRelationship('request-membership', {
      grant_id: null,
      membership_request_id: 'membership-request-1',
      request_item_kind: 'membership',
      group_id: 'partner-group',
      related_group_id: 'current-group',
      with_right: null,
      initiator_group_id: 'current-group',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'all_members',
    });
    const grantRel = buildRelationship('request-grant', {
      grant_id: 'grant-amendment',
      membership_request_id: null,
      request_item_kind: 'right',
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
        manageRightFilter={new Set(['informationRight', 'amendmentRight', 'membership'])}
        onToggleRightFilter={() => undefined}
        incomingRequests={[]}
        outgoingRequests={[buildGroupedRequest([structureRel, membershipRel, grantRel]) as never]}
        filteredRelationships={[]}
        allRelationships={[structureRel, membershipRel, grantRel] as never[]}
        onAcceptRequest={vi.fn().mockResolvedValue(undefined)}
        onRejectRequest={vi.fn().mockResolvedValue(undefined)}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.getByText('common.network.outgoingRequests')).toBeTruthy();
    expect(screen.queryByText('Structure / membership change')).toBeNull();
    expect(screen.getAllByText('Membership').length).toBeGreaterThan(0);
    expect(screen.getByText('Alle Mitglieder von')).toBeTruthy();
    expect(screen.getByText('werden')).toBeTruthy();
    expect(screen.getByText('hinzugefügt')).toBeTruthy();
    expect(
      screen
        .getAllByText('Partner Group')
        .some(element => element.closest('a')?.getAttribute('to') === '/group/$id')
    ).toBe(true);
    expect(
      screen
        .getAllByText('Current Group')
        .some(element => element.closest('a')?.getAttribute('to') === '/group/$id')
    ).toBe(true);
    expect(screen.getAllByText('common.rights.amendment').length).toBeGreaterThan(0);
    expect(screen.queryByText('-')).toBeNull();
  });

  it('renders role-based membership request wording', () => {
    const membershipRel = buildRelationship('request-membership-role', {
      grant_id: null,
      membership_request_id: 'membership-request-role',
      request_item_kind: 'membership',
      group_id: 'partner-group',
      related_group_id: 'current-group',
      with_right: null,
      initiator_group_id: 'current-group',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'role_members',
      required_source_role_id: 'role-1',
      required_source_role: { id: 'role-1', name: 'Delegate' },
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
        manageRightFilter={new Set(['membership'])}
        onToggleRightFilter={() => undefined}
        incomingRequests={[buildGroupedRequest([membershipRel]) as never]}
        outgoingRequests={[]}
        filteredRelationships={[]}
        allRelationships={[membershipRel] as never[]}
        onAcceptRequest={vi.fn().mockResolvedValue(undefined)}
        onRejectRequest={vi.fn().mockResolvedValue(undefined)}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.getByText('Mitglieder von')).toBeTruthy();
    expect(screen.getByText('mit Rolle')).toBeTruthy();
    expect(screen.getByText('Delegate').closest('[data-role-key="role-1"]')).toBeTruthy();
    expect(
      screen
        .getAllByText('Partner Group')
        .some(element => element.closest('a')?.getAttribute('to') === '/group/$id')
    ).toBe(true);
    expect(
      screen
        .getAllByText('Current Group')
        .some(element => element.closest('a')?.getAttribute('to') === '/group/$id')
    ).toBe(true);
  });

  it('renders a role fallback as a role tag for legacy role membership requests', () => {
    const membershipRel = buildRelationship('request-membership-role-fallback', {
      grant_id: null,
      membership_request_id: 'membership-request-role-fallback',
      request_item_kind: 'membership',
      group_id: 'partner-group',
      related_group_id: 'current-group',
      with_right: null,
      initiator_group_id: 'current-group',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'role_members',
      required_source_role_id: null,
      required_source_role: null,
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
        manageRightFilter={new Set(['membership'])}
        onToggleRightFilter={() => undefined}
        incomingRequests={[buildGroupedRequest([membershipRel]) as never]}
        outgoingRequests={[]}
        filteredRelationships={[]}
        allRelationships={[membershipRel] as never[]}
        onAcceptRequest={vi.fn().mockResolvedValue(undefined)}
        onRejectRequest={vi.fn().mockResolvedValue(undefined)}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(
      screen
        .getByText('selected role')
        .closest('[data-role-key="membership-request-role-request-membership-role-fallback"]')
    ).toBeTruthy();
  });

  it('renders a named fallback row for structure-only requests', () => {
    const structureRel = buildRelationship('request-structure-only', {
      grant_id: null,
      membership_request_id: null,
      request_item_kind: 'structure',
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

    expect(screen.getByText('common.network.outgoingRequests')).toBeTruthy();
    expect(screen.getAllByText('Structure / membership change').length).toBeGreaterThan(0);
    expect(screen.getByText('Structure / membership')).toBeTruthy();
    expect(screen.queryByText('-')).toBeNull();
  });
});
