/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  finalizeExpiredInternalChangeRequestVotes: vi.fn(),
  finalizeInternalChangeRequestVote: vi.fn(),
  useAmendmentState: vi.fn(),
  useChangeRequests: vi.fn(),
  useAgendaItemByAmendment: vi.fn(),
  usePermissions: vi.fn(),
  voteOnChangeRequest: vi.fn(),
}));

vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaItemByAmendment: (...args: unknown[]) => mocks.useAgendaItemByAmendment(...args),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    finalizeExpiredInternalChangeRequestVotes: mocks.finalizeExpiredInternalChangeRequestVotes,
    finalizeInternalChangeRequestVote: mocks.finalizeInternalChangeRequestVote,
    voteOnChangeRequest: mocks.voteOnChangeRequest,
  }),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: (...args: unknown[]) => mocks.useAmendmentState(...args),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: (...args: unknown[]) => mocks.usePermissions(...args),
}));

vi.mock('../../hooks/useChangeRequests', () => ({
  useChangeRequests: (...args: unknown[]) => mocks.useChangeRequests(...args),
}));

import { useChangeRequestsPageContainerController } from '../useChangeRequestsPageContainerController';

function setDefaultHookData() {
  mocks.useAgendaItemByAmendment.mockReturnValue({ agendaItemId: null });
  mocks.useAmendmentState.mockReturnValue({ amendmentProcess: null });
  mocks.useChangeRequests.mockReturnValue({
    amendment: {
      id: 'amendment-1',
      internal_cr_voting_close_trigger: null,
    },
    document: null,
    openChangeRequests: [],
    approvedChangeRequests: [],
    declinedChangeRequests: [],
    isLoading: false,
  });
}

describe('useChangeRequestsPageContainerController permissions', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    setDefaultHookData();
  });

  afterEach(() => {
    cleanup();
  });

  it('bases internal vote management on amendment manage permission', () => {
    const permissions = {
      can: vi.fn().mockReturnValue(true),
      canManage: vi.fn().mockReturnValue(true),
      canUpdate: vi.fn().mockReturnValue(false),
    };
    mocks.usePermissions.mockReturnValue(permissions);

    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({
        amendmentId: 'amendment-1',
        userId: 'user-1',
      })
    );

    expect(result.current.canManageInternalVotes).toBe(true);
    expect(permissions.canManage).toHaveBeenCalledWith('amendments');
    expect(permissions.canUpdate).not.toHaveBeenCalledWith('amendments');
  });

  it('does not allow update-only amendment rights to manage internal votes', () => {
    const permissions = {
      can: vi.fn().mockReturnValue(true),
      canManage: vi.fn().mockReturnValue(false),
      canUpdate: vi.fn().mockReturnValue(true),
    };
    mocks.usePermissions.mockReturnValue(permissions);

    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({
        amendmentId: 'amendment-1',
        userId: 'user-1',
      })
    );

    expect(result.current.canManageInternalVotes).toBe(false);
    expect(permissions.canManage).toHaveBeenCalledWith('amendments');
    expect(permissions.canUpdate).not.toHaveBeenCalledWith('amendments');
  });
});
