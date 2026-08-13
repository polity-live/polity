/* @vitest-environment jsdom */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captures = vi.hoisted(() => ({
  components: {} as Record<string, any[]>,
  wait: vi.fn(async (value: unknown) => value),
  membershipPage: vi.fn((args: unknown) => ({ kind: 'membership-page', args })),
  membershipById: vi.fn((args: unknown) => ({ kind: 'membership-id', args })),
  guestPage: vi.fn((args: unknown) => ({ kind: 'guest-page', args })),
  guestById: vi.fn((args: unknown) => ({ kind: 'guest-id', args })),
}));

function captureComponent(name: string) {
  return (props: any) => {
    (captures.components[name] ??= []).push(props);
    return <div data-testid={name}>{props.children}</div>;
  };
}

vi.mock('../MembershipTabs', () => ({
  MembershipTabs: (props: any) => {
    (captures.components.MembershipTabs ??= []).push(props);
    return (
      <div>
        {props.tabBarAction}
        {props.membershipsByUserContent}
        {props.membershipsByRoleContent}
        {props.compositionContent}
        {props.rightsAlignmentContent}
        {props.openAssignmentsContent}
        {props.guestsContent}
        {props.rolesContent}
      </div>
    );
  },
}));
vi.mock('../ActiveMembersTable', () => ({
  ActiveMembersTable: captureComponent('ActiveMembersTable'),
}));
vi.mock('../MembershipsByRoleTables', () => ({
  MembershipsByRoleTables: captureComponent('MembershipsByRoleTables'),
}));
vi.mock('../MembershipCompositionPanel', () => ({
  MembershipCompositionPanel: captureComponent('MembershipCompositionPanel'),
}));
vi.mock('../MembershipRightsAlignmentPanel', () => ({
  MembershipRightsAlignmentPanel: captureComponent('MembershipRightsAlignmentPanel'),
}));
vi.mock('../OpenAssignmentsPanel', () => ({
  OpenAssignmentsPanel: captureComponent('OpenAssignmentsPanel'),
}));
vi.mock('../PendingRequestsTable', () => ({
  PendingRequestsTable: captureComponent('PendingRequestsTable'),
}));
vi.mock('../PendingInvitationsTable', () => ({
  PendingInvitationsTable: captureComponent('PendingInvitationsTable'),
}));
vi.mock('../InviteMembersDialog', () => ({
  InviteMembersDialog: captureComponent('InviteMembersDialog'),
}));
vi.mock('../GuestsTable', () => ({ GuestsTable: captureComponent('GuestsTable') }));
vi.mock('../ChangeRoleDialog', () => ({ ChangeRoleDialog: captureComponent('ChangeRoleDialog') }));
vi.mock('../MemberRightsDialog', () => ({
  MemberRightsDialog: captureComponent('MemberRightsDialog'),
}));
vi.mock('../RolesPermissionsTable', () => ({
  RolesPermissionsTable: (props: any) => {
    (captures.components.RolesPermissionsTable ??= []).push(props);
    return <div>{props.addRoleButton}</div>;
  },
}));
vi.mock('../RoleDetailsTable', () => ({
  RoleDetailsTable: (props: any) => {
    (captures.components.RoleDetailsTable ??= []).push(props);
    return <div>{props.addRoleButton}</div>;
  },
}));
vi.mock('../AddRoleDialog', () => ({ AddRoleDialog: captureComponent('AddRoleDialog') }));
vi.mock('../AssignHolderDialog', () => ({
  AssignHolderDialog: captureComponent('AssignHolderDialog'),
}));
vi.mock('@/features/offline-roster/ui/OfflineRosterCard', () => ({
  OfflineRosterCard: captureComponent('OfflineRosterCard'),
}));
vi.mock('@/features/roles/ui/RoleHolderHistoryDialog', () => ({
  RoleHolderHistoryDialog: captureComponent('RoleHolderHistoryDialog'),
}));
vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: captureComponent('EntitySearchBar'),
}));
vi.mock('@/features/shared/ui/participation', () => ({
  ParticipationRoleFilterBar: captureComponent('ParticipationRoleFilterBar'),
  getParticipationDisplayRoles: (membership: any) => membership.roles ?? [],
  filterParticipationsByRole: (items: any[], roleIds: string[]) =>
    roleIds.length === 0
      ? items
      : items.filter(item => (item.roles ?? []).some((role: any) => roleIds.includes(role.id))),
}));
vi.mock('@/features/shared/ui/form', () => ({
  SettingsPage: captureComponent('SettingsPage'),
  ManagementToolbar: captureComponent('ManagementToolbar'),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: captureComponent('Tabs'),
  TabsContent: captureComponent('TabsContent'),
  TabsList: captureComponent('TabsList'),
  TabsTrigger: captureComponent('TabsTrigger'),
}));
vi.mock('lucide-react', () => ({ Plus: () => <span /> }));
vi.mock('@/zero/mutate-with-server-check', () => ({ waitForClientApply: captures.wait }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    groups: {
      membershipPage: captures.membershipPage,
      membershipById: captures.membershipById,
      guestAccessPage: captures.guestPage,
      guestAccessById: captures.guestById,
    },
  },
}));

import {
  GroupMembershipsContentView,
  GroupMembershipsPageView,
  groupMembershipsContentViewInternals as helpers,
  type GroupMembershipsContentViewProps,
} from '../GroupMembershipsContentView';

function last(name: string) {
  return captures.components[name]?.at(-1);
}

function props(
  overrides: Partial<GroupMembershipsContentViewProps> = {}
): GroupMembershipsContentViewProps {
  const fn = vi.fn();
  return {
    accessRoles: [],
    activeGuestAccesses: [],
    activeMembers: [],
    activeTab: 'membershipsByUser',
    addRoleOpen: false,
    allUserRows: [],
    approveGuestAccess: fn,
    approveMembership: fn,
    assignmentsAreLoading: false,
    assignmentsAreScheduling: false,
    authUser: { id: 'actor' },
    availableEvents: [],
    canManageAssignments: true,
    canManageMembers: true,
    changeRoleMembership: null,
    changeRoleOpen: false,
    compositionBuckets: [],
    compositionIsLoading: false,
    connectedUserCandidates: [],
    createOfflineMember: fn,
    deleteOfflineMember: fn,
    editingRole: null,
    editRoleForm: {},
    editRoleOpen: false,
    existingMemberIds: [],
    group: { id: 'group', name: 'Group', group_type: 'base' },
    groupId: 'group',
    groupName: 'Group',
    groupRoleHook: {
      roles: [],
      selectedRole: null,
      actions: { delete: fn, openAssignHolder: fn, openHistory: fn, assignHolder: fn },
      dialogs: {
        assignHolder: { open: false, setOpen: fn },
        history: { open: false, setOpen: fn },
      },
    },
    guestOnlyMembershipFlow: false,
    guestRoles: [],
    handleAddRole: fn,
    handleConfirmRoleChange: fn,
    handleInvite: fn,
    handleInviteGuests: fn,
    handleMembershipSortChange: fn,
    handleOpenChangeRoleDialog: fn,
    handleOpenEditRole: fn,
    handleOpenMemberRights: fn,
    handleRemoveRoleFromMembershipTypeView: fn,
    handleSaveEditedRole: fn,
    handleTogglePermission: fn,
    importOfflineMembers: fn,
    invitedGuestAccesses: [],
    inviteMembershipPreflight: { blocking: false, isLoading: false, response: { conflicts: [] } },
    inviteOpen: false,
    isInviting: false,
    isInvitingGuests: false,
    memberRightsMembership: null,
    memberRightsOpen: false,
    memberRoles: [],
    memberSearchQuery: '',
    membershipsByRoleMembers: [],
    membershipSort: { field: 'user', direction: 'asc' },
    navigate: fn,
    newRoleForm: {},
    offlineMembershipsById: new Map(),
    openAssignments: [],
    pendingInvitations: [],
    pendingRequests: [],
    rejectMembership: fn,
    removeMember: fn,
    reorderRoles: fn,
    requestedGuestAccesses: [],
    revokeGuest: fn,
    rightsAlignmentRows: [],
    scheduleDelegateElection: fn,
    scheduleProcessTask: fn,
    scheduleRoleRenewal: fn,
    selectedGuestRoleIds: [],
    selectedGuestUserIds: [],
    selectedInviteRoleIds: [],
    selectedUserIds: [],
    setActiveTab: fn,
    setAddRoleOpen: fn,
    setChangeRoleOpen: fn,
    setEditingRole: fn,
    setEditRoleForm: fn,
    setEditRoleOpen: fn,
    setInviteOpen: fn,
    setMemberRightsOpen: fn,
    setMemberSearchQuery: fn,
    setNewRoleForm: fn,
    setSelectedGuestRoleIds: fn,
    setSelectedGuestUserIds: fn,
    setSelectedInviteRoleIds: fn,
    setSelectedUserIds: fn,
    showComposition: false,
    showRightsAlignment: false,
    t: (key: string) => `t:${key}`,
    updateOfflineMember: fn,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  captures.components = {};
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
    'offline-id' as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('GroupMembershipsPageView', () => {
  it('renders no toolbar, search-only, filter-only, and combined toolbar states', () => {
    const base = {
      title: 'Title',
      searchQuery: '',
      onSearchQueryChange: vi.fn(),
      searchPlaceholder: 'Search',
    };
    render(
      <GroupMembershipsPageView {...base} showSearch={false}>
        <span />
      </GroupMembershipsPageView>
    );
    expect(last('ManagementToolbar')).toBeUndefined();
    render(
      <GroupMembershipsPageView {...base} showSearch>
        <span />
      </GroupMembershipsPageView>
    );
    expect(last('EntitySearchBar')).toBeTruthy();
    render(
      <GroupMembershipsPageView {...base} showSearch={false} secondaryFilterContent={<b>filter</b>}>
        <span />
      </GroupMembershipsPageView>
    );
    expect(last('ManagementToolbar')).toBeTruthy();
    render(
      <GroupMembershipsPageView {...base} showSearch secondaryFilterContent={<b>filter</b>}>
        <span />
      </GroupMembershipsPageView>
    );
    expect(last('EntitySearchBar')).toMatchObject({ placeholder: 'Search' });
  });
});

describe('GroupMembershipsContentView', () => {
  it('compares roles by order and then by case-insensitive fallback names', () => {
    expect(helpers.compareDisplayRoles({ sort_order: 1 }, { sort_order: 2 })).toBeGreaterThan(0);
    expect(helpers.compareDisplayRoles({ sort_order: 1 }, { sort_order: undefined })).toBeLessThan(
      0
    );
    expect(
      helpers.compareDisplayRoles({ sort_order: undefined }, { sort_order: 1 })
    ).toBeGreaterThan(0);
    expect(helpers.compareDisplayRoles({ name: 'Alpha' }, { name: 'beta' })).toBeLessThan(0);
    expect(helpers.compareDisplayRoles({ name: undefined }, { name: undefined })).toBe(0);
  });

  it('deduplicates and sorts roles, applies valid filters, and exercises virtual sources', () => {
    const roleA = { id: 'a', name: 'Alpha', sort_order: 1 };
    const roleB = { id: 'b', name: 'beta', sort_order: 1 };
    const roleHigh = { id: 'high', name: null, sort_order: 5 };
    const roleUnset = { id: 'unset', name: undefined, sort_order: null };
    const active = { id: 'active', created_at: 10, roles: [roleA, roleHigh] };
    const request = { id: 'request', created_at: 20, roles: [roleB] };
    const invitation = { id: 'invite', created_at: 30, roles: [roleUnset] };
    const rendered = render(
      <GroupMembershipsContentView
        {...props({
          memberRoles: [null, { id: '' }, roleB, roleA],
          activeMembers: [active],
          membershipsByRoleMembers: [active, { id: 'other', roles: [roleUnset] }],
          pendingRequests: [request],
          pendingInvitations: [invitation],
        })}
      />
    );
    expect(last('ParticipationRoleFilterBar').roles.map((role: any) => role.id)).toEqual([
      'high',
      'a',
      'b',
      'unset',
    ]);
    const offlineRenderCount = captures.components.OfflineRosterCard?.length ?? 0;
    act(() => last('ParticipationRoleFilterBar').onSelectedRoleIdsChange(['a', 'missing']));
    expect(last('ActiveMembersTable').members).toEqual([active]);
    expect(last('PendingRequestsTable').requests).toEqual([]);
    expect(captures.components.OfflineRosterCard?.length ?? 0).toBe(offlineRenderCount);

    for (const source of [
      last('PendingRequestsTable').virtualSource,
      last('PendingInvitationsTable').virtualSource,
      last('ActiveMembersTable').virtualSource,
      last('MembershipsByRoleTables').getVirtualSource('a'),
    ]) {
      expect(
        source.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: false }).options.ttl
      ).toBe('none');
      expect(
        source.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: true }).options.ttl
      ).toBe('5m');
      expect(source.getSingleQuery({ id: 'active', settled: false }).options.ttl).toBe('none');
      expect(source.getSingleQuery({ id: 'active', settled: true }).options.ttl).toBe('5m');
      expect(source.getRowKey({ id: 'row' })).toBe('row');
      expect(source.toStartRow({ id: 'row', created_at: 1 })).toEqual({ id: 'row', created_at: 1 });
      expect(source.mapRow({ id: 'active' })).toBe(active);
      expect(source.mapRow({ id: 'unknown' })).toEqual({ id: 'unknown' });
    }
    rendered.unmount();
  });

  it('renders each tab action, guest filters, and all invitation preflight messages', () => {
    const guestRole = { id: 'guest-role', name: 'Guest' };
    const guests = [
      { id: 'requested', user: { id: 'requested-user' }, roles: [guestRole] },
      { id: 'active', user: { id: null }, roles: [guestRole] },
      { id: 'invited', user: null, roles: [] },
    ];
    render(
      <GroupMembershipsContentView
        {...props({
          activeTab: 'guests',
          guestRoles: [guestRole],
          requestedGuestAccesses: [guests[0]],
          activeGuestAccesses: [guests[1]],
          invitedGuestAccesses: [guests[2]],
          existingMemberIds: ['member'],
          authUser: null,
        })}
      />
    );
    expect(last('InviteMembersDialog')).toMatchObject({
      roles: [guestRole],
      excludeUserId: undefined,
    });
    const guestSource = last('GuestsTable').virtualSource;
    expect(
      guestSource.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: false }).options
        .ttl
    ).toBe('none');
    expect(
      guestSource.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: true }).options.ttl
    ).toBe('5m');
    expect(guestSource.getSingleQuery({ id: 'requested', settled: false }).options.ttl).toBe(
      'none'
    );
    expect(guestSource.getSingleQuery({ id: 'requested', settled: true }).options.ttl).toBe('5m');
    expect(guestSource.mapRow({ id: 'requested' })).toBe(guests[0]);
    expect(guestSource.mapRow({ id: 'unknown' })).toEqual({ id: 'unknown' });
    expect(guestSource.getRowKey({ id: 'guest' })).toBe('guest');
    expect(guestSource.toStartRow({ id: 'guest', created_at: 1 })).toEqual({
      id: 'guest',
      created_at: 1,
    });
    act(() => last('GuestsTable').onApprove('requested'));
    act(() => last('GuestsTable').onRevoke('requested'));

    render(
      <GroupMembershipsContentView
        {...props({ canManageMembers: false, activeTab: 'membershipsByUser' })}
      />
    );
    expect(last('MembershipTabs').tabBarAction).toBeNull();
    render(<GroupMembershipsContentView {...props({ activeTab: 'composition' })} />);
    expect(last('MembershipTabs').tabBarAction).toBeNull();

    for (const preflight of [
      { blocking: true, isLoading: true, response: { summary: 'summary', conflicts: [] } },
      {
        blocking: true,
        isLoading: false,
        response: { summary: null, conflicts: [{ summary: 'conflict' }] },
      },
      { blocking: true, isLoading: false, response: { summary: null, conflicts: [] } },
      { blocking: false, isLoading: false, response: { conflicts: [] } },
    ]) {
      render(
        <GroupMembershipsContentView
          {...props({
            activeTab: 'membershipsByUser',
            inviteMembershipPreflight: preflight,
          })}
        />
      );
    }
    expect(last('InviteMembersDialog').submitConflictResponse).toBeNull();

    render(
      <GroupMembershipsContentView
        {...props({
          activeTab: 'membershipsByRole',
          guestOnlyMembershipFlow: true,
          guestRoles: [guestRole],
          selectedGuestUserIds: ['guest'],
          selectedGuestRoleIds: ['guest-role'],
          requestedGuestAccesses: guests,
          activeGuestAccesses: guests,
          invitedGuestAccesses: guests,
        })}
      />
    );
    expect(last('InviteMembersDialog')).toMatchObject({
      selectedUsers: ['guest'],
      selectedRoleIds: ['guest-role'],
      roles: [guestRole],
      submitDisabled: false,
    });
  });

  it('runs membership, offline roster, role, dialog, and navigation callbacks', async () => {
    const approve = vi.fn(),
      reject = vi.fn(),
      remove = vi.fn(),
      rights = vi.fn(),
      change = vi.fn();
    const create = vi.fn(() => ({ kind: 'create' }));
    const update = vi.fn(() => ({ kind: 'update' }));
    const removeOffline = vi.fn(() => ({ kind: 'delete' }));
    const importRows = vi.fn(() => ({ kind: 'import' }));
    const navigate = vi.fn();
    const offlineMembership = { id: 'offline-membership' };
    const selectedRole = { id: 'selected', name: 'Selected' };
    const groupRoleHook = {
      roles: [{ id: 'role' }],
      selectedRole,
      actions: {
        delete: vi.fn(),
        openAssignHolder: vi.fn(),
        openHistory: vi.fn(),
        assignHolder: vi.fn(),
      },
      dialogs: {
        assignHolder: { open: true, setOpen: vi.fn() },
        history: { open: true, setOpen: vi.fn() },
      },
    };
    const viewProps = props({
      approveMembership: approve,
      rejectMembership: reject,
      removeMember: remove,
      handleOpenMemberRights: rights,
      handleOpenChangeRoleDialog: change,
      createOfflineMember: create,
      updateOfflineMember: update,
      deleteOfflineMember: removeOffline,
      importOfflineMembers: importRows,
      offlineMembershipsById: new Map([['offline-membership', offlineMembership]]),
      allUserRows: [{ id: 'row' }],
      navigate,
      authUser: null,
      groupRoleHook,
      changeRoleMembership: { user: { first_name: '', last_name: '' }, role: { id: 'single' } },
      editingRole: { id: 'edit', name: 'Edit role' },
    });
    render(<GroupMembershipsContentView {...viewProps} />);
    const requests = last('PendingRequestsTable');
    expect(requests.getApprovePreflightInput({ id: 'membership' })).toEqual({
      kind: 'membership_activation',
      membership_id: 'membership',
    });
    requests.onApprove('membership', 'user');
    requests.onReject('membership', 'user');
    last('PendingInvitationsTable').onWithdraw('membership', 'user');
    last('ActiveMembersTable').onRemove('membership', 'user');
    expect(approve).toHaveBeenCalledWith(
      'membership',
      'user',
      undefined,
      undefined,
      undefined,
      'Group'
    );
    expect(remove).toHaveBeenCalledWith(
      'membership',
      'user',
      undefined,
      undefined,
      undefined,
      'Group'
    );

    const offline = last('OfflineRosterCard');
    offline.onOpenRightsDialog({});
    offline.onOpenRightsDialog({ effectiveMembershipId: 'missing' });
    offline.onOpenRightsDialog({ effectiveMembershipId: 'offline-membership' });
    offline.onOpenChangeRoleDialog({});
    offline.onOpenChangeRoleDialog({ effectiveMembershipId: 'missing' });
    offline.onOpenChangeRoleDialog({ effectiveMembershipId: 'offline-membership' });
    expect(rights).toHaveBeenCalledWith(offlineMembership);
    expect(change).toHaveBeenCalledWith(offlineMembership);

    await offline.onCreate(
      { firstName: 'First', lastName: 'Last', reasonNotSignedUp: '' },
      'correlation'
    );
    await offline.onCreate(
      { firstName: 'First', lastName: 'Last', reasonNotSignedUp: 'reason' },
      'correlation'
    );
    await offline.onImport(
      [
        { firstName: 'One', lastName: 'A', reasonNotSignedUp: '' },
        { firstName: 'Two', lastName: 'B', reasonNotSignedUp: 'reason' },
      ],
      'correlation'
    );
    await offline.onConnect({ id: 'row' }, 'user', 'correlation');
    await offline.onEdit(
      { id: 'row' },
      { firstName: 'Edit', lastName: 'Name', reasonNotSignedUp: '' },
      'correlation'
    );
    await offline.onEdit(
      { id: 'row' },
      { firstName: 'Edit', lastName: 'Name', reasonNotSignedUp: 'reason' },
      'correlation'
    );
    await offline.onDelete({ id: 'row' }, 'correlation');
    expect(captures.wait).toHaveBeenCalled();

    const roleDetails = last('RoleDetailsTable');
    roleDetails.onDelete('role');
    roleDetails.onAssignHolder('role');
    roleDetails.onViewHistory('role');
    roleDetails.onOpenElectionAssignment('role');
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { tab: 'openAssignments', assignmentId: 'role:role' },
      })
    );
    const buttons = Array.from(document.querySelectorAll('button'));
    fireEvent.click(
      buttons.find(button => button.getAttribute('data-action-id')?.includes('definitions'))!
    );
    fireEvent.click(
      buttons.find(button => button.getAttribute('data-action-id')?.includes('rights'))!
    );

    const tabs = last('Tabs');
    act(() => tabs.onValueChange('actionRights'));
    act(() => last('Tabs').onValueChange('unexpected'));

    const addDialogs = captures.components.AddRoleDialog;
    act(() => addDialogs[0].onFormChange({ name: 'New' }));
    expect((viewProps.setNewRoleForm as any).mock.calls.at(-1)[0]({ old: true })).toEqual({
      old: true,
      name: 'New',
    });
    act(() => addDialogs.at(-1).onFormChange({ name: 'Edited' }));
    expect((viewProps.setEditRoleForm as any).mock.calls.at(-1)[0]({ old: true })).toEqual({
      old: true,
      name: 'Edited',
    });
    act(() => addDialogs.at(-1).onOpenChange(true));
    act(() => addDialogs.at(-1).onOpenChange(false));
    last('MemberRightsDialog').onNavigateToUser('user');
    expect(navigate).toHaveBeenCalledWith({ to: '/user/$id', params: { id: 'user' } });

    const assign = last('AssignHolderDialog');
    await assign.onAssign('user', 'reason');
    groupRoleHook.selectedRole = null as any;
    await expect(assign.onAssign('user', 'reason')).resolves.toBeUndefined();
  });

  it('covers role/dialog fallbacks, anonymous and authenticated callbacks, and hidden offline roster', () => {
    const changeCases = [
      null,
      { user: { first_name: 'First', last_name: 'Last' }, roles: [{ id: 'role' }] },
      { user: null, role: null },
    ];
    for (const changeRoleMembership of changeCases) {
      render(
        <GroupMembershipsContentView
          {...props({
            changeRoleMembership,
            editingRole: null,
            authUser: { id: 'actor' },
            showComposition: true,
            activeMembers: [{ id: 'member', user: null, roles: [] }],
          })}
        />
      );
    }
    expect(last('ChangeRoleDialog').currentRoles).toEqual([]);

    render(
      <GroupMembershipsContentView
        {...props({
          memberRoles: [],
          activeMembers: [],
          membershipsByRoleMembers: [],
          activeTab: 'roles',
          canManageMembers: true,
        })}
      />
    );
    expect(last('ParticipationRoleFilterBar')).toBeUndefined();
  });
});
