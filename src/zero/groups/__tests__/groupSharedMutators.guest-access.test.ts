import { beforeEach, describe, expect, it, vi } from 'vitest';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { groupSharedMutators } from '../shared-mutators';

interface GroupMutatorCtx {
  userID: string;
  email: string;
}

function createCtx(): GroupMutatorCtx {
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
      group_membership: {
        insert: vi.fn(),
      },
      group_guest_access: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      group_guest_role: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('groupSharedMutators guest-only sibling flow', () => {
  it('rejects official membership requests for guest-only sibling groups', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([{ id: 'group-1' }])
      .mockResolvedValueOnce([
        {
          id: 'link-1',
          source_group_id: 'group-1',
          target_group_id: 'group-2',
          structural_relation: 'sibling',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'right-1',
          network_link_id: 'link-1',
          right_key: 'informationRight',
          direction: 'bidirectional',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          network_link_id: 'link-1',
          membership_mode: 'role_members',
          role_id: null,
          source_group_ids: null,
        },
      ]);

    await expect(
      groupSharedMutators.joinGroup.fn({
        tx: tx as never,
        ctx: createCtx() as never,
        args: {
          id: 'membership-1',
          group_id: 'group-1',
          user_id: 'user-1',
          status: 'requested',
          visibility: 'public',
        },
      })
    ).rejects.toThrow('This group only supports guest access requests and invitations.');

    expect(tx.mutate.group_membership.insert).not.toHaveBeenCalled();
  });

  it('creates requested guest access with the default guest request role', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([{ id: 'group-1' }])
      .mockResolvedValueOnce([
        {
          id: 'link-1',
          source_group_id: 'group-1',
          target_group_id: 'group-2',
          structural_relation: 'sibling',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'right-1',
          network_link_id: 'link-1',
          right_key: 'informationRight',
          direction: 'bidirectional',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          network_link_id: 'link-1',
          membership_mode: 'selected_source_groups',
          role_id: null,
          source_group_ids: ['group-2'],
        },
      ])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        {
          id: 'guest-role-1',
          group_id: 'group-1',
          scope: 'group',
          name: 'Guest',
          assignee_kind: 'guest',
          default_request_role: true,
          default_invite_role: true,
          sort_order: 0,
        },
      ])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);

    await groupSharedMutators.requestGuestAccess.fn({
      tx: tx as never,
      ctx: createCtx() as never,
      args: {
        id: 'guest-access-1',
        group_id: 'group-1',
        user_id: 'user-1',
        status: 'requested',
      },
    });

    expect(tx.mutate.group_guest_access.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'guest-access-1',
        group_id: 'group-1',
        user_id: 'user-1',
        status: 'requested',
      })
    );
    expect(tx.mutate.group_guest_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_guest_access_id: 'guest-access-1',
        role_id: 'guest-role-1',
      })
    );
  });
});
