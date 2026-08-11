/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  memberships: undefined as any,
  participations: undefined as any,
  collaborations: undefined as any,
  blogs: undefined as any,
  waitForClientApply: vi.fn(async (value: unknown) => value),
  createTimelineEvent: vi.fn(),
  groupActions: { leaveGroup: vi.fn(), acceptInvitation: vi.fn() },
  eventActions: { leaveEvent: vi.fn(), updateParticipant: vi.fn() },
  amendmentActions: { leaveCollaboration: vi.fn(), updateCollaborator: vi.fn() },
  blogActions: { deleteEntry: vi.fn(), updateEntry: vi.fn() },
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: () => ({ userMemberships: mocks.memberships }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventState: () => ({ participantsByUser: mocks.participations }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({ collaboratorsByUser: mocks.collaborations }),
}));
vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({ bloggersByUser: mocks.blogs }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({ useGroupActions: () => mocks.groupActions }));
vi.mock('@/zero/events/useEventActions', () => ({ useEventActions: () => mocks.eventActions }));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => mocks.amendmentActions,
}));
vi.mock('@/zero/blogs/useBlogActions', () => ({ useBlogActions: () => mocks.blogActions }));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/timeline/utils/createTimelineEvent', () => ({
  createTimelineEvent: mocks.createTimelineEvent,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, string>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { useUserMemberships } from '../useUserMemberships';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.memberships = undefined;
  mocks.participations = undefined;
  mocks.collaborations = undefined;
  mocks.blogs = undefined;
  mocks.waitForClientApply.mockImplementation(async value => value);
  for (const actions of [
    mocks.groupActions,
    mocks.eventActions,
    mocks.amendmentActions,
    mocks.blogActions,
  ]) {
    for (const action of Object.values(actions)) action.mockReturnValue({ mutation: true });
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useUserMemberships branch contract', () => {
  it('normalizes missing rows and executes every successful leave/invite/request action', async () => {
    const { result } = renderHook(() => useUserMemberships('user-1', 'Ada'));
    expect(result.current.memberships).toEqual([]);
    expect(result.current.participations).toEqual([]);
    expect(result.current.collaborations).toEqual([]);
    expect(result.current.blogRelations).toEqual([]);

    const actions: [keyof typeof result.current, string][] = [
      ['leaveGroup', 'membership'],
      ['declineGroupInvitation', 'membership'],
      ['withdrawGroupRequest', 'membership'],
      ['withdrawFromEvent', 'participant'],
      ['acceptEventInvitation', 'participant'],
      ['declineEventInvitation', 'participant'],
      ['withdrawEventRequest', 'participant'],
      ['leaveCollaboration', 'collaboration'],
      ['declineCollaborationInvitation', 'collaboration'],
      ['withdrawCollaborationRequest', 'collaboration'],
      ['leaveBlog', 'blog'],
      ['acceptBlogInvitation', 'blog'],
      ['declineBlogInvitation', 'blog'],
      ['withdrawBlogRequest', 'blog'],
    ];
    for (const [name, id] of actions) {
      await expect((result.current[name] as any)(id)).resolves.toEqual({ success: true });
    }
  });

  it('creates group timelines for named and fallback groups and skips absent snapshots or users', async () => {
    mocks.memberships = [
      { id: 'named', group: { id: 'group-1', name: 'Group' } },
      { id: 'fallback', group: { id: 'group-2', name: '' } },
      { id: 'missing', group: null },
    ];
    const named = renderHook(() => useUserMemberships('user-1', 'Ada'));
    await act(() => named.result.current.acceptGroupInvitation('named'));
    await act(() => named.result.current.acceptGroupInvitation('fallback'));
    await act(() => named.result.current.acceptGroupInvitation('missing'));
    expect(mocks.createTimelineEvent).toHaveBeenCalledTimes(2);

    cleanup();
    mocks.createTimelineEvent.mockClear();
    const anonymous = renderHook(() => useUserMemberships(undefined, undefined));
    await act(() => anonymous.result.current.acceptGroupInvitation('named'));
    expect(mocks.createTimelineEvent).not.toHaveBeenCalled();
  });

  it('creates only public amendment timelines and covers snapshot/title/user fallbacks', async () => {
    mocks.collaborations = [
      {
        id: 'public',
        amendment: { id: 'amendment-1', title: 'Title', visibility: 'public' },
      },
      {
        id: 'fallback-title',
        amendment: { id: 'amendment-2', title: '', visibility: 'public' },
      },
      {
        id: 'private',
        amendment: { id: 'amendment-3', title: 'Private', visibility: 'private' },
      },
      { id: 'missing', amendment: null },
    ];
    const publicUser = renderHook(() => useUserMemberships('user-1', 'Ada'));
    for (const id of ['public', 'fallback-title', 'private', 'missing']) {
      await act(() => publicUser.result.current.acceptCollaborationInvitation(id));
    }
    expect(mocks.createTimelineEvent).toHaveBeenCalledTimes(2);

    cleanup();
    mocks.createTimelineEvent.mockClear();
    const noUser = renderHook(() => useUserMemberships(undefined, undefined));
    await act(() => noUser.result.current.acceptCollaborationInvitation('public'));
    expect(mocks.createTimelineEvent).not.toHaveBeenCalled();
  });

  it('returns a failure object from every catch boundary', async () => {
    mocks.memberships = [{ id: 'membership', group: { id: 'group', name: 'Group' } }];
    mocks.collaborations = [
      {
        id: 'collaboration',
        amendment: { id: 'amendment', title: 'Title', visibility: 'public' },
      },
    ];
    mocks.waitForClientApply.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useUserMemberships('user-1', 'Ada'));
    const actions: [keyof typeof result.current, string][] = [
      ['leaveGroup', 'membership'],
      ['acceptGroupInvitation', 'membership'],
      ['declineGroupInvitation', 'membership'],
      ['withdrawGroupRequest', 'membership'],
      ['withdrawFromEvent', 'participant'],
      ['acceptEventInvitation', 'participant'],
      ['declineEventInvitation', 'participant'],
      ['withdrawEventRequest', 'participant'],
      ['leaveCollaboration', 'collaboration'],
      ['acceptCollaborationInvitation', 'collaboration'],
      ['declineCollaborationInvitation', 'collaboration'],
      ['withdrawCollaborationRequest', 'collaboration'],
      ['leaveBlog', 'blog'],
      ['acceptBlogInvitation', 'blog'],
      ['declineBlogInvitation', 'blog'],
      ['withdrawBlogRequest', 'blog'],
    ];
    for (const [name, id] of actions) {
      await expect((result.current[name] as any)(id)).resolves.toEqual(
        expect.objectContaining({ success: false, error: expect.any(Error) })
      );
    }
    expect(console.error).toHaveBeenCalledTimes(actions.length);
  });
});
