import { beforeEach, describe, expect, it, vi } from 'vitest';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { groupSharedMutators } from '../shared-mutators';

type OfflineMemberMutatorInput = Parameters<typeof groupSharedMutators.createOfflineMember.fn>[0];
type OfflineMemberMutatorTx = OfflineMemberMutatorInput['tx'];
type OfflineMemberMutatorCtx = OfflineMemberMutatorInput['ctx'];

function createCtx(): OfflineMemberMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

function createTx() {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: 'server' as const,
    run: vi.fn(),
    mutate: {
      group_offline_member: {
        insert: vi.fn(),
      },
      group_offline_membership: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      group_offline_membership_role: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('groupSharedMutators.createOfflineMember', () => {
  it('creates a direct offline membership and assigns the default invite role', async () => {
    const tx = createTx();
    canMock.mockResolvedValue(undefined);
    tx.run
      .mockResolvedValueOnce([
        {
          id: 'group-1',
          group_type: 'base',
        },
      ])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        {
          id: 'role-member',
          group_id: 'group-1',
          scope: 'group',
          name: 'Member',
          assignee_kind: 'member',
          default_invite_role: true,
          default_request_role: false,
          sort_order: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);

    await groupSharedMutators.createOfflineMember.fn({
      tx: tx as unknown as OfflineMemberMutatorTx,
      ctx: createCtx(),
      args: {
        id: 'offline-1',
        group_id: 'group-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        reason_not_signed_up: null,
        connected_user_id: null,
      },
    });

    expect(tx.mutate.group_offline_member.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'offline-1',
        group_id: 'group-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
      })
    );
    expect(tx.mutate.group_offline_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_offline_member_id: 'offline-1',
        group_id: 'group-1',
        source: 'direct',
        status: 'active',
      })
    );
    expect(tx.mutate.group_offline_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_offline_membership_id: expect.any(String),
        role_id: 'role-member',
        assigned_by_id: 'user-1',
      })
    );
  });
});
