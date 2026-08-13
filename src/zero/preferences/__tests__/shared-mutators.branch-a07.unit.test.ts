import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock('@rocicorp/zero', () => ({ defineMutator: (_schema: unknown, fn: unknown) => ({ fn }) }));
vi.mock('../schema', () => ({ createUserPreferenceSchema: {}, updateUserPreferenceSchema: {} }));
vi.mock('../../rbac/authorize', () => ({
  requireAuthenticated: (...args: unknown[]) => mocks.requireAuthenticated(...args),
  requireOwner: (...args: unknown[]) => mocks.requireOwner(...args),
}));
vi.mock('../../schema', () => {
  const chain: any = new Proxy(
    {},
    { get: (_target, key) => (key === 'where' || key === 'one' ? () => chain : chain) }
  );
  return { zql: new Proxy({}, { get: () => chain }) };
});

import { preferenceSharedMutators } from '../shared-mutators';

type Location = 'client' | 'server';

function harness(location: Location = 'server', results: unknown[] = []) {
  const update = vi.fn();
  const insert = vi.fn();
  const queue = [...results];
  return {
    tx: {
      location,
      run: vi.fn(async () => queue.shift()),
      mutate: { user_preference: { update, insert } },
    } as any,
    update,
    insert,
  };
}

const ctx = { userID: 'u1' };
const createArgs = { id: 'p1', theme: 'dark', appearance_theme_id: null };

beforeEach(() => vi.clearAllMocks());

describe('preference shared mutators branches A07', () => {
  it('updates an existing row and inserts a missing row without a theme check', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const existing = harness('server', [{ id: 'old' }]);
    await preferenceSharedMutators.create.fn({ tx: existing.tx, ctx, args: createArgs } as never);
    expect(existing.update).toHaveBeenCalledWith({
      id: 'old',
      theme: 'dark',
      appearance_theme_id: null,
      updated_at: 100,
    });
    expect(existing.insert).not.toHaveBeenCalled();

    const missing = harness('server', [undefined]);
    await preferenceSharedMutators.create.fn({ tx: missing.tx, ctx, args: createArgs } as never);
    expect(missing.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', user_id: 'u1', app_tutorial_completed_at: null })
    );
  });

  it('skips appearance checks on the client and accepts builtin themes on the server', async () => {
    const client = harness('client', [undefined]);
    await preferenceSharedMutators.create.fn({
      tx: client.tx,
      ctx,
      args: { ...createArgs, appearance_theme_id: 't1' },
    } as never);
    expect(client.insert).toHaveBeenCalled();

    const builtin = harness('server', [{ id: 't1', kind: 'builtin' }, undefined]);
    await preferenceSharedMutators.create.fn({
      tx: builtin.tx,
      ctx,
      args: { ...createArgs, appearance_theme_id: 't1' },
    } as never);
    expect(builtin.insert).toHaveBeenCalled();
  });

  it('rejects missing, unpublished, revisionless and unavailable group themes', async () => {
    for (const [results, message] of [
      [[undefined], 'Appearance theme not found'],
      [
        [{ id: 't', kind: 'group', group_id: null, current_revision_id: 'r' }],
        'Appearance theme is not published',
      ],
      [
        [{ id: 't', kind: 'group', group_id: 'g', current_revision_id: null }],
        'Appearance theme is not published',
      ],
      [
        [{ id: 't', kind: 'group', group_id: 'g', current_revision_id: 'r' }, undefined],
        'Appearance theme is not published',
      ],
      [
        [
          { id: 't', kind: 'group', group_id: 'g', current_revision_id: 'r' },
          { id: 'r' },
          undefined,
        ],
        'Appearance theme is not available',
      ],
    ] as const) {
      const test = harness('server', [...results]);
      await expect(
        preferenceSharedMutators.create.fn({
          tx: test.tx,
          ctx,
          args: { ...createArgs, appearance_theme_id: 't' },
        } as never)
      ).rejects.toThrow(message);
    }

    const valid = harness('server', [
      { id: 't', kind: 'group', group_id: 'g', current_revision_id: 'r' },
      { id: 'r' },
      { id: 'membership' },
      undefined,
    ]);
    await preferenceSharedMutators.create.fn({
      tx: valid.tx,
      ctx,
      args: { ...createArgs, appearance_theme_id: 't' },
    } as never);
    expect(valid.insert).toHaveBeenCalled();
  });

  it('rethrows non-duplicate insert failures and duplicate races without a recovered row', async () => {
    for (const error of ['not-an-error', new Error('different constraint')]) {
      const test = harness('server', [undefined]);
      test.insert.mockRejectedValue(error);
      await expect(
        preferenceSharedMutators.create.fn({ tx: test.tx, ctx, args: createArgs } as never)
      ).rejects.toBe(error);
    }

    const duplicate = new Error('user_preference_user_id_key');
    const missing = harness('server', [undefined, undefined]);
    missing.insert.mockRejectedValue(duplicate);
    await expect(
      preferenceSharedMutators.create.fn({ tx: missing.tx, ctx, args: createArgs } as never)
    ).rejects.toBe(duplicate);
  });

  it('recovers a duplicate race by updating the winning row', async () => {
    const duplicate = new Error('user_preference_user_id_key');
    const test = harness('server', [undefined, { id: 'winner' }]);
    test.insert.mockRejectedValue(duplicate);
    await preferenceSharedMutators.create.fn({ tx: test.tx, ctx, args: createArgs } as never);
    expect(test.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'winner', theme: 'dark' })
    );
  });

  it('updates directly on clients and performs owner/theme checks on servers', async () => {
    const client = harness('client');
    await preferenceSharedMutators.update.fn({
      tx: client.tx,
      ctx,
      args: { id: 'p1', theme: 'light' },
    } as never);
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalled();

    const server = harness('server', [{ id: 'p1', user_id: 'u1' }]);
    await preferenceSharedMutators.update.fn({
      tx: server.tx,
      ctx,
      args: { id: 'p1', theme: 'light', appearance_theme_id: null },
    } as never);
    expect(mocks.requireOwner).toHaveBeenCalledWith(server.tx, ctx, 'u1', expect.anything());

    const absent = harness('server', [undefined]);
    await preferenceSharedMutators.update.fn({
      tx: absent.tx,
      ctx,
      args: { id: 'p1', theme: 'light' },
    } as never);
    expect(mocks.requireOwner).toHaveBeenLastCalledWith(
      absent.tx,
      ctx,
      undefined,
      expect.anything()
    );
  });
});
