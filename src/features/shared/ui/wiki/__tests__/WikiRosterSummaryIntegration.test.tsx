/* @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventWikiContentView } from '@/features/events/EventWikiContentView';
import { GroupWikiContentView } from '@/features/groups/GroupWikiContentView';

afterEach(() => {
  cleanup();
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@/features/shared/ui/layout', () => ({
  StatsBar: ({ items }: { items: { value: number; label: ReactNode }[] }) => (
    <div data-testid="stats-bar">
      {items.map((item, index) => (
        <span key={index}>{item.value}</span>
      ))}
    </div>
  ),
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  SubscribeButton: () => <button type="button">Subscribe</button>,
  MembershipButton: () => <button type="button">Membership</button>,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">Share</button>,
}));

vi.mock('@/features/network/ui/LinkGroupDialog', () => ({
  LinkGroupDialog: () => <button type="button">Link group</button>,
}));

vi.mock('@/features/users/ui/SocialBar', () => ({
  SocialBar: () => <div data-testid="social-bar" />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: () => <div data-testid="hashtags" />,
}));

vi.mock('@/features/shared/ui/wiki/InfoTabs.tsx', () => ({
  InfoTabs: () => <div data-testid="info-tabs" />,
}));

vi.mock('@/features/timeline/ui/cards/BlogTimelineCard', () => ({
  BlogTimelineCard: () => <div data-testid="blog-card" />,
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: () => <div data-testid="group-card" />,
}));

vi.mock('@/features/groups/ui/RelatedGroupsTabs', () => ({
  RelatedGroupsTabs: () => <div data-testid="related-groups" />,
}));

vi.mock('@/features/network/ui/GroupRelationshipFields', () => ({
  SiblingMembershipModeDescription: () => <span data-testid="membership-mode" />,
}));

vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  getCanonicalMembershipModeLabel: () => 'Open',
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/events/ui/EventDeadlinesCard', () => ({
  EventDeadlinesCard: () => <div data-testid="event-deadlines" />,
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableAlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

function getDirectorySummary(container: HTMLElement) {
  const directory = container.querySelector('[data-slot="wiki-participation-directory"]');
  expect(directory).toBeTruthy();

  const summary = directory?.querySelector('[data-slot="wiki-roster-summary-card"]');
  expect(summary).toBeTruthy();
  if (!summary) {
    throw new Error('Expected wiki roster summary card');
  }

  const standaloneSummary = Array.from(
    container.querySelectorAll('[data-slot="wiki-roster-summary-card"]')
  ).find(element => !element.closest('[data-slot="wiki-participation-directory"]'));
  expect(standaloneSummary).toBeUndefined();

  const firstGridItem = directory?.querySelector('.civic-load-card-reveal');
  expect(firstGridItem?.contains(summary)).toBe(true);

  return summary as HTMLElement;
}

function expectOnlyNonSignedUpMetric(summary: HTMLElement, value: string) {
  expect(within(summary).getByText('Non signed-up users')).toBeTruthy();
  expect(within(summary).getByText(value)).toBeTruthy();
  expect(within(summary).queryByText('Total roster')).toBeNull();
  expect(within(summary).queryByText('Signed-up users')).toBeNull();
}

describe('wiki roster offline summary integration', () => {
  it('shows offline group members as a count while rendering signed-up member cards', () => {
    const { container } = render(
      <GroupWikiContentView
        groupId="group-1"
        group={{
          name: 'Open Assembly',
          visibility: 'public',
          roles: [],
          memberships: [
            {
              id: 'membership-1',
              status: 'member',
              user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
            },
            {
              id: 'membership-2',
              status: 'active',
              user: { id: 'user-2', first_name: 'Grace', last_name: 'Hopper', handle: 'grace' },
            },
            {
              id: 'membership-3',
              status: 'invited',
              user: { id: 'user-3', first_name: 'Pending', last_name: 'Invite' },
            },
          ],
          offline_memberships: [
            {
              offline_member: {
                first_name: 'Offline Guest',
                reason_not_signed_up: 'No email address',
              },
            },
          ],
        }}
        groupLocation=""
        groupDescription=""
        memberCount={4}
        subscriberCount={0}
        eventsCount={0}
        amendmentsCount={0}
        isSubscribed={false}
        subscribeLoading={false}
        toggleSubscribe={vi.fn()}
        status={null}
        isMember={false}
        hasRequested={false}
        isInvited={false}
        isBase={false}
        isHierarchical={false}
        isSibling={false}
        membershipLoading={false}
        requestJoinActionDisabled={false}
        acceptInvitationDisabled={false}
        requestJoinConflictResponse={null}
        acceptInvitationConflictResponse={null}
        requestJoin={vi.fn()}
        leaveGroup={vi.fn()}
        acceptInvitation={vi.fn()}
        parentGroups={[]}
        childGroups={[]}
        siblingGroups={[]}
        connectedGroup={null}
        primarySiblingMembershipMode={null}
        parliamentSourceGroups={[]}
      />
    );

    const summary = getDirectorySummary(container);
    expectOnlyNonSignedUpMetric(summary, '2');
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.queryByText('Pending Invite')).toBeNull();
    expect(screen.queryByText('Offline Guest')).toBeNull();
    expect(screen.queryByText('No email address')).toBeNull();
  });

  it('shows offline event participants as a count while rendering signed-up participant cards', () => {
    const participation = {
      participantCount: 4,
      status: null,
      isParticipant: false,
      hasRequested: false,
      isInvited: false,
      requestParticipation: vi.fn(),
      leaveEvent: vi.fn(),
      acceptInvitation: vi.fn(),
      isLoading: false,
    };

    const { container } = render(
      <EventWikiContentView
        agendaStats={null}
        amendmentsCount={0}
        canAccess
        confirmDialogOpen={false}
        elections={[]}
        electionsCount={0}
        electionsDialogOpen={false}
        event={{
          title: 'Civic Night',
          visibility: 'public',
          event_type: null,
          recurrence_pattern: null,
          creator: null,
          group: null,
          roles: [],
          participants: [
            {
              id: 'participant-1',
              status: 'confirmed',
              user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
            },
            {
              id: 'participant-2',
              status: 'active',
              user: { id: 'user-2', first_name: 'Grace', last_name: 'Hopper', handle: 'grace' },
            },
            {
              id: 'participant-3',
              status: 'requested',
              user: { id: 'user-3', first_name: 'Request', last_name: 'Pending' },
            },
          ],
          offline_participants: [
            {
              first_name: 'Offline Participant',
              reason_not_signed_up: 'No account yet',
            },
          ],
          participant_count: 4,
          event_hashtags: [],
          description: '',
          registration_deadline: null,
          amendment_deadline: null,
          candidacy_deadline: null,
          start_date: null,
          end_date: null,
        }}
        eventDescription=""
        eventId="event-1"
        formattedLocation=""
        getUserCandidacy={() => null}
        handleConfirmCandidacy={vi.fn()}
        handleElectionClick={vi.fn()}
        isAssemblyEventType={false}
        isSubmitting={false}
        isSubscribed={false}
        openChangeRequestsCount={0}
        participation={participation}
        participationDisabledReason={undefined}
        selectedElection={null}
        setConfirmDialogOpen={vi.fn()}
        setElectionsDialogOpen={vi.fn()}
        shouldDisableParticipationRequest={false}
        subscribeLoading={false}
        subscriberCount={0}
        t={(key: string, fallback?: string) => fallback ?? key}
        toggleSubscribe={vi.fn()}
        user={null}
      />
    );

    const summary = getDirectorySummary(container);
    expectOnlyNonSignedUpMetric(summary, '2');
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.queryByText('Request Pending')).toBeNull();
    expect(screen.queryByText('Offline Participant')).toBeNull();
    expect(screen.queryByText('No account yet')).toBeNull();
  });
});
