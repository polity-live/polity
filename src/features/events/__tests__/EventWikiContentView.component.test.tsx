/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventWikiContentView, type EventWikiContentViewProps } from '../EventWikiContentView';

const wikiParticipationDirectoryMock = vi.hoisted(() =>
  vi.fn(({ leadingCard }: { leadingCard?: ReactNode; virtualSource?: any }) => (
    <div data-testid="wiki-participation-directory">{leadingCard}</div>
  ))
);
const statsBarMock = vi.hoisted(() =>
  vi.fn((props: { items?: readonly { label: string; value: number | string }[] }) => (
    <div data-testid="stats-bar" data-item-count={props.items?.length ?? 0} />
  ))
);
const queryMocks = vi.hoisted(() => ({
  participantPage: vi.fn((args: unknown) => ({ kind: 'page', args })),
  participantById: vi.fn((args: unknown) => ({ kind: 'single', args })),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    events: {
      participantPage: queryMocks.participantPage,
      participantById: queryMocks.participantById,
    },
  },
}));

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
  translate: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
    typeof paramsOrFallback === 'string' ? paramsOrFallback : key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  VisibilityBadge: ({ children, ...props }: { children: ReactNode }) => (
    <span {...props}>{children}</span>
  ),
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
  ResponsiveActionLabel: ({ full }: { full: ReactNode }) => <>{full}</>,
  StatsBar: statsBarMock,
  compactActionButtonClassName: 'compact-action',
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  MembershipButton: ({ 'data-action-id': actionId }: { 'data-action-id'?: string }) => (
    <button data-action-id={actionId}>participate</button>
  ),
  SubscribeButton: ({
    'data-action-id': actionId,
    onToggleSubscribe,
  }: {
    'data-action-id'?: string;
    onToggleSubscribe: () => void;
  }) => (
    <button data-action-id={actionId} onClick={onToggleSubscribe}>
      subscribe
    </button>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: { 'data-action-id'?: string }) => (
    <button data-action-id={actionId}>share</button>
  ),
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ badgeClassName }: { badgeClassName?: string }) => (
    <div data-testid="hashtags" data-badge-class-name={badgeClassName} />
  ),
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
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
      typeof paramsOrFallback === 'string' ? paramsOrFallback : key,
    toggleSubscribe: vi.fn(),
    user: null,
  };

  return render(<EventWikiContentView {...defaultProps} {...overrides} />);
}

describe('EventWikiContentView', () => {
  it.each([
    ['public', 'public'],
    ['authenticated', 'authenticated'],
    ['private', 'private'],
    [null, 'public'],
    ['unexpected', 'private'],
  ])('normalizes the %s visibility to one %s badge', (visibility, expected) => {
    const { container } = renderEventWikiContent({
      event: {
        id: 'event-1',
        title: 'Civic Night',
        visibility,
        event_type: null,
        recurrence_pattern: null,
        creator: { first_name: 'Organizer' },
      },
    });

    const badges = container.querySelectorAll('[data-entity-visibility]');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.getAttribute('data-entity-visibility')).toBe(expected);
    expect(badges[0]?.textContent).toBe(`common.visibility.${expected}`);
  });

  it('shows only share actions to unauthenticated visitors', () => {
    renderEventWikiContent({ user: null, elections: [{ id: 'election-1' }] });

    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'subscribe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'participate' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'generated.inline.0428_kandidieren_b1de92a5' })
    ).toBeNull();
  });

  it('keeps event actions visible to authenticated users', () => {
    const toggleSubscribe = vi.fn();
    const setElectionsDialogOpen = vi.fn();
    renderEventWikiContent({
      user: { id: 'user-1' },
      elections: [{ id: 'election-1' }],
      setElectionsDialogOpen,
      toggleSubscribe,
    });

    const subscribe = screen.getByRole('button', { name: 'subscribe' });
    expect(subscribe.getAttribute('data-action-id')).toBe('events.wiki.subscribe');
    fireEvent.click(subscribe);
    expect(toggleSubscribe).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'participate' }).getAttribute('data-action-id')).toBe(
      'events.wiki.participation'
    );
    const candidacy = screen.getByRole('button', {
      name: 'generated.inline.0428_kandidieren_b1de92a5',
    });
    expect(candidacy.getAttribute('data-action-id')).toBe('events.wiki.candidacy.open');
    fireEvent.click(candidacy);
    expect(setElectionsDialogOpen).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'share' }).getAttribute('data-action-id')).toBe(
      'events.wiki.share'
    );
  });

  it('stacks wrapping badges and mobile hashtags below a constrained title', () => {
    renderEventWikiContent({
      event: {
        id: 'event-1',
        title: 'A very long recurring assembly event title',
        visibility: 'public',
        event_type: 'delegate_assembly',
        recurrence_pattern: 'weekly',
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
        event_hashtags: [
          {
            id: 'event-tag-1',
            hashtag: { id: 'tag-1', tag: 'a-very-long-hashtag' },
          },
        ],
        registration_deadline: null,
        amendment_deadline: null,
        candidacy_deadline: null,
        start_date: null,
        end_date: null,
      },
    });

    const title = screen.getByRole('heading', {
      level: 1,
      name: 'A very long recurring assembly event title',
    });
    const titleGroup = title.parentElement;
    const badgeGroup = title.nextElementSibling;
    const hashtagDisplays = screen.getAllByTestId('hashtags');

    expect(title.className).toContain('min-w-0');
    expect(title.className).toContain('break-words');
    expect(titleGroup?.className).toContain('flex-col');
    expect(titleGroup?.className).toContain('md:flex-row');
    expect(badgeGroup?.className).toContain('flex-wrap');
    expect(badgeGroup?.className).toContain('md:contents');
    expect(titleGroup?.nextElementSibling).toBe(hashtagDisplays[0]?.parentElement);
    expect(hashtagDisplays[0]?.parentElement?.className).toContain('md:hidden');
    expect(hashtagDisplays[0]?.getAttribute('data-badge-class-name')).toContain('break-all');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('hidden');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('md:block');
  });

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
    expect(
      screen.getByRole('button', { name: /Board election/ }).getAttribute('data-action-id')
    ).toBe('events.wiki.candidacy.select-election');
    expect(screen.queryByText('features.events.candidacy.becomeTitle')).toBeNull();
  });

  it('disables an existing candidacy and renders the complete role description', () => {
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
          role: { title: 'Chair', description: 'Facilitates the board.' },
          majority_type: 'simple',
        },
      ],
      getUserCandidacy: vi.fn(() => ({ id: 'candidacy-1' })),
      handleElectionClick,
    });

    const election = screen.getByRole('button', { name: /Board election/ });
    expect((election as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Facilitates the board.')).toBeTruthy();
    fireEvent.click(election);
    expect(handleElectionClick).not.toHaveBeenCalled();
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
    expect(
      document.querySelector('[data-action-id="events.wiki.candidacy.confirm"]')
    ).not.toBeNull();
  });

  it('normalizes sparse private-event data through every persisted-counter fallback', () => {
    renderEventWikiContent({
      amendmentsCount: null,
      electionsCount: null,
      openChangeRequestsCount: null,
      eventDescription: null,
      formattedLocation: '',
      user: { id: 'user-1' },
      elections: [],
      event: {
        id: 'event-1',
        title: null,
        visibility: 'private',
        event_type: null,
        recurrence_pattern: null,
        participant_count: null,
        election_count: 6,
        amendment_count: null,
        open_change_request_count: null,
        creator: null,
        group: null,
        roles: null,
        participants: null,
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
        participantCount: null,
      },
    });

    const items = statsBarMock.mock.calls.at(-1)?.[0]?.items ?? [];
    const values = new Map(
      items.map((item: { label: string; value: number | string }) => [item.label, item.value])
    );
    expect(values.get('components.labels.participants')).toBe(0);
    expect(values.get('components.labels.elections')).toBe(6);
    expect(values.get('components.labels.amendments')).toBe(0);
    expect(values.get('components.labels.openChangeRequests')).toBe(0);
    expect(
      screen.queryByRole('button', { name: 'generated.inline.0428_kandidieren_b1de92a5' })
    ).toBeNull();
  });

  it('covers all recurrence labels, organizer variants, dates, and role sources', () => {
    const commonEvent = {
      id: 'event-1',
      title: 'Recurring event',
      visibility: 'private',
      event_type: 'workshop',
      participant_count: null,
      election_count: null,
      amendment_count: 8,
      open_change_request_count: 9,
      creator: { id: 'creator-1', first_name: '', avatar: 'avatar.png' },
      group: { id: 'group-1', name: 'Group' },
      roles: [
        { id: 'known', name: 'Known' },
        { id: 'duplicate', name: 'Zulu' },
        { id: 'duplicate', name: 'Zulu duplicate' },
      ],
      participants: [
        {
          id: null,
          status: null,
          role_id: 'known',
          role: { id: 'single', name: 'Single' },
          roles: [
            { id: 'direct', name: 'Direct' },
            { id: 'duplicate', name: 'Zulu' },
          ],
          participant_roles: null,
          user: {
            id: 'participant-1',
            first_name: 'Ada',
            handle: null,
            email: null,
            avatar: null,
          },
        },
      ],
      event_hashtags: null,
      start_date: '2026-08-09T10:00:00Z',
      end_date: '2026-08-09T12:00:00Z',
      city: 'Berlin',
      post_code: '10115',
    };

    for (const recurrence_pattern of ['daily', 'monthly', 'yearly', 'four-yearly', 'custom']) {
      renderEventWikiContent({
        amendmentsCount: null,
        electionsCount: null,
        openChangeRequestsCount: null,
        formattedLocation: 'Town Hall',
        event: { ...commonEvent, recurrence_pattern },
        participation: {
          status: null,
          isParticipant: false,
          hasRequested: false,
          isInvited: false,
          requestParticipation: vi.fn(),
          leaveEvent: vi.fn(),
          acceptInvitation: vi.fn(),
          isLoading: false,
          participantCount: 4,
        },
      });
    }

    const directoryProps = wikiParticipationDirectoryMock.mock.calls.at(-1)?.[0];
    expect(directoryProps).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'participant-participant-1',
            handle: null,
            email: null,
            avatar: null,
            status: null,
          }),
        ],
        roles: expect.arrayContaining([
          expect.objectContaining({ id: 'direct' }),
          expect.objectContaining({ id: 'known' }),
          expect.objectContaining({ id: 'single' }),
        ]),
      })
    );

    renderEventWikiContent({
      event: {
        ...commonEvent,
        creator: { first_name: 'Named without id' },
        recurrence_pattern: null,
      },
    });
    renderEventWikiContent({
      event: {
        ...commonEvent,
        creator: { id: 'creator-without-avatar', first_name: 'Linked' },
        recurrence_pattern: null,
      },
    });
    renderEventWikiContent({
      event: { ...commonEvent, creator: {}, recurrence_pattern: null },
    });
  });

  it('builds and executes the virtual participant directory contract', () => {
    renderEventWikiContent({
      virtualizeParticipationDirectory: true,
      event: {
        id: 'event-1',
        title: 'Virtual event',
        visibility: 'public',
        creator: { first_name: 'Organizer' },
        roles: [{ id: 'role-1', name: 'Member' }],
        participants: [],
      },
    });

    const source = wikiParticipationDirectoryMock.mock.calls.at(-1)?.[0]?.virtualSource;
    expect(source.historyKey).toBe('event-event-1-participation-directory');
    expect(
      source.getPageQuery({
        limit: 20,
        start: null,
        dir: 'forward',
        settled: true,
        query: 'ada',
        roleIds: ['role-1'],
      }).options
    ).toEqual({ ttl: '5m' });
    expect(
      source.getPageQuery({
        limit: 10,
        start: 'cursor',
        dir: 'backward',
        settled: false,
        query: '',
        roleIds: [],
      }).options
    ).toEqual({ ttl: 'none' });
    expect(source.getSingleQuery({ id: 'participant-1', settled: true }).options).toEqual({
      ttl: '5m',
    });
    expect(source.getSingleQuery({ id: 'participant-2', settled: false }).options).toEqual({
      ttl: 'none',
    });
    expect(source.getRowKey({ id: 'row-1' })).toBe('row-1');

    expect(
      source.mapRow({
        id: 'participant-1',
        user_id: 'fallback-user',
        status: 'active',
        role_id: 'role-1',
        roles: [],
        participant_roles: [],
        user: {
          id: 'user-1',
          first_name: 'Ada',
          handle: 'ada',
          email: 'ada@example.test',
          contact_email: 'contact@example.test',
          avatar: 'avatar.png',
        },
      })
    ).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        handle: 'ada',
        email: 'contact@example.test',
        avatar: 'avatar.png',
        status: 'active',
      })
    );
    expect(
      source.mapRow({
        id: 'participant-2',
        user_id: 'fallback-user',
        status: null,
        participant_roles: null,
        user: null,
      })
    ).toEqual(
      expect.objectContaining({
        userId: 'fallback-user',
        handle: null,
        email: null,
        avatar: null,
        status: null,
      })
    );
    expect(queryMocks.participantPage).toHaveBeenCalledTimes(2);
    expect(queryMocks.participantById).toHaveBeenCalledTimes(2);
  });
});
