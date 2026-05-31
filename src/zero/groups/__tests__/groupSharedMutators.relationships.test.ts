import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { groupSharedMutators } from '../shared-mutators';

type RelationshipMutatorInput = Parameters<typeof groupSharedMutators.createRelationship.fn>[0];
type RelationshipMutatorTx = RelationshipMutatorInput['tx'];
type RelationshipMutatorCtx = RelationshipMutatorInput['ctx'];

interface TestTx {
  clientID: string;
  mutationID: number;
  reason: string;
  location: RelationshipMutatorTx['location'];
  run: ReturnType<typeof vi.fn>;
  mutate: {
    group_relationship: {
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
}

function createTx(location: RelationshipMutatorTx['location'] = 'server'): TestTx {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      group_relationship: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): RelationshipMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

const baseCreateArgs = {
  id: 'relationship-1',
  group_id: 'group-1',
  related_group_id: 'group-2',
  relationship_type: 'sibling',
  with_right: 'informationRight',
  status: 'requested',
  initiator_group_id: 'group-1',
};

beforeEach(() => {
  canMock.mockReset();
});

describe('groupSharedMutators relationship authorization', () => {
  it('rejects createRelationship when manage rights are missing on the initiator group', async () => {
    const tx = createTx('server');
    const permissionError = new PermissionError('manage', 'groupRelationships', 'group:group-1');

    canMock.mockRejectedValueOnce(permissionError);

    await expect(
      groupSharedMutators.createRelationship.fn({
        tx: tx as unknown as RelationshipMutatorTx,
        ctx: createCtx(),
        args: baseCreateArgs,
      })
    ).rejects.toBe(permissionError);

    expect(tx.mutate.group_relationship.insert).not.toHaveBeenCalled();
  });

  it('rejects createRelationship when initiator_group_id is not one of the relationship endpoints', async () => {
    const tx = createTx('server');

    await expect(
      groupSharedMutators.createRelationship.fn({
        tx: tx as unknown as RelationshipMutatorTx,
        ctx: createCtx(),
        args: {
          ...baseCreateArgs,
          initiator_group_id: 'group-3',
        },
      })
    ).rejects.toThrow('initiator_group_id must match group_id or related_group_id');

    expect(canMock).not.toHaveBeenCalled();
    expect(tx.mutate.group_relationship.insert).not.toHaveBeenCalled();
  });

  it('allows updateRelationship when the user can manage either relationship endpoint', async () => {
    const tx = createTx('server');
    const permissionError = new PermissionError('manage', 'groupRelationships', 'group:group-1');

    tx.run.mockResolvedValue({
      id: 'relationship-1',
      group_id: 'group-1',
      related_group_id: 'group-2',
    });
    canMock.mockRejectedValueOnce(permissionError).mockResolvedValueOnce(undefined);

    await groupSharedMutators.updateRelationship.fn({
      tx: tx as unknown as RelationshipMutatorTx,
      ctx: createCtx(),
      args: {
        id: 'relationship-1',
        status: 'active',
      },
    });

    expect(canMock).toHaveBeenNthCalledWith(1, tx, createCtx(), {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-1',
    });
    expect(canMock).toHaveBeenNthCalledWith(2, tx, createCtx(), {
      action: 'manage',
      resource: 'groupRelationships',
      groupId: 'group-2',
    });
    expect(tx.mutate.group_relationship.update).toHaveBeenCalledWith({
      id: 'relationship-1',
      status: 'active',
    });
  });

  it('allows deleteRelationship when the user can manage the related group endpoint', async () => {
    const tx = createTx('server');
    const permissionError = new PermissionError('manage', 'groupRelationships', 'group:group-1');

    tx.run.mockResolvedValue({
      id: 'relationship-1',
      group_id: 'group-1',
      related_group_id: 'group-2',
    });
    canMock.mockRejectedValueOnce(permissionError).mockResolvedValueOnce(undefined);

    await groupSharedMutators.deleteRelationship.fn({
      tx: tx as unknown as RelationshipMutatorTx,
      ctx: createCtx(),
      args: {
        id: 'relationship-1',
      },
    });

    expect(tx.mutate.group_relationship.delete).toHaveBeenCalledWith({
      id: 'relationship-1',
    });
  });

  it('rejects deleteRelationship when the user cannot manage either endpoint', async () => {
    const tx = createTx('server');
    const firstPermissionError = new PermissionError(
      'manage',
      'groupRelationships',
      'group:group-1'
    );
    const secondPermissionError = new PermissionError(
      'manage',
      'groupRelationships',
      'group:group-2'
    );

    tx.run.mockResolvedValue({
      id: 'relationship-1',
      group_id: 'group-1',
      related_group_id: 'group-2',
    });
    canMock
      .mockRejectedValueOnce(firstPermissionError)
      .mockRejectedValueOnce(secondPermissionError);

    await expect(
      groupSharedMutators.deleteRelationship.fn({
        tx: tx as unknown as RelationshipMutatorTx,
        ctx: createCtx(),
        args: {
          id: 'relationship-1',
        },
      })
    ).rejects.toBe(secondPermissionError);

    expect(tx.mutate.group_relationship.delete).not.toHaveBeenCalled();
  });
});
