/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PolityZeroListView } from '../PolityZeroListView';

const virtualizerCapture = vi.hoisted(() => ({
  windowOptions: null as Record<string, unknown> | null,
  total: undefined as number | undefined,
}));

vi.mock('../usePolityZeroList', () => ({
  usePolityZeroList: vi.fn(),
  usePolityZeroWindowList: (options: Record<string, unknown>) => {
    virtualizerCapture.windowOptions = options;
    return {
      items: [],
      rowsEmpty: true,
      spaceAfter: 0,
      spaceBefore: 0,
      total: virtualizerCapture.total,
    };
  },
}));

afterEach(() => {
  cleanup();
  virtualizerCapture.windowOptions = null;
  virtualizerCapture.total = undefined;
});

describe('PolityZeroListView window scrolling', () => {
  it('provides a DOM anchor to the window virtualizer while the list is empty', () => {
    render(
      <PolityZeroListView
        context={{ threadId: 'thread-1' }}
        historyKey="discussion-thread-1"
        estimateSize={220}
        getRowKey={(row: { id: string }) => row.id}
        toStartRow={(row: { id: string }) => ({ id: row.id })}
        getPageQuery={() => null}
        getSingleQuery={() => null}
        renderRow={() => null}
        renderSkeleton={() => null}
        renderEmpty={() => <p>No comments</p>}
        permalinkID="comment-new"
        windowScroll
      />
    );

    const getScrollElement = virtualizerCapture.windowOptions?.getScrollElement as
      (() => HTMLElement | null) | undefined;
    const anchor = getScrollElement?.();

    expect(screen.getByText('No comments')).toBeTruthy();
    expect(anchor).toBeInstanceOf(HTMLDivElement);
    expect(anchor?.contains(screen.getByText('No comments'))).toBe(true);
    expect(virtualizerCapture.windowOptions?.permalinkID).toBe('comment-new');
  });

  it('reports an exact loaded total to its consumer', () => {
    virtualizerCapture.total = 10;
    const onTotalChange = vi.fn();

    render(
      <PolityZeroListView
        context={{ threadId: 'thread-1' }}
        historyKey="discussion-thread-1"
        estimateSize={220}
        getRowKey={(row: { id: string }) => row.id}
        toStartRow={(row: { id: string }) => ({ id: row.id })}
        getPageQuery={() => null}
        getSingleQuery={() => null}
        renderRow={() => null}
        renderSkeleton={() => null}
        renderEmpty={() => null}
        onTotalChange={onTotalChange}
        windowScroll
      />
    );

    expect(onTotalChange).toHaveBeenCalledWith(10);
  });
});
