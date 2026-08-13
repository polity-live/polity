/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const preferenceState = vi.hoisted(() => ({ groupNetworkLayouts: {} as any, isLoading: false }));
const saveMock = vi.hoisted(() => vi.fn());
const resetMock = vi.hoisted(() => vi.fn());

vi.mock('@/zero/preferences', () => ({
  usePreferenceState: () => preferenceState,
  usePreferenceActions: () => ({ saveNetworkLayout: saveMock, resetNetworkLayout: resetMock }),
}));

import { usePersistedNetworkLayout } from '../usePersistedNetworkLayout';

describe('usePersistedNetworkLayout', () => {
  beforeEach(() => {
    preferenceState.groupNetworkLayouts = {};
    preferenceState.isLoading = false;
    saveMock.mockReset();
    resetMock.mockReset();
  });

  it('reads, normalizes, saves, and resets scoped layouts', () => {
    const { result, rerender } = renderHook(
      ({ scopeKey }) => usePersistedNetworkLayout({ scopeKey }),
      { initialProps: { scopeKey: 'scope-a' } }
    );
    expect(result.current.savedLayout).toBeNull();
    expect(result.current.hasSavedLayout).toBe(false);

    preferenceState.groupNetworkLayouts = {
      'scope-b': {
        node_positions: { node: { x: 1, y: 2 } },
        edge_bend_points: {},
      },
    };
    preferenceState.isLoading = true;
    rerender({ scopeKey: 'scope-b' });
    expect(result.current.savedLayout).toEqual({
      node_positions: { node: { x: 1, y: 2 } },
      edge_bend_points: {},
    });
    expect(result.current.hasSavedLayout).toBe(true);
    expect(result.current.isLoading).toBe(true);

    act(() =>
      result.current.persistLayout({
        node_positions: { saved: { x: 3, y: 4 } },
        edge_bend_points: {},
      })
    );
    expect(saveMock).toHaveBeenCalledWith(
      'scope-b',
      expect.objectContaining({ node_positions: { saved: { x: 3, y: 4 } } })
    );
    act(() => result.current.resetLayout());
    expect(resetMock).toHaveBeenCalledWith('scope-b');
  });
});
