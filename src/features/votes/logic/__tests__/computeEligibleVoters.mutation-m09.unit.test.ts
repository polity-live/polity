import { describe, expect, it, vi } from 'vitest';

describe('computeEligibleVoters M09 static mutation boundaries', () => {
  it('initializes the complete active participant status policy in an isolated module', async () => {
    vi.resetModules();
    const voters = await import('../computeEligibleVoters');
    const activeVotingRole = {
      action_rights: [{ action: 'active_voting', resource: 'events' }],
    };

    expect([...voters.ACTIVE_EVENT_PARTICIPANT_STATUSES]).toEqual([
      'active',
      'confirmed',
      'member',
      'admin',
    ]);

    for (const status of ['active', 'confirmed', 'member', 'admin']) {
      expect(
        voters.computeEligibleFinalVoterCount({
          participants: [{ status, user_id: `user-${status}`, role: activeVotingRole }],
        })
      ).toBe(1);
    }

    expect(
      voters.computeEligibleFinalVoterCount({
        participants: [{ status: 'invited', user_id: 'user-invited', role: activeVotingRole }],
      })
    ).toBe(0);
  });
});
