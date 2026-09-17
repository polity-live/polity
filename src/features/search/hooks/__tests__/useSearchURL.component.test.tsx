/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSearchURL } from '../useSearchURL';

const navigateMock = vi.fn();
let previewOpen = false;
let searchParams: Record<string, string> = {};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchParams,
  useRouterState: () => previewOpen,
}));

describe('useSearchURL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockReset();
    previewOpen = false;
    searchParams = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps pending filters local while a preview is open, then flushes after closing', () => {
    const { result, rerender } = renderHook(() => useSearchURL());
    act(() => result.current.setSearchQuery('assembly'));
    act(() => {
      previewOpen = true;
      rerender();
    });
    act(() => vi.advanceTimersByTime(300));
    expect(navigateMock).not.toHaveBeenCalled();
    expect(result.current.searchQuery).toBe('assembly');
    act(() => {
      previewOpen = false;
      rerender();
    });
    act(() => vi.advanceTimersByTime(300));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenLastCalledWith({
      to: '/search?q=assembly',
      hash: true,
      resetScroll: false,
    });
  });

  it('defaults to the list view when no view parameter is present', () => {
    const { result } = renderHook(() => useSearchURL());

    expect(result.current.view).toBe('list');
  });

  it('reads and writes the spatial view parameter', () => {
    searchParams = { view: 'spatial' };
    const { result, rerender } = renderHook(() => useSearchURL());

    expect(result.current.view).toBe('spatial');

    act(() => {
      result.current.setView('list');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(navigateMock).toHaveBeenLastCalledWith({
      to: '/search?',
      hash: true,
      resetScroll: false,
    });

    act(() => {
      searchParams = {};
      rerender();
    });
    act(() => {
      result.current.setView('spatial');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(navigateMock).toHaveBeenLastCalledWith({
      to: '/search?view=spatial',
      hash: true,
      resetScroll: false,
    });
  });
});
