import { describe, expect, it, vi } from 'vitest';
import { computeDistinctEventParticipantCount } from '../offline-roster-helpers';

describe('computeDistinctEventParticipantCount', () => {
  it('counts only confirmed online participants plus offline participants', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce([
          { user_id: 'active-user', status: 'active' },
          { user_id: 'confirmed-user', status: 'confirmed' },
          { user_id: 'member-user', status: 'member' },
          { user_id: 'admin-user', status: 'admin' },
          { user_id: 'invited-user', status: 'invited' },
          { user_id: 'requested-user', status: 'requested' },
        ])
        .mockResolvedValueOnce([
          { id: 'offline-1', connected_user_id: null },
          { id: 'offline-2', connected_user_id: 'active-user' },
        ]),
    };

    await expect(computeDistinctEventParticipantCount(tx as never, 'event-1')).resolves.toBe(5);
  });
});
