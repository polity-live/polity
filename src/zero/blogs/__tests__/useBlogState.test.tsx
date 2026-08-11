/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown>();
  const statuses = new Map<string, string>();
  const blogs = new Proxy(
    {},
    {
      get: (_target, property: string) => (args: unknown) => ({
        key: `blogs.${property}`,
        args,
      }),
    }
  );
  return {
    results,
    statuses,
    queries: { blogs },
    useQuery: vi.fn((query?: { key?: string }) => [
      query?.key ? results.get(query.key) : undefined,
      { type: query?.key ? (statuses.get(query.key) ?? 'complete') : 'complete' },
    ]),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('../../queries', () => ({ queries: mocks.queries }));

import { useBlogState } from '../useBlogState';

const allOptions = {
  blogId: 'blog-1',
  groupId: 'group-1',
  userId: 'user-1',
  includeBloggers: true,
  includeManagement: true,
  includeDetails: true,
  includeHashtags: true,
  includeForEditor: true,
  includeVersions: true,
  includeSubscribers: true,
  includeComments: true,
};

beforeEach(() => {
  mocks.results.clear();
  mocks.statuses.clear();
  mocks.useQuery.mockClear();
});

describe('useBlogState query contract', () => {
  it('keeps every query disabled and normalizes defaults', () => {
    expect(renderHook(() => useBlogState()).result.current).toEqual({
      blog: undefined,
      entries: [],
      blogWithBloggers: undefined,
      blogWithManagement: undefined,
      blogWithDetails: undefined,
      blogWithHashtags: undefined,
      blogForEditor: undefined,
      versions: [],
      subscriberCount: 0,
      subscribers: [],
      comments: [],
      blogThread: null,
      blogsByGroup: [],
      bloggersByUser: [],
      isLoading: false,
    });
    expect(mocks.useQuery.mock.calls.every(([query]) => query === undefined)).toBe(true);
  });

  it('returns every requested projection without reshaping query data', () => {
    const values: Record<string, unknown> = {
      'blogs.byId': { id: 'blog-1', subscriber_count: 7 },
      'blogs.entries': [{ id: 'entry-1' }],
      'blogs.byIdWithBloggers': [{ id: 'bloggers' }],
      'blogs.byIdWithManagement': [{ id: 'management' }],
      'blogs.byIdWithDetails': [{ id: 'details' }],
      'blogs.byIdWithHashtags': [{ id: 'hashtags' }],
      'blogs.byIdForEditor': [{ id: 'editor' }],
      'blogs.versionsByBlogId': [{ id: 'version-1' }],
      'blogs.subscribers': [{ id: 'subscriber-1' }, { id: 'subscriber-2' }],
      'blogs.blogThread': { id: 'thread-1', comments: [{ id: 'comment-1' }] },
      'blogs.byGroupWithHashtags': [{ id: 'group-blog-1' }],
      'blogs.bloggersByUser': [{ id: 'blogger-1' }],
    };
    for (const [key, value] of Object.entries(values)) mocks.results.set(key, value);

    expect(renderHook(() => useBlogState(allOptions)).result.current).toEqual({
      blog: values['blogs.byId'],
      entries: values['blogs.entries'],
      blogWithBloggers: values['blogs.byIdWithBloggers'],
      blogWithManagement: values['blogs.byIdWithManagement'],
      blogWithDetails: values['blogs.byIdWithDetails'],
      blogWithHashtags: values['blogs.byIdWithHashtags'],
      blogForEditor: values['blogs.byIdForEditor'],
      versions: values['blogs.versionsByBlogId'],
      subscriberCount: 2,
      subscribers: values['blogs.subscribers'],
      comments: [{ id: 'comment-1' }],
      blogThread: values['blogs.blogThread'],
      blogsByGroup: values['blogs.byGroupWithHashtags'],
      bloggersByUser: values['blogs.bloggersByUser'],
      isLoading: false,
    });
  });

  it('uses each subscriber and thread fallback according to readiness', () => {
    mocks.results.set('blogs.byId', { id: 'blog-1', subscriber_count: 7 });
    mocks.statuses.set('blogs.subscribers', 'unknown');
    expect(
      renderHook(() => useBlogState({ blogId: 'blog-1', includeSubscribers: true })).result.current
        .subscriberCount
    ).toBe(7);

    mocks.statuses.delete('blogs.subscribers');
    expect(
      renderHook(() => useBlogState({ blogId: 'blog-1', includeSubscribers: true })).result.current
        .subscriberCount
    ).toBe(7);
    mocks.results.set('blogs.byId', { id: 'blog-1', subscriber_count: null });
    expect(
      renderHook(() => useBlogState({ blogId: 'blog-1', includeSubscribers: true })).result.current
        .subscriberCount
    ).toBe(0);
    mocks.results.set('blogs.subscribers', []);
    expect(
      renderHook(() => useBlogState({ blogId: 'blog-1', includeSubscribers: true })).result.current
        .subscriberCount
    ).toBe(0);

    mocks.results.set('blogs.blogThread', { id: 'thread-empty', comments: null });
    expect(
      renderHook(() => useBlogState({ blogId: 'blog-1', includeComments: true })).result.current
        .comments
    ).toEqual([]);
  });

  it('reports every enabled query boundary independently as loading', () => {
    const boundaries = [
      'blogs.byId',
      'blogs.entries',
      'blogs.byIdWithBloggers',
      'blogs.byIdWithManagement',
      'blogs.byIdWithDetails',
      'blogs.byIdWithHashtags',
      'blogs.byIdForEditor',
      'blogs.versionsByBlogId',
      'blogs.subscribers',
      'blogs.blogThread',
      'blogs.byGroupWithHashtags',
      'blogs.bloggersByUser',
    ];
    for (const key of boundaries) {
      mocks.statuses.set(key, 'unknown');
      expect(renderHook(() => useBlogState(allOptions)).result.current.isLoading).toBe(true);
      mocks.statuses.delete(key);
    }
  });

  it('does not count disabled opt-ins as loading even if unrelated keys are unknown', () => {
    for (const key of [
      'blogs.byIdWithBloggers',
      'blogs.byIdWithManagement',
      'blogs.byIdWithDetails',
      'blogs.byIdWithHashtags',
      'blogs.byIdForEditor',
      'blogs.versionsByBlogId',
      'blogs.subscribers',
      'blogs.blogThread',
    ]) {
      mocks.statuses.set(key, 'unknown');
    }
    expect(renderHook(() => useBlogState({ blogId: 'blog-1' })).result.current.isLoading).toBe(
      false
    );
  });
});
