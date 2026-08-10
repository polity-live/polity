/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventStreamView, type EventStreamViewProps } from '../EventStreamView';

const mocks = vi.hoisted(() => ({
  electionProps: null as Record<string, any> | null,
  voteProps: null as Record<string, any> | null,
  navigationOptions: null as Record<string, any> | null,
  autoAssigned: false,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/agenda">{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/hooks/useHorizontalArrowNavigation', () => ({
  INTERACTIVE_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR: '[data-arrow-keys]',
  useHorizontalArrowNavigation: (options: Record<string, any>) => {
    mocks.navigationOptions = options;
    return { onKeyDown: vi.fn() };
  },
}));
vi.mock('@/features/agendas/ui/AgendaNavigationControls', () => ({
  AgendaNavigationControls: () => null,
}));
vi.mock('@/features/agendas/ui/AgendaElectionSection', () => ({
  AgendaElectionSection: (props: Record<string, any>) => {
    mocks.electionProps = props;
    return <div data-testid="election" />;
  },
  isAutoAssignedRoleElection: () => mocks.autoAssigned,
}));
vi.mock('@/features/agendas/ui/AgendaVoteSection', () => ({
  AgendaVoteSection: (props: Record<string, any>) => {
    mocks.voteProps = props;
    return <div data-testid="vote" />;
  },
}));
vi.mock('../EventLivestreamPlayer', () => ({ EventLivestreamPlayer: () => null }));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipHint: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function props(overrides: Partial<EventStreamViewProps> = {}): EventStreamViewProps {
  return {
    activeContentRef: createRef<HTMLDivElement>(),
    addingSpeaker: false,
    attendanceMode: 'online',
    calculateSpeakerTime: vi.fn(() => new Date('2026-08-02T12:00:00Z')),
    canJoinSpeakerList: false,
    canScrollLeft: false,
    canScrollRight: false,
    carouselRef: createRef<HTMLDivElement>(),
    confirmedOfflineParticipantCount: 2,
    currentAgendaItem: { id: 'agenda-1', title: 'Opening' },
    election: null,
    event: { gender_quota_enabled: false, stream_url: null, title: 'Covered event' },
    eventId: 'event-1',
    finalDecisions: [],
    finalSelections: [],
    formatTime: vi.fn(() => '12:00'),
    getAgendaItemIcon: vi.fn(() => null),
    getStatusColor: vi.fn(() => ''),
    getTypeColor: vi.fn(() => ''),
    handleAddToSpeakerList: vi.fn(),
    handleRemoveFromSpeakerList: vi.fn(),
    indicativeDecisions: [],
    indicativeSelections: [],
    isLoading: false,
    isUserCandidate: false,
    navigate: vi.fn(),
    previousAgendaItemIdRef: { current: null },
    removingSpeaker: null,
    scroll: vi.fn(),
    setCanScrollLeft: vi.fn(),
    setCanScrollRight: vi.fn(),
    setSpeakersExpanded: vi.fn(),
    speakerList: [],
    speakersExpanded: true,
    t: (key: string) => key,
    updateScrollButtons: vi.fn(),
    user: null,
    userHasElectionVoted: false,
    userHasVoteVoted: false,
    userSelectedCandidateIds: [],
    userSelectedChoiceIds: [],
    userSpeaker: null,
    voteEntity: null,
    ...overrides,
  } as EventStreamViewProps;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.electionProps = null;
  mocks.voteProps = null;
  mocks.navigationOptions = null;
  mocks.autoAssigned = false;
});

afterEach(cleanup);

describe('EventStreamView branch coverage', () => {
  it('renders fallback election, vote, quota labels, and adding state', () => {
    const scroll = vi.fn();
    const view = render(
      <EventStreamView
        {...props({
          addingSpeaker: true,
          canJoinSpeakerList: true,
          canScrollLeft: true,
          canScrollRight: true,
          currentAgendaItem: {
            description: 'Agenda description',
            duration: 15,
            id: 'agenda-1',
            status: null,
            title: 'Opening',
            type: null,
          },
          election: {
            candidates: [{ id: 'candidate-1' }],
            election_mode: null,
            offline_tallies: null,
            seat_count: 1,
            status: null,
            title: null,
          },
          event: { gender_quota_enabled: true, stream_url: null },
          scroll,
          speakerList: [
            { id: 'male', user: { first_name: 'Max', last_name: 'M', gender: 'male' }, time: 3 },
            { id: 'female', user: { email: 'f@example.test', gender: 'female' }, time: 3 },
            { id: 'diverse', user: { gender: 'diverse' }, time: 3 },
            { id: 'unknown', user: null, time: 3, title: null },
          ],
          speakersExpanded: false,
          user: null,
          voteEntity: {
            choices: [{ id: 'choice-1' }],
            id: 'vote-1',
            offline_electorate_size: null,
            offline_tallies: null,
            status: null,
            title: '',
            voters: null,
          },
        })}
      />
    );

    expect(mocks.electionProps).toMatchObject({
      roleName: 'features.events.agenda.role',
      electionMode: null,
      offlineTallies: [],
      electionStatus: 'indicative',
      canVote: false,
    });
    expect(mocks.voteProps).toMatchObject({
      voteTitle: 'Vote',
      offlineTallies: [],
      voteStatus: 'indicative',
      totalEligibleVoters: 2,
      offlineEligibleCount: 2,
    });
    expect(view.container.textContent).toContain(
      'features.events.agenda.genderQuota.genderLabels.male'
    );
    expect(view.container.textContent).toContain(
      'features.events.agenda.genderQuota.genderLabels.female'
    );
    expect(view.container.textContent).toContain(
      'features.events.agenda.genderQuota.genderLabels.diverse'
    );
    expect(view.container.textContent).toContain(
      'features.events.agenda.genderQuota.genderLabels.unspecified'
    );
    expect(view.container.textContent).toContain('generated.inline.0017_adding_268c06a2');

    mocks.electionProps!.onBecomeCandidate();
    mocks.electionProps!.onWithdrawCandidacy();
    mocks.navigationOptions!.onGoPrev();
    mocks.navigationOptions!.onGoNext();
    expect(scroll).toHaveBeenNthCalledWith(1, 'left');
    expect(scroll).toHaveBeenNthCalledWith(2, 'right');
  });

  it('renders explicit election/vote data and every speaker card state', () => {
    mocks.autoAssigned = true;
    const remove = vi.fn();
    const currentSpeaker = {
      completed: false,
      id: 'current',
      time: 2,
      title: 'Current title',
      user: { avatar: 'avatar.png', first_name: 'Ada', id: 'user-1' },
    };
    const view = render(
      <EventStreamView
        {...props({
          currentAgendaItem: {
            id: 'agenda-1',
            status: 'in-progress',
            title: 'Opening',
            type: 'vote',
          },
          election: {
            candidates: [{ id: 'candidate-1' }],
            delegate_assignment_meta: { targetEventId: 'target-1' },
            election_mode: 'single',
            offline_tallies: [{ id: 'tally-1' }],
            status: 'final',
            title: 'Chair',
          },
          event: { gender_quota_enabled: false },
          handleRemoveFromSpeakerList: remove,
          removingSpeaker: 'current',
          speakerList: [
            { completed: true, id: 'done', time: 2, user: { first_name: 'Done' } },
            currentSpeaker,
            { completed: false, id: 'other', time: 2, user: { first_name: 'Other' } },
          ],
          user: { id: 'user-1' },
          userSpeaker: currentSpeaker,
          voteEntity: {
            choices: [{ id: 'choice-1' }],
            id: 'vote-1',
            offline_electorate_size: 5,
            offline_tallies: [{ id: 'vote-tally' }],
            status: 'final',
            title: 'Budget vote',
            voters: null,
          },
        })}
      />
    );

    expect(mocks.electionProps).toMatchObject({
      roleName: 'Chair',
      electionMode: 'single',
      offlineTallies: [{ id: 'tally-1' }],
      delegateTargetEventId: 'target-1',
      showRoleAssignedMessage: true,
      electionStatus: 'final',
      canVote: true,
    });
    expect(mocks.voteProps).toMatchObject({
      voteTitle: 'Budget vote',
      offlineTallies: [{ id: 'vote-tally' }],
      voteStatus: 'final',
      totalEligibleVoters: 5,
      offlineEligibleCount: 5,
    });
    expect(view.container.textContent).toContain('generated.inline.0015_removing_2a76d431');
    expect(view.container.textContent).toContain('generated.inline.0057_completed_1798b3ba');
    expect(view.container.textContent).toContain('generated.inline.0055_you_905cb326');
    expect(remove).not.toHaveBeenCalled();
  });

  it('filters online voters and covers hidden optional sections and add-ready state', () => {
    const add = vi.fn();
    const view = render(
      <EventStreamView
        {...props({
          addingSpeaker: false,
          canJoinSpeakerList: true,
          election: { candidates: null },
          handleAddToSpeakerList: add,
          speakerList: [],
          user: { id: 'user-1' },
          voteEntity: {
            choices: [{ id: 'choice-1' }],
            id: 'vote-1',
            offline_electorate_size: 3,
            voters: [
              { participation_channel: 'offline' },
              { participation_channel: 'online' },
              { participation_channel: null },
            ],
          },
        })}
      />
    );

    expect(mocks.electionProps).toBeNull();
    expect(mocks.voteProps).toMatchObject({ totalEligibleVoters: 5, offlineEligibleCount: 3 });
    expect(view.container.textContent).toContain('generated.inline.0054_no_speakers_yet_47546d9a');
    expect(view.container.textContent).toContain('generated.inline.0018_add_yourself_71fba1c3');
    fireEvent.click(
      view.container.querySelector('[data-action-id="events.stream.speakers.add-self"]')!
    );
    expect(add).toHaveBeenCalledOnce();

    view.rerender(
      <EventStreamView
        {...props({
          canJoinSpeakerList: false,
          election: { candidates: [] },
          speakerList: [],
          voteEntity: { choices: [] },
        })}
      />
    );
    expect(
      view.container.querySelector('[data-action-id="events.stream.speakers.add-self"]')
    ).toBeNull();
    expect(mocks.electionProps).toBeNull();
  });

  it('renders a non-removing current speaker label', () => {
    const speaker = {
      completed: false,
      id: 'current',
      time: 2,
      user: { first_name: 'Ada', id: 'user-1' },
    };
    const view = render(
      <EventStreamView
        {...props({ speakerList: [speaker], user: { id: 'user-1' }, userSpeaker: speaker })}
      />
    );
    expect(view.container.textContent).toContain('generated.inline.0016_remove_yourself_fa3b0e30');
  });
});
