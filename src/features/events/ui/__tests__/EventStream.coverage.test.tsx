/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventStream } from '../EventStream';

const mocks = vi.hoisted(() => ({
  stream: {} as Record<string, any>,
  viewProps: null as Record<string, any> | null,
  navigate: vi.fn(),
  toast: vi.fn(),
  theme: vi.fn((key: string) => `theme-${key}`),
  renderCarousel: true,
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: mocks.theme }));
vi.mock('../../hooks/useEventStream', () => ({ useEventStream: () => mocks.stream }));
vi.mock('../EventStreamView', () => ({
  EventStreamView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return (
      <div>
        {mocks.renderCarousel ? <div data-testid="carousel" ref={props.carouselRef} /> : null}
        <div data-testid="active" ref={props.activeContentRef} />
        <button type="button" onClick={() => props.scroll('left')}>
          left
        </button>
        <button type="button" onClick={() => props.scroll('right')}>
          right
        </button>
      </div>
    );
  },
}));

function baseStream(overrides: Record<string, unknown> = {}) {
  return {
    event: null,
    currentAgendaItem: null,
    speakerList: [],
    user: null,
    isLoading: false,
    addingSpeaker: false,
    removingSpeaker: null,
    canJoinSpeakerList: false,
    userSpeaker: null,
    handleAddToSpeakerList: vi.fn(),
    handleRemoveFromSpeakerList: vi.fn(),
    calculateSpeakerTime: vi.fn(),
    formatTime: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stream = baseStream();
  mocks.viewProps = null;
  mocks.renderCarousel = true;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('EventStream orchestration coverage', () => {
  it('derives empty, online, hybrid, and location-fallback attendance modes', () => {
    mocks.renderCarousel = false;
    const view = render(<EventStream eventId="event-1" />);
    expect(mocks.viewProps?.attendanceMode).toBe('offline');
    expect(mocks.viewProps?.confirmedOfflineParticipantCount).toBe(0);

    mocks.renderCarousel = true;
    mocks.stream = baseStream({
      event: {
        attendance_mode: 'online',
        offline_participants: [
          { attendance_status: 'confirmed', participation_channel: 'offline' },
          { attendance_status: 'declined', participation_channel: 'offline' },
          { attendance_status: 'confirmed', participation_channel: 'online' },
        ],
      },
    });
    view.rerender(<EventStream eventId="event-1" />);
    expect(mocks.viewProps?.attendanceMode).toBe('online');
    expect(mocks.viewProps?.confirmedOfflineParticipantCount).toBe(1);

    mocks.stream = baseStream({ event: { attendance_mode: 'hybrid' } });
    view.rerender(<EventStream eventId="event-1" />);
    expect(mocks.viewProps?.attendanceMode).toBe('hybrid');

    mocks.stream = baseStream({ event: { attendance_mode: 'other', location_type: 'online' } });
    view.rerender(<EventStream eventId="event-1" />);
    expect(mocks.viewProps?.attendanceMode).toBe('online');
  });

  it('derives election and vote state for all selection phases', () => {
    const election = {
      id: 'election-1',
      status: 'indicative',
      indicative_selections: [
        { candidate_id: 'candidate-1', elector_participation_id: 'participation-1' },
        { candidate_id: '', elector_participation_id: null },
      ],
      final_selections: [{ candidate_id: 'candidate-2', elector_participation_id: null }],
      electors: [{ id: 'elector-1', user_id: 'user-1' }],
      candidates: [{ user_id: 'user-1' }, { user_id: 'other' }],
    };
    const vote = {
      id: 'vote-1',
      status: 'indicative',
      indicative_decisions: [{ choice_id: 'choice-1' }, { choice_id: '' }],
      final_decisions: [{ choice_id: 'choice-2' }],
      voters: [{ user_id: 'user-1' }],
    };
    mocks.stream = baseStream({
      currentAgendaItem: { election: [election], id: 'agenda-1', title: 'First', votes: [vote] },
      user: { id: 'user-1' },
    });
    const view = render(<EventStream eventId="event-1" />);

    expect(mocks.viewProps).toMatchObject({
      election,
      indicativeSelections: election.indicative_selections,
      finalSelections: election.final_selections,
      userHasElectionVoted: true,
      userSelectedCandidateIds: ['candidate-1'],
      isUserCandidate: true,
      voteEntity: vote,
      userHasVoteVoted: true,
      userSelectedChoiceIds: ['choice-1'],
    });

    const finalElection = {
      ...election,
      status: 'final',
      indicative_selections: [],
      final_selections: [
        { candidate_id: 'candidate-2', elector_participation_id: 'participation-2' },
      ],
    };
    const finalVote = {
      ...vote,
      status: 'final',
      final_decisions: [{ choice_id: 'choice-2' }],
    };
    mocks.stream = baseStream({
      currentAgendaItem: {
        election: [finalElection],
        id: 'agenda-1',
        title: 'First',
        votes: [finalVote],
      },
      user: { id: 'user-1' },
    });
    view.rerender(<EventStream eventId="event-1" />);
    expect(mocks.viewProps?.userSelectedCandidateIds).toEqual(['candidate-2']);
    expect(mocks.viewProps?.userSelectedChoiceIds).toEqual(['choice-2']);
    expect(mocks.viewProps?.userHasElectionVoted).toBe(true);
  });

  it('covers absent collections, electors, voters, and candidates', () => {
    const view = render(<EventStream eventId="event-1" />);
    expect(mocks.viewProps).toMatchObject({
      indicativeSelections: [],
      finalSelections: [],
      userHasElectionVoted: false,
      userSelectedCandidateIds: [],
      isUserCandidate: false,
      indicativeDecisions: [],
      finalDecisions: [],
      userHasVoteVoted: false,
      userSelectedChoiceIds: [],
    });

    mocks.stream = baseStream({
      currentAgendaItem: {
        election: [
          {
            candidates: null,
            electors: [{ user_id: 'other' }],
            final_selections: null,
            indicative_selections: null,
            status: 'final',
          },
        ],
        id: 'agenda-1',
        title: 'First',
        votes: [
          {
            final_decisions: null,
            indicative_decisions: null,
            status: 'final',
            voters: [{ user_id: 'other' }],
          },
        ],
      },
      user: { id: 'user-1' },
    });
    view.rerender(<EventStream eventId="event-1" />);
    expect(mocks.viewProps).toMatchObject({
      indicativeSelections: [],
      finalSelections: [],
      userHasElectionVoted: false,
      isUserCandidate: false,
      indicativeDecisions: [],
      finalDecisions: [],
      userHasVoteVoted: false,
    });
  });

  it('notifies and scrolls when the active agenda item changes', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    mocks.stream = baseStream({ currentAgendaItem: { id: 'agenda-1', title: 'First' } });
    const view = render(<EventStream eventId="event-1" />);
    expect(mocks.toast).not.toHaveBeenCalled();

    mocks.stream = baseStream({ currentAgendaItem: { id: 'agenda-2', title: 'Second' } });
    view.rerender(<EventStream eventId="event-1" />);
    expect(mocks.toast).toHaveBeenCalledWith('features.events.agenda.itemActivated', {
      description: 'Second',
    });
    act(() => vi.advanceTimersByTime(100));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('updates carousel boundaries, scrolls both ways, and guards a missing element', () => {
    const { getByRole } = render(<EventStream eventId="event-1" />);
    const carousel = mocks.viewProps!.carouselRef.current as HTMLDivElement;
    const scrollTo = vi.fn();
    Object.defineProperties(carousel, {
      scrollLeft: { configurable: true, value: 20, writable: true },
      scrollWidth: { configurable: true, value: 1000 },
      clientWidth: { configurable: true, value: 300 },
      scrollTo: { configurable: true, value: scrollTo },
    });

    act(() => mocks.viewProps!.updateScrollButtons());
    expect(mocks.viewProps).toMatchObject({ canScrollLeft: true, canScrollRight: true });
    fireEvent.click(getByRole('button', { name: 'left' }));
    fireEvent.click(getByRole('button', { name: 'right' }));
    expect(scrollTo).toHaveBeenNthCalledWith(1, { left: -280, behavior: 'smooth' });
    expect(scrollTo).toHaveBeenNthCalledWith(2, { left: 320, behavior: 'smooth' });

    Object.defineProperty(carousel, 'scrollLeft', { configurable: true, value: 700 });
    act(() => mocks.viewProps!.updateScrollButtons());
    expect(mocks.viewProps?.canScrollRight).toBe(false);

    mocks.viewProps!.carouselRef.current = null;
    act(() => {
      mocks.viewProps!.updateScrollButtons();
      mocks.viewProps!.scroll('left');
    });
  });

  it('maps every agenda icon, status color, and type color', () => {
    render(<EventStream eventId="event-1" />);
    const props = mocks.viewProps!;

    expect(
      ['election', 'vote', 'speech', 'discussion', 'other'].map(props.getAgendaItemIcon)
    ).toHaveLength(5);
    expect(['completed', 'in-progress', 'pending', 'other'].map(props.getStatusColor)).toEqual([
      'theme-agendaEventStreamSectionSuccessBackground',
      'theme-agendaEventStreamSectionInfoBackground',
      'theme-agendaEventStreamSectionNeutralBackground',
      'theme-agendaEventStreamSectionNeutralBackground',
    ]);
    expect(['election', 'vote', 'speech', 'discussion', 'other'].map(props.getTypeColor)).toEqual([
      'theme-agendaEventStreamSectionAccentBackground',
      'theme-agendaEventStreamSectionWarningBackground',
      'theme-agendaEventStreamSectionInfoBackground',
      'theme-agendaEventStreamSectionSuccessBackground',
      'theme-agendaEventStreamSectionSuccessBackground',
    ]);
  });
});
