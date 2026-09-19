/* @vitest-environment jsdom */
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loading: false, preference: null as unknown, mutate: vi.fn() }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../usePreferenceState', () => ({
  usePreferenceState: () => ({ preference: mocks.preference, isLoading: mocks.loading }),
}));
vi.mock('../../mutators', () => ({
  mutators: {
    preferences: {
      setWorkspaceFavorite: (args: unknown) => ({ type: 'favorite', args }),
      setWorkspaceDisplay: (args: unknown) => ({ type: 'display', args }),
    },
  },
}));
import { useWorkspacePreferences } from '../useWorkspacePreferences';
afterEach(cleanup);
beforeEach(() => {
  mocks.loading = false;
  mocks.preference = null;
  mocks.mutate.mockReset().mockReturnValue({ server: Promise.resolve({ type: 'success' }) });
});

it('rejects edits while preferences load and preserves server confirmation for personal display choices', async () => {
  mocks.loading = true;
  const { result, rerender } = renderHook(useWorkspacePreferences);
  const favorite = { kind: 'group' as const, href: '/group/one', title: 'x'.repeat(300) };
  await expect(result.current.setFavorite(favorite, true)).rejects.toThrow('still loading');
  await expect(result.current.setDisplay({ todoView: 'list' })).rejects.toThrow('still loading');
  expect(mocks.mutate).not.toHaveBeenCalled();
  mocks.loading = false;
  mocks.preference = {
    workspace_preferences: { favorites: [], display: { searchView: 'compact' } },
  };
  rerender();
  expect(result.current.display.searchView).toBe('compact');
  await result.current.setFavorite(favorite, true);
  expect(mocks.mutate).toHaveBeenCalledWith({
    type: 'favorite',
    args: {
      id: expect.any(String),
      active: true,
      favorite: { ...favorite, title: 'x'.repeat(240) },
    },
  });
  let confirm!: (value: { type: 'success' }) => void;
  mocks.mutate.mockReturnValueOnce({
    server: new Promise(resolve => {
      confirm = resolve;
    }),
  });
  let saved = false;
  const pending = result.current.setDisplay({ todoView: 'list' }).then(() => {
    saved = true;
  });
  await Promise.resolve();
  expect(saved).toBe(false);
  confirm({ type: 'success' });
  await pending;
  expect(saved).toBe(true);
  mocks.mutate.mockReturnValueOnce({
    server: Promise.resolve({
      type: 'error',
      error: { type: 'app', message: 'permission_denied' },
    }),
  });
  await expect(result.current.setDisplay({ timelineMapVisible: true })).rejects.toThrow();
});
