// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  location: { pathname: '/unrelated', search: undefined } as {
    pathname: string;
    search?: Record<string, unknown>;
  },
  navigate: vi.fn(),
  unreadNotifications: 0,
  unreadMessages: 0,
  primaryItems: [] as any[],
  secondaryItems: null as any[] | null,
  secondaryArgs: [] as any[][],
  amendmentState: {} as Record<string, any>,
  manage: new Set<string>(),
  view: new Set<string>(),
  update: new Set<string>(),
  canPairs: new Set<string>(),
  member: false,
  participant: false,
  blogger: false,
  collaborator: false,
  author: false,
  me: false,
  operationAccess: false,
  entityUnread: { group: 1, event: 2, amendment: 3, blog: 4 } as Record<string, number>,
  branchTargetIds: new Set<string>(),
  unauthenticatedItems: [{ id: 'public', label: 'Public' }] as any[],
  amendmentOptions: vi.fn(),
  entityUnreadCalls: [] as [string, string][],
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

vi.mock('@/features/navigation/nav-items/nav-items-unauthenticated.tsx', () => ({
  createNavItemsUnauthenticated: () => mocks.unauthenticatedItems,
}));

vi.mock('@/features/navigation/nav-items/nav-items-authenticated.tsx', () => ({
  navItemsAuthenticated: () => ({
    primaryNavItems: mocks.primaryItems,
    getSecondaryNavItems: (...args: any[]) => {
      mocks.secondaryArgs.push(args);
      return mocks.secondaryItems;
    },
  }),
}));

vi.mock('@/features/navigation/state/use-unread-counts.ts', () => ({
  useUnreadNotificationsCount: () => ({ count: mocks.unreadNotifications }),
  useUnreadMessagesCount: () => ({ count: mocks.unreadMessages }),
}));

vi.mock('@/features/groups/logic/hasGroupOperationAccess', () => ({
  hasGroupOperationAccess: () => mocks.operationAccess,
}));

vi.mock('@/zero/amendments/useAmendmentState.ts', () => ({
  useAmendmentState: (options: unknown) => {
    mocks.amendmentOptions(options);
    return mocks.amendmentState;
  },
}));

vi.mock('@/zero/rbac/usePermissions.ts', () => ({
  usePermissions: () => ({
    canManage: (resource: string) => mocks.manage.has(resource),
    canView: (resource: string) => mocks.view.has(resource),
    canUpdate: (resource: string) => mocks.update.has(resource),
    can: (action: string, resource: string) => mocks.canPairs.has(`${action}:${resource}`),
    isMe: () => mocks.me,
    isMember: () => mocks.member,
    isParticipant: () => mocks.participant,
    isABlogger: () => mocks.blogger,
    isCollaborator: () => mocks.collaborator,
    isAuthor: () => mocks.author,
  }),
}));

vi.mock('@/zero/notifications/useEntityUnreadCount.ts', () => ({
  useEntityUnreadCount: (id: string, type: string) => {
    mocks.entityUnreadCalls.push([id, type]);
    return mocks.entityUnread[type] ?? 0;
  },
}));

vi.mock('@/features/navigation/logic/entityNotificationBadge', () => ({
  getEntityNotificationUnreadCount: (route: string | null, counts: Record<string, number>) =>
    route ? (counts[route] ?? 0) : 0,
  withEntityNotificationBadge: (item: any, count: number) => ({ ...item, unreadApplied: count }),
}));

vi.mock('@/features/navigation/logic/amendmentBranchNavigation', () => ({
  getBranchPreservingAmendmentNavTarget: ({ itemId, amendmentId, branchId }: any) =>
    mocks.branchTargetIds.has(itemId)
      ? {
          href: `/amendment/${amendmentId}/${itemId}?branch=${branchId}`,
          to: '/amendment/$id/$tab',
          params: { id: amendmentId, tab: itemId },
          search: { branch: branchId },
        }
      : null,
}));

vi.mock('@/features/navigation/nav-items/nav-helpers', () => ({
  getPrimaryRouteFromPathname: (pathname: string) => {
    const match = pathname.match(/^\/(group|event|amendment|blog|user)(?:\/|$)/);
    return match?.[1] ?? null;
  },
}));

import { useNavigation } from '../useNavigation';

function setPrimaryItems() {
  mocks.primaryItems = [
    { id: 'notifications', label: 'Notifications', badge: 99, href: '/notifications' },
    { id: 'messages', label: 'Messages', badge: 88, href: '/messages' },
    { id: 'plain', label: 'Plain' },
    { id: 'linked', label: 'Linked', href: '/linked' },
  ];
}

describe('useNavigation', () => {
  beforeEach(() => {
    mocks.location = { pathname: '/unrelated', search: undefined };
    mocks.navigate.mockReset();
    mocks.unreadNotifications = 0;
    mocks.unreadMessages = 0;
    setPrimaryItems();
    mocks.secondaryItems = null;
    mocks.secondaryArgs = [];
    mocks.amendmentState = {};
    mocks.manage = new Set();
    mocks.view = new Set();
    mocks.update = new Set();
    mocks.canPairs = new Set();
    mocks.member = false;
    mocks.participant = false;
    mocks.blogger = false;
    mocks.collaborator = false;
    mocks.author = false;
    mocks.me = false;
    mocks.operationAccess = false;
    mocks.branchTargetIds = new Set();
    mocks.amendmentOptions.mockClear();
    mocks.entityUnreadCalls = [];
  });

  it('returns anonymous primary navigation with cleared badges and no entity context', () => {
    const { result } = renderHook(() => useNavigation());

    expect(result.current.currentPrimaryRoute).toBeNull();
    expect(result.current.secondaryNavItems).toBeNull();
    expect(result.current.unauthenticatedNavItems).toBe(mocks.unauthenticatedItems);
    expect(result.current.primaryNavItems).toEqual([
      expect.objectContaining({
        id: 'notifications',
        badge: undefined,
        preloadTarget: { href: '/notifications' },
      }),
      expect.objectContaining({
        id: 'messages',
        badge: undefined,
        preloadTarget: { href: '/messages' },
      }),
      expect.objectContaining({ id: 'plain', badge: undefined }),
      expect.objectContaining({
        id: 'linked',
        badge: undefined,
        preloadTarget: { href: '/linked' },
      }),
    ]);
    expect(mocks.amendmentOptions).toHaveBeenLastCalledWith({
      amendmentId: undefined,
      includeRoles: false,
    });
    expect(mocks.entityUnreadCalls).toEqual([
      ['', 'group'],
      ['', 'event'],
      ['', 'amendment'],
      ['', 'blog'],
    ]);
  });

  it('maps a complete amendment RBAC context and preserves branch navigation', () => {
    mocks.location = { pathname: '/amendment/am-1', search: { branch: 'branch-7' } };
    mocks.unreadNotifications = 5;
    mocks.unreadMessages = 6;
    mocks.amendmentState = {
      amendment: {
        id: 'am-1',
        visibility: 'public',
        created_by: { id: 'creator' },
        group: { id: 'group-from-amendment' },
      },
      roles: [
        {
          id: 'role-1',
          name: 'Owner',
          description: 'Owns',
          scope: 'amendment',
          action_rights: [
            {
              id: 1,
              resource: 'amendments',
              action: 'manage',
              group_id: 'g',
              event_id: 'e',
              amendment_id: 'am-1',
              blog_id: 'b',
            },
            { id: 2, resource: null, action: null },
          ],
        },
        { id: 'role-empty', name: null, description: null, scope: null, action_rights: null },
      ],
      collaborators: [
        { id: 'collab-role', user: { id: 'u' }, role_id: 'role-1' },
        { id: 'collab-missing', user: null, role_id: 'missing' },
      ],
    };
    mocks.manage = new Set(['amendments']);
    mocks.update = new Set(['amendments']);
    mocks.collaborator = true;
    mocks.canPairs = new Set(['viewNotifications:notifications']);
    mocks.secondaryItems = [
      { id: 'text', label: 'Text', href: '/old-text' },
      { id: 'history', label: 'History' },
    ];
    mocks.branchTargetIds = new Set(['text']);

    const { result } = renderHook(() => useNavigation());

    expect(result.current.primaryNavItems[0]).toMatchObject({ badge: 5 });
    expect(result.current.primaryNavItems[1]).toMatchObject({ badge: 6 });
    expect(result.current.secondaryNavItems?.[0]).toMatchObject({
      href: '/amendment/am-1/text?branch=branch-7',
      preloadTarget: { href: '/old-text' },
      unreadApplied: 3,
    });
    expect(result.current.secondaryNavItems?.[1]).toMatchObject({ unreadApplied: 3 });
    act(() => result.current.secondaryNavItems?.[0]?.onClick?.());
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/amendment/$id/$tab',
      params: { id: 'am-1', tab: 'text' },
      search: { branch: 'branch-7' },
    });
    expect(mocks.amendmentOptions).toHaveBeenLastCalledWith({
      amendmentId: 'am-1',
      includeRoles: true,
    });

    const args = mocks.secondaryArgs.at(-1) ?? [];
    expect(args[0]).toBe('amendment');
    expect(args[9]).toBe(true);
    expect(args[10]).toBe(true);
    expect(args[15]).toBe(true);
  });

  it('derives group permissions, nested group blogs, membership management, and notifications', () => {
    mocks.location = { pathname: '/group/group-1/blog/blog-1', search: { branch: 17 } };
    mocks.member = true;
    mocks.me = true;
    mocks.manage = new Set(['groups', 'groupMemberships']);
    mocks.view = new Set(['groupDocuments', 'groupLinks', 'groupPayments', 'groupTodos']);
    mocks.canPairs = new Set(['viewNotifications:groupNotifications']);
    mocks.operationAccess = true;
    mocks.secondaryItems = [{ id: 'overview', label: 'Overview', href: '/group/group-1' }];

    const { result } = renderHook(() => useNavigation());
    expect(result.current.currentPrimaryRoute).toBe('group');
    expect(result.current.secondaryNavItems?.[0]).toMatchObject({ unreadApplied: 1 });
    const args = mocks.secondaryArgs.at(-1) ?? [];
    expect(args[4]).toBe('group-1');
    expect(args[11]).toBe('blog-1');
    expect(args[13]).toBe(true);
    expect(args[14]).toBe(true);
    expect(args[15]).toBe(true);
    expect(args[16]).toBe(true);
    expect(args[17]).toBe(true);
  });

  it('handles event administration and notification access independently', () => {
    mocks.location = { pathname: '/event/event-1' };
    mocks.manage = new Set(['eventParticipants']);
    mocks.participant = true;
    mocks.canPairs = new Set(['viewNotifications:notifications']);
    mocks.secondaryItems = [{ id: 'agenda', label: 'Agenda' }];

    const { result } = renderHook(() => useNavigation());
    expect(result.current.secondaryNavItems?.[0]).toMatchObject({ unreadApplied: 2 });
    expect((mocks.secondaryArgs.at(-1) ?? [])[7]).toBe(true);
  });

  it('handles direct and user-nested blog ownership and notification decisions', () => {
    mocks.location = { pathname: '/blog/blog-direct' };
    mocks.manage = new Set(['blogBloggers']);
    mocks.blogger = true;
    mocks.canPairs = new Set(['viewNotifications:notifications']);
    mocks.secondaryItems = [{ id: 'posts', label: 'Posts' }];
    const direct = renderHook(() => useNavigation());
    expect(direct.result.current.secondaryNavItems?.[0]).toMatchObject({ unreadApplied: 4 });
    expect((mocks.secondaryArgs.at(-1) ?? [])[12]).toBe(true);
    direct.unmount();

    mocks.location = { pathname: '/user/user-1/blog/blog-user' };
    mocks.manage = new Set();
    mocks.blogger = false;
    mocks.canPairs = new Set();
    mocks.secondaryArgs = [];
    const nested = renderHook(() => useNavigation());
    expect(nested.result.current.currentPrimaryRoute).toBe('user');
    expect((mocks.secondaryArgs.at(-1) ?? [])[2]).toBe('user-1');
    expect((mocks.secondaryArgs.at(-1) ?? [])[11]).toBe('blog-user');
    expect((mocks.secondaryArgs.at(-1) ?? [])[15]).toBe(false);
  });

  it('covers authenticated amendment visibility and private permission fallbacks', () => {
    const renderVisibility = (visibility: string, canView: boolean) => {
      mocks.location = { pathname: '/amendment/am-visibility', search: {} };
      mocks.amendmentState = {
        amendment: {
          id: 'am-visibility',
          visibility,
          created_by: null,
          group: null,
        },
        roles: undefined,
        collaborators: undefined,
      };
      mocks.view = canView ? new Set(['amendments']) : new Set();
      mocks.secondaryItems = [{ id: 'overview', label: 'Overview' }];
      mocks.secondaryArgs = [];
      const hook = renderHook(() => useNavigation());
      const canViewArgument = (mocks.secondaryArgs.at(-1) ?? [])[8];
      hook.unmount();
      return canViewArgument;
    };

    expect(renderVisibility('authenticated', false)).toBe(true);
    expect(renderVisibility('private', true)).toBe(true);
    expect(renderVisibility('private', false)).toBe(false);
  });
});
