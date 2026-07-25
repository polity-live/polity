/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useHistoryScrollState: vi.fn(),
  useZeroVirtualizer: vi.fn(),
  useZeroWindowVirtualizer: vi.fn(),
}));

vi.mock('@rocicorp/zero-virtual/react', () => ({
  useHistoryScrollState: mocks.useHistoryScrollState,
  useZeroVirtualizer: mocks.useZeroVirtualizer,
  useZeroWindowVirtualizer: mocks.useZeroWindowVirtualizer,
}));

import { usePolityZeroList, usePolityZeroWindowList } from '../usePolityZeroList';

const virtualizerResult = {
  items: [],
  spaceBefore: 0,
  spaceAfter: 0,
  complete: true,
  rowsEmpty: true,
  total: 0,
};

function listOptions<TContext>(listContextParams: TContext) {
  return {
    scrollStateKey: 'members',
    listContextParams,
    getScrollElement: () => null,
    estimateSize: () => 68,
    getPageQuery: vi.fn(),
    getSingleQuery: vi.fn(),
    getRowKey: (row: { id: string }) => row.id,
    toStartRow: (row: { id: string }) => ({ id: row.id }),
  };
}

function capturedContext(mock: typeof mocks.useZeroVirtualizer): unknown {
  return mock.mock.calls.at(-1)?.[0]?.listContextParams;
}

describe('Polity zero-virtual list context identity', () => {
  beforeEach(() => {
    mocks.useHistoryScrollState.mockReset();
    mocks.useHistoryScrollState.mockReturnValue([null, vi.fn()]);
    mocks.useZeroVirtualizer.mockReset();
    mocks.useZeroVirtualizer.mockReturnValue(virtualizerResult);
    mocks.useZeroWindowVirtualizer.mockReset();
    mocks.useZeroWindowVirtualizer.mockReturnValue(virtualizerResult);
  });

  it('keeps the contained-list context reference for equal content', () => {
    let context = { query: '', roleIds: ['role-1'] };
    const { rerender } = renderHook(() => usePolityZeroList(listOptions(context)));
    const initialContext = capturedContext(mocks.useZeroVirtualizer);

    context = { query: '', roleIds: ['role-1'] };
    rerender();

    expect(capturedContext(mocks.useZeroVirtualizer)).toBe(initialContext);

    context = { query: 'alice', roleIds: ['role-1'] };
    rerender();

    expect(capturedContext(mocks.useZeroVirtualizer)).toBe(context);
    expect(capturedContext(mocks.useZeroVirtualizer)).not.toBe(initialContext);
  });

  it('keeps the window-list context reference for equal content', () => {
    let context = { threadId: 'thread-1', sort: 'recent' };
    const { rerender } = renderHook(() => usePolityZeroWindowList(listOptions(context)));
    const initialContext = capturedContext(mocks.useZeroWindowVirtualizer);

    context = { threadId: 'thread-1', sort: 'recent' };
    rerender();

    expect(capturedContext(mocks.useZeroWindowVirtualizer)).toBe(initialContext);
  });

  it('preserves identity changes for non-serializable contexts', () => {
    let context = { query: '', transform: () => 'first' };
    const { rerender } = renderHook(() => usePolityZeroList(listOptions(context)));
    const initialContext = capturedContext(mocks.useZeroVirtualizer);

    context = { query: '', transform: () => 'second' };
    rerender();

    expect(capturedContext(mocks.useZeroVirtualizer)).toBe(context);
    expect(capturedContext(mocks.useZeroVirtualizer)).not.toBe(initialContext);
  });
});
