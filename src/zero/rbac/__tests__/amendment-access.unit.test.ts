import { describe, expect, it, vi } from 'vitest';

import { assertCanViewAmendment, type ViewableAmendment } from '../amendment-access';

function serverTx(...results: unknown[]) {
  const run = vi.fn();
  for (const result of results) run.mockResolvedValueOnce(result);
  return { location: 'server', run } as any;
}

interface WhereCondition {
  readonly column: string;
  readonly value: unknown;
  readonly operator?: string;
}

function expectQuery(
  tx: ReturnType<typeof serverTx>,
  callIndex: number,
  table: string,
  conditions: readonly WhereCondition[]
) {
  const query = tx.run.mock.calls[callIndex]?.[0] as { ast?: unknown } | undefined;
  const whereConditions = conditions.map(({ column, value, operator = '=' }) => ({
    type: 'simple',
    left: { type: 'column', name: column },
    right: { type: 'literal', value },
    op: operator,
  }));

  expect(query?.ast).toEqual({
    table,
    where:
      whereConditions.length === 1
        ? whereConditions[0]
        : { type: 'and', conditions: whereConditions },
    limit: 1,
  });
}

const privateAmendment: ViewableAmendment = {
  id: 'amendment-1',
  visibility: 'private',
  created_by_id: 'creator',
};

describe('amendment read authorization', () => {
  it('keeps the optimistic client path free from server reads', async () => {
    const tx = { location: 'client', run: vi.fn() } as any;

    await expect(assertCanViewAmendment(tx, { userID: 'anon' }, 'amendment-1')).resolves.toEqual({
      id: 'amendment-1',
    });
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('rejects anonymous access before reading private data', async () => {
    const tx = serverTx(privateAmendment);
    const access = assertCanViewAmendment(tx, { userID: 'anon' }, 'amendment-1');

    await expect(access).rejects.toMatchObject({
      action: 'view',
      resource: 'amendments',
      scope: 'authentication required',
    });
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('reports a missing amendment', async () => {
    await expect(
      assertCanViewAmendment(serverTx(undefined), { userID: 'reader' }, 'missing')
    ).rejects.toThrow('Amendment not found');
  });

  it.each([
    ['public', { ...privateAmendment, visibility: 'public' }, 'reader'],
    ['authenticated', { ...privateAmendment, visibility: 'authenticated' }, 'reader'],
    ['creator', privateAmendment, 'creator'],
  ])('allows %s visibility without secondary lookups', async (_case, amendment, userID) => {
    const tx = serverTx(amendment);

    await expect(assertCanViewAmendment(tx, { userID }, amendment.id)).resolves.toBe(amendment);
    expect(tx.run).toHaveBeenCalledTimes(1);
    expectQuery(tx, 0, 'amendment', [{ column: 'id', value: amendment.id }]);
  });

  it('allows an active collaborator', async () => {
    const tx = serverTx(privateAmendment, { id: 'collaborator-1' });

    await expect(
      assertCanViewAmendment(tx, { userID: 'reader' }, privateAmendment.id)
    ).resolves.toBe(privateAmendment);
    expect(tx.run).toHaveBeenCalledTimes(2);
    expectQuery(tx, 1, 'amendment_collaborator', [
      { column: 'amendment_id', value: privateAmendment.id },
      { column: 'user_id', value: 'reader' },
      {
        column: 'status',
        operator: 'IN',
        value: ['active', 'collaborator', 'member', 'admin'],
      },
    ]);
  });

  it.each([
    ['group owner', [{ id: 'group-1' }, undefined, undefined]],
    ['group member', [undefined, { id: 'membership-1' }, undefined]],
    ['group guest', [undefined, undefined, { id: 'guest-1' }]],
  ])('allows a %s', async (_case, groupResults) => {
    const amendment = { ...privateAmendment, group_id: 'group-1' };
    const tx = serverTx(amendment, undefined, ...groupResults);

    await expect(assertCanViewAmendment(tx, { userID: 'reader' }, amendment.id)).resolves.toBe(
      amendment
    );
    expect(tx.run).toHaveBeenCalledTimes(5);
    expectQuery(tx, 2, 'group', [
      { column: 'id', value: amendment.group_id },
      { column: 'owner_id', value: 'reader' },
    ]);
    expectQuery(tx, 3, 'group_membership', [
      { column: 'group_id', value: amendment.group_id },
      { column: 'user_id', value: 'reader' },
      { column: 'status', operator: 'IN', value: ['active', 'member', 'admin'] },
    ]);
    expectQuery(tx, 4, 'group_guest_access', [
      { column: 'group_id', value: amendment.group_id },
      { column: 'user_id', value: 'reader' },
      { column: 'status', value: 'active' },
    ]);
  });

  it('allows an active event participant after group access fails', async () => {
    const amendment = {
      ...privateAmendment,
      group_id: 'group-1',
      event_id: 'event-1',
    };
    const tx = serverTx(amendment, undefined, undefined, undefined, undefined, {
      id: 'participant-1',
    });

    await expect(assertCanViewAmendment(tx, { userID: 'reader' }, amendment.id)).resolves.toBe(
      amendment
    );
    expect(tx.run).toHaveBeenCalledTimes(6);
    expectQuery(tx, 5, 'event_participant', [
      { column: 'event_id', value: amendment.event_id },
      { column: 'user_id', value: 'reader' },
      {
        column: 'status',
        operator: 'IN',
        value: ['active', 'confirmed', 'member', 'admin'],
      },
    ]);
  });

  it.each([
    ['no related scope', privateAmendment, [undefined]],
    [
      'unrelated group and event',
      { ...privateAmendment, group_id: 'group-1', event_id: 'event-1' },
      [undefined, undefined, undefined, undefined, undefined],
    ],
  ])('denies a private amendment with %s', async (_case, amendment, lookups) => {
    const tx = serverTx(amendment, ...lookups);
    const access = assertCanViewAmendment(tx, { userID: 'reader' }, amendment.id);

    await expect(access).rejects.toMatchObject({
      action: 'view',
      resource: 'amendments',
      scope: `amendment:${amendment.id}`,
    });
    expect(tx.run).toHaveBeenCalledTimes(amendment.group_id ? 6 : 2);
  });
});
