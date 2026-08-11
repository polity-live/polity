/* @vitest-environment jsdom */

import type { ComponentType, ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  homePreload: vi.fn(),
  notificationsPreload: vi.fn(),
  params: {
    agendaItemId: 'agenda-item-deep-link',
    entryId: 'blog-entry-deep-link',
    id: 'entity-deep-link',
  },
  redirect: vi.fn((options: unknown) => ({ kind: 'redirect' as const, options })),
  search: {
    engagement: 'rising',
    q: 'climate',
    range: 'week',
    sort: 'recent',
    types: 'groups',
    view: 'list',
  } as Record<string, unknown>,
  searchPreload: vi.fn(),
  statementModel: vi.fn((options: { statementId: string }) => ({
    kind: 'statement-model',
    statementId: options.statementId,
  })),
  translate: vi.fn((key: string) => `translated:${key}`),
}));

interface TestRoute {
  readonly options: {
    readonly beforeLoad?: (args: { params: { id: string } }) => unknown;
    readonly component?: ComponentType;
    readonly validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
  };
  readonly path: string;
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (options: TestRoute['options']) => ({
    options,
    path,
    useParams: () => mocks.params,
    useSearch: () => mocks.search,
  }),
  Outlet: () => <div data-testid="route-outlet" />,
  redirect: mocks.redirect,
}));

vi.mock('@/features/agendas/ui/EventAgendaItemDetail', () => ({
  EventAgendaItemDetail: ({ agendaItemId, eventId }: { agendaItemId: string; eventId: string }) => (
    <div data-agenda-item-id={agendaItemId} data-event-id={eventId} data-testid="agenda-item" />
  ),
}));
vi.mock('@/features/agendas/ui/EventAgenda', () => ({
  EventAgenda: ({ eventId }: { eventId: string }) => (
    <div data-event-id={eventId} data-testid="event-agenda" />
  ),
}));
vi.mock('@/features/events/EventWiki', () => ({
  EventWiki: ({ eventId }: { eventId: string }) => (
    <div data-event-id={eventId} data-testid="event-wiki" />
  ),
}));
vi.mock('@/features/network/ui/EventNetworkFlow', () => ({
  EventNetworkFlow: ({ eventId }: { eventId: string }) => (
    <div data-event-id={eventId} data-testid="event-network-flow" />
  ),
}));
vi.mock('@/features/network/ui/UserNetworkFlow', () => ({
  UserNetworkFlow: ({ userId }: { userId: string }) => (
    <div data-testid="user-network-flow" data-user-id={userId} />
  ),
}));
vi.mock('@/features/network/ui/NetworkViewportPanel', () => ({
  NetworkViewportPanel: ({ children }: { children: ReactNode }) => (
    <section data-testid="network-viewport">{children}</section>
  ),
}));

vi.mock('@/features/groups/ui/GroupAmendmentsPage', () => ({
  GroupAmendmentsPage: ({ groupId }: { groupId: string }) => (
    <div data-group-id={groupId} data-testid="group-amendments" />
  ),
}));
vi.mock('@/features/blogs/ui/BlogDetail', () => ({
  BlogDetail: ({ blogId }: { blogId: string }) => (
    <div data-blog-id={blogId} data-testid="blog-detail" />
  ),
}));
vi.mock('@/features/groups/ui/GroupBlogsAndStatementsPage', () => ({
  GroupBlogsAndStatementsPage: ({ groupId }: { groupId: string }) => (
    <div data-group-id={groupId} data-testid="group-blogs-statements" />
  ),
}));
vi.mock('@/features/groups/GroupWiki', () => ({
  GroupWiki: ({ groupId }: { groupId: string }) => (
    <div data-group-id={groupId} data-testid="group-wiki" />
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: mocks.translate,
}));

vi.mock('@/features/users/wiki', () => ({
  UserWiki: ({ userId }: { userId: string }) => (
    <div data-testid="user-wiki" data-user-id={userId} />
  ),
}));
vi.mock('@/features/users/ui/UserMeetingScheduler', () => ({
  UserMeetingScheduler: ({ userId }: { userId: string }) => (
    <div data-testid="meeting-scheduler" data-user-id={userId} />
  ),
}));

vi.mock('@/features/timeline', () => ({
  ModernTimeline: () => <div data-testid="modern-timeline" />,
}));
vi.mock('@/features/notifications/NotificationsPage', () => ({
  NotificationsPage: () => <div data-testid="notifications-page" />,
}));
vi.mock('@/features/search/SearchPage', () => ({
  SearchPage: () => <div data-testid="search-page" />,
}));
vi.mock('@/zero/preloads', () => ({
  useHomePreloads: mocks.homePreload,
  useNotificationsPreloads: mocks.notificationsPreload,
  useSearchPreloads: mocks.searchPreload,
}));
vi.mock('@/features/statements/hooks/useStatementDetailModel', () => ({
  useStatementDetailModel: mocks.statementModel,
}));
vi.mock('@/features/statements/ui/StatementDetail', () => ({
  StatementDetail: ({ model }: { model: { statementId: string } }) => (
    <div data-statement-id={model.statementId} data-testid="statement-detail" />
  ),
}));
vi.mock('@/features/todos/TodoDetailPage', () => ({
  TodoDetailPage: ({ todoId }: { todoId: string }) => (
    <div data-testid="todo-detail" data-todo-id={todoId} />
  ),
}));

import { Route as EventAgendaLayoutRoute } from '../_authed/event/$id/agenda';
import { Route as EventAgendaItemRoute } from '../_authed/event/$id/agenda/$agendaItemId';
import { Route as EventAgendaIndexRoute } from '../_authed/event/$id/agenda/index';
import { Route as EventIndexRoute } from '../_authed/event/$id/index';
import { Route as EventNetworkRoute } from '../_authed/event/$id/network';
import { Route as EventRolesRoute } from '../_authed/event/$id/roles';
import { Route as EventStreamRoute } from '../_authed/event/$id/stream';
import { Route as GroupAmendmentsRoute } from '../_authed/group/$id/amendments';
import { Route as GroupBlogLayoutRoute } from '../_authed/group/$id/blog';
import { Route as GroupBlogEntryRoute } from '../_authed/group/$id/blog/$entryId/index';
import { Route as GroupBlogIndexRoute } from '../_authed/group/$id/blog/index';
import { Route as GroupBlogsStatementsRoute } from '../_authed/group/$id/blogs-and-statements';
import { Route as GroupIndexRoute } from '../_authed/group/$id/index';
import { Route as HomeRoute } from '../_authed/home';
import { Route as NotificationsRoute } from '../_authed/notifications';
import { Route as SearchRoute } from '../_authed/search';
import { Route as StatementRoute } from '../_authed/statement/$id';
import { Route as TodoRoute } from '../_authed/todos/$id';
import { Route as UserBlogLayoutRoute } from '../_authed/user/$id/blog';
import { Route as UserBlogEntryRoute } from '../_authed/user/$id/blog/$entryId/index';
import { Route as UserIndexRoute } from '../_authed/user/$id/index';
import { Route as UserMeetRoute } from '../_authed/user/$id/meet';
import { Route as UserNetworkRoute } from '../_authed/user/$id/network';

function asRoute(route: unknown): TestRoute {
  return route as TestRoute;
}

function renderRoute(route: unknown) {
  const Component = asRoute(route).options.component;
  if (!Component) throw new Error('Expected a route component');
  render(<Component />);
}

function thrownBy(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error) {
    return error;
  }
  throw new Error('Expected route callback to throw');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = {
    engagement: 'rising',
    q: 'climate',
    range: 'week',
    sort: 'recent',
    types: 'groups',
    view: 'list',
  };
});

afterEach(cleanup);

describe('R03 direct event route behavior', () => {
  it('R03 event agenda layout renders the nested deep-link outlet', () => {
    renderRoute(EventAgendaLayoutRoute);
    expect(screen.getByTestId('route-outlet')).toBeTruthy();
  });

  it('R03 event agenda item forwards both deep-link parameters', () => {
    renderRoute(EventAgendaItemRoute);
    expect(screen.getByTestId('agenda-item').dataset).toMatchObject({
      agendaItemId: 'agenda-item-deep-link',
      eventId: 'entity-deep-link',
    });
  });

  it('R03 event agenda index forwards the event deep-link parameter', () => {
    renderRoute(EventAgendaIndexRoute);
    expect(screen.getByTestId('event-agenda').dataset.eventId).toBe('entity-deep-link');
  });

  it('R03 event index forwards the event deep-link parameter to its wiki', () => {
    renderRoute(EventIndexRoute);
    expect(screen.getByTestId('event-wiki').dataset.eventId).toBe('entity-deep-link');
  });

  it('R03 event network renders its viewport with the selected event', () => {
    renderRoute(EventNetworkRoute);
    expect(
      screen.getByTestId('network-viewport').contains(screen.getByTestId('event-network-flow'))
    ).toBe(true);
    expect(screen.getByTestId('event-network-flow').dataset.eventId).toBe('entity-deep-link');
  });

  it('R03 event roles redirects the deep link to the roles participant tab', () => {
    const beforeLoad = asRoute(EventRolesRoute).options.beforeLoad;
    expect(beforeLoad).toBeTypeOf('function');
    expect(thrownBy(() => beforeLoad?.({ params: { id: 'event-role-deep-link' } }))).toEqual({
      kind: 'redirect',
      options: {
        params: { id: 'event-role-deep-link' },
        search: { tab: 'roles' },
        to: '/event/$id/participants',
      },
    });
  });

  it('R03 event stream redirects the deep link to its agenda', () => {
    const beforeLoad = asRoute(EventStreamRoute).options.beforeLoad;
    expect(beforeLoad).toBeTypeOf('function');
    expect(thrownBy(() => beforeLoad?.({ params: { id: 'event-stream-deep-link' } }))).toEqual({
      kind: 'redirect',
      options: {
        params: { id: 'event-stream-deep-link' },
        to: '/event/$id/agenda',
      },
    });
  });
});

describe('R03 direct group route behavior', () => {
  it('R03 group amendments forwards the group deep-link parameter', () => {
    renderRoute(GroupAmendmentsRoute);
    expect(screen.getByTestId('group-amendments').dataset.groupId).toBe('entity-deep-link');
  });

  it('R03 group blog layout renders the nested deep-link outlet', () => {
    renderRoute(GroupBlogLayoutRoute);
    expect(screen.getByTestId('route-outlet')).toBeTruthy();
  });

  it('R03 group blog entry forwards the entry deep-link parameter', () => {
    renderRoute(GroupBlogEntryRoute);
    expect(screen.getByTestId('blog-detail').dataset.blogId).toBe('blog-entry-deep-link');
  });

  it('R03 group blog index renders its translated route content', () => {
    renderRoute(GroupBlogIndexRoute);
    expect(mocks.translate).toHaveBeenCalledWith(
      'generated.inline.1265_hello_authed_group_id_blog_7f01bdfb'
    );
    expect(screen.getByText(/translated:generated\.inline\.1265/)).toBeTruthy();
  });

  it('R03 group blogs and statements forwards the group deep-link parameter', () => {
    renderRoute(GroupBlogsStatementsRoute);
    expect(screen.getByTestId('group-blogs-statements').dataset.groupId).toBe('entity-deep-link');
  });

  it('R03 group index forwards the group deep-link parameter to its wiki', () => {
    renderRoute(GroupIndexRoute);
    expect(screen.getByTestId('group-wiki').dataset.groupId).toBe('entity-deep-link');
  });
});

describe('R03 direct user route behavior', () => {
  it('R03 user blog layout renders the nested deep-link outlet', () => {
    renderRoute(UserBlogLayoutRoute);
    expect(screen.getByTestId('route-outlet')).toBeTruthy();
  });

  it('R03 user blog entry forwards the entry deep-link parameter', () => {
    renderRoute(UserBlogEntryRoute);
    expect(screen.getByTestId('blog-detail').dataset.blogId).toBe('blog-entry-deep-link');
  });

  it('R03 user index forwards the user deep-link parameter to its wiki', () => {
    renderRoute(UserIndexRoute);
    expect(screen.getByTestId('user-wiki').dataset.userId).toBe('entity-deep-link');
  });

  it('R03 user meet forwards the user deep link to the scheduler', () => {
    renderRoute(UserMeetRoute);
    expect(screen.getByTestId('meeting-scheduler').dataset.userId).toBe('entity-deep-link');
  });

  it('R03 user network renders its viewport with the selected user', () => {
    renderRoute(UserNetworkRoute);
    expect(
      screen.getByTestId('network-viewport').contains(screen.getByTestId('user-network-flow'))
    ).toBe(true);
    expect(screen.getByTestId('user-network-flow').dataset.userId).toBe('entity-deep-link');
  });
});

describe('R03 direct authenticated top-level route behavior', () => {
  it('R03 home invokes its preload before rendering the timeline', () => {
    renderRoute(HomeRoute);
    expect(mocks.homePreload).toHaveBeenCalledOnce();
    expect(screen.getByTestId('modern-timeline')).toBeTruthy();
  });

  it('R03 notifications invokes its preload before rendering the page', () => {
    renderRoute(NotificationsRoute);
    expect(mocks.notificationsPreload).toHaveBeenCalledOnce();
    expect(screen.getByTestId('notifications-page')).toBeTruthy();
  });

  it('R03 search validates deep-link filters and preloads that exact state', () => {
    const validateSearch = asRoute(SearchRoute).options.validateSearch;
    expect(validateSearch).toBeTypeOf('function');
    const valid = validateSearch?.({
      engagement: 'rising',
      q: 'climate',
      range: 'week',
      sort: 'recent',
      types: 'groups',
      view: 'list',
    });
    expect(valid).toEqual(mocks.search);
    expect(
      validateSearch?.({
        engagement: 'invalid',
        range: 'invalid',
        sort: 'invalid',
        view: 'invalid',
      })
    ).toEqual({ engagement: undefined, range: undefined, sort: undefined, view: undefined });
    renderRoute(SearchRoute);
    expect(mocks.searchPreload).toHaveBeenCalledWith(mocks.search);
    expect(screen.getByTestId('search-page')).toBeTruthy();
  });

  it('R03 statement detail builds its model from the deep-link parameter', () => {
    renderRoute(StatementRoute);
    expect(mocks.statementModel).toHaveBeenCalledWith({ statementId: 'entity-deep-link' });
    expect(screen.getByTestId('statement-detail').dataset.statementId).toBe('entity-deep-link');
  });

  it('R03 todo detail forwards the todo deep-link parameter', () => {
    renderRoute(TodoRoute);
    expect(screen.getByTestId('todo-detail').dataset.todoId).toBe('entity-deep-link');
  });
});
