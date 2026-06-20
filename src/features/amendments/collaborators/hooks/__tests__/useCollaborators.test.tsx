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
});
