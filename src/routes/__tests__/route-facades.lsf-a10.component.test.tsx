/* @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  preload: vi.fn(),
  createConfig: { steps: [] },
  collaboratorArgs: [] as Record<string, any>[],
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (options: Record<string, any>) => ({
    options,
    useParams: () => ({ id: 'entity', entryId: 'entry', agendaItemId: 'agenda', slug: 'slug' }),
    useSearch: () => ({ groupId: 'group', branch: 'branch', tab: 'membershipsByUser' }),
    useNavigate: () => mocks.navigate,
  }),
  useNavigate: () => mocks.navigate,
  Outlet: () => null,
  redirect: (options: unknown) => ({ kind: 'redirect', options }),
  notFound: () => ({ kind: 'not-found' }),
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user' } }),
}));
vi.mock('@/zero/preloads', () => ({
  useCalendarPreloads: mocks.preload,
  useCreatePreloads: mocks.preload,
  useCreateEventPreloads: mocks.preload,
  useHomePreloads: mocks.preload,
  useNotificationsPreloads: mocks.preload,
  useSearchPreloads: mocks.preload,
}));
vi.mock('@/features/create/hooks/useCreateAgendaItemForm', () => ({
  useCreateAgendaItemForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreateAmendmentForm', () => ({
  useCreateAmendmentForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreateBlogForm', () => ({
  useCreateBlogForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreateElectionCandidateForm', () => ({
  useCreateElectionCandidateForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreateEventForm', () => ({
  useCreateEventForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreateGroupForm', () => ({
  useCreateGroupForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreatePaymentForm', () => ({
  useCreatePaymentForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreateStatementForm', () => ({
  useCreateStatementForm: () => mocks.createConfig,
}));
vi.mock('@/features/create/hooks/useCreateTodoForm', () => ({
  useCreateTodoForm: () => mocks.createConfig,
}));
vi.mock('@/features/amendments/collaborators/hooks/useCollaboratorsPageController', () => ({
  useCollaboratorsPageController: (options: Record<string, any>) => {
    mocks.collaboratorArgs.push(options);
    return { isLoading: false, canManageCollaborators: true };
  },
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    amendment: { created_by_id: 'user', title: 'Amendment' },
    isLoading: false,
  }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}));
vi.mock('@/features/statements/hooks/useStatementDetailModel', () => ({
  useStatementDetailModel: () => ({ id: 'statement' }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Route as AmendmentChangeRequests } from '../_authed/amendment/$id/change-requests';
import { Route as AmendmentCityDesign } from '../_authed/amendment/$id/citydesign';
import { Route as AmendmentCollaborators } from '../_authed/amendment/$id/collaborators';
import { Route as AmendmentIndex } from '../_authed/amendment/$id/index';
import { Route as AmendmentProcess } from '../_authed/amendment/$id/process';
import { Route as AmendmentText } from '../_authed/amendment/$id/text';
import { Route as BlogEdit } from '../_authed/blog/$id/edit';
import { Route as BlogIndex } from '../_authed/blog/$id/index';
import { Route as Calendar } from '../_authed/calendar';
import { Route as CreateAgendaItem } from '../_authed/create/agenda-item';
import { Route as CreateAmendment } from '../_authed/create/amendment';
import { Route as CreateBlogEntry } from '../_authed/create/blog-entry';
import { Route as CreateElectionCandidate } from '../_authed/create/election-candidate';
import { Route as CreateEvent } from '../_authed/create/event';
import { Route as CreateGroup } from '../_authed/create/group';
import { Route as CreateIndex } from '../_authed/create/index';
import { Route as CreatePayment } from '../_authed/create/payment';
import { Route as CreateStatement } from '../_authed/create/statement';
import { Route as CreateTodo } from '../_authed/create/todo';
import { Route as EventAgendaLayout } from '../_authed/event/$id/agenda';
import { Route as EventAgendaItem } from '../_authed/event/$id/agenda/$agendaItemId';
import { Route as EventAgendaIndex } from '../_authed/event/$id/agenda/index';
import { Route as EventIndex } from '../_authed/event/$id/index';
import { Route as EventNetwork } from '../_authed/event/$id/network';
import { Route as EventParticipants } from '../_authed/event/$id/participants';
import { Route as EventRoles } from '../_authed/event/$id/roles';
import { Route as EventStream } from '../_authed/event/$id/stream';
import { Route as GroupAmendments } from '../_authed/group/$id/amendments';
import { Route as GroupBlogLayout } from '../_authed/group/$id/blog';
import { Route as GroupBlogEntry } from '../_authed/group/$id/blog/$entryId/index';
import { Route as GroupBlogIndex } from '../_authed/group/$id/blog/index';
import { Route as GroupBlogsStatements } from '../_authed/group/$id/blogs-and-statements';
import { Route as GroupIndex } from '../_authed/group/$id/index';
import { Route as GroupMemberships } from '../_authed/group/$id/memberships';
import { Route as Home } from '../_authed/home';
import { Route as Notifications } from '../_authed/notifications';
import { Route as Search } from '../_authed/search';
import { Route as Statement } from '../_authed/statement/$id';
import { Route as Todo } from '../_authed/todos/$id';
import { Route as UserBlogLayout } from '../_authed/user/$id/blog';
import { Route as UserBlogEntry } from '../_authed/user/$id/blog/$entryId/index';
import { Route as UserIndex } from '../_authed/user/$id/index';
import { Route as UserMeet } from '../_authed/user/$id/meet';
import { Route as UserNetwork } from '../_authed/user/$id/network';
import { Route as CatchAll } from '../$';
import { Route as AuthLayout } from '../auth';
import { Route as AuthCallback } from '../auth/callback';
import { Route as ForgotPassword } from '../auth/forgot-password';
import { Route as AuthIndex } from '../auth/index';
import { Route as ResetPassword } from '../auth/reset-password';
import { Route as SignIn } from '../auth/sign-in';
import { Route as SignUp } from '../auth/sign-up';
import { Route as Verify } from '../auth/verify';
import { Route as DocsLayout } from '../docs';
import { Route as GettingStartedDocs } from '../docs/getting-started/$slug';
import { Route as GuideDocs } from '../docs/guides/$slug';
import { Route as DocsIndex } from '../docs/index';
import { Route as Features } from '../features';
import { Route as Imprint } from '../imprint';
import { Route as Solutions } from '../solutions';

interface TestRoute {
  options: {
    component?: () => React.ReactNode;
    beforeLoad?: (args: any) => unknown;
    loader?: () => unknown;
    validateSearch?: any;
  };
}

const asTestRoute = (route: unknown) => route as TestRoute;

describe('A10 route facade LSF contracts', () => {
  it('executes all simple route components', () => {
    const routes = [
      AmendmentCityDesign,
      AmendmentIndex,
      BlogEdit,
      BlogIndex,
      Calendar,
      CreateAgendaItem,
      CreateAmendment,
      CreateBlogEntry,
      CreateElectionCandidate,
      CreateEvent,
      CreateGroup,
      CreateIndex,
      CreatePayment,
      CreateStatement,
      CreateTodo,
      EventAgendaLayout,
      EventAgendaItem,
      EventAgendaIndex,
      EventIndex,
      EventNetwork,
      GroupAmendments,
      GroupBlogLayout,
      GroupBlogEntry,
      GroupBlogIndex,
      GroupBlogsStatements,
      GroupIndex,
      Home,
      Notifications,
      Search,
      Statement,
      Todo,
      UserBlogLayout,
      UserBlogEntry,
      UserIndex,
      UserMeet,
      UserNetwork,
      AuthLayout,
      AuthCallback,
      ForgotPassword,
      ResetPassword,
      SignIn,
      SignUp,
      Verify,
      DocsLayout,
      GettingStartedDocs,
      GuideDocs,
      DocsIndex,
    ];
    for (const route of routes) {
      expect(asTestRoute(route).options.component?.()).toBeDefined();
    }
  });

  it('executes route validation and interaction callbacks', () => {
    mocks.navigate.mockImplementation((options: { search?: unknown }) => {
      if (typeof options.search === 'function') {
        options.search({});
      }
    });
    for (const route of [AmendmentChangeRequests, AmendmentProcess, AmendmentText, Search]) {
      expect(asTestRoute(route).options.validateSearch?.({})).toBeDefined();
    }

    asTestRoute(AmendmentCollaborators).options.component?.();
    mocks.collaboratorArgs[0].onTabChange('roles');
    const participants = asTestRoute(EventParticipants).options.component?.() as any;
    participants.props.onTabChange('roles');
    const memberships = asTestRoute(GroupMemberships).options.component?.() as any;
    memberships.props.onTabChange('roles');
    expect(mocks.navigate).toHaveBeenCalledTimes(3);
  });

  it('executes redirect, loader, and null route callbacks', () => {
    for (const route of [EventRoles, EventStream, AuthIndex, Features, Imprint, Solutions]) {
      expect(() => asTestRoute(route).options.beforeLoad?.({ params: { id: 'event' } })).toThrow();
      asTestRoute(route).options.component?.();
    }
    expect(() => asTestRoute(CatchAll).options.loader?.()).toThrow();
  });
});
