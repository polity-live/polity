/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));

vi.mock('@/features/shared/ui/form', () => ({
  ManagementToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: () => null,
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value: _value, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/groups/ui/MembershipTabs', () => ({
  MembershipTabs: ({ rolesContent }: { rolesContent: ReactNode }) => <div>{rolesContent}</div>,
}));

vi.mock('@/features/groups/ui/RoleDetailsTable', () => ({
  RoleDetailsTable: ({ addRoleButton }: { addRoleButton: ReactNode }) => <div>{addRoleButton}</div>,
}));

vi.mock('@/features/groups/ui/RolesPermissionsTable', () => ({
  RolesPermissionsTable: ({ addRoleButton }: { addRoleButton: ReactNode }) => (
    <div>{addRoleButton}</div>
  ),
}));

vi.mock('@/features/groups/ui/AddRoleDialog', () => ({
  AddRoleDialog: ({ 'data-action-id': actionId, onSubmit }: any) => (
    <button data-action-id={actionId} type="button" onClick={onSubmit}>
      submit
    </button>
  ),
}));

vi.mock('@/features/groups/ui/ActiveMembersTable', () => ({ ActiveMembersTable: () => null }));
vi.mock('@/features/groups/ui/MembershipsByRoleTables', () => ({
  MembershipsByRoleTables: () => null,
}));
vi.mock('@/features/groups/ui/MembershipCompositionPanel', () => ({
  MembershipCompositionPanel: () => null,
}));
vi.mock('@/features/groups/ui/MembershipRightsAlignmentPanel', () => ({
  MembershipRightsAlignmentPanel: () => null,
}));
vi.mock('@/features/groups/ui/OpenAssignmentsPanel', () => ({ OpenAssignmentsPanel: () => null }));
vi.mock('@/features/groups/ui/PendingRequestsTable', () => ({ PendingRequestsTable: () => null }));
vi.mock('@/features/groups/ui/PendingInvitationsTable', () => ({
  PendingInvitationsTable: () => null,
}));
vi.mock('@/features/groups/ui/InviteMembersDialog', () => ({ InviteMembersDialog: () => null }));
vi.mock('@/features/groups/ui/GuestsTable', () => ({ GuestsTable: () => null }));
vi.mock('@/features/groups/ui/ChangeRoleDialog', () => ({ ChangeRoleDialog: () => null }));
vi.mock('@/features/groups/ui/MemberRightsDialog', () => ({ MemberRightsDialog: () => null }));
vi.mock('@/features/groups/ui/AssignHolderDialog', () => ({ AssignHolderDialog: () => null }));

vi.mock('@/features/offline-roster/ui/OfflineRosterCard', () => ({
  OfflineRosterCard: () => null,
}));
vi.mock('@/features/roles/ui/RoleHolderHistoryDialog', () => ({
  RoleHolderHistoryDialog: () => null,
}));
vi.mock('@/features/shared/ui/participation', () => ({
  ParticipationRoleFilterBar: () => null,
  filterParticipationsByRole: (items: unknown[]) => items,
  getParticipationDisplayRoles: () => [],
}));

import { GroupMembershipsContentView } from '../GroupMembershipsContentView';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function props() {
  const values: any = {};
  for (const key of [
    'accessRoles',
    'activeGuestAccesses',
    'activeMembers',
    'allUserRows',
    'availableEvents',
    'compositionBuckets',
    'connectedUserCandidates',
    'existingMemberIds',
    'guestRoles',
    'invitedGuestAccesses',
    'memberRoles',
    'membershipsByRoleMembers',
    'offlineMembershipsById',
    'openAssignments',
    'pendingInvitations',
    'pendingRequests',
    'requestedGuestAccesses',
    'rightsAlignmentRows',
    'selectedGuestRoleIds',
    'selectedGuestUserIds',
    'selectedInviteRoleIds',
    'selectedUserIds',
  ]) {
    values[key] = [];
  }
  for (const key of [
    'approveGuestAccess',
    'approveMembership',
    'createOfflineMember',
    'deleteOfflineMember',
    'handleConfirmRoleChange',
    'handleInvite',
    'handleInviteGuests',
    'handleMembershipSortChange',
    'handleOpenChangeRoleDialog',
    'handleOpenEditRole',
    'handleOpenMemberRights',
    'handleRemoveRoleFromMembershipTypeView',
    'handleTogglePermission',
    'importOfflineMembers',
    'inviteMembershipPreflight',
    'navigate',
    'rejectMembership',
    'removeMember',
    'reorderRoles',
    'revokeGuest',
    'scheduleDelegateElection',
    'scheduleProcessTask',
    'scheduleRoleRenewal',
    'setActiveTab',
    'setAddRoleOpen',
    'setChangeRoleOpen',
    'setEditingRole',
    'setEditRoleForm',
    'setEditRoleOpen',
    'setInviteOpen',
    'setMemberRightsOpen',
    'setMemberSearchQuery',
    'setNewRoleForm',
    'setSelectedGuestRoleIds',
    'setSelectedGuestUserIds',
    'setSelectedInviteRoleIds',
    'setSelectedUserIds',
    'updateOfflineMember',
  ]) {
    values[key] = vi.fn();
  }
  return {
    ...values,
    activeTab: 'roles',
    addRoleOpen: false,
    assignmentsAreLoading: false,
    assignmentsAreScheduling: false,
    authUser: { id: 'user-1' },
    canManageAssignments: false,
    canManageMembers: true,
    changeRoleMembership: null,
    changeRoleOpen: false,
    compositionIsLoading: false,
    editingRole: null,
    editRoleForm: {},
    editRoleOpen: false,
    group: { id: 'group-1', name: 'Group' },
    groupId: 'group-1',
    groupName: 'Group',
    groupRoleHook: {
      actions: {
        delete: vi.fn(),
        openAssignHolder: vi.fn(),
        openHistory: vi.fn(),
      },
      roles: [],
      selectedRole: null,
    },
    guestOnlyMembershipFlow: false,
    handleAddRole: vi.fn(),
    handleSaveEditedRole: vi.fn(),
    inviteOpen: false,
    isInviting: false,
    isInvitingGuests: false,
    memberRightsMembership: null,
    memberRightsOpen: false,
    memberSearchQuery: '',
    membershipSort: {},
    newRoleForm: {},
    showComposition: false,
    showRightsAlignment: false,
    t: (key: string) => key,
  };
}

describe('GroupMembershipsContentView role actions', () => {
  it('switches role surfaces and dispatches both create entries and dialog submissions', () => {
    const viewProps = props();
    const { container } = render(<GroupMembershipsContentView {...viewProps} />);
    const byId = (id: string) => container.querySelector<HTMLElement>(`[data-action-id="${id}"]`)!;

    fireEvent.click(byId('groups.members.roles.open-create-from-definitions'));
    fireEvent.click(byId('groups.members.roles.create-submit'));
    fireEvent.click(byId('groups.members.roles.edit-submit'));
    fireEvent.click(byId('groups.members.roles.select-action-rights'));
    fireEvent.click(byId('groups.members.roles.open-create-from-rights'));
    fireEvent.click(byId('groups.members.roles.select-definitions'));

    expect(viewProps.setAddRoleOpen).toHaveBeenCalledWith(true);
    expect(viewProps.handleAddRole).toHaveBeenCalledOnce();
    expect(viewProps.handleSaveEditedRole).toHaveBeenCalledOnce();
  });
});
