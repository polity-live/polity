/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventParticipants } from '../useEventParticipants';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  eventData: {} as any,
  users: [] as any[],
  usersLoading: false,
  user: { id: 'admin-1' } as null | { id: string },
  roles: [] as any[],
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  assignActionRight: vi.fn(),
  removeActionRight: vi.fn(),
  inviteParticipants: vi.fn(),
  removeParticipant: vi.fn(),
  changeParticipantRole: vi.fn(),
  changeParticipantRoles: vi.fn(),
  approveParticipation: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../useEventData', () => ({ useEventData: () => mocks.eventData }));
vi.mock('@/zero/users', () => ({
  useUserState: () => ({ allUsers: mocks.users, isLoading: mocks.usersLoading }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/events/useEventState', () => ({
  useEventAccessRoles: () => ({ roles: mocks.roles }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    createRole: mocks.createRole,
    deleteRole: mocks.deleteRole,
    assignActionRight: mocks.assignActionRight,
    removeActionRight: mocks.removeActionRight,
  }),
}));
vi.mock('../useEventMutations', () => ({
  useEventMutations: () => ({
    inviteParticipants: mocks.inviteParticipants,
    removeParticipant: mocks.removeParticipant,
    changeParticipantRole: mocks.changeParticipantRole,
    changeParticipantRoles: mocks.changeParticipantRoles,
    approveParticipation: mocks.approveParticipation,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

function participant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant-1',
    status: 'active',
    user: {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      handle: 'ada',
      email: 'ada@example.test',
    },
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventData = {
    event: { id: 'event-1', title: 'Assembly' },
    participants: [],
    isLoading: false,
    error: null,
  };
  mocks.users = [];
  mocks.usersLoading = false;
  mocks.user = { id: 'admin-1' };
  mocks.roles = [
    { id: 'organizer', name: 'Organizer', action_rights: [] },
    { id: 'participant', name: 'Participant', action_rights: [] },
  ];
  for (const operation of [
    mocks.createRole,
    mocks.deleteRole,
    mocks.assignActionRight,
    mocks.removeActionRight,
    mocks.inviteParticipants,
    mocks.removeParticipant,
    mocks.changeParticipantRole,
    mocks.changeParticipantRoles,
    mocks.approveParticipation,
  ]) {
    operation.mockResolvedValue(undefined);
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useEventParticipants coverage', () => {
  it('filters invite candidates through identity, existing users, names, handles, and emails', () => {
    mocks.eventData.participants = [participant()];
    mocks.users = [
      null,
      { id: 'user-1', first_name: 'Existing' },
      { id: 'user-2', first_name: 'Grace', last_name: 'Hopper', handle: null, email: null },
      { id: 'user-3', first_name: null, last_name: null, handle: 'civic-handle', email: null },
      { id: 'user-4', first_name: null, last_name: null, handle: null, email: 'mail@example.test' },
      { id: 'user-5', first_name: 'Unmatched', handle: null, email: null },
    ];
    const { result } = renderHook(() => useEventParticipants('event-1'));
    expect(result.current).toMatchObject({
      currentUserId: 'admin-1',
      organizerRole: expect.objectContaining({ id: 'organizer' }),
      participantRole: expect.objectContaining({ id: 'participant' }),
    });
    expect(result.current.filteredUsers.map(user => user.id)).toEqual([
      'user-2',
      'user-3',
      'user-4',
      'user-5',
    ]);

    act(() => result.current.state.setInviteSearchQuery('grace'));
    expect(result.current.filteredUsers.map(user => user.id)).toEqual(['user-2']);
    act(() => result.current.state.setInviteSearchQuery('civic'));
    expect(result.current.filteredUsers.map(user => user.id)).toEqual(['user-3']);
    act(() => result.current.state.setInviteSearchQuery('mail@'));
    expect(result.current.filteredUsers.map(user => user.id)).toEqual(['user-4']);
  });

  it('toggles selections and runs invite success, empty guard, and failure', async () => {
    const { result } = renderHook(() => useEventParticipants('event-1'));
    await act(async () => result.current.actions.inviteUsers());
    expect(mocks.inviteParticipants).not.toHaveBeenCalled();

    act(() => result.current.actions.toggleUserSelection('user-1'));
    act(() => result.current.actions.toggleUserSelection('user-2'));
    act(() => result.current.actions.toggleUserSelection('user-1'));
    expect(result.current.state.selectedUsers).toEqual(['user-2']);
    act(() => {
      result.current.state.setInviteSearchQuery('search');
      result.current.state.setInviteDialogOpen(true);
    });
    await act(async () => result.current.actions.inviteUsers());
    expect(mocks.inviteParticipants).toHaveBeenCalledWith(
      ['user-2'],
      undefined,
      'admin-1',
      'Assembly'
    );
    expect(result.current.state).toMatchObject({
      selectedUsers: [],
      inviteSearchQuery: '',
      inviteDialogOpen: false,
      isInviting: false,
    });

    act(() => result.current.state.setSelectedUsers(['user-3']));
    mocks.inviteParticipants.mockRejectedValueOnce(new Error('invite failed'));
    await act(async () => result.current.actions.inviteUsers());
    expect(result.current.state.isInviting).toBe(false);
  });

  it('runs participant mutation wrappers, role toggles, catches failures, and navigates back', async () => {
    const { result } = renderHook(() => useEventParticipants('event-1'));
    await act(async () => {
      await result.current.actions.removeParticipant('participant-1', 'user-1');
      await result.current.actions.changeRole('participant-1', 'role-1');
      await result.current.actions.toggleRole('participant-1', 'role-2', true, [
        'role-1',
        'role-2',
      ]);
      await result.current.actions.toggleRole('participant-1', 'role-1', false, [
        'role-1',
        'role-2',
      ]);
      await result.current.actions.acceptRequest('participant-1', 'user-1');
    });
    expect(mocks.changeParticipantRoles).toHaveBeenNthCalledWith(1, 'participant-1', [
      'role-1',
      'role-2',
    ]);
    expect(mocks.changeParticipantRoles).toHaveBeenNthCalledWith(2, 'participant-1', ['role-2']);
    await act(async () => result.current.actions.changeRole('participant-1', ''));
    expect(mocks.changeParticipantRole).toHaveBeenCalledTimes(1);

    for (const [operation, call] of [
      [mocks.removeParticipant, () => result.current.actions.removeParticipant('failed')],
      [mocks.changeParticipantRole, () => result.current.actions.changeRole('failed', 'role')],
      [
        mocks.changeParticipantRoles,
        () => result.current.actions.toggleRole('failed', 'role', true, []),
      ],
      [mocks.approveParticipation, () => result.current.actions.acceptRequest('failed')],
    ] as const) {
      operation.mockRejectedValueOnce(new Error('failed'));
      await act(async () => call());
    }
    act(() => result.current.actions.goBack());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '..' });
  });

  it('forwards absent event titles through participant mutation wrappers', async () => {
    mocks.eventData.event = null;
    const { result } = renderHook(() => useEventParticipants('event-1'));
    act(() => result.current.state.setSelectedUsers(['user-1']));
    await act(async () => {
      await result.current.actions.inviteUsers();
      await result.current.actions.removeParticipant('participant-1');
      await result.current.actions.acceptRequest('participant-1');
    });
    expect(mocks.inviteParticipants).toHaveBeenCalledWith(
      ['user-1'],
      undefined,
      'admin-1',
      undefined
    );
    expect(mocks.removeParticipant).toHaveBeenCalledWith(
      'participant-1',
      undefined,
      'admin-1',
      undefined
    );
    expect(mocks.approveParticipation).toHaveBeenCalledWith(
      'participant-1',
      undefined,
      'admin-1',
      undefined
    );
  });

  it('adds and removes roles through validation, success, and error paths', async () => {
    const { result } = renderHook(() => useEventParticipants('event-1'));
    await act(async () => result.current.actions.addRole());
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('role_name_is_required'));

    act(() => {
      result.current.state.setNewRoleName(' Facilitator ');
      result.current.state.setNewRoleDescription('Helps');
      result.current.state.setAddRoleDialogOpen(true);
    });
    await act(async () => result.current.actions.addRole());
    expect(mocks.createRole).toHaveBeenCalledWith(
      expect.objectContaining({ name: ' Facilitator ', description: 'Helps', event_id: 'event-1' })
    );
    expect(result.current.state).toMatchObject({
      newRoleName: '',
      newRoleDescription: '',
      addRoleDialogOpen: false,
    });

    act(() => result.current.state.setNewRoleName('Broken'));
    mocks.createRole.mockRejectedValueOnce(new Error('create failed'));
    await act(async () => result.current.actions.addRole());
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('failed_to_create_role');

    await act(async () => result.current.actions.removeRole('role-1'));
    expect(mocks.deleteRole).toHaveBeenCalledWith({ id: 'role-1' });
    mocks.deleteRole.mockRejectedValueOnce(new Error('delete failed'));
    await act(async () => result.current.actions.removeRole('role-2'));
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('failed_to_remove_role');
  });

  it('adds, removes, skips, and catches action-right mutations', async () => {
    mocks.roles = [
      {
        id: 'role-1',
        name: 'Organizer',
        action_rights: [{ id: 'right-1', resource: 'events', action: 'update' }],
      },
    ];
    const { result } = renderHook(() => useEventParticipants('event-1'));
    await act(async () =>
      result.current.actions.toggleActionRight('role-1', 'events', 'update', true)
    );
    expect(mocks.removeActionRight).toHaveBeenCalledWith({ id: 'right-1' });
    await act(async () =>
      result.current.actions.toggleActionRight('missing', 'events', 'update', true)
    );
    await act(async () =>
      result.current.actions.toggleActionRight('role-1', 'events', 'delete', false)
    );
    expect(mocks.assignActionRight).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'role-1', event_id: 'event-1' })
    );
    mocks.assignActionRight.mockRejectedValueOnce(new Error('right failed'));
    await act(async () =>
      result.current.actions.toggleActionRight('role-1', 'events', 'create', false)
    );
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('failed_to_update_permission');
  });

  it('filters every participant classification and optional search field', () => {
    mocks.eventData.event = { id: 'event-1', title: null };
    mocks.eventData.participants = [
      participant({ id: 'requested', status: 'requested' }),
      participant({ id: 'invited', status: 'invited' }),
      participant({ id: 'active', status: 'active' }),
      participant({ id: 'member', status: 'member' }),
      participant({ id: 'confirmed', status: 'confirmed' }),
      participant({ id: 'admin', status: 'admin' }),
      participant({ id: 'role', status: 'other', role: { name: 'Organizer' } }),
      participant({ id: 'roles', status: 'other', role: null, roles: [{ name: 'Organizer' }] }),
      participant({
        id: 'sparse',
        status: null,
        role: null,
        roles: null,
        user: { id: 'sparse', first_name: null, last_name: null, email: null, handle: null },
      }),
    ];
    const { result } = renderHook(() => useEventParticipants('event-1'));
    expect(result.current.derived).toMatchObject({
      pendingRequests: [expect.objectContaining({ id: 'requested' })],
      invitedUsers: [expect.objectContaining({ id: 'invited' })],
    });
    expect(result.current.derived.activeParticipants).toHaveLength(6);
    act(() => result.current.state.setSearchQuery('ada'));
    expect(result.current.filteredUsers).toEqual([]);
    expect(result.current.derived.activeParticipants).toHaveLength(6);
    act(() => result.current.state.setSearchQuery('requested'));
    expect(result.current.derived.pendingRequests).toHaveLength(1);
    act(() => result.current.state.setSearchQuery('no-match'));
    expect(result.current.derived.activeParticipants).toEqual([]);

    act(() => {
      result.current.state.setActiveTab('roles');
      result.current.state.setInviteDialogOpen(true);
      result.current.state.setAddRoleDialogOpen(true);
    });
    expect(result.current.state.activeTab).toBe('roles');
  });
});
