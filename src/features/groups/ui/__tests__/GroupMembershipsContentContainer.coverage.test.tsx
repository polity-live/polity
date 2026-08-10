/* @vitest-environment jsdom */

import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: null as any,
  group: null as any,
  relationships: [] as any[],
  activeMemberships: [] as any[],
  invitedMemberships: [] as any[],
  requestedMemberships: [] as any[],
  activeMembers: [] as any[],
  pendingRequests: [] as any[],
  pendingInvitations: [] as any[],
  activeGuests: [] as any[],
  requestedGuests: [] as any[],
  invitedGuests: [] as any[],
  groupRoles: [] as any[],
  accessRoles: [] as any[],
  showComposition: false,
  provenanceMemberships: [] as any[],
  compositionLoading: false,
  offlineMembers: [] as any[] | null,
  offlineMembersResult: { type: 'complete' } as any,
  offlineMemberships: [] as any[] | null,
  offlineMembershipsLoading: false,
  provenance: new Map<string, any>(),
  childGroups: [] as string[],
  authUser: { id: 'actor' } as any,
  preflight: { blocking: false } as any,
  addRoleResult: { success: true },
  updateRoleResult: { success: true },
  navigate: vi.fn(),
  onTabChange: vi.fn(),
  inviteUsers: vi.fn(async () => undefined),
  inviteGuests: vi.fn(async () => undefined),
  approveGuestAccess: vi.fn(),
  revokeGuest: vi.fn(),
  approveMembership: vi.fn(),
  rejectMembership: vi.fn(),
  removeMember: vi.fn(),
  changeMemberRoles: vi.fn(async () => undefined),
  addRole: vi.fn(async () => ({ success: true })),
  updateRole: vi.fn(async () => ({ success: true })),
  reorderRoles: vi.fn(),
  toggleActionRight: vi.fn(async () => undefined),
  createOfflineMember: vi.fn(),
  updateOfflineMember: vi.fn(),
  deleteOfflineMember: vi.fn(),
  importOfflineMembers: vi.fn(),
  syncOfflineMembershipRoles: vi.fn(() => ({ kind: 'sync' })),
  waitForClientApply: vi.fn(async (value: unknown) => value),
}));

vi.mock('../GroupMembershipsContentView', () => ({
  GroupMembershipsContentView: (props: any) => {
    mocks.viewProps = props;
    return <div data-testid="memberships-view" />;
  },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => `t:${key}` }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock('../../hooks/useGroupData', () => ({
  useGroupData: () => ({ group: mocks.group }),
  useGroupMemberships: () => ({
    activeMemberships: mocks.activeMemberships,
    invitedMemberships: mocks.invitedMemberships,
    requestedMemberships: mocks.requestedMemberships,
  }),
  useGroupGuestAccesses: () => ({
    activeGuestAccesses: mocks.activeGuests,
    requestedGuestAccesses: mocks.requestedGuests,
    invitedGuestAccesses: mocks.invitedGuests,
  }),
  useGroupAccessRoles: () => ({ roles: mocks.accessRoles }),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: () => ({ allRelationshipsWithGroups: mocks.relationships }),
  useGroupOfflineMembershipsByGroupIds: () => ({
    offlineMemberships: mocks.offlineMemberships,
    isLoading: mocks.offlineMembershipsLoading,
  }),
}));
vi.mock('@/features/roles/hooks/useGroupRoles', () => ({
  useGroupRoles: () => ({ roles: mocks.groupRoles }),
}));
vi.mock('../../hooks/useGroupMembershipComposition', () => ({
  useGroupMembershipComposition: () => ({
    showComposition: mocks.showComposition,
    membershipsWithProvenance: mocks.provenanceMemberships,
    isLoading: mocks.compositionLoading,
  }),
}));
vi.mock('../../hooks/useGroupOpenAssignments', () => ({
  useGroupOpenAssignments: () => ({
    openAssignments: [{ id: 'assignment' }],
    availableEvents: [{ id: 'event' }],
    isLoading: false,
    isScheduling: false,
    scheduleDelegateElection: vi.fn(),
    scheduleRoleRenewal: vi.fn(),
    scheduleProcessTask: vi.fn(),
  }),
}));
vi.mock('../../hooks/useMembershipSearch', () => ({
  useMembershipSearch: () => ({
    activeMembers: mocks.activeMembers,
    pendingRequests: mocks.pendingRequests,
    pendingInvitations: mocks.pendingInvitations,
  }),
}));
vi.mock('../../hooks/useGroupMutations', () => ({
  useGroupMutations: () => ({
    inviteUsers: mocks.inviteUsers,
    inviteGuests: mocks.inviteGuests,
    approveGuestAccess: mocks.approveGuestAccess,
    revokeGuest: mocks.revokeGuest,
    approveMembership: mocks.approveMembership,
    rejectMembership: mocks.rejectMembership,
    removeMember: mocks.removeMember,
    changeMemberRoles: mocks.changeMemberRoles,
  }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    createOfflineMember: mocks.createOfflineMember,
    updateOfflineMember: mocks.updateOfflineMember,
    deleteOfflineMember: mocks.deleteOfflineMember,
    importOfflineMembers: mocks.importOfflineMembers,
    syncOfflineMembershipRoles: mocks.syncOfflineMembershipRoles,
  }),
}));
vi.mock('../../hooks/useRoleManagement', () => ({
  useRoleManagement: () => ({
    addRole: mocks.addRole,
    updateRole: mocks.updateRole,
    reorderRoles: mocks.reorderRoles,
    toggleActionRight: mocks.toggleActionRight,
  }),
}));
vi.mock('../../hooks/useMembershipActivationPreflight', () => ({
  useMembershipActivationPreflight: () => mocks.preflight,
}));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [mocks.offlineMembers, mocks.offlineMembersResult],
}));
vi.mock('@/zero/queries', () => ({
  queries: { groups: { offlineMembersByGroupIds: (args: unknown) => ({ args }) } },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('../../logic/roleFormHelpers', () => ({
  emptyRoleEditorForm: () => ({ name: '', permissions: [] }),
  roleToEditorForm: (role: any) => ({ name: role.name, permissions: role.action_rights ?? [] }),
}));
vi.mock('../../logic/buildMembershipRightsSummary', () => ({
  augmentMembershipsWithCurrentRoleHolders: (memberships: any[]) => memberships,
  getMembershipAssignedRoles: (membership: any) => membership.roles ?? [],
  getMembershipDisplayRoles: (membership: any) => membership.roles ?? [],
}));
vi.mock('../../logic/hierarchy', () => ({ resolveChildBaseGroups: () => mocks.childGroups }));
vi.mock('../../logic/membershipRightsAlignment', () => ({
  buildMembershipRightsAlignmentRowsFromRelationships: () => [{ id: 'alignment' }],
}));
vi.mock('../../logic/offlineRosterProvenance', () => ({
  resolveOfflineRosterProvenance: () => mocks.provenance,
}));
vi.mock('../../logic/membershipComposition', () => ({
  buildMembershipCompositionBuckets: (memberships: any[]) =>
    memberships.map(item => ({ id: item.id })),
}));
vi.mock('../../logic/effectiveMemberships', () => ({
  selectMaterializedHierarchicalMemberships: ({ memberships }: any) => memberships,
}));

import {
  buildCompositionOfflineRosterRows,
  GroupMembershipsContentContainer,
  groupMembershipsContentInternals as helpers,
} from '../GroupMembershipsContentContainer';

const baseProps = {
  groupId: 'group',
  canManageMembers: true,
  canManageAssignments: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewProps = null;
  mocks.group = null;
  mocks.relationships = [];
  mocks.activeMemberships = [];
  mocks.invitedMemberships = [];
  mocks.requestedMemberships = [];
  mocks.activeMembers = [];
  mocks.pendingRequests = [];
  mocks.pendingInvitations = [];
  mocks.activeGuests = [];
  mocks.requestedGuests = [];
  mocks.invitedGuests = [];
  mocks.groupRoles = [];
  mocks.accessRoles = [];
  mocks.showComposition = false;
  mocks.provenanceMemberships = [];
  mocks.compositionLoading = false;
  mocks.offlineMembers = [];
  mocks.offlineMembersResult = { type: 'complete' };
  mocks.offlineMemberships = [];
  mocks.offlineMembershipsLoading = false;
  mocks.provenance = new Map();
  mocks.childGroups = [];
  mocks.authUser = { id: 'actor' };
  mocks.preflight = { blocking: false };
  mocks.addRole.mockImplementation(async () => mocks.addRoleResult);
  mocks.updateRole.mockImplementation(async () => mocks.updateRoleResult);
  mocks.addRoleResult = { success: true };
  mocks.updateRoleResult = { success: true };
});

describe('GroupMembershipsContentContainer helpers', () => {
  it('normalizes membership kinds and group references', () => {
    expect(helpers.isOfflineMembershipParticipant(null)).toBe(false);
    expect(helpers.isOfflineMembershipParticipant({ id: 'online' } as any)).toBe(false);
    expect(helpers.isOfflineMembershipParticipant({ membershipKind: 'offline' } as any)).toBe(true);
    expect(helpers.toMembershipCompositionGroup(null)).toBeNull();
    expect(helpers.toMembershipCompositionGroup({ id: '' })).toBeNull();
    expect(helpers.toMembershipCompositionGroup({ id: 'id' })).toEqual({
      id: 'id',
      name: 'id',
      group_type: null,
      connected_group_id: null,
      sibling_membership_mode: null,
    });
    expect(
      helpers.toMembershipCompositionGroup({
        id: 'id',
        name: 'Name',
        group_type: 'sibling',
        connected_group_id: 'partner',
        sibling_membership_mode: 'elected',
      })
    ).toMatchObject({ name: 'Name', group_type: 'sibling', connected_group_id: 'partner' });
    expect(helpers.toOfflineRosterGroupReference(undefined)).toBeNull();
    expect(helpers.toOfflineRosterGroupReference({ id: 'id' })).toEqual({
      id: 'id',
      name: 'id',
      group_type: null,
    });
    expect(
      helpers.toOfflineRosterGroupReference({ id: 'id', name: 'Name', group_type: 'base' })
    ).toEqual({
      id: 'id',
      name: 'Name',
      group_type: 'base',
    });
    expect(helpers.toProvenanceGroupReference({ id: null })).toBeNull();
    expect(helpers.toProvenanceGroupReference({ id: 'id' })).toEqual({
      id: 'id',
      name: 'id',
      group_type: null,
    });
    expect(
      helpers.toProvenanceGroupReference({ id: 'id', name: 'Name', group_type: 'base' })
    ).toEqual({
      id: 'id',
      name: 'Name',
      group_type: 'base',
    });
  });

  it('builds offline composition rows with relational and synthetic fallbacks', () => {
    const rows = buildCompositionOfflineRosterRows(
      [
        {
          id: 'membership-full',
          group_offline_member_id: 'offline-full',
          group_offline_member: {
            id: 'offline-full',
            first_name: 'First',
            last_name: 'Last',
            reason_not_signed_up: 'reason',
            connected_user: { id: 'connected' },
          },
          user: { first_name: 'User First', last_name: 'User Last' },
          roles: [{ id: 'role' }],
          partGroup: { id: 'part' },
          baseGroup: { id: 'base' },
        },
        {
          id: 'membership-fallback',
          group_offline_member_id: 'offline-fallback',
          group_offline_member: null,
          user: { first_name: null, last_name: undefined },
          roles: null,
          partGroup: undefined,
          baseGroup: undefined,
        },
        {
          id: 'membership-user',
          group_offline_member_id: 'offline-user',
          group_offline_member: { id: null, first_name: null, last_name: null },
          user: { first_name: 'User First', last_name: 'User Last' },
          roles: [],
        },
      ] as any,
      false
    );
    expect(rows[0]).toMatchObject({
      id: 'offline-full',
      firstName: 'First',
      lastName: 'Last',
      reasonNotSignedUp: 'reason',
      connectedUser: { id: 'connected' },
      canManageRoles: false,
    });
    expect(rows[1]).toMatchObject({
      id: 'offline-fallback',
      firstName: '',
      lastName: '',
      reasonNotSignedUp: null,
      connectedUser: null,
      partGroup: null,
      baseGroup: null,
      roles: [],
    });
    expect(rows[2]).toMatchObject({
      id: 'offline-user',
      firstName: 'User First',
      lastName: 'User Last',
    });
  });
});

describe('GroupMembershipsContentContainer integration', () => {
  it('resolves allowed and fallback tabs for each permission combination', () => {
    const onTabChange = mocks.onTabChange;
    render(
      <GroupMembershipsContentContainer
        {...baseProps}
        defaultTab="openAssignments"
        onTabChange={onTabChange}
      />
    );
    expect(mocks.viewProps.activeTab).toBe('openAssignments');

    render(<GroupMembershipsContentContainer {...baseProps} defaultTab="membershipsByRole" />);
    expect(mocks.viewProps.activeTab).toBe('membershipsByRole');

    render(<GroupMembershipsContentContainer {...baseProps} defaultTab="rightsAlignment" />);
    expect(mocks.viewProps.activeTab).toBe('membershipsByUser');

    render(
      <GroupMembershipsContentContainer
        groupId="group"
        canManageMembers={false}
        canManageAssignments={false}
        defaultTab="roles"
      />
    );
    expect(mocks.viewProps.activeTab).toBe('openAssignments');

    act(() => mocks.viewProps.setActiveTab('guests'));
    expect(mocks.viewProps.activeTab).toBe('guests');
  });

  it('builds base-group roster rows, filters them, and resolves candidate users', () => {
    mocks.group = { id: 'group', name: '', group_type: 'base' };
    mocks.activeMemberships = [
      {
        id: 'active',
        user: { id: 'candidate', first_name: 'Active', last_name: 'User' },
        roles: [{ id: 'role', name: 'Role' }],
      },
      {
        id: 'connected-active',
        user: { id: 'connected', first_name: null, last_name: null },
        roles: [],
      },
      { id: 'no-user', user: null, roles: [] },
    ];
    mocks.activeMembers = mocks.activeMemberships;
    mocks.provenanceMemberships = mocks.activeMemberships;
    mocks.requestedMemberships = [{ id: 'request', user: { id: 'requested' } }];
    mocks.invitedMemberships = [{ id: 'invite', user: null }];
    mocks.offlineMembers = [
      {
        id: 'offline',
        group_id: 'group',
        first_name: 'Offline',
        last_name: 'Person',
        reason_not_signed_up: 'Reason',
        connected_user_id: null,
        connected_user: {
          id: 'connected-user',
          first_name: 'Connect',
          last_name: 'User',
          handle: 'handle',
        },
        group: { id: 'group', name: 'Group', group_type: 'base' },
      },
      {
        id: 'connected-offline',
        group_id: 'group',
        first_name: 'Connected',
        last_name: 'Offline',
        connected_user_id: 'connected',
      },
      { id: 'other', group_id: 'other', first_name: 'Other', last_name: 'Group' },
    ];
    mocks.offlineMemberships = [
      {
        id: 'effective',
        group_id: 'group',
        group_offline_member_id: 'offline',
        source_group: { id: 'source', name: 'Source', group_type: 'base' },
        group: { id: 'group', name: 'Group' },
        group_offline_member: mocks.offlineMembers[0],
        roles: [{ id: 'offline-role', name: 'Offline Role' }],
        role: { id: 'offline-role' },
      },
    ];
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.groupName).toBe('t:features.groups.detail.title');
    expect(mocks.viewProps.offlineRows).toBeUndefined();
    expect(mocks.viewProps.allUserRows).toHaveLength(5);
    expect(mocks.viewProps.connectedUserCandidates).toEqual([
      expect.objectContaining({ id: 'candidate' }),
    ]);
    expect(mocks.viewProps.existingMemberIds).toEqual(['candidate', 'connected', 'requested']);
    expect(mocks.viewProps.offlineMembershipsById.get('effective')).toBeTruthy();

    act(() => mocks.viewProps.setMemberSearchQuery('connect'));
    expect(mocks.viewProps.allUserRows.filter((row: any) => row.kind === 'offline')).toHaveLength(
      2
    );
    act(() => mocks.viewProps.setMemberSearchQuery('missing'));
    expect(mocks.viewProps.allUserRows.filter((row: any) => row.kind === 'offline')).toHaveLength(
      0
    );
  });

  it('builds hierarchical composition, provenance, rights alignment, and loading states', () => {
    mocks.group = { id: 'group', name: 'Hierarchy', group_type: 'hierarchical' };
    mocks.relationships = [
      {
        group: { id: 'group', name: 'Hierarchy', group_type: 'hierarchical' },
        related_group: { id: 'base', name: 'Base', group_type: 'base' },
      },
      { group: null, related_group: { id: null } },
    ];
    mocks.childGroups = ['base'];
    mocks.showComposition = true;
    mocks.provenanceMemberships = [{ id: 'online', user: { id: 'online' }, roles: [] }];
    mocks.activeMembers = [
      {
        id: 'online',
        user: { id: 'online', first_name: 'On', last_name: 'Line' },
        roles: [],
        partGroup: { id: 'part' },
        baseGroup: null,
      },
      {
        id: 'online-fallback',
        user: null,
        roles: [],
        partGroup: null,
        baseGroup: { id: 'base' },
      },
    ];
    mocks.offlineMembers = [
      {
        id: 'offline',
        group_id: 'base',
        first_name: 'Off',
        last_name: 'Line',
        group: { id: 'base', name: 'Base' },
      },
    ];
    mocks.offlineMemberships = [
      {
        id: 'offline-membership',
        group_id: 'group',
        group_offline_member_id: 'offline',
        group_offline_member: mocks.offlineMembers[0],
        source_group: null,
        roles: undefined,
        role: undefined,
        effectiveReadOnly: true,
        effectiveSourceMembershipId: 'source-membership',
      },
      {
        id: 'missing-relation',
        group_id: 'group',
        group_offline_member_id: 'missing',
        group_offline_member: null,
        source_group: null,
        roles: [],
        role: null,
      },
    ];
    mocks.provenance = new Map([
      [
        'offline',
        {
          partGroup: { id: 'part' },
          baseGroup: { id: 'base' },
          provenanceBucketLabel: 'Bucket',
        },
      ],
    ]);
    render(<GroupMembershipsContentContainer {...baseProps} defaultTab="rightsAlignment" />);
    expect(mocks.viewProps).toMatchObject({
      activeTab: 'rightsAlignment',
      showRightsAlignment: true,
      showComposition: true,
      compositionIsLoading: false,
    });
    expect(mocks.viewProps.compositionBuckets).toHaveLength(3);
    expect(mocks.viewProps.rightsAlignmentRows).toEqual([{ id: 'alignment' }]);
    expect(mocks.viewProps.membershipsByRoleMembers).toHaveLength(4);
    expect(mocks.viewProps.allUserRows.filter((row: any) => row.kind === 'offline')).toHaveLength(
      2
    );

    mocks.offlineMembersResult = { type: 'unknown' };
    const loading = render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.compositionIsLoading).toBe(true);
    expect(mocks.viewProps.compositionBuckets).toEqual([]);
    loading.unmount();

    mocks.offlineMembersResult = { type: 'complete' };
    mocks.offlineMembershipsLoading = true;
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.compositionIsLoading).toBe(true);
  });

  it('expands elected and selected sibling source groups', () => {
    mocks.showComposition = true;
    mocks.childGroups = ['base-child'];
    mocks.relationships = [
      {
        group: { id: 'source', name: 'Source', group_type: 'hierarchical' },
        related_group: { id: 'base-child', name: 'Child', group_type: 'base' },
      },
    ];
    mocks.group = {
      id: 'group',
      name: 'Sibling',
      group_type: 'sibling',
      sibling_membership_mode: 'elected',
      connected_group_id: 'source',
      primary_sibling_membership_mode: 'all_members',
    };
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.guestOnlyMembershipFlow).toBe(true);

    mocks.group = {
      id: 'group',
      name: 'Sibling',
      group_type: 'sibling',
      sibling_membership_mode: 'parliament',
      connected_group_id: null,
      primary_sibling_membership_mode: null,
      sibling_sources: [
        { source_group: { id: 'source' }, source_group_id: 'fallback' },
        { source_group: null, source_group_id: 'fallback' },
        { source_group: null, source_group_id: null },
      ],
    };
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.guestOnlyMembershipFlow).toBe(false);

    mocks.group = { ...mocks.group, sibling_sources: undefined };
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.showComposition).toBe(true);

    mocks.group = { ...mocks.group, sibling_membership_mode: 'elected', connected_group_id: null };
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.showComposition).toBe(true);
  });

  it('executes role, invitation, membership, sorting, and dialog handlers', async () => {
    mocks.group = { id: 'group', name: 'Group', group_type: 'base' };
    mocks.accessRoles = [
      {
        id: 'member-role',
        name: 'Member',
        assignee_kind: 'member',
        action_rights: [{ id: 'right' }],
      },
      { id: 'guest-role', name: 'Guest', assignee_kind: 'guest' },
    ];
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.memberRoles).toHaveLength(1);
    expect(mocks.viewProps.guestRoles).toHaveLength(1);

    act(() => mocks.viewProps.handleMembershipSortChange('user'));
    expect(mocks.viewProps.membershipSort.direction).toBe('desc');
    act(() => mocks.viewProps.handleMembershipSortChange('user'));
    expect(mocks.viewProps.membershipSort.direction).toBe('asc');
    act(() => mocks.viewProps.handleMembershipSortChange('role'));
    expect(mocks.viewProps.membershipSort).toEqual({ field: 'role', direction: 'asc' });

    await act(() => mocks.viewProps.handleConfirmRoleChange(['role']));
    act(() =>
      mocks.viewProps.handleOpenChangeRoleDialog({ id: 'readonly', effectiveReadOnly: true })
    );
    await act(() => mocks.viewProps.handleConfirmRoleChange(['role']));
    act(() =>
      mocks.viewProps.handleOpenChangeRoleDialog({
        id: 'offline',
        membershipKind: 'offline',
        user: null,
      })
    );
    await act(() => mocks.viewProps.handleConfirmRoleChange(['role']));
    expect(mocks.syncOfflineMembershipRoles).toHaveBeenCalledWith({
      group_offline_membership_id: 'offline',
      role_ids: ['role'],
      assigned_by_id: 'actor',
    });
    act(() => mocks.viewProps.handleOpenChangeRoleDialog({ id: 'missing-user', user: null }));
    await act(() => mocks.viewProps.handleConfirmRoleChange(['role']));
    act(() => mocks.viewProps.handleOpenChangeRoleDialog({ id: 'online', user: { id: 'user' } }));
    await act(() => mocks.viewProps.handleConfirmRoleChange(['role']));
    expect(mocks.changeMemberRoles).toHaveBeenCalledWith(
      'online',
      ['role'],
      'user',
      'actor',
      undefined,
      'Group'
    );

    act(() => mocks.viewProps.handleOpenMemberRights({ id: 'online' }));
    expect(mocks.viewProps.memberRightsOpen).toBe(true);

    await act(() => mocks.viewProps.handleInvite());
    act(() => mocks.viewProps.setSelectedUserIds(['user']));
    mocks.preflight.blocking = true;
    await act(() => mocks.viewProps.handleInvite());
    mocks.preflight.blocking = false;
    act(() => mocks.viewProps.setSelectedInviteRoleIds(['member-role']));
    await act(() => mocks.viewProps.handleInvite());
    expect(mocks.inviteUsers).toHaveBeenCalledWith(['user'], ['member-role'], 'actor');
    expect(mocks.viewProps.selectedUserIds).toEqual([]);

    await act(() => mocks.viewProps.handleInviteGuests());
    act(() => mocks.viewProps.setSelectedGuestUserIds(['guest']));
    await act(() => mocks.viewProps.handleInviteGuests());
    act(() => mocks.viewProps.setSelectedGuestRoleIds(['guest-role']));
    await act(() => mocks.viewProps.handleInviteGuests());
    expect(mocks.inviteGuests).toHaveBeenCalledWith(['guest'], ['guest-role'], 'actor');

    mocks.addRoleResult = { success: false };
    await act(() => mocks.viewProps.handleAddRole());
    mocks.addRoleResult = { success: true };
    act(() => mocks.viewProps.setAddRoleOpen(true));
    await act(() => mocks.viewProps.handleAddRole());
    expect(mocks.viewProps.addRoleOpen).toBe(false);

    await act(() => mocks.viewProps.handleTogglePermission('missing', 'groups', 'manage', false));
    await act(() =>
      mocks.viewProps.handleTogglePermission('member-role', 'groups', 'manage', true)
    );
    expect(mocks.toggleActionRight).toHaveBeenLastCalledWith(
      'member-role',
      'groups',
      'manage',
      true,
      [{ id: 'right' }]
    );

    act(() => mocks.viewProps.handleOpenEditRole({ id: 'missing' }));
    await act(() => mocks.viewProps.handleSaveEditedRole());
    act(() => mocks.viewProps.handleOpenEditRole({ id: 'member-role' }));
    expect(mocks.viewProps.editRoleOpen).toBe(true);
    mocks.updateRoleResult = { success: false };
    await act(() => mocks.viewProps.handleSaveEditedRole());
    mocks.updateRoleResult = { success: true };
    await act(() => mocks.viewProps.handleSaveEditedRole());
    expect(mocks.viewProps.editRoleOpen).toBe(false);

    await act(() =>
      mocks.viewProps.handleRemoveRoleFromMembershipTypeView({ effectiveReadOnly: true }, 'role')
    );
    await act(() =>
      mocks.viewProps.handleRemoveRoleFromMembershipTypeView(
        {
          id: 'offline-remove',
          membershipKind: 'offline',
          roles: [{ id: 'role' }, { id: 'keep' }],
        },
        'role'
      )
    );
    await act(() =>
      mocks.viewProps.handleRemoveRoleFromMembershipTypeView({ id: 'no-user', roles: [] }, 'role')
    );
    await act(() =>
      mocks.viewProps.handleRemoveRoleFromMembershipTypeView(
        {
          id: 'online-remove',
          user: { id: 'user' },
          roles: [{ id: 'role' }, { id: 'keep' }],
        },
        'role'
      )
    );
    expect(mocks.changeMemberRoles).toHaveBeenLastCalledWith(
      'online-remove',
      ['keep'],
      'user',
      'actor',
      undefined,
      'Group'
    );
  });

  it('covers anonymous mutations, invite preflight gates, and null roster collections', async () => {
    mocks.authUser = null;
    mocks.group = { id: 'group', name: 'Group', group_type: 'base' };
    mocks.offlineMembers = null;
    mocks.offlineMemberships = null;
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.allUserRows).toEqual([]);

    mocks.group = { id: 'group', name: 'Hierarchy', group_type: 'hierarchical' };
    render(<GroupMembershipsContentContainer {...baseProps} />);
    expect(mocks.viewProps.membershipsByRoleMembers).toEqual([]);
    mocks.group = { id: 'group', name: 'Group', group_type: 'base' };

    act(() =>
      mocks.viewProps.handleOpenChangeRoleDialog({
        id: 'offline',
        membershipKind: 'offline',
        user: null,
      })
    );
    await act(() => mocks.viewProps.handleConfirmRoleChange([]));
    expect(mocks.syncOfflineMembershipRoles).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: null })
    );
    act(() => mocks.viewProps.handleOpenChangeRoleDialog({ id: 'online', user: { id: 'user' } }));
    await act(() => mocks.viewProps.handleConfirmRoleChange([]));
    expect(mocks.changeMemberRoles).toHaveBeenLastCalledWith(
      'online',
      [],
      'user',
      undefined,
      undefined,
      'Group'
    );

    act(() => mocks.viewProps.setInviteOpen(true));
    act(() => mocks.viewProps.setSelectedUserIds(['user']));
    await act(() => mocks.viewProps.handleInvite());
    expect(mocks.inviteUsers).toHaveBeenLastCalledWith(['user'], [], undefined);
    act(() => mocks.viewProps.setSelectedGuestUserIds(['guest']));
    act(() => mocks.viewProps.setSelectedGuestRoleIds(['role']));
    await act(() => mocks.viewProps.handleInviteGuests());
    expect(mocks.inviteGuests).toHaveBeenLastCalledWith(['guest'], ['role'], undefined);

    await act(() =>
      mocks.viewProps.handleRemoveRoleFromMembershipTypeView(
        {
          id: 'offline-remove',
          membershipKind: 'offline',
          roles: [],
        },
        'role'
      )
    );
    expect(mocks.syncOfflineMembershipRoles).toHaveBeenLastCalledWith(
      expect.objectContaining({ assigned_by_id: null })
    );
    await act(() =>
      mocks.viewProps.handleRemoveRoleFromMembershipTypeView(
        {
          id: 'online-remove',
          user: { id: 'user' },
          roles: [],
        },
        'role'
      )
    );
    expect(mocks.changeMemberRoles).toHaveBeenLastCalledWith(
      'online-remove',
      [],
      'user',
      undefined,
      undefined,
      'Group'
    );
  });

  it('evaluates every invitation-preflight enablement condition', () => {
    mocks.group = { id: 'group', name: 'Group', group_type: 'base' };
    render(<GroupMembershipsContentContainer {...baseProps} />);
    act(() => mocks.viewProps.setInviteOpen(true));
    act(() => mocks.viewProps.setActiveTab('guests'));
    act(() => mocks.viewProps.setSelectedUserIds(['user']));
    act(() => mocks.viewProps.setActiveTab('membershipsByUser'));

    mocks.group = {
      id: 'group',
      name: 'Sibling',
      group_type: 'sibling',
      primary_sibling_membership_mode: 'all_members',
    };
    render(<GroupMembershipsContentContainer {...baseProps} />);
    act(() => mocks.viewProps.setInviteOpen(true));
  });
});
