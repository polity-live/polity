/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authUser: null as null | { email?: string | null; id: string },
  blogEdit: vi.fn(),
  blogPermission: { canEdit: true, isLoading: false },
  can: vi.fn(),
  canManage: vi.fn(),
  canView: vi.fn(),
  currentUser: undefined as
    | undefined
    | {
        avatar?: string | null;
        first_name?: string | null;
        handle?: string | null;
        id: string;
        last_name?: string | null;
      },
  editor: vi.fn(),
  isMember: vi.fn(),
  navigate: vi.fn(),
  params: { docId: 'doc-1', entryId: 'entry-1', id: 'entity-1' },
  permissionsLoading: false,
  search: { tab: undefined as 'general' | 'tags' | undefined },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params,
    useSearch: () => mocks.search,
  }),
  Outlet: () => <div>outlet</div>,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div>access-denied</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div>loading</div>,
}));
vi.mock('@/features/blogs/hooks/useBlogPermissions', () => ({
  useBlogPermissions: () => mocks.blogPermission,
}));
vi.mock('@/features/blogs/ui/BlogEdit', () => ({
  BlogEdit: (props: Record<string, any>) => {
    mocks.blogEdit(props);
    return <button onClick={() => props.onTabChange('tags')}>blog-edit</button>;
  },
}));
vi.mock('@/features/editor/ui/EditorView', () => ({
  EditorView: (props: Record<string, unknown>) => {
    mocks.editor(props);
    return <div>editor</div>;
  },
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: mocks.currentUser }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({
    can: mocks.can,
    canManage: mocks.canManage,
    canView: mocks.canView,
    isLoading: mocks.permissionsLoading,
    isMember: mocks.isMember,
  }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({
    can: mocks.can,
    canManage: mocks.canManage,
    canView: mocks.canView,
    isLoading: mocks.permissionsLoading,
    isMember: mocks.isMember,
  }),
}));
vi.mock('@/features/auth/EnsureUser', () => ({ EnsureUser: ({ children }: any) => children }));
vi.mock('@/providers/zero-ready-context', () => ({ useZeroReady: () => true }));
vi.mock('@/features/auth/logic/guestEntityRouteAccess', () => ({
  isGuestAccessibleEntityPath: () => false,
}));

import { mapEditorUserRecord } from '../_authed';
import { Route as GroupBlogEditRoute } from '../_authed/group/$id/blog/$entryId/edit';
import { Route as GroupBlogEditorRoute } from '../_authed/group/$id/blog/$entryId/editor';
import { Route as GroupEditorRoute } from '../_authed/group/$id/editor';
import { Route as GroupEditorDocRoute } from '../_authed/group/$id/editor/$docId';
import { Route as UserBlogEditRoute } from '../_authed/user/$id/blog/$entryId/edit';
import { Route as UserBlogEditorRoute } from '../_authed/user/$id/blog/$entryId/editor';
import { Route as UserEditorRoute } from '../_authed/user/$id/editor';
import { Route as UserEditorDocRoute } from '../_authed/user/$id/editor/$docId';

interface TestRoute {
  component: React.ComponentType;
}
const component = (route: unknown) => (route as TestRoute).component;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authUser = { email: 'user@example.com', id: 'entity-1' };
  mocks.blogPermission = { canEdit: true, isLoading: false };
  mocks.can.mockReturnValue(true);
  mocks.canManage.mockReturnValue(true);
  mocks.canView.mockReturnValue(true);
  mocks.currentUser = undefined;
  mocks.isMember.mockReturnValue(true);
  mocks.navigate.mockResolvedValue(undefined);
  mocks.permissionsLoading = false;
  mocks.search = { tab: undefined };
});

afterEach(() => cleanup());

describe('editor route user mapping', () => {
  it('maps absent, named, handled and anonymous-profile records', () => {
    expect(mapEditorUserRecord(undefined, undefined)).toBeUndefined();
    expect(
      mapEditorUserRecord(
        {
          id: 'user-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          handle: 'ada',
          avatar: 'avatar.png',
        },
        'ada@example.com'
      )
    ).toEqual({
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      avatar: 'avatar.png',
    });
    expect(
      mapEditorUserRecord(
        { id: 'user-2', first_name: '', last_name: null, handle: 'handle', avatar: null },
        null
      )
    ).toEqual({ id: 'user-2', name: 'handle', email: undefined, avatar: undefined });
    expect(mapEditorUserRecord({ id: 'user-3' }, undefined)?.name).toBe('');
  });
});

describe('blog editor routes', () => {
  it.each([GroupBlogEditorRoute, UserBlogEditorRoute])(
    'renders loading, denied and editable states',
    route => {
      const Component = component(route);
      mocks.blogPermission = { canEdit: true, isLoading: true };
      render(<Component />);
      expect(screen.getByText('loading')).toBeTruthy();
      cleanup();

      mocks.blogPermission = { canEdit: false, isLoading: false };
      mocks.authUser = null;
      render(<Component />);
      expect(screen.getByText('access-denied')).toBeTruthy();
      cleanup();

      mocks.authUser = { id: 'entity-1', email: 'user@example.com' };
      mocks.currentUser = {
        id: 'entity-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        avatar: 'avatar.png',
      };
      if (route === GroupBlogEditorRoute) mocks.can.mockReturnValue(true);
      else mocks.blogPermission = { canEdit: true, isLoading: false };
      render(<Component />);
      expect(screen.getByText('editor')).toBeTruthy();
      expect(mocks.editor).toHaveBeenLastCalledWith(
        expect.objectContaining({
          entityType: 'blog',
          entityId: 'entry-1',
          userId: 'entity-1',
          userRecord: expect.objectContaining({ name: 'Ada Lovelace' }),
        })
      );
    }
  );

  it('requires either direct edit or group-management permission for group blogs', () => {
    const Component = component(GroupBlogEditorRoute);
    mocks.blogPermission = { canEdit: false, isLoading: false };
    mocks.can.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    expect(mocks.can).toHaveBeenCalledWith('manage', 'groups');
    cleanup();

    mocks.blogPermission = { canEdit: true, isLoading: false };
    mocks.can.mockClear();
    render(<Component />);
    expect(screen.getByText('editor')).toBeTruthy();
    expect(mocks.can).not.toHaveBeenCalled();
  });

  it('waits for group permission state independently', () => {
    mocks.permissionsLoading = true;
    const Component = component(GroupBlogEditorRoute);
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
  });
});

describe('document editor routes', () => {
  it.each([UserEditorRoute, UserEditorDocRoute])('guards foreign user documents', route => {
    const Component = component(route);
    mocks.authUser = null;
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.authUser = { id: 'other-user' };
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.authUser = { id: 'entity-1', email: 'owner@example.com' };
    render(<Component />);
    expect(screen.getByText('editor')).toBeTruthy();
  });

  it('maps the current user for a user document', () => {
    mocks.currentUser = { id: 'entity-1', handle: 'owner' };
    const Component = component(UserEditorDocRoute);
    render(<Component />);
    expect(mocks.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityType: 'document',
        entityId: 'doc-1',
        userRecord: expect.objectContaining({ name: 'owner' }),
      })
    );
  });

  it('renders managed and read-only group documents with or without an authenticated user', () => {
    const Component = component(GroupEditorDocRoute);
    mocks.authUser = null;
    mocks.canManage.mockReturnValue(false);
    render(<Component />);
    expect(mocks.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: undefined, userRecord: undefined, readOnly: true })
    );
    cleanup();

    mocks.authUser = { id: 'user-1', email: null };
    mocks.currentUser = { id: 'user-1' };
    mocks.canManage.mockReturnValue(true);
    render(<Component />);
    expect(mocks.editor).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: 'user-1', readOnly: false })
    );
  });

  it('guards the group editor layout while permissions load or deny access', () => {
    const Component = component(GroupEditorRoute);
    mocks.permissionsLoading = true;
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();

    mocks.permissionsLoading = false;
    mocks.isMember.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    expect(mocks.canView).not.toHaveBeenCalled();
    cleanup();

    mocks.isMember.mockReturnValue(true);
    mocks.canView.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.canView.mockReturnValue(true);
    render(<Component />);
    expect(screen.getByText('outlet')).toBeTruthy();
  });
});

describe('blog settings routes', () => {
  it.each([
    [GroupBlogEditRoute, 'groupId'],
    [UserBlogEditRoute, 'userId'],
  ] as const)('handles loading, denial, defaults and tab navigation', (route, ownerProp) => {
    const Component = component(route);
    mocks.blogPermission = { canEdit: false, isLoading: true };
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();

    mocks.blogPermission = { canEdit: false, isLoading: false };
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.blogPermission = { canEdit: true, isLoading: false };
    render(<Component />);
    expect(mocks.blogEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blogId: 'entry-1',
        [ownerProp]: 'entity-1',
        activeTab: 'general',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'blog-edit' }));
    const updater = mocks.navigate.mock.calls.at(-1)?.[0].search;
    expect(updater({ preserved: true })).toEqual({ preserved: true, tab: 'tags' });
    cleanup();

    mocks.search = { tab: 'tags' };
    render(<Component />);
    expect(mocks.blogEdit).toHaveBeenLastCalledWith(expect.objectContaining({ activeTab: 'tags' }));
  });
});
