// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createEventTemplate } from '@/features/communication-studio/logic/event-templates';
import type { StudioDocumentV3 } from '@/features/communication-studio/logic/document-v3';
import { useAnimatedStudioDocument } from '../useAnimatedStudioDocument';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(reduced = false) {
  let now = 0;
  let sequence = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  const cancel = vi.fn((id: number) => frames.delete(id));
  vi.stubGlobal('cancelAnimationFrame', cancel);
  return {
    frames,
    cancel,
    tick(time: number) {
      now = time;
      act(() => {
        const batch = [...frames.values()];
        frames.clear();
        batch.forEach(callback => callback(time));
      });
    },
  };
}

function documentWithValues(values: (number | null)[], labels = ['Yes', 'No']) {
  const document = createEventTemplate('vote', crypto.randomUUID());
  const chart = document.nodes.find(node => node.type === 'chart');
  if (!chart || chart.type !== 'chart') throw new Error('Vote template chart required');
  chart.data.labels = labels;
  chart.data.series = [{ ...chart.data.series[0], values }];
  return document;
}

it('interpolates live counts from zero and prior values while preserving nulls and canonical documents', () => {
  const animation = setup();
  const initial = documentWithValues([8, null]);
  const original = structuredClone(initial);
  const { result, rerender, unmount } = renderHook(
    ({ document }: { document: StudioDocumentV3 | null }) => useAnimatedStudioDocument(document),
    { initialProps: { document: initial as StudioDocumentV3 | null } }
  );
  const values = () => {
    const chart = result.current?.nodes.find(node => node.type === 'chart');
    return chart?.type === 'chart' ? chart.data.series[0].values : undefined;
  };
  animation.tick(325);
  expect(values()).toEqual([7, null]);
  expect(animation.frames.size).toBe(1);
  animation.tick(650);
  expect(values()).toEqual([8, null]);
  expect(initial).toEqual(original);
  const update = structuredClone(initial);
  const chart = update.nodes.find(node => node.type === 'chart');
  if (!chart || chart.type !== 'chart') throw new Error('chart');
  chart.data.series[0].values = [16, null];
  rerender({ document: update });
  animation.tick(975);
  expect(values()).toEqual([15, null]);
  animation.tick(1300);
  expect(values()).toEqual([16, null]);
  rerender({ document: structuredClone(update) });
  expect(animation.frames.size).toBe(0);
  rerender({ document: null });
  expect(result.current).toBeNull();
  unmount();
  expect(animation.cancel).toHaveBeenCalled();
});

it('restarts changed labels and newly introduced series from zero and cancels obsolete frames', () => {
  const animation = setup();
  const initial = documentWithValues([8, 4]);
  const { result, rerender, unmount } = renderHook(useAnimatedStudioDocument, {
    initialProps: initial as StudioDocumentV3 | null,
  });
  animation.tick(650);
  const changed = structuredClone(initial);
  const chart = changed.nodes.find(node => node.type === 'chart');
  if (!chart || chart.type !== 'chart') throw new Error('chart');
  chart.data.labels = ['A', 'B'];
  chart.data.series.push({ ...chart.data.series[0], values: [2, 6] });
  rerender(changed);
  animation.tick(975);
  const displayed = result.current?.nodes.find(node => node.type === 'chart');
  expect(displayed?.type === 'chart' && displayed.data.series.map(series => series.values)).toEqual(
    [
      [7, 3.5],
      [1.75, 5.25],
    ]
  );
  unmount();
  expect(animation.frames.size).toBe(0);
});

it('uses static values immediately for reduced motion and charts without a live binding', () => {
  const animation = setup(true);
  const document = documentWithValues([8, 4]);
  const { result, unmount } = renderHook(useAnimatedStudioDocument, { initialProps: document });
  expect(result.current).toBe(document);
  expect(animation.frames.size).toBe(0);
  unmount();
  setup();
  const chart = document.nodes.find(node => node.type === 'chart');
  if (!chart) throw new Error('chart');
  delete chart.liveBinding;
  const staticChart = renderHook(useAnimatedStudioDocument, { initialProps: document });
  expect(staticChart.result.current).toBe(document);
  staticChart.unmount();
});

it('ignores an obsolete chart animation when a borrowed snapshot loses that node before the frame callback', () => {
  const animation = setup();
  const document = documentWithValues([8, 4]);
  const { result, unmount } = renderHook(useAnimatedStudioDocument, { initialProps: document });
  document.nodes = document.nodes.filter(node => node.type !== 'chart');
  animation.tick(650);
  expect(result.current?.nodes.some(node => node.type === 'chart')).toBe(false);
  expect(animation.frames.size).toBe(0);
  unmount();
});
