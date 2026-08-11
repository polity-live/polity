/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PolityZeroListView } from '../PolityZeroListView';

const virtualizerCapture = vi.hoisted(() => ({
  windowOptions: null as Record<string, unknown> | null,
  containedOptions: null as Record<string, unknown> | null,
  total: undefined as number | undefined,
  list: {
    items: [] as any[],
    rowsEmpty: true,
    spaceAfter: 0,
    spaceBefore: 0,
    total: undefined as number | undefined,
  },
}));

vi.mock('../usePolityZeroList', () => ({
  usePolityZeroList: (options: Record<string, unknown>) => {
    virtualizerCapture.containedOptions = options;
    return virtualizerCapture.list;
  },
  usePolityZeroWindowList: (options: Record<string, unknown>) => {
    virtualizerCapture.windowOptions = options;
    return { ...virtualizerCapture.list, total: virtualizerCapture.total };
  },
}));

vi.mock('@rocicorp/zero-virtual/react', () => ({
  rowAttributes: (index: number, key: string) => ({
    'data-row-index': index,
    'data-row-key': key,
  }),
}));

afterEach(() => {
  cleanup();
  virtualizerCapture.windowOptions = null;
  virtualizerCapture.containedOptions = null;
  virtualizerCapture.total = undefined;
  virtualizerCapture.list = {
    items: [],
    rowsEmpty: true,
    spaceAfter: 0,
    spaceBefore: 0,
    total: undefined,
  };
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
    expect((virtualizerCapture.windowOptions?.estimateSize as (() => number) | undefined)?.()).toBe(
      220
    );
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

  it('renders an empty contained viewport with default options', () => {
    render(
      <PolityZeroListView
        context={{ scope: 'all' }}
        historyKey="contained"
        estimateSize={40}
        getRowKey={(row: { id: string }) => row.id}
        toStartRow={(row: { id: string }) => row}
        getPageQuery={() => null}
        getSingleQuery={() => null}
        renderRow={() => null}
        renderSkeleton={() => null}
        renderEmpty={() => <p>Nothing here</p>}
      />
    );

    expect(screen.getByText('Nothing here').parentElement?.className).toContain('min-h-80');
    expect(virtualizerCapture.containedOptions).toMatchObject({
      overscan: 8,
      permalinkID: undefined,
    });
    expect(
      (virtualizerCapture.containedOptions?.estimateSize as (() => number) | undefined)?.()
    ).toBe(40);
    expect(
      (
        virtualizerCapture.containedOptions?.getScrollElement as (() => Element | null) | undefined
      )?.()
    ).toBeInstanceOf(HTMLDivElement);
  });

  it('renders loaded rows and skeletons in contained and window modes', () => {
    virtualizerCapture.list = {
      rowsEmpty: false,
      total: undefined,
      spaceBefore: 12,
      spaceAfter: 24,
      items: [
        { key: 'one', index: 4, row: { id: 'row-one' } },
        { key: 'two', index: 5, row: undefined },
      ],
    };
    const common = {
      context: { scope: 'all' },
      historyKey: 'loaded',
      estimateSize: 50,
      getRowKey: (row: { id: string }) => row.id,
      toStartRow: (row: { id: string }) => row,
      getPageQuery: () => null,
      getSingleQuery: () => null,
      renderRow: (row: { id: string }, index: number) => <p>{`${row.id}:${index}`}</p>,
      renderSkeleton: (index: number) => <p>{`skeleton:${index}`}</p>,
      renderEmpty: () => <p>Empty</p>,
      className: 'viewport',
      contentClassName: 'content',
      permalinkID: null,
    };
    const contained = render(<PolityZeroListView {...common} />);
    expect(screen.getByText('row-one:4')).toBeTruthy();
    expect(screen.getByText('skeleton:5')).toBeTruthy();
    expect(
      contained.container.querySelector('[data-row-index="4"]')?.getAttribute('style')
    ).toContain('margin-top: 0');
    expect(
      contained.container.querySelector('[data-row-index="5"]')?.getAttribute('style')
    ).toBeNull();
    expect(contained.container.firstElementChild?.className).toBe('viewport');
    contained.unmount();

    render(<PolityZeroListView {...common} windowScroll />);
    expect(screen.getByText('row-one:4').parentElement?.parentElement?.className).toBe('content');
    expect(virtualizerCapture.windowOptions?.permalinkID).toBeUndefined();
  });
});
