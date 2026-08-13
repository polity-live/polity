/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendment: undefined as undefined | { created_by_id?: string | null; title?: string | null },
  amendmentLoading: false,
  authUser: null as null | { id: string },
  blogEdit: vi.fn(),
  can: vi.fn(),
  changeRequests: vi.fn(),
  collaboratorsController: {
    canManageCollaborators: false,
    isLoading: false,
  } as Record<string, unknown>,
  collaboratorsInput: vi.fn(),
  collaboratorsView: vi.fn(),
  discussions: vi.fn(),
  eventEdit: vi.fn(),
  eventParticipants: vi.fn(),
  filterType: 'all',
  groupEdit: vi.fn(),
  isMember: vi.fn(),
  navigate: vi.fn(),
  params: { id: 'entity-1' },
  permissionsLoading: false,
  processFlow: vi.fn(),
  search: { branch: undefined, tab: undefined } as Record<string, any>,
  searchQuery: '',
  subscriptionsTable: vi.fn(),
  userEdit: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params,
    useSearch: () => mocks.search,
  }),
  useNavigate: () => mocks.navigate,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div>access-denied</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div>loading</div>,
}));
vi.mock('@/features/groups/ui/GroupEdit', () => ({
  GroupEdit: (props: Record<string, any>) => {
    mocks.groupEdit(props);
    return <button onClick={() => props.onTabChange('contact')}>group-edit</button>;
  },
}));
vi.mock('@/features/users/ui/UserEdit', () => ({
  UserEdit: (props: Record<string, any>) => {
    mocks.userEdit(props);
    return <button onClick={() => props.onTabChange('ai')}>user-edit</button>;
  },
}));
vi.mock('@/features/events/ui/EventEdit', () => ({
  EventEdit: (props: Record<string, any>) => {
    mocks.eventEdit(props);
    return <button onClick={() => props.onTabChange('time-series')}>event-edit</button>;
  },
}));
vi.mock('@/features/events/ui/EventParticipants', () => ({
  EventParticipants: (props: Record<string, any>) => {
    mocks.eventParticipants(props);
    return <div>participants</div>;
  },
}));
vi.mock('@/features/amendments/collaborators/hooks/useCollaboratorsPageController', () => ({
  useCollaboratorsPageController: (input: Record<string, unknown>) => {
    mocks.collaboratorsInput(input);
    return mocks.collaboratorsController;
  },
}));
vi.mock('@/features/amendments/collaborators/ui/CollaboratorsView', () => ({
  CollaboratorsView: (props: Record<string, unknown>) => {
    mocks.collaboratorsView(props);
    return <div>collaborators</div>;
  },
}));
vi.mock('@/features/change-requests/ui/ChangeRequestsPageContainer', () => ({
  ChangeRequestsPageContainer: (props: Record<string, unknown>) => {
    mocks.changeRequests(props);
    return <div>change-requests</div>;
  },
}));
vi.mock('@/features/amendments/ui/AmendmentProcessFlow', () => ({
  AmendmentProcessFlow: (props: Record<string, unknown>) => {
    mocks.processFlow(props);
    return <div>process-flow</div>;
  },
}));
vi.mock('@/features/discussions/ui/DiscussionsPageContainer', () => ({
  DiscussionsPageContainer: (props: Record<string, unknown>) => {
    mocks.discussions(props);
    return <div>discussions</div>;
  },
}));
vi.mock('@/features/payments/hooks/useUserSubscriptions', () => ({
  useUserSubscriptions: () => ({
    subscriptions: [],
    subscribers: [],
    unsubscribe: vi.fn(),
  }),
}));
vi.mock('@/features/payments/hooks/useSubscriptionsFilters', () => ({
  useSubscriptionsFilters: () => ({
    searchQuery: mocks.searchQuery,
    setSearchQuery: vi.fn(),
    filterType: mocks.filterType,
    setFilterType: vi.fn(),
    filteredSubscriptions: [],
    subscriptionCounts: {},
  }),
}));
vi.mock('@/features/payments/ui/SubscriptionTypeFilters', () => ({
  SubscriptionTypeFilters: () => <div>filters</div>,
}));
vi.mock('@/features/payments/ui/SubscriptionsTable', () => ({
  SubscriptionsTable: (props: Record<string, unknown>) => {
    mocks.subscriptionsTable(props);
    return <div>subscriptions</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/entity-search-bar', () => ({
  EntitySearchBar: () => <div>search</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/payments/logic/stripeRedirectSearch', async () => {
  const { z } = await import('zod');
  return { stripeRedirectSearchSchema: z.object({}) };
});
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    amendment: mocks.amendment,
    isLoading: mocks.amendmentLoading,
  }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: mocks.can, isLoading: mocks.permissionsLoading }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({
    can: mocks.can,
    isLoading: mocks.permissionsLoading,
    isMember: mocks.isMember,
  }),
}));

import { Route as CollaboratorsRoute } from '../_authed/amendment/$id/collaborators';
import { Route as ChangeRequestsRoute } from '../_authed/amendment/$id/change-requests';
import { Route as DiscussionsRoute } from '../_authed/amendment/$id/discussions';
import { Route as ProcessRoute } from '../_authed/amendment/$id/process';
import { Route as EventParticipantsRoute } from '../_authed/event/$id/participants';
import { Route as EventSettingsRoute } from '../_authed/event/$id/settings';
import { Route as GroupSettingsRoute } from '../_authed/group/$id/settings';
import { Route as UserSettingsRoute } from '../_authed/user/$id/settings';
import {
  getSubscriptionHref,
  Route as UserSubscriptionsRoute,
} from '../_authed/user/$id/subscriptions';

interface TestRoute {
  component: React.ComponentType;
}
const component = (route: unknown) => (route as TestRoute).component;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.amendment = undefined;
  mocks.amendmentLoading = false;
  mocks.authUser = { id: 'entity-1' };
  mocks.can.mockReturnValue(true);
  mocks.collaboratorsController = { canManageCollaborators: false, isLoading: false };
  mocks.filterType = 'all';
  mocks.isMember.mockReturnValue(true);
  mocks.navigate.mockResolvedValue(undefined);
  mocks.permissionsLoading = false;
  mocks.search = { branch: undefined, tab: undefined };
  mocks.searchQuery = '';
});

afterEach(() => cleanup());

describe('entity settings routes', () => {
  it('handles group loading and every permission combination', () => {
    const Component = component(GroupSettingsRoute);
    mocks.permissionsLoading = true;
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();

    mocks.permissionsLoading = false;
    mocks.isMember.mockReturnValue(false);
    mocks.can.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.isMember.mockReturnValue(true);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.can.mockImplementation((_action, resource) => resource === 'groupThemes');
    render(<Component />);
    expect(mocks.groupEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeTab: 'themes', canManageGroup: false })
    );
    cleanup();

    mocks.can.mockReturnValue(true);
    render(<Component />);
    expect(mocks.groupEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeTab: 'general', canManageGroup: true })
    );
    fireEvent.click(screen.getByRole('button', { name: 'group-edit' }));
    const updater = mocks.navigate.mock.calls.at(-1)?.[0].search;
    expect(updater({ keep: true })).toEqual({ keep: true, tab: 'contact' });
    cleanup();

    mocks.search = { tab: 'relationships' };
    render(<Component />);
    expect(mocks.groupEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeTab: 'relationships' })
    );
  });

  it('guards user settings and normalizes tab changes', () => {
    const Component = component(UserSettingsRoute);
    mocks.authUser = null;
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();
    mocks.authUser = { id: 'other' };
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();
    mocks.authUser = { id: 'entity-1' };
    render(<Component />);
    expect(mocks.userEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeTab: 'basic-info' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'user-edit' }));
    const updater = mocks.navigate.mock.calls.at(-1)?.[0].search;
    expect(updater({ keep: true })).toEqual({ keep: true, tab: 'ai' });
    cleanup();
    mocks.search = { tab: 'notifications' };
    render(<Component />);
    expect(mocks.userEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeTab: 'notifications' })
    );
  });

  it('handles event settings loading, denial and tab updates', () => {
    const Component = component(EventSettingsRoute);
    mocks.permissionsLoading = true;
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();
    mocks.permissionsLoading = false;
    mocks.can.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();
    mocks.can.mockReturnValue(true);
    render(<Component />);
    fireEvent.click(screen.getByRole('button', { name: 'event-edit' }));
    const updater = mocks.navigate.mock.calls.at(-1)?.[0].search;
    expect(updater({ keep: true })).toEqual({ keep: true, tab: 'time-series' });
  });
});

describe('participants and collaborators tab routes', () => {
  it('guards event participants and only accepts supported tabs', () => {
    const Component = component(EventParticipantsRoute);
    mocks.permissionsLoading = true;
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();
    mocks.permissionsLoading = false;
    mocks.can.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();
    mocks.can.mockReturnValue(true);
    render(<Component />);
    const onTabChange = mocks.eventParticipants.mock.calls.at(-1)?.[0].onTabChange;
    for (const tab of [
      'membershipsByUser',
      'membershipsByRole',
      'composition',
      'guests',
      'roles',
    ]) {
      onTabChange(tab);
    }
    const callsBeforeInvalid = mocks.navigate.mock.calls.length;
    onTabChange('invalid');
    expect(mocks.navigate).toHaveBeenCalledTimes(callsBeforeInvalid);
  });

  it('loads, authorizes and maps amendment collaborators', () => {
    const Component = component(CollaboratorsRoute);
    mocks.amendmentLoading = true;
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();
    mocks.amendmentLoading = false;
    mocks.collaboratorsController = { canManageCollaborators: false, isLoading: true };
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();
    mocks.collaboratorsController = { canManageCollaborators: false, isLoading: false };
    mocks.amendment = { created_by_id: 'other', title: null };
    mocks.authUser = null;
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.authUser = { id: 'entity-1' };
    mocks.amendment = { created_by_id: 'entity-1', title: 'Amendment' };
    mocks.search = { tab: 'roles' };
    render(<Component />);
    expect(mocks.collaboratorsInput).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentUserId: 'entity-1', initialTab: 'roles' })
    );
    expect(mocks.collaboratorsView).toHaveBeenLastCalledWith(
      expect.objectContaining({ amendmentTitle: 'Amendment' })
    );
    const onTabChange = mocks.collaboratorsInput.mock.calls.at(-1)?.[0].onTabChange;
    for (const tab of ['membershipsByUser', 'membershipsByRole', 'roles']) onTabChange(tab);
    const callsBeforeInvalid = mocks.navigate.mock.calls.length;
    onTabChange('invalid');
    expect(mocks.navigate).toHaveBeenCalledTimes(callsBeforeInvalid);
    cleanup();

    mocks.amendment = undefined;
    mocks.search = {};
    mocks.collaboratorsController = { canManageCollaborators: true, isLoading: false };
    render(<Component />);
    expect(mocks.collaboratorsInput).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialTab: 'membershipsByUser' })
    );
    expect(mocks.collaboratorsView).toHaveBeenLastCalledWith(
      expect.objectContaining({ amendmentTitle: '' })
    );
  });
});

describe('amendment navigation adapters', () => {
  it('maps auth and branch callbacks for change requests', () => {
    const Component = component(ChangeRequestsRoute);
    mocks.authUser = null;
    render(<Component />);
    expect(mocks.changeRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: '', requestedBranchId: undefined })
    );
    let onBranchChange = mocks.changeRequests.mock.calls.at(-1)?.[0].onBranchChange;
    onBranchChange(null, undefined);
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { branch: undefined }, replace: undefined })
    );
    cleanup();
    mocks.authUser = { id: 'user-1' };
    mocks.search = { branch: 'branch-1' };
    render(<Component />);
    onBranchChange = mocks.changeRequests.mock.calls.at(-1)?.[0].onBranchChange;
    onBranchChange('branch-2', { replace: true });
    expect(mocks.changeRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: 'user-1', requestedBranchId: 'branch-1' })
    );
  });

  it('maps optional branch callbacks for the process route', () => {
    const Component = component(ProcessRoute);
    render(<Component />);
    let onBranchChange = mocks.processFlow.mock.calls.at(-1)?.[0].onBranchChange;
    onBranchChange(null);
    cleanup();
    mocks.search = { branch: 'branch-1' };
    render(<Component />);
    onBranchChange = mocks.processFlow.mock.calls.at(-1)?.[0].onBranchChange;
    onBranchChange('branch-2', { replace: false });
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { branch: 'branch-2' }, replace: false })
    );
  });

  it('maps anonymous and authenticated discussion users', () => {
    const Component = component(DiscussionsRoute);
    mocks.authUser = null;
    render(<Component />);
    expect(mocks.discussions).toHaveBeenLastCalledWith(expect.objectContaining({ userId: '' }));
    cleanup();
    mocks.authUser = { id: 'user-1' };
    render(<Component />);
    expect(mocks.discussions).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    );
  });
});

describe('user subscriptions route', () => {
  it('resolves every supported subscription target', () => {
    expect(getSubscriptionHref({ user: { id: 'user-2' } }, 'user-1')).toBe('/user/user-2');
    expect(getSubscriptionHref({ group: { id: 'group-1' } }, 'user-1')).toBe('/group/group-1');
    expect(getSubscriptionHref({ amendment: { id: 'amendment-1' } }, 'user-1')).toBe(
      '/amendment/amendment-1'
    );
    expect(getSubscriptionHref({ event: { id: 'event-1' } }, 'user-1')).toBe('/event/event-1');
    expect(getSubscriptionHref({ blog: { id: 'blog-1', group_id: 'group-1' } }, 'user-1')).toBe(
      '/group/group-1/blog/blog-1'
    );
    expect(getSubscriptionHref({ blog: { id: 'blog-1' } }, 'user-1')).toBe(
      '/user/user-1/blog/blog-1'
    );
    expect(getSubscriptionHref({}, 'user-1')).toBeNull();
  });

  it('shows filtered empty-state copy for search or type filters', () => {
    const Component = component(UserSubscriptionsRoute);
    mocks.searchQuery = '   ';
    render(<Component />);
    expect(mocks.subscriptionsTable).toHaveBeenLastCalledWith(
      expect.objectContaining({ emptyMessage: undefined })
    );
    cleanup();
    mocks.searchQuery = 'climate';
    render(<Component />);
    expect(mocks.subscriptionsTable.mock.calls.at(-1)?.[0].emptyMessage).toContain(
      'noFilterResults'
    );
    cleanup();
    mocks.searchQuery = '';
    mocks.filterType = 'group';
    render(<Component />);
    const props = mocks.subscriptionsTable.mock.calls.at(-1)?.[0];
    expect(props.emptyMessage).toContain('noFilterResults');
    expect(props.getSubscriptionHref({ event: { id: 'event-1' } })).toBe('/event/event-1');
  });
});
