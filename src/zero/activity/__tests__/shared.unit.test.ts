import { describe, expect, it, vi } from 'vitest';

import { appendEntityActivity, buildActivityChanges, severityForChanges } from '../shared';

describe('entity activity helpers', () => {
  it('normalizes diffs, omits no-ops, and lets high fields win', () => {
    const changes = buildActivityChanges(
      { title: 'Old', status: 'draft', untouched: null },
      { title: 'New', status: 'active', untouched: undefined },
      ['title', 'status', 'untouched']
    );
    expect(changes).toEqual([
      { field: 'title', from: 'Old', to: 'New' },
      { field: 'status', from: 'draft', to: 'active' },
    ]);
    expect(severityForChanges(changes, new Set(['status']))).toBe('high');
    expect(severityForChanges(changes, new Set())).toBe('normal');
  });

  it('writes only on a server transaction and supports system actors', async () => {
    const insert = vi.fn();
    const tx = { location: 'server', mutate: { event_activity: { insert } } };
    await appendEntityActivity(
      tx,
      { userID: 'user-1' },
      {
        table: 'event_activity',
        entityField: 'event_id',
        entityId: 'event-1',
        action: 'updated',
        severity: 'normal',
        actorType: 'system',
        context: { count: 2 },
      }
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'event-1',
        actor_id: null,
        actor_type: 'system',
        severity: 'normal',
        context: { count: 2 },
      })
    );

    const clientInsert = vi.fn();
    await appendEntityActivity(
      { location: 'client', mutate: { event_activity: { insert: clientInsert } } },
      { userID: 'user-1' },
      {
        table: 'event_activity',
        entityField: 'event_id',
        entityId: 'event-1',
        action: 'updated',
        severity: 'normal',
      }
    );
    expect(clientInsert).not.toHaveBeenCalled();
  });
});
