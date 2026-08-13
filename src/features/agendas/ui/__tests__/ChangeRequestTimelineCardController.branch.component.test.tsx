/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  summary: {
    result: 'accepted',
    winningChoiceId: 'yes',
    winningPercent: 75,
  } as Record<string, unknown> | null,
  computeVoteResultSummary: vi.fn(() => mocks.summary),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count == null ? key : `${key}:${params.count}`,
  }),
}));

vi.mock('../../logic/changeRequestVotePhase', () => ({
  deriveChangeRequestVotePhase: (item: { phase?: string }) => item.phase ?? 'internal',
}));

vi.mock('../../hooks/useAgendaItemCRVoting', () => ({
  getVoteResult: (item: { result?: string }) => item.result,
}));

vi.mock('../../hooks/useAgendaItemVoting', () => ({
  calculateVoteStats: (choices: any[], indicative: any[], final: any[]) => ({
    choices: choices.map(choice => ({
      choice,
      indicativeCount: choice.indicativeCount ?? 0,
      finalCount: choice.finalCount ?? 0,
      finalPercentage: choice.finalPercentage ?? 0,
    })),
    totalIndicative: indicative.length,
    totalFinal: final.length,
  }),
}));

vi.mock('@/features/vote-cast/logic/computeVoteResults', () => ({
  computeVoteResultSummary: mocks.computeVoteResultSummary,
}));

import { useChangeRequestTimelineCardController } from '../useChangeRequestTimelineCardController';

afterEach(() => {
  mocks.summary = { result: 'accepted', winningChoiceId: 'yes', winningPercent: 75 };
  vi.clearAllMocks();
});

function props(item: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    item,
    index: 0,
    isCurrent: false,
    hasUserVoted: false,
    userSelectedChoiceIds: [],
    canManage: false,
    canVote: false,
    editingMode: 'suggest_event',
    ...overrides,
  } as never;
}

describe('useChangeRequestTimelineCardController branches', () => {
  it('handles an internal change request without vote data or a selection', async () => {
    const { result } = renderHook(() =>
      useChangeRequestTimelineCardController(
        props({ id: 'cr-row', phase: 'internal', change_request: null })
      )
    );

    expect(result.current.selectedCrIds).toBeNull();
    expect(result.current.selectedSuggestionIds.size).toBe(0);
    expect(result.current.voteStepKind).toBeNull();
    expect(result.current.isPlaceholder).toBe(false);
    expect(result.current.title).toContain('features.agendas.crTimeline.changeRequest');
    expect(result.current.choices).toEqual([]);
    expect(result.current.indicativeDecisions).toEqual([]);
    expect(result.current.finalDecisions).toEqual([]);
    expect(result.current.offlineTallies).toEqual([]);
    expect(result.current.leadingChoiceId).toBeNull();
    expect(result.current.winningChoiceId).toBeNull();
    expect(result.current.winningLabel).toBeUndefined();
    expect(result.current.resolvedVoteSharePercent).toBeUndefined();
    await act(async () => result.current.handleCastVote('yes'));
    expect(result.current.votingLoading).toBe(false);
  });

  it('maps every discussion identity and resolves a closed variant vote', async () => {
    const onCastVote = vi.fn(async () => undefined);
    const vote = {
      title: '',
      majority_type: 'absolute',
      choices: [
        { id: 'yes', label: '', order_index: null, finalCount: 3, finalPercentage: 75 },
        { id: 'no', label: 'No', order_index: 2, finalCount: 1, finalPercentage: 25 },
      ],
      indicative_decisions: [{}],
      final_decisions: [{}, {}, {}, {}],
      offline_tallies: [{ choice_id: 'yes', count: 1 }],
      offline_electorate_size: null,
      electorate_snapshotted_at: 123,
      voters: [{ participation_channel: 'online' }, { participation_channel: 'offline' }],
    };
    const discussions = [
      {
        id: 'discussion-1',
        crId: 'CR-1',
        displayCrId: 'Branch 1 CR-1',
        title: 'Mapped title',
        changeRequestEntityId: 'entity-1',
      },
      { id: '', title: 'ignored' },
    ];
    const { result } = renderHook(() =>
      useChangeRequestTimelineCardController(
        props(
          {
            id: 'variant',
            phase: 'closed',
            result: undefined,
            _voteStepKind: 'merge_variant',
            _votePlaceholder: true,
            _placeholderTitle: null,
            vote,
          },
          {
            crId: 'CR-1',
            suggestionId: 'discussion-1',
            discussions,
            onCastVote,
          }
        )
      )
    );

    expect(result.current.selectedCrIds).toEqual(new Set(['CR-1']));
    expect(result.current.crIdToDiscussionId.get('Branch 1 CR-1')).toBe('discussion-1');
    expect(result.current.selectedSuggestionIds).toEqual(new Set(['discussion-1']));
    expect(result.current.isPlaceholder).toBe(true);
    expect(result.current.title).toBe('Variant Final Vote');
    expect(result.current.totalVoters).toBe(2);
    expect(result.current.computedVoteSummary).toBe(mocks.summary);
    expect(result.current.resolvedVoteResult).toBe('accepted');
    expect(result.current.winningChoiceId).toBe('yes');
    expect(result.current.winningLabel).toBeUndefined();
    expect(result.current.resolvedVoteSharePercent).toBe(75);
    expect(mocks.computeVoteResultSummary).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'yes',
          label: 'features.events.agenda.defaultChoiceLabels.choiceWithNumber:1',
          order_index: 0,
        }),
      ]),
      vote.final_decisions,
      2,
      'absolute',
      vote.offline_tallies
    );
    await act(async () => result.current.handleCastVote('yes'));
    expect(onCastVote).toHaveBeenCalledWith(expect.objectContaining({ id: 'variant' }), 'yes');
    expect(result.current.votingLoading).toBe(false);
  });

  it('falls back through suggestion, electorate, title, result, and majority variants', () => {
    mocks.summary = { result: 'rejected', winningChoiceId: null, winningPercent: undefined };
    const allOriginal = {
      id: 'closing',
      phase: 'final',
      is_closing_vote: true,
      _placeholderTitle: 'Closing title',
      _placeholderDescription: 'Closing description',
      vote: {
        title: 'Vote title',
        majority_type: 'two_thirds',
        choices: [{ id: 'yes', label: 'Yes', finalCount: 0, indicativeCount: 2 }],
        indicative_decisions: [{}, {}],
        final_decisions: [],
        offline_tallies: [],
        offline_electorate_size: 3,
        electorate_snapshotted_at: null,
        voters: [{ participation_channel: 'online' }, { participation_channel: 'offline' }],
      },
    };
    const { result, rerender } = renderHook(
      input => useChangeRequestTimelineCardController(input),
      {
        initialProps: props(allOriginal, {
          crId: 'missing',
          suggestionId: 'fallback-suggestion',
          discussions: [{ id: 'discussion-1' }],
          eligibleFinalVoterCount: 9,
        }),
      }
    );

    expect(result.current.title).toBe('Closing title');
    expect(result.current.placeholderDescription).toBe('Closing description');
    expect(result.current.selectedSuggestionIds).toEqual(new Set(['fallback-suggestion']));
    expect(result.current.totalVoters).toBe(9);
    expect(result.current.currentPhaseVoteCount).toBe(0);
    expect(result.current.leadingChoiceId).toBeNull();

    rerender(
      props(
        {
          ...allOriginal,
          phase: 'indicative',
          _placeholderTitle: undefined,
          is_closing_vote: false,
          change_request: { title: 'CR title' },
          vote: {
            ...(allOriginal.vote as Record<string, unknown>),
            majority_type: 'unexpected',
            offline_electorate_size: null,
            electorate_snapshotted_at: null,
          },
        },
        {
          crId: undefined,
          suggestionId: 'only-suggestion',
          discussions: undefined,
          eligibleFinalVoterCount: undefined,
        }
      )
    );
    expect(result.current.title).toBe('CR title');
    expect(result.current.selectedSuggestionIds).toEqual(new Set(['only-suggestion']));
    expect(result.current.totalVoters).toBe(2);
    expect(result.current.leadingChoiceId).toBe('yes');
    expect(result.current.winningChoiceId).toBe('yes');
    expect(result.current.winningLabel).toBe('Yes');
    expect(result.current.resolvedVoteSharePercent).toBe(0);
    expect(result.current.currentPhaseVoteCount).toBe(2);
  });

  it('handles ties, missing winning stats, and reset-to-all suggestion selection', () => {
    const item = {
      id: 'closed',
      phase: 'closed',
      result: 'tie',
      vote: {
        choices: [{ id: 'yes', label: 'Yes', finalCount: 2, finalPercentage: 50 }],
        final_decisions: [{}, {}],
        voters: [],
      },
    };
    const { result } = renderHook(() =>
      useChangeRequestTimelineCardController(
        props(item, { discussions: [{ id: 'one' }, { id: 'two' }], suggestionId: 'one' })
      )
    );
    expect(result.current.resolvedVoteResult).toBe('tie');
    expect(result.current.winningChoiceId).toBeNull();

    act(() => result.current.setSelectedCrIds(null));
    expect(result.current.selectedSuggestionIds).toEqual(new Set(['one', 'two']));
    act(() => result.current.setSelectedCrIds(new Set(['unknown'])));
    expect(result.current.selectedSuggestionIds).toEqual(new Set(['one']));
  });

  it('omits the live winning share when the winning choice has no stats row', () => {
    let idRead = 0;
    const changingChoice = {
      get id() {
        idRead += 1;
        return `choice-${idRead}`;
      },
      label: 'Yes',
      finalCount: 1,
      finalPercentage: 100,
    };
    const { result } = renderHook(() =>
      useChangeRequestTimelineCardController(
        props({
          id: 'live-vote',
          phase: 'final',
          vote: {
            choices: [changingChoice],
            final_decisions: [{}],
            voters: [],
          },
        })
      )
    );

    expect(result.current.winningChoiceId).toBe('choice-1');
    expect(result.current.resolvedVoteSharePercent).toBeUndefined();
  });

  it('uses the single-suggestion and closed-result fallbacks', () => {
    const suggestionOnly = renderHook(() =>
      useChangeRequestTimelineCardController(
        props({ id: 'internal', phase: 'internal' }, { suggestionId: 'only-suggestion' })
      )
    );
    expect(suggestionOnly.result.current.selectedSuggestionIds).toEqual(
      new Set(['only-suggestion'])
    );
    suggestionOnly.unmount();

    mocks.summary = { result: 'accepted', winningChoiceId: null, winningPercent: null };
    const closed = renderHook(() =>
      useChangeRequestTimelineCardController(
        props({
          id: 'closing',
          phase: 'closed',
          is_closing_vote: true,
          vote: {
            title: '',
            majority_type: 'two_thirds',
            choices: [{ id: 'yes', label: 'Yes', finalCount: 2, finalPercentage: 100 }],
            final_decisions: [{}, {}],
            offline_electorate_size: 3,
            voters: undefined,
          },
        })
      )
    );
    expect(closed.result.current.title).toBe('features.agendas.crTimeline.acceptAmendment');
    expect(closed.result.current.totalVoters).toBe(3);
    expect(closed.result.current.winningChoiceId).toBe('yes');
    expect(closed.result.current.resolvedVoteSharePercent).toBeUndefined();
    expect(mocks.computeVoteResultSummary).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.any(Array),
      3,
      'two_thirds',
      expect.any(Array)
    );
  });
});
