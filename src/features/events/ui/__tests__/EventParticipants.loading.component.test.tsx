/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventParticipants, EventParticipantsView } from '../EventParticipants';

const mocks = vi.hoisted(() => ({
  useEventData: vi.fn(),
  useEventParticipants: vi.fn(),
  useEventMutations: vi.fn(),
  useEventAccessRoles: vi.fn(),
  useEventOfflineParticipants: vi.fn(),
  useEventParticipantsComposition: vi.fn(),
  useEventActions: vi.fn(),
  authUser: { id: 'user-1' } as null | { id: string },
  membershipSearch: {
    activeMembers: [] as any[],
    pendingRequests: [] as any[],
    pendingInvitations: [] as any[],
  },
  offlineModel: { activeRows: [] as any[], offlineRows: [] as any[] },
  componentProps: {} as Record<string, any>,
  inviteProps: [] as any[],
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  navigate: vi.fn(),
  inviteParticipants: vi.fn(),
  approveParticipation: vi.fn(),
  rejectParticipation: vi.fn(),
  removeParticipant: vi.fn(),
  changeParticipantRoles: vi.fn(),
  createOfflineParticipant: vi.fn(),
  updateOfflineParticipant: vi.fn(),
  deleteOfflineParticipant: vi.fn(),
  importOfflineParticipants: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.waitForClientApply(value),
}));

vi.mock('@/features/groups/hooks/useMembershipSearch', () => ({
  useMembershipSearch: () => mocks.membershipSearch,
}));

vi.mock('@/features/groups/logic/buildMembershipRightsSummary', () => ({
  getMembershipDisplayRoles: (participant: any) =>
    participant.displayRoles ?? participant.roles ?? (participant.role ? [participant.role] : []),
}));

vi.mock('@/features/shared/ui/participation', () => ({
  filterParticipationsByRole: (participants: any[], roleIds: string[]) =>
    roleIds.length === 0
      ? participants
      : participants.filter(participant =>
          (participant.roles ?? []).some((role: any) => roleIds.includes(role.id))
        ),
  ParticipationRoleFilterBar: (props: any) => {
    mocks.componentProps.roleFilter = props;
    return (
      <button onClick={() => props.onSelectedRoleIdsChange(['guest-role'])}>role-filter</button>
    );
  },
}));

vi.mock('../../logic/offlineParticipantRows', () => ({
  buildOfflineRosterRowsForEvent: () => mocks.offlineModel,
}));
vi.mock('../../logic/eventParticipantComposition', () => ({
  buildEventParticipantCompositionBuckets: (rows: any[]) => {
    mocks.componentProps.compositionRows = rows;
    return [{ key: 'bucket', label: 'Bucket', memberCount: rows.length }];
  },
}));

vi.mock('@/features/shared/ui/form', () => ({
  SettingsPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  ManagementToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: (props: any) => {
    mocks.componentProps.search = props;
    return <button onClick={() => props.onSearchQueryChange('offline')}>search</button>;
  },
}));

vi.mock('@/features/groups/ui/MembershipTabs', () => ({
  MembershipTabs: (props: any) => {
    mocks.componentProps.tabs = props;
    return (
      <div>
        <button onClick={() => props.onTabChange('guests')}>tab-guests</button>
        <button onClick={() => props.onTabChange('roles')}>tab-roles</button>
        <button onClick={() => props.onTabChange('composition')}>tab-composition</button>
        <button onClick={() => props.onTabChange('membershipsByUser')}>tab-users</button>
        {props.tabBarAction}
        {props.membershipsByUserContent}
        {props.membershipsByRoleContent}
        {props.compositionContent}
        {props.guestsContent}
        {props.rolesContent}
      </div>
    );
  },
}));

vi.mock('@/features/groups/ui/PendingRequestsTable', () => ({
  PendingRequestsTable: (props: any) => {
    mocks.componentProps.pendingRequests = props;
    return <div data-testid="pendingRequests" />;
  },
}));
vi.mock('@/features/groups/ui/PendingInvitationsTable', () => ({
  PendingInvitationsTable: (props: any) => {
    mocks.componentProps.pendingInvitations = props;
    return <div data-testid="pendingInvitations" />;
  },
}));
vi.mock('@/features/groups/ui/ActiveMembersTable', () => ({
  ActiveMembersTable: (props: any) => {
    mocks.componentProps.activeMembers = props;
    return <div data-testid="activeMembers" />;
  },
}));
vi.mock('@/features/groups/ui/MembershipsByRoleTables', () => ({
  MembershipsByRoleTables: (props: any) => {
    mocks.componentProps.byRole = props;
    return <div data-testid="byRole" />;
  },
}));
vi.mock('@/features/groups/ui/GuestsTable', () => ({
  GuestsTable: (props: any) => {
    mocks.componentProps.guests = props;
    return <div data-testid="guests" />;
  },
}));

vi.mock('@/features/groups/ui/InviteMembersDialog', () => ({
  InviteMembersDialog: (props: any) => {
    mocks.inviteProps.push(props);
    return <div data-testid="invite-dialog">invite</div>;
  },
}));
vi.mock('@/features/groups/ui/ChangeRoleDialog', () => ({
  ChangeRoleDialog: (props: any) => {
    mocks.componentProps.changeRole = props;
    return <div data-testid="change-role">change role</div>;
  },
}));
vi.mock('@/features/groups/ui/MemberRightsDialog', () => ({
  MemberRightsDialog: (props: any) => {
    mocks.componentProps.memberRights = props;
    return <div data-testid="member-rights">rights</div>;
  },
}));
vi.mock('@/features/offline-roster/ui/OfflineRosterCard', () => ({
  OfflineRosterCard: (props: any) => {
    mocks.componentProps.offlineRoster = props;
    return <div data-testid="offline-roster">offline roster</div>;
  },
}));
vi.mock('@/features/groups/ui/MembershipCompositionPanel', () => ({
  MembershipCompositionPanel: (props: any) => {
    mocks.componentProps.composition = props;
    return <div data-testid="composition">composition</div>;
  },
}));
vi.mock('../DelegateAssemblyCompositionPanel', () => ({
  DelegateAssemblyCompositionPanel: () => <div data-testid="delegate-composition" />,
}));
vi.mock('@/features/roles/ui/EventRoles', () => ({ EventRoles: () => <div>event roles</div> }));

vi.mock('@/zero/queries', () => ({
  queries: {
    events: {
      participantPage: vi.fn(args => ({ kind: 'page', args })),
      participantById: vi.fn(args => ({ kind: 'single', args })),
    },
  },
}));

vi.mock('../../hooks/useEventData', () => ({
  useEventData: (...args: unknown[]) => mocks.useEventData(...args),
  useEventParticipants: (...args: unknown[]) => mocks.useEventParticipants(...args),
}));

vi.mock('../../hooks/useEventMutations', () => ({
  useEventMutations: (...args: unknown[]) => mocks.useEventMutations(...args),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventAccessRoles: (...args: unknown[]) => mocks.useEventAccessRoles(...args),
  useEventOfflineParticipants: (...args: unknown[]) => mocks.useEventOfflineParticipants(...args),
}));

vi.mock('../../hooks/useDelegateAssemblyParticipantsComposition', () => ({
  useEventParticipantsComposition: (...args: unknown[]) =>
    mocks.useEventParticipantsComposition(...args),
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: (...args: unknown[]) => mocks.useEventActions(...args),
}));

beforeEach(() => {
  mocks.useEventData.mockReturnValue({ event: null, isLoading: true, error: null });
  mocks.useEventParticipants.mockReturnValue({ participants: [] });
  mocks.useEventAccessRoles.mockReturnValue({ roles: [] });
  mocks.useEventOfflineParticipants.mockReturnValue({ offlineParticipants: [] });
  mocks.useEventParticipantsComposition.mockReturnValue({
    showComposition: false,
    participantsWithProvenance: [],
    isLoading: false,
    isDelegateAssembly: false,
  });
  mocks.useEventMutations.mockReturnValue({
    inviteParticipants: mocks.inviteParticipants,
    approveParticipation: mocks.approveParticipation,
    rejectParticipation: mocks.rejectParticipation,
    removeParticipant: mocks.removeParticipant,
    changeParticipantRoles: mocks.changeParticipantRoles,
  });
  mocks.useEventActions.mockReturnValue({
    createOfflineParticipant: mocks.createOfflineParticipant,
    updateOfflineParticipant: mocks.updateOfflineParticipant,
    deleteOfflineParticipant: mocks.deleteOfflineParticipant,
    importOfflineParticipants: mocks.importOfflineParticipants,
  });
  mocks.authUser = { id: 'user-1' };
  mocks.membershipSearch = { activeMembers: [], pendingRequests: [], pendingInvitations: [] };
  mocks.offlineModel = { activeRows: [], offlineRows: [] };
  mocks.componentProps = {};
  mocks.inviteProps = [];
  mocks.waitForClientApply.mockClear();
  for (const operation of [
    mocks.inviteParticipants,
    mocks.approveParticipation,
    mocks.rejectParticipation,
    mocks.removeParticipant,
    mocks.changeParticipantRoles,
    mocks.createOfflineParticipant,
    mocks.updateOfflineParticipant,
    mocks.deleteOfflineParticipant,
    mocks.importOfflineParticipants,
  ]) {
    operation.mockReset().mockResolvedValue(undefined);
  }
  mocks.navigate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EventParticipants loading state', () => {
  it('renders a page skeleton instead of loading text', () => {
    render(<EventParticipants eventId="event-1" />);

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(
      screen.queryByText('generated.inline.0491_loading_event_participants_4216bb13')
    ).toBeNull();
  });

  it('renders error and missing-event states', () => {
    mocks.useEventData.mockReturnValue({ event: null, isLoading: false, error: new Error('bad') });
    const failed = render(<EventParticipants eventId="event-1" />);
    expect(screen.getByText('generated.inline.0492_event_not_found_0f7c1f48')).toBeTruthy();
    failed.unmount();

    mocks.useEventData.mockReturnValue({ event: null, isLoading: false, error: null });
    render(<EventParticipants eventId="event-1" />);
    expect(screen.getByText('generated.inline.0492_event_not_found_0f7c1f48')).toBeTruthy();
  });

  it('renders the exported view toolbar for secondary-only content and hides an empty toolbar', () => {
    const { rerender } = render(
      <EventParticipantsView
        title="Title"
        subtitle="Subtitle"
        showSearch={false}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        searchPlaceholder="Search"
        secondaryFilterContent={<span>Secondary only</span>}
      >
        Content
      </EventParticipantsView>
    );
    expect(screen.getByText('Secondary only')).toBeTruthy();
    expect(screen.queryByText('search')).toBeNull();
    rerender(
      <EventParticipantsView
        title="Title"
        subtitle="Subtitle"
        showSearch={false}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        searchPlaceholder="Search"
      >
        Content
      </EventParticipantsView>
    );
    expect(screen.queryByText('Secondary only')).toBeNull();
  });

  it('runs the complete participant, guest, virtual-list, dialog, and offline-roster contracts', async () => {
    const roles = [
      { id: 'member-role', name: 'Member', assignee_kind: 'member' },
      { id: 'guest-role', name: 'Guest', assignee_kind: 'guest' },
      { id: '', name: 'No id', assignee_kind: 'guest' },
    ];
    const active = {
      id: 'active-1',
      created_at: 1,
      status: 'active',
      user_id: 'active-user',
      user: { id: 'active-user', first_name: 'Ada', last_name: 'Active', email: 'ada@test' },
      roles: [roles[0]],
      partGroup: null,
      baseGroup: null,
    };
    const requestedGuest = {
      id: 'guest-requested',
      status: 'requested',
      user: { id: 'guest-1', first_name: null, last_name: null },
      roles: [roles[1]],
      partGroup: undefined,
      baseGroup: undefined,
      provenanceBucketLabel: undefined,
    };
    const activeGuest = {
      id: 'guest-active',
      status: 'active',
      user: null,
      role: roles[1],
      roles: undefined,
    };
    const allParticipants = [active, requestedGuest, activeGuest] as any[];
    mocks.useEventData.mockReturnValue({
      event: {
        id: 'event-1',
        title: null,
        event_type: 'open',
        attendance_mode: null,
        location_type: 'physical',
        group: { id: 'base-group', name: null, group_type: 'base' },
        delegates: [],
      },
      isLoading: false,
      error: null,
    });
    mocks.useEventParticipants.mockReturnValue({ participants: allParticipants });
    mocks.useEventAccessRoles.mockReturnValue({ roles });
    mocks.useEventOfflineParticipants.mockReturnValue({
      offlineParticipants: [{ connected_user_id: 'connected-user' }, { connected_user_id: null }],
    });
    mocks.useEventParticipantsComposition.mockReturnValue({
      showComposition: true,
      participantsWithProvenance: [
        active,
        { ...active, id: 'member', status: 'member', user_id: null, user: { id: 'member-user' } },
        { ...active, id: 'admin', status: 'admin', user: null, user_id: null },
        { ...active, id: 'confirmed', status: 'confirmed', user: { id: 'connected-user' } },
        { ...active, id: 'inactive', status: 'inactive' },
        requestedGuest,
        activeGuest,
      ],
      isLoading: false,
      isDelegateAssembly: false,
    });
    mocks.membershipSearch = {
      activeMembers: [active],
      pendingRequests: [requestedGuest],
      pendingInvitations: [{ ...requestedGuest, id: 'invited', status: 'invited' }],
    };
    const activeRosterRow = {
      id: 'active:active-1',
      kind: 'active',
      attendanceParticipantId: null,
      firstName: 'Ada',
      lastName: 'Active',
      user: active.user,
    };
    const offlineRow = {
      id: 'offline-1',
      kind: 'offline',
      attendanceParticipantId: 'offline-1',
      firstName: 'Offline',
      lastName: 'Person',
      reasonNotSignedUp: 'No account',
      connectedUser: {
        id: 'offline-user',
        first_name: null,
        last_name: 'Connected',
        handle: 'offline-handle',
        avatar: null,
        email: null,
      },
      roles: null,
      partGroup: { id: 'part', name: null },
      baseGroup: { id: 'base', name: 'Base' },
    };
    const sparseOfflineRow = {
      ...offlineRow,
      id: 'offline-sparse',
      attendanceParticipantId: null,
      connectedUser: null,
      roles: [],
      partGroup: null,
      baseGroup: { id: 'base-fallback', name: null },
    };
    const namedOfflineRow = {
      ...offlineRow,
      id: 'offline-named',
      connectedUser: {
        ...offlineRow.connectedUser,
        id: undefined,
        first_name: 'Connected First',
        last_name: null,
        handle: null,
      },
      partGroup: { id: 'named-part', name: 'Named Part' },
      baseGroup: null,
    };
    mocks.offlineModel = {
      activeRows: [activeRosterRow],
      offlineRows: [offlineRow, sparseOfflineRow, namedOfflineRow],
    };

    const onTabChange = vi.fn();
    const { rerender, container } = render(
      <EventParticipants eventId="event-1" onTabChange={onTabChange} />
    );
    expect(screen.getByTestId('offline-roster')).toBeTruthy();
    expect(mocks.componentProps.compositionRows).toHaveLength(8);
    expect(mocks.componentProps.activeMembers.showPartGroupColumn).toBe(true);

    const sourceSet = mocks.componentProps.activeMembers.virtualSource;
    for (const source of [
      mocks.componentProps.pendingRequests.virtualSource,
      mocks.componentProps.pendingInvitations.virtualSource,
      sourceSet,
      mocks.componentProps.byRole.getVirtualSource('member-role'),
      mocks.componentProps.guests.virtualSource,
    ]) {
      expect(
        source.getPageQuery({ limit: 2, start: null, dir: 'forward', settled: false }).options.ttl
      ).toBe('none');
      expect(
        source.getPageQuery({ limit: 2, start: null, dir: 'forward', settled: true }).options.ttl
      ).toBe('5m');
      expect(source.getSingleQuery({ id: 'active-1', settled: false }).options.ttl).toBe('none');
      expect(source.getSingleQuery({ id: 'active-1', settled: true }).options.ttl).toBe('5m');
      expect(source.getRowKey({ id: 'row' })).toBe('row');
      expect(source.toStartRow({ id: 'row', created_at: 7 })).toEqual({ id: 'row', created_at: 7 });
      expect(source.mapRow({ id: 'missing' })).toEqual({ id: 'missing' });
    }
    expect(sourceSet.mapRow({ id: 'active-1' })).toEqual(
      expect.objectContaining({ id: 'active-1' })
    );

    await act(async () => {
      await mocks.componentProps.pendingRequests.onApprove('request', 'guest-1');
      await mocks.componentProps.pendingRequests.onReject('request', 'guest-1');
      await mocks.componentProps.pendingInvitations.onWithdraw('invited', 'guest-1');
      await mocks.componentProps.activeMembers.onRemove('active-1', 'active-user');
    });
    expect(mocks.approveParticipation).toHaveBeenCalled();
    expect(mocks.rejectParticipation).toHaveBeenCalledTimes(2);
    expect(mocks.removeParticipant).toHaveBeenCalled();

    act(() => mocks.componentProps.activeMembers.onSortChange('user'));
    act(() => mocks.componentProps.activeMembers.onSortChange('user'));
    act(() => mocks.componentProps.activeMembers.onSortChange('status'));
    expect(mocks.componentProps.activeMembers.sort.field).toBe('status');

    await act(async () => mocks.componentProps.changeRole.onConfirm(['member-role']));
    expect(mocks.changeParticipantRoles).not.toHaveBeenCalled();
    act(() => mocks.componentProps.activeMembers.onOpenChangeRoleDialog(active));
    expect(mocks.componentProps.changeRole.memberName).toBe('Ada Active');
    await act(async () => mocks.componentProps.changeRole.onConfirm(['guest-role']));
    expect(mocks.changeParticipantRoles).toHaveBeenCalledWith(
      'active-1',
      ['guest-role'],
      'active-user',
      'user-1',
      'Event'
    );
    await act(async () =>
      mocks.componentProps.byRole.onRemoveRole(
        { ...active, roles: [roles[0], roles[1]] },
        'member-role'
      )
    );
    act(() => mocks.componentProps.byRole.onOpenRightsDialog(active));
    expect(mocks.changeParticipantRoles).toHaveBeenLastCalledWith(
      'active-1',
      ['guest-role'],
      'active-user',
      'user-1',
      'Event'
    );
    act(() => mocks.componentProps.activeMembers.onOpenRightsDialog(active));
    act(() => mocks.componentProps.memberRights.onNavigateToUser('active-user'));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/user/$id',
      params: { id: 'active-user' },
    });

    const regularInvite = mocks.inviteProps.at(-1);
    await act(async () => regularInvite.onInvite());
    expect(mocks.inviteParticipants).not.toHaveBeenCalled();
    act(() => {
      regularInvite.onSelectedUsersChange(['new-user']);
      regularInvite.onSelectedRoleIdsChange(['member-role']);
    });
    await act(async () => mocks.inviteProps.at(-1).onInvite());
    expect(mocks.inviteParticipants).toHaveBeenCalledWith(
      ['new-user'],
      ['member-role'],
      'user-1',
      'Event'
    );

    fireEvent.click(screen.getByText('tab-guests'));
    expect(onTabChange).toHaveBeenCalledWith('guests');
    const guestInvite = mocks.inviteProps.at(-1);
    await act(async () => guestInvite.onInvite());
    act(() => {
      guestInvite.onSelectedUsersChange(['guest-user']);
      guestInvite.onSelectedRoleIdsChange(['guest-role']);
    });
    await act(async () => mocks.inviteProps.at(-1).onInvite());
    expect(mocks.inviteParticipants).toHaveBeenLastCalledWith(
      ['guest-user'],
      ['guest-role'],
      'user-1',
      'Event'
    );

    act(() => mocks.componentProps.guests.onApprove('missing'));
    act(() => mocks.componentProps.guests.onApprove('guest-requested'));
    act(() => mocks.componentProps.guests.onApprove('guest-active'));
    act(() => mocks.componentProps.guests.onRevoke('missing'));
    act(() => mocks.componentProps.guests.onRevoke('guest-requested'));
    act(() => mocks.componentProps.guests.onRevoke('guest-active'));
    expect(mocks.approveParticipation).toHaveBeenCalledWith(
      'guest-requested',
      'guest-1',
      'user-1',
      'Event'
    );
    expect(mocks.approveParticipation).toHaveBeenCalledWith(
      'guest-active',
      undefined,
      'user-1',
      'Event'
    );
    expect(mocks.rejectParticipation).toHaveBeenCalledWith(
      'guest-requested',
      'guest-1',
      'user-1',
      'Event'
    );
    expect(mocks.removeParticipant).toHaveBeenCalledWith(
      'guest-active',
      undefined,
      'user-1',
      'Event'
    );

    act(() =>
      mocks.componentProps.activeMembers.onOpenChangeRoleDialog({
        ...active,
        roles: null,
        role: roles[1],
        user: { id: 'unknown', first_name: '', last_name: '' },
      })
    );
    expect(mocks.componentProps.changeRole.memberName).toBe('Unknown User');
    expect(mocks.componentProps.changeRole.currentRoles).toEqual([roles[1]]);
    act(() =>
      mocks.componentProps.activeMembers.onOpenChangeRoleDialog({
        ...active,
        roles: null,
        role: null,
        user: null,
      })
    );
    expect(mocks.componentProps.changeRole.currentRoles).toEqual([]);

    fireEvent.click(screen.getByText('search'));
    expect(mocks.componentProps.search.searchQuery).toBe('offline');
    fireEvent.click(screen.getByText('role-filter'));
    expect(mocks.componentProps.activeMembers.members).toEqual([]);
    fireEvent.click(screen.getByText('tab-roles'));
    fireEvent.click(screen.getByText('tab-composition'));
    fireEvent.click(screen.getByText('tab-users'));

    const roster = mocks.componentProps.offlineRoster;
    await act(async () => {
      await roster.onCreate({ firstName: 'New', lastName: 'Offline', reasonNotSignedUp: '' }, 'c1');
      await roster.onCreate(
        { firstName: 'Why', lastName: 'Reason', reasonNotSignedUp: 'Because' },
        'c2'
      );
      await roster.onImport(
        [
          { firstName: 'One', lastName: 'A', reasonNotSignedUp: '' },
          { firstName: 'Two', lastName: 'B', reasonNotSignedUp: 'Reason' },
        ],
        'c3'
      );
      await roster.onConnect(offlineRow, 'active-user', 'c4');
      await roster.onEdit(
        offlineRow,
        { firstName: 'Edited', lastName: 'Name', reasonNotSignedUp: '' },
        'c5'
      );
      await roster.onEdit(
        offlineRow,
        { firstName: 'Edited', lastName: 'Name', reasonNotSignedUp: 'Why' },
        'c6'
      );
      await roster.onDelete(offlineRow, 'c7');
      await roster.onDelete({ ...offlineRow, attendanceParticipantId: null }, 'c8');
      await roster.onSetParticipationStatus(offlineRow, 'confirmed', 'c9');
      await roster.onSetParticipationStatus(
        { ...activeRosterRow, kind: 'offline' },
        'confirmed',
        'c10'
      );
      await roster.onSetParticipationStatus({ ...activeRosterRow, user: null }, 'confirmed', 'c11');
      await roster.onSetParticipationStatus(activeRosterRow, 'listed', 'c12');
      await roster.onSetParticipationStatus(activeRosterRow, 'confirmed', 'c13');
      await roster.onSetParticipationStatus(
        { ...activeRosterRow, firstName: '', lastName: '', user: { id: 'u2', email: 'mail@test' } },
        'confirmed',
        'c14'
      );
      await roster.onSetParticipationStatus(
        { ...activeRosterRow, firstName: '', lastName: '', user: { id: 'u3', email: '' } },
        'confirmed',
        'c15'
      );
      await roster.onToggleChannel(offlineRow, 'online', 'c16');
      await roster.onToggleChannel(
        { ...offlineRow, attendanceParticipantId: null },
        'offline',
        'c17'
      );
    });
    expect(mocks.createOfflineParticipant).toHaveBeenCalled();
    expect(mocks.updateOfflineParticipant).toHaveBeenCalled();
    expect(mocks.deleteOfflineParticipant).toHaveBeenCalled();
    expect(mocks.importOfflineParticipants).toHaveBeenCalled();

    rerender(
      <EventParticipants eventId="event-1" defaultTab="composition" onTabChange={onTabChange} />
    );
    expect(container.querySelector('[data-testid="composition"]')).toBeTruthy();

    const selectedInvite = mocks.inviteProps.at(-1);
    act(() => selectedInvite.onSelectedRoleIdsChange(['member-role']));
    mocks.useEventAccessRoles.mockReturnValue({ roles: [roles[1]] });
    rerender(<EventParticipants eventId="event-1" defaultTab="membershipsByUser" />);
    fireEvent.click(screen.getByText('tab-guests'));
    const selectedGuestInvite = mocks.inviteProps.at(-1);
    act(() => selectedGuestInvite.onSelectedRoleIdsChange(['missing-role']));
    mocks.useEventAccessRoles.mockReturnValue({ roles: [{ ...roles[1] }] });
    rerender(<EventParticipants eventId="event-1" defaultTab="guests" />);
    mocks.useEventAccessRoles.mockReturnValue({ roles: [] });
    rerender(<EventParticipants eventId="event-1" defaultTab="guests" />);
  });

  it('builds delegate representation, assembly-only roles, and online/create fallbacks', async () => {
    const guestRole = { id: 'guest-role', name: 'Guest', assignee_kind: 'guest' };
    const memberRole = { id: 'member-role', name: 'Member', assignee_kind: 'member' };
    const represented = {
      id: 'represented',
      status: 'active',
      user_id: null,
      user: { id: 'delegate-user', first_name: '', last_name: '' },
      roles: [guestRole],
    };
    mocks.useEventData.mockReturnValue({
      event: {
        id: 'event-1',
        title: 'Assembly',
        event_type: 'delegate_assembly',
        attendance_mode: 'online',
        location_type: 'physical',
        group: { id: 'group', name: 'Group', group_type: 'hierarchical' },
        delegates: [
          { status: 'pending', user_id: 'delegate-user', group_id: 'ignored' },
          { status: 'confirmed', user_id: null, group_id: 'ignored' },
          { status: 'confirmed', user_id: 'delegate-user', group_id: null, group: null },
          {
            status: 'confirmed',
            user_id: 'delegate-user',
            group_id: null,
            group: { id: 'z', name: null },
            seat_count: null,
          },
          {
            status: 'confirmed',
            user_id: 'delegate-user',
            group_id: 'a',
            group: { id: 'a', name: 'Alpha' },
            seat_count: 0,
          },
          {
            status: 'confirmed',
            user_id: 'delegate-user',
            group_id: 'a',
            group: { id: 'a', name: 'Alpha' },
            seat_count: 2,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    mocks.useEventParticipants.mockReturnValue({ participants: [represented] });
    mocks.useEventAccessRoles.mockReturnValue({ roles: [memberRole, guestRole] });
    mocks.useEventOfflineParticipants.mockReturnValue({ offlineParticipants: [] });
    mocks.useEventParticipantsComposition.mockReturnValue({
      showComposition: false,
      participantsWithProvenance: [
        represented,
        { ...represented, id: 'by-user-id', user_id: 'delegate-user', user: null },
        { ...represented, id: 'no-user', user_id: null, user: null },
        { ...represented, id: 'requested-null', status: 'requested', user_id: null, user: null },
      ],
      isLoading: true,
      isDelegateAssembly: true,
    });
    mocks.membershipSearch = {
      activeMembers: [
        represented,
        { ...represented, id: 'by-user-id', user_id: 'delegate-user', user: null },
        { ...represented, id: 'no-user', user_id: null, user: null },
      ],
      pendingRequests: [],
      pendingInvitations: [],
    };
    mocks.offlineModel = { activeRows: [], offlineRows: [] };
    const { rerender } = render(<EventParticipants eventId="event-1" />);
    expect(screen.queryByTestId('offline-roster')).toBeNull();
    expect(screen.getByTestId('delegate-composition')).toBeTruthy();
    expect(mocks.componentProps.activeMembers.members[0].delegateRepresentedGroups).toEqual([
      { id: 'a', name: 'Alpha', seatCount: 3 },
      { id: 'z', name: 'z', seatCount: 1 },
    ]);
    expect(mocks.inviteProps.at(-1).roles).toEqual([guestRole]);
    expect(mocks.inviteProps.at(-1).disabled).toBe(true);

    mocks.authUser = null;
    mocks.useEventData.mockReturnValue({
      event: {
        id: 'event-1',
        title: 'General',
        event_type: 'general_assembly',
        attendance_mode: 'hybrid',
        group: null,
        delegates: null,
      },
      isLoading: false,
      error: null,
    });
    rerender(<EventParticipants eventId="event-1" defaultTab="membershipsByUser" />);
    const invite = mocks.inviteProps.at(-1);
    act(() => invite.onSelectedUsersChange(['new-user']));
    await act(async () => mocks.inviteProps.at(-1).onInvite());
    expect(mocks.inviteParticipants).toHaveBeenLastCalledWith(
      ['new-user'],
      [],
      undefined,
      'General'
    );

    await act(async () => {
      await mocks.componentProps.pendingRequests.onApprove('request', 'guest');
      await mocks.componentProps.pendingRequests.onReject('request', 'guest');
      await mocks.componentProps.pendingInvitations.onWithdraw('invite', 'guest');
      await mocks.componentProps.activeMembers.onRemove('member', 'guest');
    });
    act(() => mocks.componentProps.activeMembers.onOpenChangeRoleDialog(represented));
    await act(async () => mocks.componentProps.changeRole.onConfirm(['guest-role']));
    await act(async () => mocks.componentProps.byRole.onRemoveRole(represented, 'guest-role'));
    fireEvent.click(screen.getByText('tab-guests'));
    const nullAuthGuestInvite = mocks.inviteProps.at(-1);
    act(() => nullAuthGuestInvite.onSelectedUsersChange(['guest-null-auth']));
    await act(async () => mocks.inviteProps.at(-1).onInvite());
    act(() => mocks.componentProps.guests.onApprove('represented'));
    act(() => mocks.componentProps.guests.onApprove('requested-null'));
    act(() => mocks.componentProps.guests.onRevoke('represented'));
    act(() => mocks.componentProps.guests.onRevoke('requested-null'));

    mocks.useEventData.mockReturnValue({
      event: {
        id: 'event-1',
        title: 'Location fallback',
        event_type: 'meeting',
        attendance_mode: null,
        location_type: 'online',
        group: null,
        delegates: [],
      },
      isLoading: false,
      error: null,
    });
    rerender(<EventParticipants eventId="event-1" />);
    expect(screen.queryByTestId('offline-roster')).toBeNull();
  });
});
