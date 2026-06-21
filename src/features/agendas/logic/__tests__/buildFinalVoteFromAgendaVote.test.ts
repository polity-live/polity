import { describe, expect, it } from 'vitest';
import { getVoteResult } from '../../hooks/useAgendaItemCRVoting';
import {
  buildFinalVoteFromAgendaVote,
  buildVariantVoteFromAgendaVote,
  buildVoteSequencePlaceholder,
} from '../buildFinalVoteFromAgendaVote';

describe('buildFinalVoteFromAgendaVote', () => {
  it('preserves offline tallies for synthesized final vote items', () => {
    const finalVoteItem = buildFinalVoteFromAgendaVote(
      {
        id: 'vote-1',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        status: 'closed',
        majority_type: 'simple',
        visibility: 'public',
        created_at: 1,
        updated_at: 2,
        choices: [
          { id: 'accept', vote_id: 'vote-1', label: 'accept', order_index: 0, created_at: 1 },
          { id: 'reject', vote_id: 'vote-1', label: 'reject', order_index: 1, created_at: 1 },
          { id: 'abstain', vote_id: 'vote-1', label: 'abstain', order_index: 2, created_at: 1 },
        ],
        voters: [{ id: 'voter-1', vote_id: 'vote-1', user_id: 'user-1', created_at: 1 }],
        final_decisions: [],
        offline_tallies: [{ choice_id: 'accept', phase: 'final', count: 1 }],
      },
      0
    );

    expect(finalVoteItem?.vote.offline_tallies).toEqual([
      { choice_id: 'accept', phase: 'final', count: 1 },
    ]);
    expect(getVoteResult(finalVoteItem as never)).toBe('passed');
  });

  it('synthesizes variant votes as the first sequenced voting step', () => {
    const variantVoteItem = buildVariantVoteFromAgendaVote(
      {
        id: 'variant-vote-1',
        agenda_item_id: 'agenda-1',
        amendment_id: 'amendment-1',
        title: 'Merge round 1',
        status: 'open',
        purpose: 'variant_selection',
        visibility: 'public',
        created_at: 1,
        updated_at: 2,
      },
      0
    );

    expect(variantVoteItem).toMatchObject({
      id: 'agenda-vote-variant-variant-vote-1',
      order_index: 0,
      is_final_vote: false,
      _voteStepKind: 'variant_selection',
      status: 'pending',
      vote: {
        id: 'variant-vote-1',
        purpose: 'variant_selection',
      },
    });
  });

  it('builds locked sequence placeholders without backing votes', () => {
    const placeholder = buildVoteSequencePlaceholder({
      agendaItemId: 'agenda-1',
      orderIndex: 2,
      kind: 'final_amendment_placeholder',
      title: 'Final vote',
      description: 'Created later',
    });

    expect(placeholder).toMatchObject({
      id: 'agenda-vote-placeholder-final_amendment_placeholder-agenda-1',
      agenda_item_id: 'agenda-1',
      vote_id: null,
      order_index: 2,
      is_final_vote: true,
      _voteStepKind: 'final_amendment_placeholder',
      _votePlaceholder: true,
      _placeholderTitle: 'Final vote',
      _placeholderDescription: 'Created later',
      status: 'pending',
      vote: null,
    });
  });
});
