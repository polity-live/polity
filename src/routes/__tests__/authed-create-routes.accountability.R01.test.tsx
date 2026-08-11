/* @vitest-environment jsdom */

import type { ComponentType } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  params: { id: 'deep-link-entity' },
  search: { groupId: 'deep-link-group' },
  useCalendarPreloads: vi.fn(),
  useCreateEventPreloads: vi.fn(),
  useCreatePreloads: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (options: TestRoute['options']) => ({
    options,
    path,
    useParams: () => mocks.params,
    useSearch: () => mocks.search,
  }),
}));
vi.mock('@/zero/preloads', () => ({
  useCalendarPreloads: mocks.useCalendarPreloads,
  useCreateEventPreloads: mocks.useCreateEventPreloads,
  useCreatePreloads: mocks.useCreatePreloads,
}));

vi.mock('@/features/amendments/city-design/CityDesignPage', () => ({
  CityDesignPage: ({ amendmentId }: { amendmentId: string }) => (
    <div data-testid="city-design-page">{amendmentId}</div>
  ),
}));
vi.mock('@/features/amendments/AmendmentWiki', () => ({
  AmendmentWiki: ({ amendmentId }: { amendmentId: string }) => (
    <div data-testid="amendment-wiki">{amendmentId}</div>
  ),
}));
vi.mock('@/features/blogs/ui/ResolvedBlogRedirect', () => ({
  ResolvedBlogRedirect: ({ blogId, target }: { blogId: string; target: string }) => (
    <div data-testid="resolved-blog-redirect">{`${blogId}:${target}`}</div>
  ),
}));
vi.mock('@/features/calendar/CalendarPage', () => ({
  default: () => <div data-testid="calendar-page" />,
}));
vi.mock('@/features/create/ui/CreateDashboard', () => ({
  CreateDashboard: () => <div data-testid="create-dashboard" />,
}));
vi.mock('@/features/create/ui/CreateFormShell', () => ({
  CreateFormShell: ({ config }: { config: { kind: string } }) => (
    <div data-testid="create-form-shell">{config.kind}</div>
  ),
}));

vi.mock('@/features/create/hooks/useCreateAgendaItemForm', () => ({
  useCreateAgendaItemForm: () => ({ kind: 'agenda-item' }),
}));
vi.mock('@/features/create/hooks/useCreateAmendmentForm', () => ({
  useCreateAmendmentForm: () => ({ kind: 'amendment' }),
}));
vi.mock('@/features/create/hooks/useCreateBlogForm', () => ({
  useCreateBlogForm: () => ({ kind: 'blog-entry' }),
}));
vi.mock('@/features/create/hooks/useCreateElectionCandidateForm', () => ({
  useCreateElectionCandidateForm: () => ({ kind: 'election-candidate' }),
}));
vi.mock('@/features/create/hooks/useCreateEventForm', () => ({
  useCreateEventForm: () => ({ kind: 'event' }),
}));
vi.mock('@/features/create/hooks/useCreateGroupForm', () => ({
  useCreateGroupForm: () => ({ kind: 'group' }),
}));
vi.mock('@/features/create/hooks/useCreatePaymentForm', () => ({
  useCreatePaymentForm: () => ({ kind: 'payment' }),
}));
vi.mock('@/features/create/hooks/useCreateStatementForm', () => ({
  useCreateStatementForm: () => ({ kind: 'statement' }),
}));
vi.mock('@/features/create/hooks/useCreateTodoForm', () => ({
  useCreateTodoForm: () => ({ kind: 'todo' }),
}));

import { Route as AmendmentCityDesignRoute } from '../_authed/amendment/$id/citydesign';
import { Route as AmendmentIndexRoute } from '../_authed/amendment/$id/index';
import { Route as BlogEditRoute } from '../_authed/blog/$id/edit';
import { Route as BlogIndexRoute } from '../_authed/blog/$id/index';
import { Route as CalendarRoute } from '../_authed/calendar';
import { Route as CreateAgendaItemRoute } from '../_authed/create/agenda-item';
import { Route as CreateAmendmentRoute } from '../_authed/create/amendment';
import { Route as CreateBlogEntryRoute } from '../_authed/create/blog-entry';
import { Route as CreateElectionCandidateRoute } from '../_authed/create/election-candidate';
import { Route as CreateEventRoute } from '../_authed/create/event';
import { Route as CreateGroupRoute } from '../_authed/create/group';
import { Route as CreateIndexRoute } from '../_authed/create/index';
import { Route as CreatePaymentRoute } from '../_authed/create/payment';
import { Route as CreateStatementRoute } from '../_authed/create/statement';
import { Route as CreateTodoRoute } from '../_authed/create/todo';

interface SearchSchema {
  readonly parse: (input: unknown) => unknown;
}

interface TestRoute {
  readonly options: {
    readonly component?: ComponentType;
    readonly validateSearch?: SearchSchema;
  };
  readonly path: string;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

function routeComponent(route: unknown): ComponentType {
  const component = (route as TestRoute).options.component;
  if (!component) throw new Error('Expected route component');
  return component;
}

function searchSchema(route: unknown): SearchSchema {
  const schema = (route as TestRoute).options.validateSearch;
  if (!schema) throw new Error('Expected route search schema');
  return schema;
}

function renderRoute(route: unknown) {
  const Component = routeComponent(route);
  render(<Component />);
}

function expectCreateForm(route: unknown, kind: string) {
  renderRoute(route);
  expect(screen.getByTestId('create-form-shell').textContent).toBe(kind);
}

describe('R01 authenticated amendment and blog route accountability', () => {
  it('passes the amendment deep-link id to the city-design page', () => {
    renderRoute(AmendmentCityDesignRoute);
    expect(screen.getByTestId('city-design-page').textContent).toBe('deep-link-entity');
  });

  it('passes the amendment deep-link id to the wiki page', () => {
    renderRoute(AmendmentIndexRoute);
    expect(screen.getByTestId('amendment-wiki').textContent).toBe('deep-link-entity');
  });

  it('resolves the canonical blog edit deep link', () => {
    renderRoute(BlogEditRoute);
    expect(screen.getByTestId('resolved-blog-redirect').textContent).toBe('deep-link-entity:edit');
  });

  it('resolves the canonical blog detail deep link', () => {
    renderRoute(BlogIndexRoute);
    expect(screen.getByTestId('resolved-blog-redirect').textContent).toBe(
      'deep-link-entity:detail'
    );
  });
});

describe('R01 authenticated calendar route accountability', () => {
  it('preloads and renders the authenticated calendar page', () => {
    renderRoute(CalendarRoute);
    expect(mocks.useCalendarPreloads).toHaveBeenCalledOnce();
    expect(screen.getByTestId('calendar-page')).toBeTruthy();
  });
});

describe('R01 authenticated create route accountability', () => {
  it('preloads and renders the agenda-item creation form', () => {
    expectCreateForm(CreateAgendaItemRoute, 'agenda-item');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });

  it('validates search state and renders the amendment creation form', () => {
    expect(searchSchema(CreateAmendmentRoute).parse({ pathMode: 'workflow' })).toEqual({
      pathMode: 'workflow',
    });
    expect(() => searchSchema(CreateAmendmentRoute).parse({ pathMode: 'invalid' })).toThrow();
    expectCreateForm(CreateAmendmentRoute, 'amendment');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });

  it('validates group search state and renders the blog-entry creation form', () => {
    expect(searchSchema(CreateBlogEntryRoute).parse({ groupId: 'group-1' })).toEqual({
      groupId: 'group-1',
    });
    expect(() => searchSchema(CreateBlogEntryRoute).parse({ groupId: 42 })).toThrow();
    expectCreateForm(CreateBlogEntryRoute, 'blog-entry');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });

  it('preloads and renders the election-candidate creation form', () => {
    expectCreateForm(CreateElectionCandidateRoute, 'election-candidate');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });

  it('validates event search and preloads its deep-linked group', () => {
    expect(
      searchSchema(CreateEventRoute).parse({
        eventType: 'open',
        groupId: 'group-1',
        startDate: '2026-08-10',
        startTime: '09:30',
      })
    ).toEqual({
      eventType: 'open',
      groupId: 'group-1',
      startDate: '2026-08-10',
      startTime: '09:30',
    });
    expect(() => searchSchema(CreateEventRoute).parse({ startDate: '10.08.2026' })).toThrow();
    expectCreateForm(CreateEventRoute, 'event');
    expect(mocks.useCreateEventPreloads).toHaveBeenCalledWith('deep-link-group');
  });

  it('preloads and renders the group creation form', () => {
    expectCreateForm(CreateGroupRoute, 'group');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });

  it('preloads and renders the create dashboard', () => {
    renderRoute(CreateIndexRoute);
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
    expect(screen.getByTestId('create-dashboard')).toBeTruthy();
  });

  it('validates payment return state and renders the payment creation form', () => {
    expect(
      searchSchema(CreatePaymentRoute).parse({
        groupId: 'group-1',
        direction: 'expense',
        returnSection: 'payments',
      })
    ).toEqual({
      groupId: 'group-1',
      direction: 'expense',
      returnSection: 'payments',
    });
    expect(() => searchSchema(CreatePaymentRoute).parse({ direction: 'transfer' })).toThrow();
    expectCreateForm(CreatePaymentRoute, 'payment');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });

  it('validates group search state and renders the statement creation form', () => {
    expect(searchSchema(CreateStatementRoute).parse({ groupId: 'group-1' })).toEqual({
      groupId: 'group-1',
    });
    expect(() => searchSchema(CreateStatementRoute).parse({ groupId: false })).toThrow();
    expectCreateForm(CreateStatementRoute, 'statement');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });

  it('validates todo return state and renders the todo creation form', () => {
    expect(
      searchSchema(CreateTodoRoute).parse({ groupId: 'group-1', returnSection: 'todos' })
    ).toEqual({ groupId: 'group-1', returnSection: 'todos' });
    expect(() => searchSchema(CreateTodoRoute).parse({ returnSection: 'payments' })).toThrow();
    expectCreateForm(CreateTodoRoute, 'todo');
    expect(mocks.useCreatePreloads).toHaveBeenCalledOnce();
  });
});
