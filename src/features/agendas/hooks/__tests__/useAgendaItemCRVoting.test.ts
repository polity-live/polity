import { describe, expect, it } from 'vitest';
import { getVoteResult } from '../useAgendaItemCRVoting';

describe('getVoteResult', () => {
  it('treats accept/reject labels as decisive choices instead of reporting a tie', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'simple',
        voters: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }],
        choices: [
          { id: 'abstain', label: 'abstain', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'accept', label: 'accept', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: 'accept' },
          { choice_id: 'accept' },
          { choice_id: 'reject' },
        ],
      },
    } as never);

    expect(result).toBe('passed');
  });

  it('respects majority thresholds when resolving closed CR votes', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'two_thirds',
        voters: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }],
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: 'accept' },
          { choice_id: 'accept' },
          { choice_id: 'reject' },
        ],
      },
    } as never);

    expect(result).toBe('rejected');
  });

  it('includes final offline tallies when resolving a closed CR vote', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'simple',
        voters: [],
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        final_decisions: [],
        offline_tallies: [{ choice_id: 'accept', phase: 'final', count: 1 }],
      },
    } as never);

    expect(result).toBe('passed');
  });
});
