/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  changeRoles: vi.fn(),
  mutations: {} as any,
  displayRoles: [] as any[],
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/groups/logic/buildMembershipRightsSummary', () => ({
  getMembershipDisplayRoles: () => mocks.displayRoles,
}));
vi.mock('@/features/groups/hooks/useMembershipSearch', () => ({
  useMembershipSearch: () => ({
    activeMembers: [{ id: 'active' }],
    pendingRequests: [{ id: 'request' }],
    pendingInvitations: [{ id: 'invite' }],
  }),
}));
vi.mock('../useCollaboratorMutations', () => ({
  useCollaboratorMutations: () => mocks.mutations,
}));
vi.mock('../useCollaborators', () => ({
  useCollaborators: () => ({
    collaborators: [{ id: 'collaborator' }],
    roles: [{ id: 'role' }],
    isAdmin: true,
    isLoading: false,
  }),
}));

import { useCollaboratorsPageController } from '../useCollaboratorsPageController';

describe('useCollaboratorsPageController A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.changeRoles.mockResolvedValue(undefined);
    mocks.displayRoles = [];
    mocks.mutations = {
      changeCollaboratorRoles: mocks.changeRoles,
      approveRequest: vi.fn(),
      createRole: vi.fn(),
      deleteRole: vi.fn(),
      inviteUsers: vi.fn(),
      rejectRequest: vi.fn(),
      removeCollaborator: vi.fn(),
      toggleActionRight: vi.fn(),
      withdrawInvitation: vi.fn(),
    };
  });
  afterEach(() => cleanup());

  it('changes tabs with and without callbacks and follows initial-tab changes', () => {
    const onTabChange = vi.fn();
    const hook = renderHook(
      ({ initialTab, callback }: any) =>
        useCollaboratorsPageController({
          amendmentId: 'amendment',
          currentUserId: 'user',
          initialTab,
          onTabChange: callback,
        }),
      {
        initialProps: {
          initialTab: 'membershipsByUser',
          callback: onTabChange as typeof onTabChange | undefined,
        },
      }
    );
    act(() => hook.result.current.onActiveTabChange('roles'));
    expect(onTabChange).toHaveBeenCalledWith('roles');
    hook.rerender({ initialTab: 'membershipsByRole', callback: undefined });
    expect(hook.result.current.activeTab).toBe('membershipsByRole');
    act(() => hook.result.current.onActiveTabChange('membershipsByUser'));
  });

  it('sorts the same field both ways and resets a new field to ascending', () => {
    const { result } = renderHook(() =>
      useCollaboratorsPageController({ amendmentId: 'amendment', currentUserId: 'user' })
    );
    act(() => result.current.onMembershipSortChange('user'));
    expect(result.current.membershipSort).toEqual({ field: 'user', direction: 'desc' });
    act(() => result.current.onMembershipSortChange('user'));
    expect(result.current.membershipSort).toEqual({ field: 'user', direction: 'asc' });
    act(() => result.current.onMembershipSortChange('role'));
    expect(result.current.membershipSort).toEqual({ field: 'role', direction: 'asc' });
  });

  it('opens dialogs, navigates, guards missing role membership, and confirms role changes', async () => {
    const { result } = renderHook(() =>
      useCollaboratorsPageController({ amendmentId: 'amendment', currentUserId: 'user' })
    );
    await act(async () => result.current.onConfirmRoleChange(['role']));
    expect(mocks.changeRoles).not.toHaveBeenCalled();

    const membership = { id: 'collaboration' } as any;
    act(() => result.current.onOpenChangeRoleDialog(membership));
    act(() => result.current.onOpenMemberRightsDialog(membership));
    expect(result.current.changeRoleOpen).toBe(true);
    expect(result.current.memberRightsOpen).toBe(true);
    await act(async () => result.current.onConfirmRoleChange(['role']));
    expect(mocks.changeRoles).toHaveBeenCalledWith('collaboration', ['role'], [{ id: 'role' }]);
    act(() => result.current.onNavigateToUser('target'));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/user/$id', params: { id: 'target' } });
  });

  it('removes one selected role while retaining all others', async () => {
    mocks.displayRoles = [{ id: 'keep' }, { id: 'remove' }];
    const { result } = renderHook(() =>
      useCollaboratorsPageController({ amendmentId: 'amendment', currentUserId: undefined })
    );
    await act(async () =>
      result.current.onRemoveRoleFromByRoleView({ id: 'collaboration' } as any, 'remove')
    );
    expect(mocks.changeRoles).toHaveBeenCalledWith('collaboration', ['keep'], [{ id: 'role' }]);
  });
});
