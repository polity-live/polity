/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventStreamSectionView } from '../EventStreamSectionView';

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected captured mock value');
  return value;
}

const mocks = vi.hoisted(() => ({
  electionSection: vi.fn((_props: unknown) => <div data-testid="election-section" />),
  voteSection: vi.fn((_props: unknown) => <div data-testid="vote-section" />),
  accreditationSection: vi.fn((_props: unknown) => <div data-testid="accreditation-section" />),
  livestream: vi.fn((_props: unknown) => <div data-testid="livestream" />),
  autoAssignedRole: false,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('../AgendaNavigationControls', () => ({
  AgendaNavigationControls: () => <div />,
}));
vi.mock('../AgendaElectionSection', () => ({
  AgendaElectionSection: (props: unknown) => mocks.electionSection(props),
  isAutoAssignedRoleElection: () => mocks.autoAssignedRole,
}));
vi.mock('../AgendaVoteSection', () => ({
  AgendaVoteSection: (props: unknown) => mocks.voteSection(props),
}));
vi.mock('../AccreditationSection', () => ({
  AccreditationSection: (props: unknown) => mocks.accreditationSection(props),
}));
vi.mock('@/features/events/ui/EventLivestreamPlayer', () => ({
  EventLivestreamPlayer: (props: unknown) => mocks.livestream(props),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.autoAssignedRole = false;
});

function props(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'event-1',
    streamUrl: '',
    currentAgendaItem: {
      id: 'agenda-1',
      title: 'Budget',
      type: 'discussion',
      status: 'in-progress',
      duration: 10,
    },
    speakerList: [],
    showGender: false,
    userId: 'user-1',
    isUserCandidate: false,
    addingSpeaker: false,
    removingSpeaker: null,
    votingLoading: null,
    userSpeaker: null,
    onAddToSpeakerList: vi.fn(),
    onRemoveFromSpeakerList: vi.fn(),
    onBecomeCandidate: vi.fn(),
    onWithdrawCandidacy: vi.fn(),
    calculateSpeakerTime: vi.fn(() => 0),
    formatTime: vi.fn(() => '00:00'),
    t: (key: string) => key,
    carouselRef: { current: null },
    canScrollLeft: false,
    setCanScrollLeft: vi.fn(),
    canScrollRight: false,
    setCanScrollRight: vi.fn(),
    speakersExpanded: true,
    setSpeakersExpanded: vi.fn(),
    expanded: true,
    setExpanded: vi.fn(),
    election: null,
    voteEntity: null,
    candidates: [],
    indicativeSelections: [],
    finalSelections: [],
    userHasVotedElection: false,
    userSelectedCandidateIds: [],
    electionStatus: 'pending',
    choices: [],
    indicativeDecisions: [],
    finalDecisions: [],
    userHasVotedVote: false,
    userSelectedChoiceIds: [],
    voteStatus: 'pending',
    getStatusColor: vi.fn(() => ''),
    getTypeColor: vi.fn(() => ''),
    updateScrollButtons: vi.fn(),
    scroll: vi.fn(),
    ...overrides,
  };
}

function action(container: HTMLElement, id: string, index = 0) {
  const matches = container.querySelectorAll<HTMLElement>(`[data-action-id="${id}"]`);
  if (!matches[index]) throw new Error(`Missing action ${id}[${index}]`);
  return matches[index];
}

describe('EventStreamSectionView action contracts', () => {
  it.each([
    ['election', '.lucide-user-check'],
    ['vote', '.lucide-vote'],
    ['speech', '.lucide-users'],
    ['accreditation', '.lucide-shield-check'],
    [null, '.lucide-file-text'],
  ])('renders the %s agenda icon and collapsed state', (type, selector) => {
    const { container } = render(
      <EventStreamSectionView
        {...props({
          expanded: false,
          currentAgendaItem: {
            id: 'agenda-1',
            title: 'Budget',
            type,
            status: null,
            duration: null,
          },
        })}
      />
    );
    expect(container.querySelector(selector)).toBeTruthy();
    expect(container.querySelector('.lucide-chevron-down')).toBeTruthy();
  });

  it('toggles stream sections and joins the speaker list through stable controls', () => {
    const setExpanded = vi.fn();
    const setSpeakersExpanded = vi.fn();
    const onAddToSpeakerList = vi.fn();
    const { container } = render(
      <EventStreamSectionView
        {...props({ setExpanded, setSpeakersExpanded, onAddToSpeakerList })}
      />
    );

    fireEvent.click(action(container, 'agendas.stream.section.toggle'));
    fireEvent.click(action(container, 'agendas.stream.speakers.toggle'));
    fireEvent.click(action(container, 'agendas.stream.speakers.join'));
    expect(setExpanded).toHaveBeenCalled();
    expect(setSpeakersExpanded).toHaveBeenCalled();
    expect(onAddToSpeakerList).toHaveBeenCalledTimes(1);
  });

  it('scrolls the speaker rail and removes the current user from either responsive control', () => {
    const scroll = vi.fn();
    const onRemoveFromSpeakerList = vi.fn();
    const speaker = {
      id: 'speaker-1',
      user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
      completed: false,
    };
    const { container } = render(
      <EventStreamSectionView
        {...props({
          speakerList: [speaker],
          userSpeaker: speaker,
          canScrollLeft: true,
          canScrollRight: true,
          scroll,
          onRemoveFromSpeakerList,
        })}
      />
    );

    fireEvent.click(action(container, 'agendas.stream.speakers.scroll.previous'));
    fireEvent.click(action(container, 'agendas.stream.speakers.scroll.next'));
    fireEvent.click(action(container, 'agendas.stream.speakers.leave', 0));
    fireEvent.click(action(container, 'agendas.stream.speakers.leave', 1));
    expect(scroll).toHaveBeenNthCalledWith(1, 'left');
    expect(scroll).toHaveBeenNthCalledWith(2, 'right');
    expect(onRemoveFromSpeakerList).toHaveBeenCalledTimes(2);
    expect(onRemoveFromSpeakerList).toHaveBeenCalledWith('speaker-1');
  });

  it('supports keyboard carousel navigation and shows the pending leave state', () => {
    const scroll = vi.fn();
    const speaker = {
      id: 'speaker-1',
      user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
      completed: false,
    };
    const { container } = render(
      <EventStreamSectionView
        {...props({
          speakerList: [speaker],
          userSpeaker: speaker,
          removingSpeaker: 'speaker-1',
          canScrollLeft: true,
          canScrollRight: true,
          scroll,
        })}
      />
    );

    const carousel = container.querySelector<HTMLElement>('[data-arrow-keys="local"]')!;
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(scroll).toHaveBeenNthCalledWith(1, 'left');
    expect(scroll).toHaveBeenNthCalledWith(2, 'right');
    expect((action(container, 'agendas.stream.speakers.leave') as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('forwards election, accreditation, and hydrating vote data with fallbacks', () => {
    mocks.autoAssignedRole = true;
    const election = {
      id: 'election-1',
      title: null,
      candidates: [{ id: 'candidate-1' }],
      election_mode: 'list',
      seat_count: undefined,
      offline_tallies: undefined,
      delegate_assignment_meta: { targetEventId: 'event-2' },
    };
    const voteEntity = {
      id: 'vote-1',
      title: null,
      choices: [{ id: 'choice-1', label: 'Yes' }],
      voters: undefined,
      offline_electorate_size: null,
      offline_tallies: undefined,
    };
    const { rerender } = render(
      <EventStreamSectionView
        {...props({
          currentAgendaItem: {
            id: 'agenda-1',
            title: 'Accreditation',
            description: 'Description',
            type: 'accreditation',
            status: 'completed',
            duration: null,
          },
          election,
          candidates: election.candidates,
          voteEntity,
          choices: voteEntity.choices,
          userId: '',
          votingLoading: 'election-1',
          onBecomeCandidate: undefined,
        })}
      />
    );
    expect(mocks.electionSection).toHaveBeenCalledWith(
      expect.objectContaining({
        roleName: 'features.events.agenda.role',
        electionMode: 'list',
        seatCount: null,
        offlineTallies: [],
        delegateTargetEventId: 'event-2',
        showRoleAssignedMessage: true,
        canVote: false,
        isVotingLoading: true,
      })
    );
    expect(mocks.voteSection).toHaveBeenCalledWith(
      expect.objectContaining({
        voteTitle: 'Vote',
        offlineTallies: [],
        totalEligibleVoters: undefined,
      })
    );
    expect(mocks.accreditationSection).toHaveBeenCalledWith({
      eventId: 'event-1',
      agendaItemId: 'agenda-1',
    });
    (requireDefined(mocks.electionSection.mock.lastCall)[0] as any).onBecomeCandidate();

    const hydratedVote = {
      ...voteEntity,
      title: 'Budget vote',
      offline_electorate_size: 2,
      offline_tallies: [{ choice_id: 'choice-1', count: 1 }],
      voters: [{ participation_channel: 'online' }, { participation_channel: 'offline' }],
    };
    rerender(
      <EventStreamSectionView
        {...props({
          currentAgendaItem: {
            id: 'agenda-1',
            title: 'Vote',
            type: 'vote',
            status: 'pending',
            duration: 5,
          },
          election: { ...election, title: 'Election', election_mode: null, offline_tallies: [] },
          candidates: election.candidates,
          voteEntity: hydratedVote,
          choices: hydratedVote.choices,
          votingLoading: null,
        })}
      />
    );
    expect(mocks.voteSection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        voteTitle: 'Budget vote',
        offlineTallies: [{ choice_id: 'choice-1', count: 1 }],
        totalEligibleVoters: 3,
      })
    );
    expect(mocks.electionSection).toHaveBeenLastCalledWith(
      expect.objectContaining({ electionMode: null, isVotingLoading: false })
    );

    rerender(
      <EventStreamSectionView
        {...props({
          voteEntity: {
            ...voteEntity,
            offline_electorate_size: 2,
            voters: undefined,
          },
          choices: voteEntity.choices,
        })}
      />
    );
    expect(mocks.voteSection).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalEligibleVoters: 2 })
    );
  });

  it('renders speaker identity, gender, completion, and join-state variants', () => {
    const add = vi.fn();
    const remove = vi.fn();
    const speakers = [
      {
        id: 'full-name',
        completed: true,
        time: 2,
        user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', gender: 'male' },
      },
      {
        id: 'email',
        completed: false,
        time: 3,
        user: {
          id: 'user-2',
          first_name: null,
          last_name: null,
          email: 'email@example.com',
          gender: 'female',
        },
      },
      {
        id: 'unknown',
        completed: false,
        time: 4,
        user: { id: 'user-3', first_name: null, last_name: null, email: null, gender: 'diverse' },
      },
      {
        id: 'unspecified',
        completed: false,
        time: 5,
        user: null,
      },
    ];
    const { container, rerender } = render(
      <EventStreamSectionView
        {...props({
          speakerList: speakers,
          showGender: true,
          userId: 'user-1',
          userSpeaker: null,
          onAddToSpeakerList: add,
          onRemoveFromSpeakerList: remove,
          addingSpeaker: true,
        })}
      />
    );
    expect(container.textContent).toContain('Ada Lovelace');
    expect(container.textContent).toContain('email@example.com');
    expect(container.textContent).toContain('Unknown');
    expect(container.querySelector('.opacity-60')).toBeTruthy();
    fireEvent.click(action(container, 'agendas.stream.speakers.leave'));
    expect(remove).toHaveBeenCalledWith('full-name');

    rerender(
      <EventStreamSectionView
        {...props({
          speakerList: [],
          userId: null,
          onAddToSpeakerList: add,
          addingSpeaker: false,
          speakersExpanded: false,
        })}
      />
    );
    const join = action(container, 'agendas.stream.speakers.join') as HTMLButtonElement;
    expect(join.disabled).toBe(true);

    rerender(
      <EventStreamSectionView
        {...props({
          speakerList: [],
          userSpeaker: null,
          onAddToSpeakerList: null,
        })}
      />
    );
    expect(container.querySelector('[data-action-id*="stream.speakers.join"]')).toBeNull();
  });
});
