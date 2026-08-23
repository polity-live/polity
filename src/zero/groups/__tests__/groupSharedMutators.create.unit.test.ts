import { describe, expect, it, vi } from 'vitest';

import { groupCreateSchema } from '../schema';
import { groupSharedMutators } from '../shared-mutators';

type CreateGroupMutatorInput = Parameters<typeof groupSharedMutators.create.fn>[0];
type CreateGroupMutatorTx = CreateGroupMutatorInput['tx'];
type CreateGroupMutatorCtx = CreateGroupMutatorInput['ctx'];

function createCtx(): CreateGroupMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

function createTx() {
  const table = () => ({ insert: vi.fn(), update: vi.fn(), delete: vi.fn() });
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: 'server' as const,
    run: vi.fn().mockResolvedValue(undefined),
    mutate: {
      group: table(),
      role: table(),
      action_right: table(),
      group_membership: table(),
      group_membership_role: table(),
    },
  };
}

function createGroupArgs(overrides: Partial<CreateGroupMutatorInput['args']> = {}) {
  return {
    id: 'group-1',
    name: 'Test Group',
    description: null,
    email: null,
    country: null,
    region: null,
    post_code: null,
    city: null,
    street: null,
    house_number: null,
    latitude: null,
    longitude: null,
    image_url: null,
    video_url: null,
    x: null,
    youtube: null,
    linkedin: null,
    website: null,
    whatsapp: null,
    instagram: null,
    twitter: null,
    facebook: null,
    snapchat: null,
    tiktok: null,
    visibility: 'public',
    group_type: 'base',
    owner_id: null,
    ...overrides,
  } satisfies CreateGroupMutatorInput['args'];
}

describe('group create schema and mutator', () => {
  it('defaults group_type to base when omitted from schema input', () => {
    const inputWithoutGroupType = { ...createGroupArgs() };
    delete (inputWithoutGroupType as Partial<CreateGroupMutatorInput['args']>).group_type;
    const parsed = groupCreateSchema.parse(inputWithoutGroupType);

    expect(parsed.group_type).toBe('base');
  });

  it('preserves hierarchical group_type in the group insert payload', async () => {
    const tx = createTx();

    await groupSharedMutators.create.fn({
      tx: tx as unknown as CreateGroupMutatorTx,
      ctx: createCtx(),
      args: createGroupArgs({ group_type: 'hierarchical' }),
    });

    expect(tx.mutate.group.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'group-1',
        group_type: 'hierarchical',
        owner_id: 'user-1',
      })
    );
    expect(tx.mutate.group_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-1', user_id: 'user-1', status: 'active' })
    );
    expect(tx.mutate.group_membership_role.insert).toHaveBeenCalledOnce();
    expect(tx.mutate.action_right.insert).not.toHaveBeenCalledTimes(0);
  });
});
