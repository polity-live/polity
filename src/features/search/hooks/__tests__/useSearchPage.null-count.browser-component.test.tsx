import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSearchPage } from '../useSearchPage';

const state = vi.hoisted(() => ({ url: {} as Record<string, unknown> }));
vi.mock('@tanstack/react-router', () => ({ useSearch: () => ({}) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/zero/observed-query', () => ({ useQuery: () => [undefined] }));
vi.mock('@/zero/queries', () => ({
  queries: { search: { searchDocumentTopics: () => ({}) } },
}));
vi.mock('@/zero/common/useUserHashtagsState', () => ({
  useUserHashtagsState: () => ({ userHashtags: [] }),
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtagTags: () => [] }));
vi.mock('../useSearchURL', () => ({ useSearchURL: () => state.url }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('keeps unknown result reports from triggering a redundant search-page render', () => {
  state.url = {
    searchQuery: 'benchmark Base Group',
    contentTypes: ['group'],
    dateRange: 'all',
    topics: [],
    engagement: 'all',
    sortBy: 'recent',
    view: 'list',
  };
  // Auxiliary topic subscriptions run after the first paint; isolate the
  // initial grid count report from those later, independent updates.
  vi.stubGlobal('requestIdleCallback', () => 1);
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  let renders = 0;
  const hook = renderHook(() => {
    renders++;
    return useSearchPage();
  });
  const initialRenders = renders;
  act(() => hook.result.current.setTotalResults(null));
  expect(renders).toBe(initialRenders);
  expect(hook.result.current.totalResults).toBeNull();

  state.url = { ...state.url, searchQuery: 'another group' };
  hook.rerender();
  const changedContextRenders = renders;
  act(() => hook.result.current.setTotalResults(null));
  expect(renders).toBe(changedContextRenders);
  expect(hook.result.current.totalResults).toBeNull();

  act(() => hook.result.current.setTotalResults(0));
  expect(hook.result.current.totalResults).toBe(0);
  act(() => hook.result.current.setTotalResults(12));
  expect(hook.result.current.totalResults).toBe(12);
});
