/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  entityNotifications: vi.fn(),
  event: undefined as undefined | { title?: string | null },
  group: undefined as undefined | { name?: string | null },
  isABlogger: vi.fn(),
  isMember: vi.fn(),
  isParticipant: vi.fn(),
  loading: false,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ entryId: 'blog-1', id: 'entity-1' }),
  }),
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div>access-denied</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div>loading</div>,
}));
vi.mock('@/features/notifications/ui/EntityNotifications.tsx', () => ({
  EntityNotifications: (props: Record<string, unknown>) => {
    mocks.entityNotifications(props);
    return <div>entity-notifications</div>;
  },
}));
vi.mock('@/features/blogs/ui/BlogNotifications', () => ({
  BlogNotifications: ({ blogId }: { blogId: string }) => <div>blog:{blogId}</div>,
}));
vi.mock('@/features/blogs/ui/ResolvedBlogRedirect', () => ({
  ResolvedBlogRedirect: ({ blogId, target }: { blogId: string; target: string }) => (
    <div>{`${blogId}:${target}`}</div>
  ),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupById: () => ({ group: mocks.group }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventById: () => ({ event: mocks.event }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({
    can: mocks.can,
    isABlogger: mocks.isABlogger,
    isLoading: mocks.loading,
    isMember: mocks.isMember,
    isParticipant: mocks.isParticipant,
  }),
}));

import { Route as CanonicalBlogRoute } from '../_authed/blog/$id/notifications';
import { Route as EventRoute } from '../_authed/event/$id/notifications';
import { Route as GroupRoute } from '../_authed/group/$id/notifications';
import { Route as GroupBlogRoute } from '../_authed/group/$id/blog/$entryId/notifications';
import { Route as UserBlogRoute } from '../_authed/user/$id/blog/$entryId/notifications';

interface TestRoute {
  component: React.ComponentType;
}
const component = (route: unknown) => (route as TestRoute).component;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockReturnValue(true);
  mocks.event = undefined;
  mocks.group = undefined;
  mocks.isABlogger.mockReturnValue(true);
  mocks.isMember.mockReturnValue(true);
  mocks.isParticipant.mockReturnValue(true);
  mocks.loading = false;
});

afterEach(() => cleanup());

describe('notification routes', () => {
  it.each([
    [GroupRoute, mocks.isMember, 'entity-notifications'],
    [EventRoute, mocks.isParticipant, 'entity-notifications'],
    [GroupBlogRoute, mocks.isABlogger, 'blog:blog-1'],
    [UserBlogRoute, mocks.isABlogger, 'blog:blog-1'],
  ] as const)('handles loading, membership, rights and content', (route, membership, content) => {
    const Component = component(route);
    mocks.loading = true;
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();

    mocks.loading = false;
    membership.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    expect(mocks.can).not.toHaveBeenCalled();
    cleanup();

    membership.mockReturnValue(true);
    mocks.can.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.can.mockReturnValue(true);
    render(<Component />);
    expect(screen.getByText(content)).toBeTruthy();
  });

  it('maps absent and present group and event names', () => {
    let Component = component(GroupRoute);
    render(<Component />);
    expect(mocks.entityNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityName: '' })
    );
    cleanup();
    mocks.group = { name: 'Group' };
    render(<Component />);
    expect(mocks.entityNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityName: 'Group' })
    );
    cleanup();

    Component = component(EventRoute);
    render(<Component />);
    expect(mocks.entityNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityName: '' })
    );
    cleanup();
    mocks.event = { title: 'Assembly' };
    render(<Component />);
    expect(mocks.entityNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityName: 'Assembly' })
    );
  });

  it('forwards canonical blog notifications', () => {
    const Component = component(CanonicalBlogRoute);
    render(<Component />);
    expect(screen.getByText('entity-1:notifications')).toBeTruthy();
  });
});
