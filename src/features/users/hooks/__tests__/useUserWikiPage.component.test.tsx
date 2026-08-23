/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'viewer-1' } as { id: string } | null,
  user: null as any,
  isLoading: false,
  error: null as unknown,
  userDataId: vi.fn(),
  subscriptionStatus: undefined as any,
  subscriptionId: vi.fn(),
  subscribed: false,
  subscriberCount: 0,
  subscribeLoading: false,
  toggleSubscribe: vi.fn(),
  subscribeId: vi.fn(),
  access: vi.fn(),
  plainText: vi.fn(),
  location: vi.fn(),
  avatar: vi.fn(),
  navigate: vi.fn(),
  searchTerms: {
    all: '',
    blogs: '',
    groups: '',
    amendments: '',
    statements: '',
  },
  searchChange: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock('../useUserData', () => ({
  useUserData: (userId: string | undefined) => {
    mocks.userDataId(userId);
    return { user: mocks.user, isLoading: mocks.isLoading, error: mocks.error };
  },
}));
vi.mock('@/zero/payments/usePaymentState', () => ({
  useSubscriptionStatusByUser: (userId: string | undefined) => {
    mocks.subscriptionId(userId);
    return { subscriptionStatus: mocks.subscriptionStatus };
  },
}));
vi.mock('@/features/payments/hooks/useSubscribeUser', () => ({
  useSubscribeUser: (userId: string | undefined) => {
    mocks.subscribeId(userId);
    return {
      isSubscribed: mocks.subscribed,
      subscriberCount: mocks.subscriberCount,
      toggleSubscribe: mocks.toggleSubscribe,
      isLoading: mocks.subscribeLoading,
    };
  },
}));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({ checkEntityAccess: mocks.access }));
vi.mock('@/features/shared/logic/richText', () => ({ richTextToPlainText: mocks.plainText }));
vi.mock('@/features/shared/logic/locationHelpers', () => ({ formatLocation: mocks.location }));
vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  resolveAssistantAvatar: mocks.avatar,
}));
vi.mock('@/features/users/state/useUserWikiContentSearch', () => ({
  useUserWikiContentSearch: () => ({
    searchTerms: mocks.searchTerms,
    handleSearchChange: mocks.searchChange,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useUserWikiPage } from '../useUserWikiPage';

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    visibility: 'public',
    bio: { type: 'doc' },
    about: { type: 'doc' },
    avatar: 'avatar.png',
    handle: 'ada',
    group_count: 3,
    amendment_count: 4,
    user_hashtags: [],
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authUser = { id: 'viewer-1' };
  mocks.user = profile();
  mocks.isLoading = false;
  mocks.error = null;
  mocks.subscriptionStatus = undefined;
  mocks.subscribed = false;
  mocks.subscriberCount = 7;
  mocks.subscribeLoading = false;
  mocks.access.mockReturnValue(true);
  mocks.plainText.mockImplementation((value: unknown) => (value ? 'plain text' : ''));
  mocks.location.mockReturnValue('Berlin, Germany');
  mocks.avatar.mockReturnValue('resolved-avatar.png');
});

describe('useUserWikiPage status states', () => {
  it('uses the authenticated user id and returns loading copy', () => {
    mocks.isLoading = true;
    const { result } = renderHook(() => useUserWikiPage({}));
    expect(result.current).toMatchObject({ status: 'loading' });
    expect(result.current.copy.loading).toBe('common.loading.pageSkeleton.profile');
    expect(mocks.userDataId).toHaveBeenCalledWith('viewer-1');
    expect(mocks.subscriptionId).toHaveBeenCalledWith('viewer-1');
    expect(mocks.subscribeId).toHaveBeenCalledWith('viewer-1');
  });

  it('returns the original loading error', () => {
    const error = new Error('offline');
    mocks.error = error;
    const { result } = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(result.current).toEqual({
      status: 'error',
      copy: expect.any(Object),
      error,
    });
  });

  it('returns not-found for a missing user and for a missing resolved id', () => {
    mocks.user = null;
    const missingUser = renderHook(() => useUserWikiPage({ userId: 'missing' }));
    expect(missingUser.result.current.status).toBe('not-found');
    missingUser.unmount();

    mocks.authUser = null;
    mocks.user = profile();
    const missingId = renderHook(() => useUserWikiPage({}));
    expect(missingId.result.current.status).toBe('not-found');
    expect(mocks.userDataId).toHaveBeenLastCalledWith(undefined);
  });

  it('leaves route access to the server guard', () => {
    mocks.access.mockReturnValue(false);
    const { result } = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(result.current.status).toBe('ready');
    expect(mocks.access).not.toHaveBeenCalled();
  });
});

describe('useUserWikiPage ready state', () => {
  it('builds a complete own-user view and filters malformed hashtags', () => {
    mocks.authUser = { id: 'user-1' };
    mocks.subscribed = true;
    mocks.subscribeLoading = true;
    mocks.user = profile({
      user_hashtags: [
        { hashtag: { id: 'tag-1', tag: 'democracy' } },
        { hashtag: { id: '', tag: 'missing-id' } },
        { hashtag: { id: 'tag-2', tag: '' } },
        { hashtag: null },
      ],
    });
    const { result } = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(result.current).toMatchObject({
      status: 'ready',
      userId: 'user-1',
      isOwnUser: true,
      isAuthenticated: true,
      fullName: 'Ada Lovelace',
      bioText: 'plain text',
      aboutText: 'plain text',
      subscriberCount: 7,
      groupCount: 3,
      amendmentCount: 4,
      subscribed: true,
      subscribeLoading: true,
      hashtags: [{ id: 'tag-1', tag: 'democracy' }],
      userLocation: 'Berlin, Germany',
      shareDescription: 'plain text',
      supportTier: {
        label: 'pages.user.profile.supportBadge.free.label',
        description: 'pages.user.profile.supportBadge.free.description',
      },
    });
    if (result.current.status !== 'ready') throw new Error('Expected ready state');
    expect(result.current.shareContextItem).toEqual(
      expect.objectContaining({
        id: 'user-1',
        title: 'Ada Lovelace',
        authorAvatar: 'resolved-avatar.png',
        handle: 'ada',
        tags: ['democracy'],
      })
    );
    expect(result.current.searchTerms).toBe(mocks.searchTerms);
    expect(result.current.onSearchChange).toBe(mocks.searchChange);
    expect(result.current.onToggleSubscribe).toBe(mocks.toggleSubscribe);
  });

  it('falls back across names, content, location, avatar, handle and hashtag relation', () => {
    mocks.authUser = null;
    mocks.user = profile({
      first_name: '',
      last_name: null,
      bio: null,
      about: { type: 'doc' },
      avatar: null,
      handle: null,
      user_hashtags: undefined,
    });
    mocks.plainText.mockImplementation((value: unknown) => (value ? 'about text' : ''));
    mocks.location.mockReturnValue('');
    mocks.avatar.mockReturnValue(null);
    const { result } = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(result.current).toMatchObject({
      status: 'ready',
      isAuthenticated: false,
      fullName: 'User',
      bioText: undefined,
      aboutText: 'about text',
      userLocation: undefined,
      shareDescription: 'about text',
      hashtags: [],
    });
    if (result.current.status !== 'ready') throw new Error('Expected ready state');
    expect(result.current.shareContextItem).toEqual(
      expect.objectContaining({ authorAvatar: undefined, handle: undefined, location: undefined })
    );
  });

  it('uses no share description when both rich-text fields are empty', () => {
    mocks.user = profile({ bio: null, about: null });
    mocks.plainText.mockReturnValue('');
    const { result } = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(result.current).toMatchObject({
      status: 'ready',
      bioText: undefined,
      aboutText: undefined,
      shareDescription: undefined,
    });
  });

  it.each([
    [200, 'pages.user.profile.supportBadge.runningCosts.label'],
    [1000, 'pages.user.profile.supportBadge.development.label'],
    [750, 'pages.user.profile.supportBadge.yourChoice.label'],
  ])('maps an active %i subscription to its support tier', (amount, label) => {
    mocks.subscriptionStatus = {
      subscriptions: [
        { status: 'canceled', amount: 1000 },
        { status: 'active', amount },
      ],
    };
    const { result } = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(result.current).toMatchObject({ status: 'ready', supportTier: { label } });
  });

  it('uses the free tier for missing, inactive and zero-value subscriptions', () => {
    mocks.subscriptionStatus = { subscriptions: [{ status: 'canceled', amount: 200 }] };
    const inactive = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(inactive.result.current).toMatchObject({
      status: 'ready',
      supportTier: { label: 'pages.user.profile.supportBadge.free.label' },
    });
    inactive.unmount();

    mocks.subscriptionStatus = { subscriptions: [{ status: 'active', amount: 0 }] };
    const zero = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    expect(zero.result.current).toMatchObject({
      status: 'ready',
      supportTier: { label: 'pages.user.profile.supportBadge.free.label' },
    });
  });

  it('navigates to a direct message with the viewed user', () => {
    const { result } = renderHook(() => useUserWikiPage({ userId: 'user-1' }));
    if (result.current.status !== 'ready') throw new Error('Expected ready state');
    const page = result.current;
    act(() => page.onMessage());
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/messages',
      search: { userId: 'user-1' },
    });
  });
});
