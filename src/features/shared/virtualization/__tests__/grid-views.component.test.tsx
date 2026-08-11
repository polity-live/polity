// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  localOptions: undefined as any,
  zeroOptions: undefined as any,
  localVirtualizer: {
    getVirtualItems: vi.fn(() => [] as any[]),
    getTotalSize: vi.fn(() => 0),
    measureElement: vi.fn(),
  },
  zeroResult: {
    rowsEmpty: true,
    rowAt: vi.fn(),
    virtualizer: {
      getVirtualItems: vi.fn(() => [] as any[]),
      getTotalSize: vi.fn(() => 0),
      measureElement: vi.fn(),
    },
  },
  historyState: { anchor: 'saved' },
  onHistoryChange: vi.fn(),
}));

vi.mock('../usePolityLocalVirtualizer', () => ({
  usePolityLocalVirtualizer: (options: unknown) => {
    mocks.localOptions = options;
    return mocks.localVirtualizer;
  },
}));
vi.mock('../usePolityZeroGrid', () => ({
  usePolityZeroGrid: (options: unknown) => {
    mocks.zeroOptions = options;
    return mocks.zeroResult;
  },
}));
vi.mock('@rocicorp/zero-virtual/react', () => ({
  useHistoryScrollState: () => [mocks.historyState, mocks.onHistoryChange],
}));

import { PolityLocalGridView } from '../PolityLocalGridView';
import { PolityZeroGridView } from '../PolityZeroGridView';

let resizeCallback: ResizeObserverCallback | undefined;
let disconnect: ReturnType<typeof vi.fn>;
let observe: ReturnType<typeof vi.fn>;

function installResizeObserver() {
  disconnect = vi.fn();
  observe = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
  );
}

beforeEach(() => {
  resizeCallback = undefined;
  mocks.localOptions = undefined;
  mocks.zeroOptions = undefined;
  mocks.localVirtualizer.getVirtualItems.mockReset();
  mocks.localVirtualizer.getVirtualItems.mockReturnValue([]);
  mocks.localVirtualizer.getTotalSize.mockReset();
  mocks.localVirtualizer.getTotalSize.mockReturnValue(0);
  mocks.zeroResult = {
    rowsEmpty: true,
    rowAt: vi.fn(),
    virtualizer: {
      getVirtualItems: vi.fn(() => []),
      getTotalSize: vi.fn(() => 0),
      measureElement: vi.fn(),
    },
  };
  installResizeObserver();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('responsive grid views', () => {
  it('renders a local fallback window when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const getLanes = vi.fn(() => 2);
    const renderItem = vi.fn((item: string, index: number) => <span>{`${item}:${index}`}</span>);
    const { container } = render(
      <PolityLocalGridView
        items={['a', 'b', 'c']}
        getItemKey={item => item}
        renderItem={renderItem}
        getLanes={getLanes}
        estimateRowSize={100}
      />
    );

    expect(getLanes).toHaveBeenLastCalledWith(1024);
    expect(screen.getByText('a:0')).toBeTruthy();
    expect(screen.getByText('c:2')).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('h-[36rem]');
    expect((mocks.localOptions.getScrollElement as () => Element | null)()).toBe(
      container.firstElementChild
    );
    expect((mocks.localOptions.estimateSize as () => number)()).toBe(116);
    expect(mocks.localOptions).toMatchObject({ count: 2, overscan: 4 });
    expect(container.querySelector('.relative')?.getAttribute('style')).toContain('height: 232px');
  });

  it('observes local width, caps fallback rows, and prefers measured rows and total size', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
    mocks.localVirtualizer.getVirtualItems.mockReturnValue([
      { key: 'measured', index: 1, start: 90 },
    ]);
    mocks.localVirtualizer.getTotalSize.mockReturnValue(900);
    const items = Array.from({ length: 25 }, (_, index) => `item-${index}`);
    const rendered = render(
      <PolityLocalGridView
        items={items}
        getItemKey={item => item}
        renderItem={(item, index) => <span>{`${item}:${index}`}</span>}
        getLanes={() => 1}
        estimateRowSize={50}
        gap={10}
        overscan={2}
        className="local"
      />
    );
    expect(observe).toHaveBeenCalled();
    expect(screen.getByText('item-1:1')).toBeTruthy();
    expect(rendered.container.querySelector('.relative')?.getAttribute('style')).toContain(
      'height: 1500px'
    );

    act(() => resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver));
    act(() =>
      resizeCallback?.(
        [{ contentRect: { width: 640 } } as ResizeObserverEntry],
        {} as ResizeObserver
      )
    );
    expect(mocks.localOptions.initialRect).toMatchObject({ width: 640, height: 576 });
    rendered.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('renders an empty zero grid and wires measured responsive options', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(0);
    render(
      <PolityZeroGridView
        context={{ scope: 'all' }}
        historyKey="grid"
        estimateSize={100}
        getLanes={() => 2}
        getRowKey={(row: { id: string }) => row.id}
        toStartRow={(row: { id: string }) => row}
        getPageQuery={() => null}
        getSingleQuery={() => null}
        renderRow={() => null}
        renderSkeleton={() => null}
        renderEmpty={() => <p>Empty grid</p>}
      />
    );
    expect(screen.getByText('Empty grid')).toBeTruthy();
    expect(mocks.zeroOptions).toMatchObject({
      listContextParams: { scope: 'all' },
      overscan: 8,
      lanes: 2,
      scrollState: mocks.historyState,
      onScrollStateChange: mocks.onHistoryChange,
      settleTime: 750,
    });
    expect((mocks.zeroOptions.estimateSize as () => number)()).toBe(116);
    expect((mocks.zeroOptions.getScrollElement as () => Element | null)()).toBeNull();
  });

  it('renders zero rows, skeletons, lanes, and observer fallbacks', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    mocks.zeroResult = {
      rowsEmpty: false,
      rowAt: vi.fn((index: number) => (index === 0 ? { id: 'row' } : undefined)),
      virtualizer: {
        getVirtualItems: vi.fn(() => [
          { key: 'row', index: 0, lane: 1, start: 10 },
          { key: 'skeleton', index: 1, lane: undefined, start: 120 },
        ]),
        getTotalSize: vi.fn(() => 500),
        measureElement: vi.fn(),
      },
    };
    const rendered = render(
      <PolityZeroGridView
        context={{ scope: 'loaded' }}
        historyKey="loaded"
        estimateSize={80}
        gap={20}
        overscan={3}
        getLanes={() => 2}
        getRowKey={(row: { id: string }) => row.id}
        toStartRow={(row: { id: string }) => row}
        getPageQuery={() => null}
        getSingleQuery={() => null}
        renderRow={(row: { id: string }, index) => <p>{`${row.id}:${index}`}</p>}
        renderSkeleton={index => <p>{`skeleton:${index}`}</p>}
        renderEmpty={() => null}
        permalinkID="row"
        viewportClassName="zero-grid"
      />
    );
    expect(screen.getByText('row:0')).toBeTruthy();
    expect(screen.getByText('skeleton:1')).toBeTruthy();
    expect(rendered.container.firstElementChild?.className).toBe('zero-grid');
    expect(rendered.container.querySelector('[data-index="0"]')?.getAttribute('style')).toContain(
      'translate(310px, 10px)'
    );
    expect(rendered.container.querySelector('[data-index="1"]')?.getAttribute('style')).toContain(
      'translate(0px, 120px)'
    );

    act(() => resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver));
    act(() =>
      resizeCallback?.(
        [{ contentRect: { width: 10 } } as ResizeObserverEntry],
        {} as ResizeObserver
      )
    );
    expect(mocks.zeroOptions.lanes).toBe(2);
    rendered.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
