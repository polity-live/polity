import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/zero/rbac/can', () => ({ can: vi.fn().mockResolvedValue(true) }));

import { amendmentSharedMutators } from '@/zero/amendments/shared-mutators';
import { eventSharedMutators } from '@/zero/events/shared-mutators';
import { groupSharedMutators } from '@/zero/groups/shared-mutators';

function serverTx(entityTable: string, activityTable: string, existing: Record<string, unknown>) {
  const activityInsert = vi.fn();
  return {
    activityInsert,
    tx: {
      location: 'server',
      run: vi.fn().mockResolvedValue(existing),
      mutate: {
        [entityTable]: { update: vi.fn() },
        [activityTable]: { insert: activityInsert },
      },
    } as any,
  };
}

describe('domain activity severity integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bundles amendment changes and lets a high relationship change win', async () => {
    const { tx, activityInsert } = serverTx('amendment', 'amendment_activity', {
      id: 'amendment-1',
      title: 'Old',
      group_id: null,
    });
    await amendmentSharedMutators.update.fn({
      tx,
      ctx: { userID: 'actor-1' },
      args: { id: 'amendment-1', title: 'New', group_id: 'group-1' },
    } as never);

    expect(activityInsert).toHaveBeenCalledTimes(1);
    expect(activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amendment_id: 'amendment-1',
        action: 'updated',
        severity: 'high',
        changes: [
          { field: 'title', from: 'Old', to: 'New' },
          { field: 'group_id', from: null, to: 'group-1' },
        ],
      })
    );
  });

  it('classifies group metadata as normal and omits no-op updates', async () => {
    const normal = serverTx('group', 'group_activity', { id: 'group-1', name: 'Old' });
    await groupSharedMutators.update.fn({
      tx: normal.tx,
      ctx: { userID: 'actor-1' },
      args: { id: 'group-1', name: 'New' },
    } as never);
    expect(normal.activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'normal' })
    );

    const noOp = serverTx('group', 'group_activity', { id: 'group-1', name: 'Same' });
    await groupSharedMutators.update.fn({
      tx: noOp.tx,
      ctx: { userID: 'actor-1' },
      args: { id: 'group-1', name: 'Same' },
    } as never);
    expect(noOp.activityInsert).not.toHaveBeenCalled();
  });

  it('classifies event schedule changes as high and content-only changes as normal', async () => {
    const high = serverTx('event', 'event_activity', {
      id: 'event-1',
      title: 'Old',
      start_date: 100,
      delegate_election_mode: 'list',
    });
    await eventSharedMutators.update.fn({
      tx: high.tx,
      ctx: { userID: 'actor-1' },
      args: { id: 'event-1', title: 'New', start_date: 200 },
    } as never);
    expect(high.activityInsert).toHaveBeenCalledWith(expect.objectContaining({ severity: 'high' }));

    const normal = serverTx('event', 'event_activity', {
      id: 'event-1',
      description: 'Old',
      delegate_election_mode: 'list',
    });
    await eventSharedMutators.update.fn({
      tx: normal.tx,
      ctx: { userID: 'actor-1' },
      args: { id: 'event-1', description: 'New' },
    } as never);
    expect(normal.activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'normal' })
    );
  });
});
