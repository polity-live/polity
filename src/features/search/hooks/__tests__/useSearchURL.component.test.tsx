/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSearchURL } from '../useSearchURL';

const navigateMock = vi.fn();
let searchParams: Record<string, string> = {};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchParams,
}));

describe('useSearchURL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockReset();
    searchParams = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to the list view when no view parameter is present', () => {
    const { result } = renderHook(() => useSearchURL());

    expect(result.current.view).toBe('list');
  });

  it('reads and writes the spatial view parameter', () => {
    searchParams = { view: 'spatial' };
    const { result } = renderHook(() => useSearchURL());

    expect(result.current.view).toBe('spatial');

    act(() => {
      result.current.setView('list');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(navigateMock).toHaveBeenLastCalledWith({ to: '/search?' });

    act(() => {
      result.current.setView('spatial');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(navigateMock).toHaveBeenLastCalledWith({ to: '/search?view=spatial' });
  });
});
