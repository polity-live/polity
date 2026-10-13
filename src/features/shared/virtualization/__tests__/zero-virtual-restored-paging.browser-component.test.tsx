import {
  ZeroVirtualizer,
  observeElementOffset,
  observeElementRect,
  rowAttributes,
  type RowsSnapshot,
  type ScrollHistoryState,
  type VirtualizerOptions,
} from '@rocicorp/zero-virtual/core';
import { afterEach, expect, it } from 'vitest';

interface Row {
  id: string;
  text: string;
}
interface Context {
  thread: string;
}
interface Start {
  id: string;
}
const disposals: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
});

function fixture({
  scrollTop = 0,
  reachedEnd = true,
  reachedStart = true,
  estimatedTotal = 3,
  attached = true,
}: {
  scrollTop?: number;
  reachedEnd?: boolean;
  reachedStart?: boolean;
  estimatedTotal?: number;
  attached?: boolean;
} = {}) {
  const context = { thread: 'cached thread' };
  const el = document.createElement('div');
  el.style.cssText = 'width:600px;height:160px;overflow:auto';
  const content = document.createElement('div');
  el.append(content);
  document.body.append(el);
  let data: Row[] = [0, 1, 2].map(index => ({
    id: `row-${index}`,
    text: `cached message ${index}`,
  }));
  const scrollState: ScrollHistoryState<Start> = {
    listContextParams: context,
    anchor: { index: 0, kind: 'forward' },
    estimatedTotal,
    hasReachedStart: reachedStart,
    hasReachedEnd: reachedEnd,
    scrollTop,
  };
  let options: VirtualizerOptions<Context, Row, Start> = {
    listContextParams: context,
    scrollState,
    estimateSize: () => 92,
    minPageSize: 50,
    getRowKey: row => row.id,
    observeElementRect,
    observeElementOffset,
  };
  const core = new ZeroVirtualizer(options);
  const notifications: ReturnType<typeof core.getSnapshot>[] = [];
  const unsubscribe = core.subscribe(() => notifications.push(core.getSnapshot()));

  function renderRows(
    nextData = data,
    { complete = true, atStart = true, atEnd = true, firstRowIndex = 0 } = {}
  ) {
    data = nextData;
    content.replaceChildren();
    if (firstRowIndex > 0) {
      const spacer = document.createElement('div');
      spacer.style.height = `${firstRowIndex * 92}px`;
      content.append(spacer);
    }
    for (const [offset, item] of data.entries()) {
      const row = document.createElement('div');
      row.style.height = '92px';
      row.textContent = item.text;
      for (const [key, value] of Object.entries(rowAttributes(firstRowIndex + offset, item.id))) {
        row.setAttribute(key, String(value));
      }
      content.append(row);
    }
    const rows: RowsSnapshot<Row> = {
      rowAt: index => data[index - firstRowIndex],
      rowsLength: data.length,
      firstRowIndex,
      complete,
      rowsEmpty: data.length === 0,
      atStart,
      atEnd,
      permalinkNotFound: false,
      probeID: null,
      probeRow: undefined,
      probeComplete: false,
      permalinkID: null,
      permalinkRow: undefined,
    };
    core.setRows(rows);
  }
  renderRows();
  if (attached) core.attach(el);
  disposals.push(() => {
    unsubscribe();
    core.detach();
    el.remove();
  });
  return {
    core,
    el,
    context,
    scrollState,
    notifications,
    renderRows,
    setOptions(next: Partial<typeof options>) {
      options = { ...options, ...next };
      core.setOptions(options);
    },
    commit() {
      core.afterDOMUpdate();
    },
  };
}

it('restores an identical cached paging state without another notification or query change', () => {
  const f = fixture();
  const before = f.core.getSnapshot();
  const queryInputs = f.core.getQueryInputs();
  f.commit();
  expect(f.notifications).toEqual([]);
  expect(f.core.getSnapshot()).toBe(before);
  expect(f.core.getQueryInputs()).toEqual(queryInputs);
  expect(f.el.clientHeight).toBe(160);
  expect(f.el.textContent).toContain('cached message 2');
  f.commit();
  expect(f.notifications).toEqual([]);
});

it('still restores a real nonzero scroll position without replacing equal paging values', () => {
  const f = fixture({ scrollTop: 40 });
  expect(f.el.scrollTop).toBe(0);
  f.commit();
  expect(f.el.scrollTop).toBe(40);
  expect(f.core.firstVisibleItem()?.key).toBe('row-0');
  expect(f.notifications).toEqual([]);
});

it('keeps a detached restore pending until a real container becomes available', () => {
  const f = fixture({ attached: false, scrollTop: 40 });
  f.commit();
  expect(f.el.scrollTop).toBe(0);
  f.core.attach(f.el);
  f.commit();
  expect(f.el.scrollTop).toBe(40);
  expect(f.el.textContent).toContain('cached message 2');
});

it.each([
  { flag: 'hasReachedStart' as const, reachedStart: false, reachedEnd: true },
  { flag: 'hasReachedEnd' as const, reachedStart: true, reachedEnd: false },
])(
  'notifies and persists a genuinely newly reached $flag',
  async ({ flag, reachedStart, reachedEnd }) => {
    const f = fixture({ reachedStart, reachedEnd });
    const writes: ScrollHistoryState<Start>[] = [];
    f.setOptions({
      onScrollStateChange: value => {
        if (value) writes.push(value);
      },
    });
    f.commit();
    expect(f.notifications).toHaveLength(1);
    await expect.poll(() => writes.at(-1)?.[flag]).toBe(true);
    expect(f.core.getSnapshot().total).toBe(3);
  }
);

it('keeps genuine estimate growth and the resulting extent when the next data is partial', () => {
  const f = fixture({ estimatedTotal: 1 });
  f.commit();
  expect(f.notifications).toHaveLength(1);
  f.renderRows([{ id: 'row-0', text: 'partial cached message' }], {
    complete: false,
    atEnd: false,
  });
  expect(f.core.getSnapshot().estimatedTotal).toBe(3);
  expect(f.core.getSnapshot().complete).toBe(false);
  f.commit();
  expect(f.el.textContent).toBe('partial cached message');
});

it('preserves a real context change even when its serialized content is equal', async () => {
  const f = fixture();
  f.commit();
  const context = { ...f.context };
  const writes: ScrollHistoryState<Start>[] = [];
  f.setOptions({
    listContextParams: context,
    onScrollStateChange: value => {
      if (value) writes.push(value);
    },
  });
  f.commit();
  expect(f.notifications.length).toBeGreaterThan(0);
  await expect.poll(() => writes.at(-1)?.listContextParams).toBe(context);
});

it('restores another history position even when the paging values match', () => {
  const f = fixture();
  f.commit();
  f.setOptions({ scrollState: { ...f.scrollState, scrollTop: 80 } });
  f.commit();
  expect(f.el.scrollTop).toBe(80);
  expect(f.notifications).toEqual([]);
});

it('retains the anchor equality contract for an equivalent anchor from another history entry', () => {
  const f = fixture();
  f.commit();
  f.setOptions({
    scrollState: {
      ...f.scrollState,
      anchor: { ...f.scrollState.anchor },
      scrollTop: 40,
    },
  });
  f.commit();
  expect(f.el.scrollTop).toBe(40);
  expect(f.notifications).toEqual([]);
});

it('notifies for a different history anchor and restores its visible rows', () => {
  const f = fixture();
  f.commit();
  const anchor = { kind: 'forward' as const, index: 1, startRow: { id: 'row-1' } };
  f.setOptions({ scrollState: { ...f.scrollState, anchor, scrollTop: 92 } });
  f.renderRows(
    [
      { id: 'row-1', text: 'cached message 1' },
      { id: 'row-2', text: 'cached message 2' },
    ],
    { atStart: false, firstRowIndex: 1 }
  );
  f.commit();
  expect(f.notifications.length).toBeGreaterThan(0);
  expect(f.core.getQueryInputs().anchor).toEqual(anchor);
  expect(f.el.scrollTop).toBe(92);
  expect(f.core.getSnapshot().items.map(item => item.key)).toEqual(['row-1', 'row-2']);
});

it('still exposes edited data with the same ID and real explicit count changes', () => {
  const f = fixture();
  f.commit();
  const before = f.core.getSnapshot();
  f.renderRows([{ id: 'row-0', text: 'edited message' }]);
  expect(f.core.getSnapshot()).not.toBe(before);
  expect(f.core.getSnapshot().items[0].row?.text).toBe('edited message');
  f.commit();
  expect(f.el.textContent).toBe('edited message');
  f.setOptions({ count: 5 });
  expect(f.core.getSnapshot().total).toBe(5);
  expect(f.core.getSnapshot().estimatedTotal).toBe(5);
});

it('still exposes revoked or empty results without retaining cached rows', () => {
  const f = fixture();
  f.commit();
  const before = f.core.getSnapshot();
  f.renderRows([]);
  f.commit();
  expect(f.core.getSnapshot()).not.toBe(before);
  expect(f.core.getSnapshot().items).toEqual([]);
  expect(f.core.getSnapshot().rowsEmpty).toBe(true);
  expect(f.core.getSnapshot().total).toBe(0);
  expect(f.el.textContent).toBe('');
});
