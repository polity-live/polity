/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  authUser: null as null | { id: string },
  guard: vi.fn(),
  params: { id: 'entity-1', entryId: 'entry-1' },
  preloadAmendment: vi.fn(),
  preloadBlog: vi.fn(),
  preloadEvent: vi.fn(),
  preloadGroup: vi.fn(),
  preloadUser: vi.fn(),
  zeroReady: true,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => mocks.params,
  }),
  Outlet: () => <span data-testid="outlet" />,
}));
vi.mock('@/features/auth/EntityVisibilityGuard', () => ({
  EntityVisibilityGuard: (props: Record<string, unknown>) => {
    mocks.guard(props);
    return <div data-testid="guard">{props.children as React.ReactNode}</div>;
  },
}));
vi.mock('@/features/auth/hooks/useEntityRouteAccess', () => ({
  useEntityRouteAccess: (input: unknown) => mocks.access(input),
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock('@/providers/zero-ready-context', () => ({
  useZeroReady: () => mocks.zeroReady,
}));
vi.mock('@/zero/preloads', () => ({
  useAmendmentRouteFamilyPreloads: (id: string) => mocks.preloadAmendment(id),
  useBlogRouteFamilyPreloads: (id: string) => mocks.preloadBlog(id),
  useEventRouteFamilyPreloads: (id: string) => mocks.preloadEvent(id),
  useGroupRouteFamilyPreloads: (id: string) => mocks.preloadGroup(id),
  useUserRouteFamilyPreloads: (id: string, ownProfile: boolean) =>
    mocks.preloadUser(id, ownProfile),
}));

import { Route as AmendmentRoute } from '../_authed/amendment/$id';
import { Route as BlogRoute } from '../_authed/blog/$id';
import { Route as EventRoute } from '../_authed/event/$id';
import { Route as GroupRoute } from '../_authed/group/$id';
import { Route as GroupBlogRoute } from '../_authed/group/$id/blog/$entryId';
import { Route as UserRoute } from '../_authed/user/$id';
import { Route as UserBlogRoute } from '../_authed/user/$id/blog/$entryId';

interface TestRoute {
  component: React.ComponentType;
}

const entityRoutes = [
  [AmendmentRoute, 'amendment', mocks.preloadAmendment, 'entity-1', undefined],
  [BlogRoute, 'blog', mocks.preloadBlog, 'entity-1', undefined],
  [EventRoute, 'event', mocks.preloadEvent, 'entity-1', undefined],
  [GroupRoute, 'group', mocks.preloadGroup, 'entity-1', undefined],
  [GroupBlogRoute, 'blog', mocks.preloadBlog, 'entry-1', 'group'],
  [UserBlogRoute, 'blog', mocks.preloadBlog, 'entry-1', 'user'],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authUser = null;
  mocks.zeroReady = true;
  mocks.access.mockReturnValue({ data: undefined, isLoading: false, error: null });
});

afterEach(() => cleanup());

describe('entity visibility route layouts', () => {
  it.each(entityRoutes)(
    'passes safe defaults through the %s route',
    (route, entityType, preload, entityId, parentType) => {
      const Component = (route as unknown as TestRoute).component;
      render(<Component />);

      expect(preload).toHaveBeenCalledWith(entityId);
      expect(mocks.access).toHaveBeenCalledWith({
        entityType,
        entityId,
        ...(parentType ? { parentType, parentId: 'entity-1' } : {}),
      });
      expect(mocks.guard).toHaveBeenLastCalledWith(
        expect.objectContaining({
          entityExists: false,
          hasError: false,
          isLoading: false,
          visibilities: [],
          canAccessPrivate: false,
        })
      );
    }
  );

  it.each(entityRoutes)(
    'forwards loaded private state and waits for Zero through the %s route',
    route => {
      mocks.zeroReady = false;
      mocks.access.mockReturnValue({
        data: { exists: true, visibilities: ['private'], canAccessPrivate: true },
        isLoading: false,
        error: new Error('offline'),
        recoveryDraft: { id: 'draft-1' },
      });
      const Component = (route as unknown as TestRoute).component;
      render(<Component />);

      expect(mocks.guard).toHaveBeenLastCalledWith(
        expect.objectContaining({
          entityExists: true,
          hasError: true,
          isLoading: true,
          visibilities: ['private'],
          canAccessPrivate: true,
          recoveryDraft: { id: 'draft-1' },
        })
      );
    }
  );

  it('handles anonymous, foreign and own user profiles', () => {
    const Component = (UserRoute as unknown as TestRoute).component;
    render(<Component />);
    expect(mocks.preloadUser).toHaveBeenLastCalledWith('entity-1', false);
    expect(mocks.guard).toHaveBeenLastCalledWith(
      expect.objectContaining({ canAccessPrivate: false })
    );
    cleanup();

    mocks.authUser = { id: 'other-user' };
    render(<Component />);
    expect(mocks.preloadUser).toHaveBeenLastCalledWith('entity-1', false);
    cleanup();

    mocks.authUser = { id: 'other-user' };
    mocks.zeroReady = true;
    mocks.access.mockReturnValue({
      data: { exists: true, visibilities: [] },
      isLoading: false,
      error: null,
    });
    render(<Component />);
    expect(mocks.guard).toHaveBeenLastCalledWith(expect.objectContaining({ isLoading: false }));
    cleanup();

    mocks.authUser = { id: 'entity-1' };
    mocks.zeroReady = false;
    mocks.access.mockReturnValue({
      data: { exists: true, visibilities: ['members'] },
      isLoading: true,
      error: new Error('failed'),
    });
    render(<Component />);
    expect(mocks.preloadUser).toHaveBeenLastCalledWith('entity-1', true);
    expect(mocks.guard).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityExists: true,
        hasError: true,
        isLoading: true,
        visibilities: ['members'],
        canAccessPrivate: true,
      })
    );
  });
});
