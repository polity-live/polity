/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollaborators } from '../useCollaborators';

const useAmendmentStateMock = vi.fn();

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: (...args: unknown[]) => useAmendmentStateMock(...args),
}));

const manageRole = {
  id: 'role-manage',
  name: 'Manager',
  action_rights: [{ id: 'right-1', resource: 'amendments', action: 'manage' }],
};

const viewRole = {
  id: 'role-view',
  name: 'Viewer',
  action_rights: [{ id: 'right-2', resource: 'amendments', action: 'view' }],
};

function mockCollaboratorState(status: string, role = manageRole) {
  useAmendmentStateMock.mockReturnValue({
    collaborators: [
      {
        id: 'collaboration-1',
        user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
        user_id: 'user-1',
        role_id: role.id,
        status,
      },
    ],
    roles: [manageRole, viewRole],
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCollaborators', () => {
  it.each(['invited', 'requested'])(
    'does not grant admin state to %s collaborators with manage-role data',
    status => {
      mockCollaboratorState(status);

      const { result } = renderHook(() => useCollaborators('amendment-1', 'user-1'));

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.currentUserCollaboration?.status).toBe(status);
    }
  );

  it('does not grant admin state to active collaborators without manage rights', () => {
    mockCollaboratorState('member', viewRole);

    const { result } = renderHook(() => useCollaborators('amendment-1', 'user-1'));

    expect(result.current.isAdmin).toBe(false);
  });

  it('grants admin state to active collaborators with manage rights', () => {
    mockCollaboratorState('member');

    const { result } = renderHook(() => useCollaborators('amendment-1', 'user-1'));

    expect(result.current.isAdmin).toBe(true);
  });

  it('falls back to empty collaborator and role collections', () => {
    useAmendmentStateMock.mockReturnValue({
      collaborators: null,
      roles: null,
      isLoading: true,
    });
    const { result } = renderHook(() => useCollaborators('amendment-1', undefined));
    expect(result.current.collaborators).toEqual([]);
    expect(result.current.roles).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('maps absent roles and classifies author, active, requested, and invited entries', () => {
    useAmendmentStateMock.mockReturnValue({
      collaborators: [
        { id: 'missing-role', user: null, role_id: 'missing', status: null },
        { id: 'author', user: { id: 'author' }, role_id: 'author-role', status: 'declined' },
        { id: 'active', user: { id: 'active' }, role_id: null, status: 'active' },
        { id: 'requested', user: { id: 'requested' }, role_id: null, status: 'requested' },
        { id: 'invited', user: { id: 'invited' }, role_id: null, status: 'invited' },
      ],
      roles: [{ id: 'author-role', name: 'Author', action_rights: [] }],
      isLoading: false,
    });
    const { result } = renderHook(() => useCollaborators('amendment-1', 'nobody'));

    expect(result.current.collaborators[0].role).toBeUndefined();
    expect(result.current.collaborators[0].roles).toEqual([]);
    expect(result.current.activeCollaborators.map(c => c.id)).toEqual(['author', 'active']);
    expect(result.current.pendingRequests.map(c => c.id)).toEqual(['requested']);
    expect(result.current.pendingInvitations.map(c => c.id)).toEqual(['invited']);
  });

  it.each([
    ['first', 'ada'],
    ['last', 'lovelace'],
    ['handle', 'analyst'],
    ['role', 'reviewer'],
    ['status', 'requested'],
    ['none', 'unmatched'],
  ])('searches collaborator %s fields and all OR fallthroughs', (_case, query) => {
    useAmendmentStateMock.mockReturnValue({
      collaborators: [
        {
          id: 'complete',
          user: {
            id: 'complete-user',
            first_name: 'Ada',
            last_name: 'Lovelace',
            handle: 'analyst',
          },
          role_id: 'reviewer-role',
          status: 'requested',
        },
        {
          id: 'empty',
          user: {},
          role_id: 'missing-role',
          status: null,
        },
      ],
      roles: [{ id: 'reviewer-role', name: 'Reviewer', action_rights: [] }],
      isLoading: false,
    });
    const { result } = renderHook(() => useCollaborators('amendment-1', undefined, query));

    expect(result.current.collaborators.map(c => c.id)).toEqual(
      query === 'unmatched' ? [] : ['complete']
    );
  });

  it('checks resource and action independently when resolving admin rights', () => {
    useAmendmentStateMock.mockReturnValue({
      collaborators: [
        {
          id: 'current',
          user: { id: 'user' },
          role_id: 'role',
          status: 'member',
        },
      ],
      roles: [
        {
          id: 'role',
          name: 'Role',
          action_rights: [
            { id: 'wrong-resource', resource: 'documents', action: 'manage' },
            { id: 'wrong-action', resource: 'amendments', action: 'view' },
            { id: 'manage', resource: 'amendments', action: 'manage' },
          ],
        },
      ],
      isLoading: false,
    });
    const { result } = renderHook(() => useCollaborators('amendment-1', 'user'));
    expect(result.current.isAdmin).toBe(true);
  });
});
