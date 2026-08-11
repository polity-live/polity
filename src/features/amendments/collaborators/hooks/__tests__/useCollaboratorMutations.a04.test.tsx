/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  leave: vi.fn(),
  update: vi.fn(),
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  assignRight: vi.fn(),
  removeRight: vi.fn(),
  waitForClientApply: vi.fn(),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    requestCollaboration: mocks.request,
    leaveCollaboration: mocks.leave,
    updateCollaborator: mocks.update,
  }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    createRole: mocks.createRole,
    deleteRole: mocks.deleteRole,
    assignActionRight: mocks.assignRight,
    removeActionRight: mocks.removeRight,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: any[]) => mocks.waitForClientApply(...args),
}));

import { useCollaboratorMutations } from '../useCollaboratorMutations';

const role = (overrides: Record<string, any> = {}) => ({
  id: 'role',
  name: 'Role',
  scope: 'amendment',
  sort_order: 0,
  action_rights: [],
  ...overrides,
});

describe('useCollaboratorMutations A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const action of [
      mocks.request,
      mocks.leave,
      mocks.update,
      mocks.createRole,
      mocks.deleteRole,
      mocks.assignRight,
      mocks.removeRight,
    ]) {
      action.mockImplementation(payload => payload);
    }
    mocks.waitForClientApply.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it('orchestrates invitations, collaborator state changes, and role CRUD', async () => {
    const { result } = renderHook(() => useCollaboratorMutations());

    await act(async () => result.current.inviteUsers(['user-1', 'user-2'], 'amendment', 'role'));
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'invited', amendment_id: 'amendment', role_id: 'role' })
    );

    await act(async () => result.current.changeCollaboratorRole('collab', 'new-role'));
    await act(async () => result.current.removeCollaborator('collab'));
    await act(async () => result.current.approveRequest('collab'));
    await act(async () => result.current.rejectRequest('collab'));
    await act(async () => result.current.withdrawInvitation('collab'));
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab', role_id: 'new-role' });
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab', status: 'member' });
    expect(mocks.leave).toHaveBeenCalledTimes(3);

    await act(async () => result.current.createRole('Editors', 'description', 'amendment'));
    await act(async () => result.current.createRole('Empty description', '', 'amendment'));
    await act(async () => result.current.deleteRole('role'));
    expect(mocks.createRole).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'description', scope: 'amendment' })
    );
    expect(mocks.createRole).toHaveBeenCalledWith(expect.objectContaining({ description: '' }));
    expect(mocks.deleteRole).toHaveBeenCalledWith({ id: 'role' });
  });

  it('promotes and demotes only when the corresponding role exists', async () => {
    const { result } = renderHook(() => useCollaboratorMutations());
    const roles = [
      role({ id: 'author', name: 'Author' }),
      role({ id: 'member', name: 'Collaborator' }),
    ];

    await act(async () => result.current.promoteToAdmin('collab', roles as any));
    await act(async () => result.current.demoteToMember('collab', roles as any));
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab', role_id: 'author' });
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab', role_id: 'member' });

    mocks.update.mockClear();
    await act(async () => result.current.promoteToAdmin('collab', []));
    await act(async () => result.current.demoteToMember('collab', []));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('selects primary roles through every fallback', async () => {
    const { result } = renderHook(() => useCollaboratorMutations());

    await act(async () =>
      result.current.changeCollaboratorRoles('collab-default', ['', ''], [
        role({ id: 'default', default_request_role: true }),
      ] as any)
    );
    await act(async () =>
      result.current.changeCollaboratorRoles('collab-named', [], [
        role({ id: 'named', name: 'Collaborator' }),
      ] as any)
    );
    await act(async () =>
      result.current.changeCollaboratorRoles('collab-first', [], [
        role({ id: 'first', name: 'Other' }),
      ] as any)
    );
    await act(async () => result.current.changeCollaboratorRoles('collab-empty', [], []));

    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab-default', role_id: 'default' });
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab-named', role_id: 'named' });
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab-first', role_id: 'first' });
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab-empty', role_id: null });
  });

  it('sorts unique primary roles by priority, name, and missing metadata', async () => {
    const { result } = renderHook(() => useCollaboratorMutations());
    const roles = [
      role({ id: 'low', name: 'Zulu', sort_order: 1 }),
      role({ id: 'high', name: 'Beta', sort_order: 5 }),
      role({ id: 'alpha', name: 'Alpha', sort_order: 5 }),
    ];

    await act(async () =>
      result.current.changeCollaboratorRoles(
        'collab',
        ['low', 'high', 'alpha', 'high', 'missing'],
        roles as any
      )
    );
    expect(mocks.update).toHaveBeenCalledWith({ id: 'collab', role_id: 'alpha' });

    await act(async () =>
      result.current.changeCollaboratorRoles('missing-metadata', ['missing-b', 'missing-a'], [])
    );
    expect(mocks.update).toHaveBeenCalledWith({ id: 'missing-metadata', role_id: 'missing-b' });
  });

  it('removes matching rights and tolerates absent roles or rights', async () => {
    const { result } = renderHook(() => useCollaboratorMutations());
    const roles = [
      role({
        id: 'role',
        action_rights: [
          { id: 'wrong-resource', resource: 'documents', action: 'manage' },
          { id: 'wrong-action', resource: 'amendments', action: 'view' },
          { id: 'right', resource: 'amendments', action: 'manage' },
        ],
      }),
    ];

    await act(async () =>
      result.current.toggleActionRight(
        'role',
        'amendments',
        'manage',
        true,
        roles as any,
        'amendment'
      )
    );
    expect(mocks.removeRight).toHaveBeenCalledWith({ id: 'right' });

    mocks.removeRight.mockClear();
    await act(async () =>
      result.current.toggleActionRight(
        'missing',
        'amendments',
        'manage',
        true,
        roles as any,
        'amendment'
      )
    );
    await act(async () =>
      result.current.toggleActionRight('role', 'threads', 'delete', true, roles as any, 'amendment')
    );
    expect(mocks.removeRight).not.toHaveBeenCalled();
  });

  it('assigns valid amendment and non-amendment rights and rejects invalid rights', async () => {
    const { result } = renderHook(() => useCollaboratorMutations());
    const roles = [
      role({ id: 'amendment-role', scope: 'amendment' }),
      role({ id: 'group-role', scope: 'group' }),
    ];

    await act(async () =>
      result.current.toggleActionRight(
        'amendment-role',
        'amendments',
        'manage',
        false,
        roles as any,
        'amendment'
      )
    );
    await act(async () =>
      result.current.toggleActionRight(
        'group-role',
        'documents',
        'update',
        false,
        roles as any,
        'amendment'
      )
    );
    await act(async () =>
      result.current.toggleActionRight(
        'missing-role',
        'threads',
        'create',
        false,
        roles as any,
        'amendment'
      )
    );
    expect(mocks.assignRight).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ amendment_id: 'amendment' })
    );
    expect(mocks.assignRight).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ amendment_id: null })
    );
    expect(mocks.assignRight).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ amendment_id: null })
    );

    await expect(
      act(async () =>
        result.current.toggleActionRight('role', 'invalid', 'invalid', false, [], 'amendment')
      )
    ).rejects.toThrow('not valid for amendment roles');
  });
});
