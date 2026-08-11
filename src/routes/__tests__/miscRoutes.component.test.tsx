/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {} as Record<string, any>,
  blogRelations: vi.fn(),
  canManage: vi.fn(),
  canView: vi.fn(),
  docsCanonical: null as string | null,
  docsSearch: vi.fn(),
  guestAccessible: false,
  isMember: vi.fn(),
  loadingState: vi.fn(),
  manageNetwork: vi.fn(),
  manageWorkflows: vi.fn(),
  membershipFilters: {} as Record<string, any>,
  memberships: {} as Record<string, any>,
  membershipsTab: vi.fn(),
  navigate: vi.fn(),
  networkPage: {} as Record<string, any>,
  networkTabs: vi.fn(),
  params: { id: 'entity-1', topic: 'legacy-topic' },
  pathname: '/home',
  permissionsLoading: false,
  preloads: vi.fn(),
  redirect: vi.fn(),
  search: {} as Record<string, any>,
  userData: undefined as undefined | Record<string, any>,
  zeroReady: true,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, any>) => ({
    ...options,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params,
    useSearch: () => mocks.search,
  }),
  Navigate: (props: Record<string, unknown>) => (
    <div data-navigate={JSON.stringify(props)}>navigate</div>
  ),
  Outlet: () => <div>outlet</div>,
  redirect: (input: unknown) => mocks.redirect(input),
  useRouterState: ({ select }: { select: (state: any) => unknown }) =>
    select({ location: { pathname: mocks.pathname } }),
}));
vi.mock('@/features/auth/EnsureUser', () => ({
  EnsureUser: ({ children }: { children: React.ReactNode }) => <div>ensure-user{children}</div>,
}));
vi.mock('@/features/auth/logic/guestEntityRouteAccess', () => ({
  isGuestAccessibleEntityPath: () => mocks.guestAccessible,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: (props: Record<string, unknown>) => (
    <div data-access={JSON.stringify(props)}>access-denied</div>
  ),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: (props: Record<string, unknown>) => {
    mocks.loadingState(props);
    return <div>boot-loading</div>;
  },
  NotFound: () => <div>not-found</div>,
  PageSkeleton: () => <div>loading</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/providers/zero-ready-context', () => ({ useZeroReady: () => mocks.zeroReady }));
vi.mock('@/features/messages/MessagesPage', () => ({ default: () => <div>messages</div> }));
vi.mock('@/features/todos/TodosPage', () => ({ TodosPage: () => <div>todos</div> }));
vi.mock('@/zero/preloads', () => ({
  useMessagesPreloads: (id: unknown) => mocks.preloads(id),
  useTodosPreloads: () => mocks.preloads('todos'),
}));
vi.mock('@/features/app-tutorial/TutorialLauncherPage', () => ({
  TutorialLauncherPage: () => <div>tutorial-launcher</div>,
}));
vi.mock('@/features/docs/logic/docsRegistry', () => ({
  getLegacyTopicCanonicalRoute: () => mocks.docsCanonical,
}));
vi.mock('@/features/docs/DocsSearchPage', () => ({
  DocsSearchPage: (props: Record<string, unknown>) => {
    mocks.docsSearch(props);
    return <div>docs-search</div>;
  },
}));
vi.mock('@/features/network/hooks/useNetworkPage', () => ({
  useNetworkPage: () => mocks.networkPage,
}));
vi.mock('@/features/network/ui/ManageNetworkTab', () => ({
  ManageNetworkTab: (props: Record<string, unknown>) => {
    mocks.manageNetwork(props);
    return <div>manage-network</div>;
  },
}));
vi.mock('@/features/network/ui/ManageWorkflowsTab', () => ({
  ManageWorkflowsTab: (props: Record<string, unknown>) => {
    mocks.manageWorkflows(props);
    return <div>manage-workflows</div>;
  },
}));
vi.mock('@/features/network/ui/CurrentNetworkTab', () => ({
  CurrentNetworkTab: () => <div>current-network</div>,
}));
vi.mock('@/features/network/ui/NetworkViewportPanel', () => ({
  NetworkViewportPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/network/ui/NetworkTabs', () => ({
  NetworkTabs: (props: Record<string, any>) => {
    mocks.networkTabs(props);
    return (
      <div>
        <button onClick={() => props.onTabChange('manage-network')}>network-tabs</button>
        {props.currentNetworkContent}
        {props.manageNetworkContent}
        {props.manageWorkflowsContent}
      </div>
    );
  },
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({
    canManage: mocks.canManage,
    canView: mocks.canView,
    isMember: mocks.isMember,
  }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({
    canManage: mocks.canManage,
    canView: mocks.canView,
    isLoading: mocks.permissionsLoading,
    isMember: mocks.isMember,
  }),
}));
vi.mock('@/features/users/hooks/useUserData', () => ({
  useUserData: () => ({ user: mocks.userData }),
}));
vi.mock('@/features/users/hooks/useUserMemberships', () => ({
  useUserMemberships: () => mocks.memberships,
}));
vi.mock('@/features/users/hooks/useUserMembershipsFilters', () => ({
  useUserMembershipsFilters: () => mocks.membershipFilters,
}));
vi.mock('@/features/users/ui/GroupMembershipsTab', () => ({
  GroupMembershipsTab: (props: Record<string, unknown>) => {
    mocks.membershipsTab('GroupMembershipsTab', props);
    return <div>GroupMembershipsTab</div>;
  },
}));
vi.mock('@/features/users/ui/EventParticipationsTab', () => ({
  EventParticipationsTab: (props: Record<string, unknown>) => {
    mocks.membershipsTab('EventParticipationsTab', props);
    return <div>EventParticipationsTab</div>;
  },
}));
vi.mock('@/features/users/ui/AmendmentCollaborationsTab', () => ({
  AmendmentCollaborationsTab: (props: Record<string, unknown>) => {
    mocks.membershipsTab('AmendmentCollaborationsTab', props);
    return <div>AmendmentCollaborationsTab</div>;
  },
}));
vi.mock('@/features/users/ui/BlogRelationsTab', () => ({
  BlogRelationsTab: (props: Record<string, unknown>) => {
    mocks.blogRelations(props);
    return <div>BlogRelationsTab</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/entity-search-bar', () => ({
  EntitySearchBar: () => <div>entity-search</div>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  SettingsPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SettingsTabs: (props: Record<string, any>) => (
    <button onClick={() => props.onValueChange('groups')}>{props.children}</button>
  ),
}));
vi.mock('@/features/shared/ui/status', () => ({
  CountBadge: ({ count }: { count: number }) => <span>{count}</span>,
}));
vi.mock('lucide-react', () => ({
  BookOpen: () => <span />,
  Calendar: () => <span />,
  FileEdit: () => <span />,
  Users: () => <span />,
}));

import { Route as AuthedRoute } from '../_authed';
import { Route as MessagesRoute } from '../_authed/messages';
import { Route as OnboardingRoute } from '../_authed/onboarding';
import { Route as TodosRoute } from '../_authed/todos';
import { Route as NetworkRoute } from '../_authed/group/$id/network';
import { Route as RelationshipsRoute } from '../_authed/group/$id/relationships';
import { Route as MembershipsRoute } from '../_authed/user/$id/memberships';
import { Route as NotificationSettingsRoute } from '../_authed/user/$id/notification-settings';
import { Route as NotificationsRoute } from '../_authed/user/$id/notifications';
import { Route as DocsTopicRoute } from '../docs/$topic';
import { Route as DocsSearchRoute } from '../docs/search';
import { Route as UnauthorizedRoute } from '../unauthorized';

interface TestRoute {
  component: React.ComponentType;
}
const component = (route: unknown) => (route as TestRoute).component;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = {
    loading: false,
    refreshAuthState: vi.fn(),
    signOut: vi.fn(),
    user: { id: 'user-1' },
  };
  mocks.canManage.mockReturnValue(true);
  mocks.canView.mockReturnValue(true);
  mocks.docsCanonical = null;
  mocks.guestAccessible = false;
  mocks.isMember.mockReturnValue(true);
  mocks.memberships = {
    memberships: [],
    participations: [],
    collaborations: [],
    blogRelations: [],
    leaveGroup: vi.fn(),
    acceptGroupInvitation: vi.fn(),
    declineGroupInvitation: vi.fn(),
    withdrawGroupRequest: vi.fn(),
    withdrawFromEvent: vi.fn(),
    acceptEventInvitation: vi.fn(),
    declineEventInvitation: vi.fn(),
    withdrawEventRequest: vi.fn(),
    leaveCollaboration: vi.fn(),
    acceptCollaborationInvitation: vi.fn(),
    declineCollaborationInvitation: vi.fn(),
    withdrawCollaborationRequest: vi.fn(),
    leaveBlog: vi.fn(),
    acceptBlogInvitation: vi.fn(),
    declineBlogInvitation: vi.fn(),
    withdrawBlogRequest: vi.fn(),
  };
  mocks.membershipFilters = {
    searchQuery: '',
    setSearchQuery: vi.fn(),
    membershipsByStatus: {},
    participationsByStatus: {},
    collaborationsByStatus: {},
    blogRelationsByStatus: {},
    filteredMemberships: [],
    filteredParticipations: [],
    filteredCollaborations: [],
    filteredBlogRelations: [],
  };
  mocks.navigate.mockResolvedValue(undefined);
  mocks.networkPage = {
    activeTab: 'current-network',
    setActiveTab: vi.fn(),
    group: undefined,
    groupName: '',
    searchQuery: '',
    setSearchQuery: vi.fn(),
    directionFilter: 'all',
    setDirectionFilter: vi.fn(),
    manageRightFilter: false,
    toggleManageRightFilter: vi.fn(),
    filteredIncoming: [],
    filteredOutgoing: [],
    filteredRelationships: [],
    allRelationships: [],
    workflowIncomingRequests: [],
    workflowAcceptedPendingRequests: [],
    workflowOutgoingRequests: [],
    workflowActiveRelevant: [],
  };
  mocks.params = { id: 'entity-1', topic: 'legacy-topic' };
  mocks.pathname = '/home';
  mocks.permissionsLoading = false;
  mocks.redirect.mockImplementation(input => Object.assign(new Error('redirect'), { input }));
  mocks.search = {};
  mocks.userData = undefined;
  mocks.zeroReady = true;
});

afterEach(() => cleanup());

describe('authenticated layout and simple routes', () => {
  it('renders every authenticated layout state', () => {
    const Component = component(AuthedRoute);
    mocks.auth.loading = true;
    render(<Component />);
    expect(screen.getByText('boot-loading')).toBeTruthy();
    cleanup();

    mocks.auth.loading = false;
    mocks.auth.user = null;
    render(<Component />);
    expect(screen.getByText('navigate')).toBeTruthy();
    cleanup();

    mocks.guestAccessible = true;
    render(<Component />);
    expect(screen.getByText('outlet')).toBeTruthy();
    cleanup();

    mocks.auth.user = { id: 'user-1' };
    mocks.zeroReady = false;
    render(<Component />);
    const retry = mocks.loadingState.mock.calls.at(-1)?.[0].onRetry;
    const originalWindow = window;
    vi.stubGlobal('window', { location: { reload: vi.fn() } });
    retry();
    vi.stubGlobal('window', originalWindow);
    cleanup();

    mocks.zeroReady = true;
    render(<Component />);
    expect(screen.getByText(/ensure-user/)).toBeTruthy();
  });

  it.each([
    ['private', 'errors.accessDenied.reasons.private.title'],
    ['login-required', 'errors.accessDenied.reasons.loginRequired.title'],
    [undefined, undefined],
  ])('maps unauthorized reason %s', (reason, title) => {
    mocks.search = { reason };
    const Component = component(UnauthorizedRoute);
    render(<Component />);
    const props = JSON.parse(screen.getByText('access-denied').dataset.access ?? '{}');
    expect(props.title).toBe(title);
    cleanup();
  });

  it('preloads messages and parses primitive search values', () => {
    const schema = (MessagesRoute as any).validateSearch;
    expect(
      schema.parse({ conversationId: true, name: 7, search: 'term', userId: undefined })
    ).toMatchObject({ conversationId: 'true', name: '7', search: 'term' });
    mocks.search = { conversationId: 'conversation-1' };
    const Component = component(MessagesRoute);
    render(<Component />);
    expect(mocks.preloads).toHaveBeenCalledWith('conversation-1');
  });

  it.each([
    ['/todos', 'todos'],
    ['/todos/todo-1', 'outlet'],
    ['/todos/todo-1/', 'outlet'],
    ['/todos/todo-1/more', 'todos'],
  ])('selects the todos view for %s', (pathname, expected) => {
    mocks.pathname = pathname;
    const Component = component(TodosRoute);
    render(<Component />);
    expect(screen.getByText(expected)).toBeTruthy();
    cleanup();
  });

  it('normalizes onboarding restart search values', () => {
    const validate = (OnboardingRoute as any).validateSearch;
    expect(validate({ restart: true })).toEqual({ restart: true });
    expect(validate({ restart: 'true' })).toEqual({ restart: true });
    expect(validate({ restart: false })).toEqual({ restart: false });
  });
});

describe('docs and redirect routes', () => {
  it('redirects legacy docs topics or renders not found', () => {
    const Component = component(DocsTopicRoute);
    render(<Component />);
    expect(screen.getByText('not-found')).toBeTruthy();
    cleanup();
    mocks.docsCanonical = '/docs/guides/topic';
    render(<Component />);
    expect(screen.getByText('navigate')).toBeTruthy();
  });

  it('normalizes and renders docs search', () => {
    const validate = (DocsSearchRoute as any).validateSearch;
    expect(validate({ q: 'climate' })).toEqual({ q: 'climate' });
    expect(validate({ q: 3 })).toEqual({ q: '' });
    mocks.search = { q: 'climate' };
    const Component = component(DocsSearchRoute);
    render(<Component />);
    expect(mocks.docsSearch).toHaveBeenCalledWith({ initialQuery: 'climate' });
  });

  it.each([NotificationsRoute, NotificationSettingsRoute])(
    'redirects legacy user notification routes',
    route => {
      expect(() => (route as any).beforeLoad({ params: { id: 'user-1' } })).toThrow('redirect');
      expect(mocks.redirect).toHaveBeenLastCalledWith({
        to: '/user/$id/settings',
        params: { id: 'user-1' },
        search: { tab: 'notifications' },
      });
      expect((route as any).component()).toBeNull();
    }
  );
});

describe('network and membership adapters', () => {
  it('guards relationships and forwards network state', () => {
    const Component = component(RelationshipsRoute);
    mocks.permissionsLoading = true;
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();
    mocks.permissionsLoading = false;
    mocks.isMember.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();
    mocks.isMember.mockReturnValue(true);
    mocks.canView.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();
    mocks.canView.mockReturnValue(true);
    render(<Component />);
    expect(mocks.manageNetwork).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'entity-1', canManageRelationships: true })
    );
  });

  it('locks network management for non-members and enables it for authorized members', () => {
    const Component = component(NetworkRoute);
    mocks.isMember.mockReturnValue(false);
    render(<Component />);
    expect(mocks.networkTabs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeTab: 'current-network',
        showManageNetworkTab: false,
        manageNetworkContent: null,
        manageWorkflowsContent: null,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'network-tabs' }));
    expect(mocks.networkPage.setActiveTab).toHaveBeenLastCalledWith('current-network');
    cleanup();

    mocks.isMember.mockReturnValue(true);
    mocks.canView.mockReturnValue(true);
    mocks.canManage.mockReturnValue(false);
    mocks.networkPage.activeTab = 'manage-network';
    mocks.networkPage.group = {
      group_type: 'base',
      sibling_membership_mode: 'same_parent',
    };
    render(<Component />);
    expect(mocks.networkTabs).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeTab: 'manage-network', showManageNetworkTab: true })
    );
    expect(mocks.manageNetwork).toHaveBeenCalledWith(
      expect.objectContaining({ canManageRelationships: false, currentGroupType: 'base' })
    );
    expect(mocks.manageWorkflows).toHaveBeenCalledWith(
      expect.objectContaining({ canManageWorkflows: false })
    );
    fireEvent.click(screen.getByRole('button', { name: 'network-tabs' }));
    expect(mocks.networkPage.setActiveTab).toHaveBeenLastCalledWith('manage-network');
  });

  it('maps user name, tab defaults, callbacks and blog links for memberships', () => {
    const Component = component(MembershipsRoute);
    render(<Component />);
    expect(screen.getByText('entity-search')).toBeTruthy();
    expect(mocks.blogRelations.mock.calls.at(-1)?.[0].getBlogHref('blog-1')).toBe(
      '/user/entity-1/blog/blog-1'
    );
    mocks.membershipsTab.mock.calls
      .find(call => call[0] === 'GroupMembershipsTab')?.[1]
      .onLeave('membership-1');
    mocks.membershipsTab.mock.calls
      .find(call => call[0] === 'EventParticipationsTab')?.[1]
      .onLeave('participation-1');
    mocks.membershipsTab.mock.calls
      .find(call => call[0] === 'AmendmentCollaborationsTab')?.[1]
      .onLeave('collaboration-1');
    expect(mocks.memberships.leaveGroup).toHaveBeenCalledWith('membership-1');
    expect(mocks.memberships.withdrawFromEvent).toHaveBeenCalledWith('participation-1');
    expect(mocks.memberships.leaveCollaboration).toHaveBeenCalledWith('collaboration-1');
    fireEvent.click(screen.getByRole('button'));
    const updater = mocks.navigate.mock.calls.at(-1)?.[0].search;
    expect(updater({ keep: true })).toEqual({ keep: true, tab: 'groups' });
    cleanup();

    mocks.userData = { first_name: 'Ada', last_name: 'Lovelace' };
    mocks.search = { tab: 'events' };
    render(<Component />);
    cleanup();
    mocks.userData = { first_name: '', last_name: null };
    render(<Component />);
  });
});
