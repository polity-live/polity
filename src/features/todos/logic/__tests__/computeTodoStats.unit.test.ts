import { describe, expect, it } from 'vitest';

import { computeTodoStats } from '../computeTodoStats';

function todo(id: string, status: string, archivedAt: number | null = null) {
  return {
    id,
    status,
    archived_at: archivedAt,
    creator: { id: 'user-1' },
    assignments: [],
  } as never;
}

describe('computeTodoStats', () => {
  it('returns empty counts before todos have loaded', () => {
    expect(computeTodoStats(undefined, 'user-1')).toEqual({
      all: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      archived: 0,
    });
  });

  it('includes todos assigned through a hydrated user relation', () => {
    const assigned = {
      id: 'assigned',
      status: 'in_progress',
      archived_at: null,
      creator: { id: 'other-user' },
      assignments: [{ user: { id: 'user-1' } }],
    } as never;

    expect(computeTodoStats([assigned], 'user-1').in_progress).toBe(1);
  });

  it('excludes archived todos from all normal counts', () => {
    expect(
      computeTodoStats(
        [
          todo('pending', 'pending'),
          todo('completed', 'completed'),
          todo('archived', 'completed', 1),
        ],
        'user-1'
      )
    ).toEqual({
      all: 2,
      pending: 1,
      in_progress: 0,
      completed: 1,
      cancelled: 0,
      archived: 1,
    });
  });
});
