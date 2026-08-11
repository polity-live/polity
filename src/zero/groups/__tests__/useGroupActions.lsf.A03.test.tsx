/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn((mutation: unknown) => ({ mutation })),
  onServerError: vi.fn((_result: unknown, callback: (message: string) => void) =>
    callback('server-error')
  ),
  trackCreation: vi.fn(),
  handleMutationError: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.mutate }),
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    groups: new Proxy(
      {},
      {
        get: (_target, name) => (args: unknown) => ({ name, args }),
      }
    ),
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  onServerError: mocks.onServerError,
  toMutationError: (message: unknown) => message,
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('@/zero/rbac/handleMutationError', () => ({
  handleMutationError: mocks.handleMutationError,
}));

vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.trackCreation,
}));

import { useGroupActions } from '../useGroupActions';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000003');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

it('invokes every group action and every optimistic error callback', () => {
  const { result } = renderHook(() => useGroupActions());
  const actions = result.current;
  const args = { id: 'entity-id' } as never;

  expect(actions.createGroup(args)).toBeDefined();
  expect(actions.createFullGroup({ group: { id: 'group-id' } } as never)).toBeDefined();
  expect(actions.updateGroup(args)).toBeDefined();
  expect(actions.updateGroup(args, { silent: true })).toBeDefined();
  actions.deleteGroup(args);
  expect(actions.createOfflineMember(args)).toBeDefined();
  expect(actions.updateOfflineMember(args)).toBeDefined();
  expect(actions.deleteOfflineMember(args)).toBeDefined();
  expect(actions.importOfflineMembers(args)).toBeDefined();

  expect(actions.joinGroup(args)).toBeDefined();
  expect(actions.requestGuestAccess(args)).toBeDefined();
  expect(actions.leaveGroup(args)).toBeDefined();
  expect(actions.inviteMember(args)).toBeDefined();
  expect(actions.acceptInvitation(args)).toBeDefined();
  expect(actions.inviteGuest(args)).toBeDefined();
  expect(actions.acceptGuestInvitation(args)).toBeDefined();
  expect(actions.revokeGuestAccess(args)).toBeDefined();
  expect(actions.updateMembership(args)).toBeDefined();
  expect(actions.addMembershipRole(args)).toBeDefined();
  expect(actions.removeMembershipRole(args)).toBeDefined();
  expect(actions.syncMembershipRoles(args)).toBeDefined();
  expect(actions.addOfflineMembershipRole(args)).toBeDefined();
  expect(actions.removeOfflineMembershipRole(args)).toBeDefined();
  expect(actions.syncOfflineMembershipRoles(args)).toBeDefined();
  expect(actions.syncGuestRoles(args)).toBeDefined();

  expect(actions.createRole(args)).toBeDefined();
  expect(actions.updateRole(args)).toBeDefined();
  expect(actions.deleteRole(args)).toBeDefined();
  expect(actions.assignActionRight(args)).toBeDefined();
  expect(actions.removeActionRight(args)).toBeDefined();
  expect(actions.setupGroupAdminRoles('group-id')).not.toHaveLength(0);
  expect(actions.createRoleHolderHistory(args)).toBeDefined();
  expect(actions.updateRoleHolderHistory(args)).toBeDefined();

  expect(mocks.trackCreation).toHaveBeenCalledTimes(7);
  expect(mocks.onServerError).toHaveBeenCalled();
  expect(mocks.handleMutationError).toHaveBeenCalled();
  expect(mocks.success).toHaveBeenCalled();
});
