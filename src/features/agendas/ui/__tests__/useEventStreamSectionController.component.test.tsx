/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useEventStreamSectionController } from '../useEventStreamSectionController';

const props = (overrides: Record<string, unknown> = {}) =>
  ({
    eventId: 'event-1',
    streamUrl: null,
    currentAgendaItem: {
      id: 'agenda-1',
      type: 'discussion',
      voting_phase: null,
      election: [],
      votes: [],
    },
    speakerList: [] as any[],
    showGender: false,
    userId: 'user-1',
    isUserCandidate: false,
    addingSpeaker: false,
    removingSpeaker: null,
    votingLoading: null,
    userSpeaker: undefined,
    onAddToSpeakerList: vi.fn(),
    onRemoveFromSpeakerList: vi.fn(),
    onBecomeCandidate: vi.fn(),
    onWithdrawCandidacy: vi.fn(),
    calculateSpeakerTime: vi.fn(),
    formatTime: vi.fn(),
    ...overrides,
  }) as any;

describe('useEventStreamSectionController', () => {
  it('returns null without a current agenda item', () => {
    const { result } = renderHook(() =>
      useEventStreamSectionController(props({ currentAgendaItem: null }))
    );
    expect(result.current).toBeNull();
  });

  it('provides empty derived voting state and default UI state', () => {
    const { result } = renderHook(() => useEventStreamSectionController(props()));
    expect(result.current).toMatchObject({
      candidates: [],
      indicativeSelections: [],
      finalSelections: [],
      userHasVotedElection: false,
      userSelectedCandidateIds: [],
      choices: [],
      indicativeDecisions: [],
      finalDecisions: [],
      userHasVotedVote: false,
      userSelectedChoiceIds: [],
      electionStatus: null,
      voteStatus: null,
      canScrollLeft: false,
      canScrollRight: false,
      speakersExpanded: true,
      expanded: true,
    });
  });

  it('derives election and vote participation with selected ids', () => {
    const currentAgendaItem = {
      id: 'agenda-1',
      voting_phase: 'final',
      election: [
        {
          id: 'election-1',
          candidates: [{ id: 'candidate-1' }],
          indicative_selections: [{ candidate_id: 'candidate-2' }],
          final_selections: [{ candidate_id: 'candidate-1' }],
          electors: [{ user_id: 'user-1' }],
        },
      ],
      votes: [
        {
          id: 'vote-1',
          choices: [{ id: 'choice-1' }],
          indicative_decisions: [{ choice_id: 'choice-2' }],
          final_decisions: [{ choice_id: 'choice-1' }],
          voters: [{ user_id: 'user-1' }],
        },
      ],
    };
    const { result } = renderHook(() =>
      useEventStreamSectionController(props({ currentAgendaItem }))
    );
    expect(result.current).toMatchObject({
      userHasVotedElection: true,
      userSelectedCandidateIds: ['candidate-1'],
      userHasVotedVote: true,
      userSelectedChoiceIds: ['choice-1'],
      electionStatus: 'final',
      voteStatus: 'final',
    });
  });

  it('filters selected ids when the user is not an elector or voter', () => {
    const currentAgendaItem = {
      id: 'agenda-1',
      election: [
        { id: 'election-1', final_selections: [{ candidate_id: 'candidate-1' }], electors: [] },
      ],
      votes: [{ id: 'vote-1', final_decisions: [{ choice_id: 'choice-1' }], voters: [] }],
    };
    const { result } = renderHook(() =>
      useEventStreamSectionController(props({ currentAgendaItem }))
    );
    expect(result.current).toMatchObject({
      userHasVotedElection: false,
      userSelectedCandidateIds: [],
      userHasVotedVote: false,
      userSelectedChoiceIds: [],
    });
  });

  it('handles missing elector and voter collections while decisions hydrate first', () => {
    const currentAgendaItem = {
      id: 'agenda-1',
      election: [{ id: 'election-1', final_selections: [{ candidate_id: 'candidate-1' }] }],
      votes: [{ id: 'vote-1', final_decisions: [{ choice_id: 'choice-1' }] }],
    };
    const { result } = renderHook(() =>
      useEventStreamSectionController(props({ currentAgendaItem }))
    );
    expect(result.current?.userSelectedCandidateIds).toEqual([]);
    expect(result.current?.userSelectedChoiceIds).toEqual([]);
  });

  it.each([
    ['completed', 'badge-success'],
    ['in-progress', 'badge-info'],
    ['pending', 'badge-neutral'],
  ])('maps %s status color', (_label, token) => {
    const { result } = renderHook(() => useEventStreamSectionController(props()));
    expect(result.current?.getStatusColor(_label)).toContain(token);
  });

  it.each([
    ['election', 'badge-accent'],
    ['vote', 'badge-warning'],
    ['speech', 'badge-info'],
    ['accreditation', 'teal'],
    ['discussion', 'badge-success'],
  ])('maps %s type color', (type, token) => {
    const { result } = renderHook(() => useEventStreamSectionController(props()));
    expect(result.current?.getTypeColor(type)).toContain(token);
  });

  it('updates scroll availability and subscribes to carousel scroll changes', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const scrollTo = vi.fn();
    const carousel = {
      scrollLeft: 50,
      scrollWidth: 1000,
      clientWidth: 300,
      addEventListener,
      removeEventListener,
      scrollTo,
    };
    const { result, rerender, unmount } = renderHook(
      ({ hookProps }) => useEventStreamSectionController(hookProps),
      { initialProps: { hookProps: props() } }
    );
    if (!result.current) throw new Error('Expected stream section controller');
    (result.current.carouselRef as any).current = carousel;
    rerender({ hookProps: props({ speakerList: [{ id: 'speaker-1' }] }) });

    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(result.current?.canScrollLeft).toBe(true);
    expect(result.current?.canScrollRight).toBe(true);

    act(() => {
      carousel.scrollLeft = 0;
      carousel.scrollWidth = 300;
      result.current?.updateScrollButtons();
    });
    expect(result.current?.canScrollLeft).toBe(false);
    expect(result.current?.canScrollRight).toBe(false);

    act(() => result.current?.scroll('left'));
    act(() => result.current?.scroll('right'));
    expect(scrollTo).toHaveBeenNthCalledWith(1, { left: -300, behavior: 'smooth' });
    expect(scrollTo).toHaveBeenNthCalledWith(2, { left: 300, behavior: 'smooth' });

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('ignores scrolling without a carousel element and exposes state setters', () => {
    const { result } = renderHook(() => useEventStreamSectionController(props()));
    act(() => result.current?.scroll('left'));
    act(() => {
      result.current?.setCanScrollLeft(true);
      result.current?.setCanScrollRight(true);
      result.current?.setSpeakersExpanded(false);
      result.current?.setExpanded(false);
    });
    expect(result.current).toMatchObject({
      canScrollLeft: true,
      canScrollRight: true,
      speakersExpanded: false,
      expanded: false,
    });
  });
});
