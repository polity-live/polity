/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventWikiContentView, type EventWikiContentViewProps } from '../EventWikiContentView';

const wikiParticipationDirectoryMock = vi.hoisted(() =>
  vi.fn(({ leadingCard }: { leadingCard?: ReactNode }) => (
    <div data-testid="wiki-participation-directory">{leadingCard}</div>
  ))
);
const statsBarMock = vi.hoisted(() =>
  vi.fn((props: { items?: readonly { label: string; value: number | string }[] }) => (
    <div data-testid="stats-bar" data-item-count={props.items?.length ?? 0} />
  ))
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ open = true, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EntityPageFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StatsBar: statsBarMock,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  MembershipButton: () => <button>participate</button>,
  SubscribeButton: () => <button>subscribe</button>,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button>share</button>,
}));

vi.mock('@/features/shared/ui/wiki/InfoTabs.tsx', () => ({
  InfoTabs: () => <div data-testid="info-tabs" />,
}));

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: () => <div data-testid="entity-wiki-media" />,
  WikiParticipationDirectory: wikiParticipationDirectoryMock,
  WikiRosterSummaryCard: () => <div data-testid="roster-summary" />,
  getWikiParticipationName: () => 'Participant',
  isVisibleWikiParticipationStatus: () => true,
  normalizeWikiParticipationRole: (
    role: {
      id?: string | null;
      name?: string | null;
      title?: string | null;
      description?: string | null;
    } | null
  ) =>
    role?.id
      ? {
          id: role.id,
          name: role.name || role.title || 'Role',
          description: role.description,
        }
      : null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderEventWikiContent(overrides: Partial<EventWikiContentViewProps> = {}) {
  const defaultProps: EventWikiContentViewProps = {
    agendaStats: {},
    amendmentsCount: 0,
    canAccess: true,
    candidacyPasswordError: null,
    confirmDialogOpen: false,
    elections: [],
    electionsCount: 0,
    electionsDialogOpen: false,
    event: {
      id: 'event-1',
      title: 'Civic Night',
      visibility: 'public',
      event_type: null,
      recurrence_pattern: null,
      description: null,
      participant_count: 0,
      subscriber_count: 0,
      election_count: 0,
      amendment_count: 0,
      open_change_request_count: 0,
      creator: { first_name: 'Organizer' },
      group: null,
      roles: [],
      participants: [],
      event_hashtags: [],
      registration_deadline: null,
      amendment_deadline: null,
      candidacy_deadline: null,
      start_date: null,
      end_date: null,
    },
    eventDescription: '',
    eventId: 'event-1',
    formattedLocation: '',
    getUserCandidacy: vi.fn(),
    handleConfirmCandidacy: vi.fn(),
    handleElectionClick: vi.fn(),
    isAssemblyEventType: false,
    isSubmitting: false,
    isSubscribed: false,
    openChangeRequestsCount: 0,
    participation: {
      status: null,
      isParticipant: false,
      hasRequested: false,
      isInvited: false,
      requestParticipation: vi.fn(),
      leaveEvent: vi.fn(),
      acceptInvitation: vi.fn(),
      isLoading: false,
      participantCount: 0,
    },
    participationDisabledReason: null,
    selectedElection: null,
    setConfirmDialogOpen: vi.fn(),
    setElectionsDialogOpen: vi.fn(),
    shouldDisableParticipationRequest: false,
    subscribeLoading: false,
    subscriberCount: 0,
    t: (key: string, fallback?: string) => fallback ?? key,
    toggleSubscribe: vi.fn(),
    user: null,
  };

  return render(<EventWikiContentView {...defaultProps} {...overrides} />);
}

describe('EventWikiContentView', () => {
  it('uses computed agenda counters instead of stale persisted event counters', () => {
    renderEventWikiContent({
      amendmentsCount: 2,
      electionsCount: 1,
      openChangeRequestsCount: 3,
    });

    const items = statsBarMock.mock.calls[0]?.[0]?.items ?? [];
    const valueByLabel = new Map(
      items.map((item: { label: string; value: number | string }) => [item.label, item.value])
    );

    expect(valueByLabel.get('components.labels.amendments')).toBe(2);
    expect(valueByLabel.get('components.labels.elections')).toBe(1);
    expect(valueByLabel.get('components.labels.openChangeRequests')).toBe(3);
  });

  it('renders the delegate members-per-seat ratio for delegate assemblies', () => {
    const t = (key: string, params?: Record<string, number>) => {
      if (key === 'features.delegates.ratio.oneMember') {
        return '1 delegate per 1 member';
      }

      if (key === 'features.delegates.ratio.members') {
        return `1 delegate per ${params?.count ?? 0} members`;
      }

      return key;
    };

    render(
      <EventWikiContentView
        agendaStats={{}}
        amendmentsCount={0}
        canAccess
        confirmDialogOpen={false}
        elections={[]}
        electionsCount={0}
        electionsDialogOpen={false}
        event={{
          id: 'event-1',
          title: 'Delegate Assembly',
          visibility: 'public',
          event_type: 'delegate_assembly',
          delegate_seat_allocation_type: 'members_per_delegate',
          main_group_delegate_allocation_mode: '1',
          description: null,
          participant_count: 0,
          subscriber_count: 0,
          election_count: 0,
          amendment_count: 0,
          open_change_request_count: 0,
          creator: { first_name: 'Organizer' },
          group: { id: 'group-1', name: 'H2' },
          roles: [],
          participants: [],
        }}
        eventDescription=""
        eventId="event-1"
        formattedLocation=""
        getUserCandidacy={vi.fn()}
        handleConfirmCandidacy={vi.fn()}
        handleElectionClick={vi.fn()}
        isAssemblyEventType
        isSubmitting={false}
        isSubscribed={false}
        openChangeRequestsCount={0}
        participation={{
          status: null,
          isParticipant: false,
          hasRequested: false,
          isInvited: false,
          requestParticipation: vi.fn(),
          leaveEvent: vi.fn(),
          acceptInvitation: vi.fn(),
          isLoading: false,
          participantCount: 0,
        }}
        participationDisabledReason={null}
        selectedElection={null}
        setConfirmDialogOpen={vi.fn()}
        setElectionsDialogOpen={vi.fn()}
        shouldDisableParticipationRequest={false}
        subscribeLoading={false}
        subscriberCount={0}
        t={t}
        toggleSubscribe={vi.fn()}
        user={null}
      />
    );

    expect(screen.getByText('1 delegate per 1 member')).toBeTruthy();
  });

  it('selects an election before opening candidacy PIN confirmation', () => {
    const handleElectionClick = vi.fn();

    renderEventWikiContent({
      user: { id: 'user-1' },
      electionsDialogOpen: true,
      elections: [
        {
          id: 'election-1',
          title: 'Board election',
          description: 'Choose the board.',
          candidates: [],
          role: { title: 'Chair' },
          majority_type: 'simple',
        },
      ],
      handleElectionClick,
    });

    fireEvent.click(screen.getByText('Board election'));

    expect(handleElectionClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'election-1' }));
    expect(screen.queryByText('features.events.candidacy.becomeTitle')).toBeNull();
  });

  it('passes participant_roles as display roles and filter roles to the participant directory', () => {
    renderEventWikiContent({
      event: {
        id: 'event-1',
        title: 'Civic Night',
        visibility: 'public',
        event_type: null,
        recurrence_pattern: null,
        description: null,
        participant_count: 1,
        subscriber_count: 0,
        election_count: 0,
        amendment_count: 0,
        open_change_request_count: 0,
        creator: { first_name: 'Organizer' },
        group: null,
        roles: [{ id: 'role-participant', name: 'Participant' }],
        participants: [
          {
            id: 'participant-1',
            status: 'active',
            user: { id: 'user-1', first_name: 'Ada' },
            participant_roles: [
              {
                id: 'role-link-1',
                role: { id: 'role-chair', name: 'Chair' },
              },
            ],
          },
        ],
        event_hashtags: [],
        registration_deadline: null,
        amendment_deadline: null,
        candidacy_deadline: null,
        start_date: null,
        end_date: null,
      },
      participation: {
        status: null,
        isParticipant: false,
        hasRequested: false,
        isInvited: false,
        requestParticipation: vi.fn(),
        leaveEvent: vi.fn(),
        acceptInvitation: vi.fn(),
        isLoading: false,
        participantCount: 1,
      },
    });

    expect(wikiParticipationDirectoryMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'participant-1',
            status: 'active',
            roles: [expect.objectContaining({ id: 'role-chair', name: 'Chair' })],
          }),
        ],
        roles: [
          expect.objectContaining({ id: 'role-chair', name: 'Chair' }),
          expect.objectContaining({ id: 'role-participant', name: 'Participant' }),
        ],
      })
    );
  });

  it('submits the voting PIN from the candidacy confirmation dialog', async () => {
    const handleConfirmCandidacy = vi.fn();

    renderEventWikiContent({
      confirmDialogOpen: true,
      handleConfirmCandidacy,
      selectedElection: {
        id: 'election-1',
        title: 'Board election',
        description: 'Choose the board.',
        candidates: [],
        role: { title: 'Chair' },
        majority_type: 'simple',
      },
    });

    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs).toHaveLength(4);

    '1234'.split('').forEach((digit, index) => {
      fireEvent.change(inputs[index], { target: { value: digit } });
    });

    await waitFor(() => expect(handleConfirmCandidacy).toHaveBeenCalledWith('1234'));
  });
});
