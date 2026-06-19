/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GroupOpenAssignment } from '@/features/groups/logic/openAssignments';
import { OpenAssignmentsPanel } from '../OpenAssignmentsPanel';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    search?: Record<string, string | number | undefined>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;
    const searchString = search
      ? new URLSearchParams(
          Object.entries(search)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)])
        ).toString()
      : '';

    return (
      <a href={searchString ? `${href}?${searchString}` : href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/timeline/ui/LazyCardComponents', () => ({
  DynamicTimelineCard: ({
    cardProps,
  }: {
    cardProps?: { event?: { title?: string | null }; onSelect?: () => void };
  }) => (
    <button type="button" data-testid="timeline-card" onClick={cardProps?.onSelect}>
      {cardProps?.event?.title ?? 'timeline-card'}
    </button>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));

vi.mock('react-i18next', () => {
  const translations: Record<string, string> = {
    'features.groups.memberships.openAssignments.titleWithCount': 'Open Assignments ({{count}})',
    'features.groups.memberships.openAssignments.description': 'Assignments',
    'features.groups.memberships.openAssignments.columns.assignment': 'Assignment',
    'features.groups.memberships.openAssignments.columns.type': 'Type',
    'features.groups.memberships.openAssignments.columns.status': 'Status',
    'features.groups.memberships.openAssignments.columns.amendment': 'Amendment',
    'features.groups.memberships.openAssignments.columns.events': 'Events',
    'features.groups.memberships.openAssignments.columns.action': 'Action',
    'features.groups.memberships.openAssignments.type.delegateElection': 'Delegate election',
    'features.groups.memberships.openAssignments.type.roleRenewal': 'Role renewal',
    'features.groups.memberships.openAssignments.status.open': 'Open',
    'features.groups.memberships.openAssignments.status.scheduled': 'Scheduled',
    'features.groups.memberships.openAssignments.noAmendment': 'No amendment',
    'features.groups.memberships.openAssignments.targetEventLabel': 'Target',
    'features.groups.memberships.openAssignments.linkedEventLabel': 'Linked',
    'features.groups.memberships.openAssignments.createEvent': 'Create event',
    'features.groups.memberships.openAssignments.noEligibleEventsForGroup':
      'There is currently no upcoming or ongoing event for {{groupName}}.',
    'features.groups.memberships.openAssignments.thisGroup': 'this group',
    'features.groups.memberships.openAssignments.completedBanner': 'Fully scheduled or completed',
    'features.groups.memberships.openAssignments.toScheduledElection': 'To scheduled election',
    'features.groups.memberships.openAssignments.searchDelegateElectionEvent':
      'Find event for delegate election',
    'features.groups.memberships.openAssignments.searchRoleRenewalEvent':
      'Find event for role election',
    'features.groups.memberships.openAssignments.roleRenewalHelp':
      'Choose an upcoming or ongoing event where this role election should be created.',
    'features.groups.memberships.openAssignments.seatCount': 'Seats',
    'features.groups.memberships.openAssignments.completedSeatCount': 'Elected',
    'features.groups.memberships.openAssignments.scheduledSeatCount': 'Scheduled',
    'features.groups.memberships.openAssignments.openSeatCount': 'Open',
    'features.groups.memberships.openAssignments.delegateDescription.hasCurrently': 'currently has',
    'features.groups.memberships.openAssignments.delegateDescription.seatPlural': 'delegate seats',
    'features.groups.memberships.openAssignments.delegateDescription.seatSingular': 'delegate seat',
    'features.groups.memberships.openAssignments.delegateDescription.for': 'for',
    'features.groups.memberships.openAssignments.delegateElectionHelpBeforeGroup':
      'Create the delegate election for',
    'features.groups.memberships.openAssignments.delegateElectionHelpAfterGroup': 'before target.',
    'features.groups.memberships.openAssignments.delegateDialog.title': 'Delegate election event',
    'features.groups.memberships.openAssignments.delegateDialog.description':
      'Choose an upcoming or ongoing event for {{groupName}} where the delegate election should be created.',
    'features.groups.memberships.openAssignments.delegateDialog.remainingSeats':
      '{{count}} delegates to elect',
    'features.groups.memberships.openAssignments.delegateDialog.targetEvent': 'Target event',
    'features.groups.memberships.openAssignments.delegateDialog.searchLabel': 'Search',
    'features.groups.memberships.openAssignments.delegateDialog.searchPlaceholder': 'Search events',
    'features.groups.memberships.openAssignments.delegateDialog.emptySearch': 'No events found',
    'features.groups.memberships.openAssignments.delegateDialog.cancel': 'Cancel',
    'features.groups.memberships.openAssignments.delegateDialog.create': 'Create election',
    'features.groups.memberships.openAssignments.roleRenewalDialog.title': 'Role election event',
    'features.groups.memberships.openAssignments.roleRenewalDialog.description':
      'Choose an upcoming or ongoing event where this role election should be created.',
    'features.groups.memberships.openAssignments.roleRenewalDialog.searchLabel': 'Search',
    'features.groups.memberships.openAssignments.roleRenewalDialog.searchPlaceholder':
      'Search events',
    'features.groups.memberships.openAssignments.roleRenewalDialog.emptySearch': 'No events found',
    'features.groups.memberships.openAssignments.roleRenewalDialog.cancel': 'Cancel',
    'features.groups.memberships.openAssignments.roleRenewalDialog.create': 'Create election',
    'features.delegates.ratio.oneMember': '1 delegate per 1 member',
  };

  return {
    useTranslation: () => ({
      i18n: { language: 'en' },
      t: (key: string, params?: Record<string, string | number>) => {
        const template = translations[key] ?? key;

        return template.replace(/\{\{(\w+)\}\}/g, (_, paramKey: string) =>
          params?.[paramKey] === undefined ? `{{${paramKey}}}` : String(params[paramKey])
        );
      },
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('OpenAssignmentsPanel', () => {
  it('renders delegate assignment event and group links as native anchors with scheduled election CTA', () => {
    const assignment: GroupOpenAssignment = {
      id: 'delegate:allocation-1',
      kind: 'delegate_election',
      status: 'scheduled',
      title: 'Delegiertenwahl fuer Delegate assembly',
      description: 'B1 hat aktuell 3 Delegiertensitze fuer H2.',
      seatCount: 3,
      scheduledSeatCount: 3,
      completedSeatCount: 0,
      remainingSeatCount: 0,
      sourceGroup: { id: 'source-group', name: 'B1' },
      targetGroup: { id: 'target-group', name: 'H2' },
      targetEvent: {
        id: 'target-event',
        title: 'Delegate assembly',
        event_type: 'delegate_assembly',
        delegate_seat_allocation_type: 'members_per_delegate',
        main_group_delegate_allocation_mode: '1',
        delegate_election_mode: 'list',
        group: { id: 'target-group', name: 'H2' },
      },
      linkedEvent: {
        id: 'linked-event',
        title: 'E1H1',
        status: 'planned',
      },
    };

    render(
      <OpenAssignmentsPanel
        groupId="source-group"
        groupName="B1"
        assignments={[assignment]}
        availableEvents={[]}
        onScheduleRoleRenewal={vi.fn()}
        onScheduleDelegateElection={vi.fn()}
        onScheduleProcessTask={vi.fn()}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Target: Delegate assembly' }).getAttribute('href')
    ).toBe('/event/target-event');
    expect(screen.getByRole('link', { name: 'Linked: E1H1' }).getAttribute('href')).toBe(
      '/event/linked-event'
    );
    expect(screen.getByRole('link', { name: 'B1' }).getAttribute('href')).toBe(
      '/group/source-group'
    );
    expect(screen.getByRole('link', { name: 'H2' }).getAttribute('href')).toBe(
      '/group/target-group'
    );
    expect(screen.getByRole('link', { name: 'To scheduled election' }).getAttribute('href')).toBe(
      '/event/linked-event'
    );
  });

  it('passes the delegate scheduling window to the create-event link', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 19, 10, 30, 20));

    const assignment: GroupOpenAssignment = {
      id: 'delegate:allocation-1',
      kind: 'delegate_election',
      status: 'open',
      title: 'Delegate election for Target assembly',
      description: 'B1 has 3 delegate seats for H2.',
      seatCount: 3,
      scheduledSeatCount: 0,
      completedSeatCount: 0,
      remainingSeatCount: 3,
      sourceGroup: { id: 'source-group', name: 'B1' },
      targetGroup: { id: 'target-group', name: 'H2' },
      targetEvent: {
        id: 'target-event',
        title: 'Target assembly',
        start_date: new Date(2026, 5, 20, 12, 0, 0).getTime(),
        event_type: 'delegate_assembly',
        delegate_election_mode: 'list',
        group: { id: 'target-group', name: 'H2' },
      },
      linkedEvent: null,
    };

    render(
      <OpenAssignmentsPanel
        groupId="source-group"
        groupName="B1"
        assignments={[assignment]}
        availableEvents={[]}
        onScheduleRoleRenewal={vi.fn()}
        onScheduleDelegateElection={vi.fn()}
        onScheduleProcessTask={vi.fn()}
      />
    );

    const createEventHref = screen.getByRole('link', { name: 'Create event' }).getAttribute('href');
    const createEventUrl = new URL(createEventHref ?? '', 'https://polity.test');

    expect(createEventUrl.pathname).toBe('/create/event');
    expect(createEventUrl.searchParams.get('groupId')).toBe('source-group');
    expect(createEventUrl.searchParams.get('minStartDate')).toBe('2026-06-19');
    expect(createEventUrl.searchParams.get('minStartTime')).toBe('10:31');
    expect(createEventUrl.searchParams.get('maxStartDate')).toBe('2026-06-20');
    expect(createEventUrl.searchParams.get('maxStartTime')).toBe('11:59');
    expect(createEventUrl.searchParams.get('returnTo')).toBe(
      '/group/source-group/memberships?tab=openAssignments'
    );
  });

  it('focuses role-renewal assignments and returns event creation to the same assignment', () => {
    const assignment: GroupOpenAssignment = {
      id: 'role:chairperson',
      kind: 'role_renewal',
      status: 'open',
      title: 'Role renewal for Chairperson',
      description: 'This role needs a new election once a suitable event is planned.',
      roleId: 'chairperson',
      linkedEvent: null,
    };

    render(
      <OpenAssignmentsPanel
        groupId="source-group"
        groupName="B1"
        assignments={[assignment]}
        availableEvents={[]}
        focusAssignmentId="role:chairperson"
        onScheduleRoleRenewal={vi.fn()}
        onScheduleDelegateElection={vi.fn()}
        onScheduleProcessTask={vi.fn()}
      />
    );

    expect(screen.getByTestId('open-assignment-role:chairperson').className).toContain(
      'ring-inset'
    );

    const createEventHref = screen.getByRole('link', { name: 'Create event' }).getAttribute('href');
    const createEventUrl = new URL(createEventHref ?? '', 'https://polity.test');

    expect(createEventUrl.pathname).toBe('/create/event');
    expect(createEventUrl.searchParams.get('groupId')).toBe('source-group');
    expect(createEventUrl.searchParams.get('returnTo')).toBe(
      '/group/source-group/memberships?tab=openAssignments&assignmentId=role:chairperson'
    );
  });

  it('opens the shared event dialog for role-renewal assignments and schedules via callback', () => {
    const assignment: GroupOpenAssignment = {
      id: 'role:chairperson',
      kind: 'role_renewal',
      status: 'open',
      title: 'Role renewal for Chairperson',
      description: 'This role needs a new election once a suitable event is planned.',
      roleId: 'chairperson',
      linkedEvent: null,
    };
    const onScheduleRoleRenewal = vi.fn().mockResolvedValue(undefined);

    render(
      <OpenAssignmentsPanel
        groupId="source-group"
        groupName="B1"
        assignments={[assignment]}
        availableEvents={[
          {
            id: 'event-1',
            title: 'Local assembly',
            status: 'planned',
          },
        ]}
        onScheduleRoleRenewal={onScheduleRoleRenewal}
        onScheduleDelegateElection={vi.fn()}
        onScheduleProcessTask={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Find event for role election' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Attach to event' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Find event for role election' }));

    expect(screen.getByText('Role election event')).toBeTruthy();
    expect(screen.getByText('Local assembly')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Create election' }));

    expect(onScheduleRoleRenewal).toHaveBeenCalledWith(assignment, 'event-1');
  });

  it('filters delegate dialog events to the same window before the target event', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 19, 10, 30, 20));

    const assignment: GroupOpenAssignment = {
      id: 'delegate:allocation-1',
      kind: 'delegate_election',
      status: 'open',
      title: 'Delegate election for Target assembly',
      description: 'B1 has 3 delegate seats for H2.',
      seatCount: 3,
      scheduledSeatCount: 0,
      completedSeatCount: 0,
      remainingSeatCount: 3,
      sourceGroup: { id: 'source-group', name: 'B1' },
      targetGroup: { id: 'target-group', name: 'H2' },
      targetEvent: {
        id: 'target-event',
        title: 'Target assembly',
        start_date: new Date(2026, 5, 20, 12, 0, 0).getTime(),
        event_type: 'delegate_assembly',
        delegate_election_mode: 'list',
        group: { id: 'target-group', name: 'H2' },
      },
      linkedEvent: null,
    };

    render(
      <OpenAssignmentsPanel
        groupId="source-group"
        groupName="B1"
        assignments={[assignment]}
        availableEvents={[
          {
            id: 'too-early',
            title: 'Too Early',
            start_date: new Date(2026, 5, 19, 10, 30, 0).getTime(),
          },
          {
            id: 'valid-election-event',
            title: 'Valid Local Election',
            start_date: new Date(2026, 5, 20, 11, 0, 0).getTime(),
          },
          {
            id: 'target-time',
            title: 'At Target Time',
            start_date: new Date(2026, 5, 20, 12, 0, 0).getTime(),
          },
          {
            id: 'too-late',
            title: 'Too Late',
            start_date: new Date(2026, 5, 20, 12, 30, 0).getTime(),
          },
        ]}
        onScheduleRoleRenewal={vi.fn()}
        onScheduleDelegateElection={vi.fn()}
        onScheduleProcessTask={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Find event for delegate election' }));

    expect(screen.getByText('Valid Local Election')).toBeTruthy();
    expect(screen.queryByText('Too Early')).toBeNull();
    expect(screen.queryByText('At Target Time')).toBeNull();
    expect(screen.queryByText('Too Late')).toBeNull();
  });
});
