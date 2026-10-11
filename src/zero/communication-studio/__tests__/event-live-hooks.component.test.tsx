// @vitest-environment jsdom
import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEventTemplate } from '@/features/communication-studio/logic/event-templates';
import { useLiveStudioState } from '../useLiveStudioState';
import { useEventPresentation } from '../useEventPresentation';
import { useAnimatedStudioDocument } from '@/features/agendas/hooks/useAnimatedStudioDocument';
const mock = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  mutate: vi.fn(() => ({})),
  confirmed: vi.fn(async (_result: unknown): Promise<void> => undefined),
  requestExport: vi.fn(async () => ({ id: 'export' })),
  notifyError: vi.fn(),
  zero: {} as any,
  studio: {} as any,
  deviceStatus: 'complete',
}));
vi.mock('@/zero/observed-query', () => ({
  useQuery: (q: any) => [
    mock.rows[q?.kind]?.[0],
    { type: q?.kind === 'presentationDevices' ? mock.deviceStatus : 'complete' },
  ],
  useZero: () => mock.zero,
}));
vi.mock('@/zero/queries', () => ({
  queries: { studio: new Proxy({}, { get: (_, kind) => (args: any) => ({ kind, args }) }) },
}));
vi.mock('@/zero/mutators', () => ({ mutators: { studio: { presentation: (a: unknown) => a } } }));
vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: (r: unknown) => mock.confirmed(r),
}));
vi.mock('@/zero/communication-studio/useStudioClient', () => ({
  useStudioClient: () => mock.studio,
}));
const event = crypto.randomUUID();
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mock.rows = {};
  mock.deviceStatus = 'complete';
  mock.confirmed.mockImplementation(async () => undefined);
  mock.zero = { mutate: mock.mutate };
  mock.studio = { requestExport: mock.requestExport, notifyError: mock.notifyError };
});
it('checks connection before warning and refreshes heartbeats on focus, visibility and reconnect without overlap', async () => {
  vi.useFakeTimers();
  let confirm!: () => void;
  mock.confirmed.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        confirm = resolve;
      })
  );
  mock.rows.presentationDevices = [[]];
  mock.deviceStatus = 'unknown';
  const h = renderHook(() => useEventPresentation(event));
  expect(h.result.current.connectionChecking).toBe(true);
  expect(mock.mutate).toHaveBeenCalledTimes(1);
  await act(async () => {
    fireEvent.focus(window);
    fireEvent(window.document, new Event('visibilitychange'));
    fireEvent(window, new Event('online'));
    vi.advanceTimersByTime(5000);
  });
  expect(mock.mutate).toHaveBeenCalledTimes(1);
  await act(async () => confirm());
  expect(h.result.current.connectionChecking).toBe(true); // Device query has not completed yet.
  mock.deviceStatus = 'complete';
  h.rerender();
  expect(h.result.current.connectionChecking).toBe(false);
  await act(async () => fireEvent.focus(window));
  expect(mock.mutate).toHaveBeenCalledTimes(2);
  await act(async () => confirm());
  Object.defineProperty(window.document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  await act(async () => fireEvent(window.document, new Event('visibilitychange')));
  expect(mock.mutate).toHaveBeenCalledTimes(2);
  Object.defineProperty(window.document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  await act(async () => fireEvent(window.document, new Event('visibilitychange')));
  expect(mock.mutate).toHaveBeenCalledTimes(3);
  await act(async () => confirm());
  act(() => fireEvent(window, new Event('offline')));
  expect(h.result.current.online).toBe(false);
  await act(async () => fireEvent(window, new Event('online')));
  expect(mock.mutate).toHaveBeenCalledTimes(4);
  await act(async () => confirm());
  expect(h.result.current.online).toBe(true);
  h.unmount();
  await act(async () => {
    fireEvent.focus(window);
    fireEvent(window.document, new Event('visibilitychange'));
    fireEvent(window, new Event('online'));
    vi.advanceTimersByTime(5000);
  });
  expect(mock.mutate).toHaveBeenCalledTimes(4);
  delete (window.document as any).visibilityState;
});
afterEach(() => vi.useRealTimers());
it('reactively resolves entity bindings and countdowns in editable wide and portrait layouts', () => {
  vi.useFakeTimers();
  const document = createEventTemplate('cover', event);
  mock.rows.liveSources = [
    [
      {
        source_type: 'event',
        source_id: event,
        payload: { title: 'First', start_time: Date.now() + 60000 },
      },
    ],
  ];
  const h = renderHook(({ portrait }) => useLiveStudioState(document, { portrait }), {
    initialProps: { portrait: false },
  });
  expect(
    h.result.current.projected!.nodes.find(n => n.liveBinding?.field === 'title')
  ).toMatchObject({ content: [{ children: [{ text: 'First' }] }] });
  mock.rows.liveSources = [
    [
      {
        source_type: 'event',
        source_id: event,
        payload: { title: 'Updated', start_time: Date.now() + 60000 },
      },
    ],
  ];
  h.rerender({ portrait: true });
  expect(h.result.current.projected!.nodes[0].transform.width).toBe(1080);
  act(() => vi.advanceTimersByTime(1000));
  expect(h.result.current.sources[0].payload.title).toBe('Updated');
  h.unmount();
});
it('registers viewer heartbeats, submits commands and queues a static presentation snapshot', async () => {
  const document = createEventTemplate('cover', event);
  mock.rows.eventProject = [{ id: event }];
  mock.rows.document = [{ document, content_revision: 4 }];
  mock.rows.eventPresentation = [
    {
      mode: 'studio',
      results_visible: true,
      frame_id: document.nodes[0].id,
      lease_until: Date.now() + 20000,
    },
  ];
  mock.rows.eventManager = [{ id: event }];
  mock.rows.liveSources = [[]];
  mock.rows.presentationDevices = [[]];
  mock.rows.assets = [[]];
  mock.rows.exports = [[{ id: 'export', status: 'completed' }]];
  const h = renderHook(() => useEventPresentation(event, true));
  await waitFor(() =>
    expect(mock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'heartbeat', eventId: event })
    )
  );
  expect(h.result.current.canManage).toBe(true);
  expect(h.result.current.projected?.nodes[0].transform.width).toBe(1080);
  await act(async () => h.result.current.command({ action: 'claim' }));
  expect(mock.mutate).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'claim', deviceId: h.result.current.deviceId })
  );
  await act(async () => h.result.current.exportSnapshot(document.nodes[0].id, 'pdf'));
  expect(mock.requestExport).toHaveBeenCalledWith({
    projectId: event,
    revision: 4,
    format: 'pdf',
    pageIds: [document.nodes[0].id],
    snapshot: { portrait: true, presentation: true },
  });
  expect(h.result.current.exportJob?.status).toBe('completed');
  act(() => window.dispatchEvent(new Event('offline')));
  expect(h.result.current.online).toBe(false);
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(h.result.current.online).toBe(true));
  h.unmount();
});
it('finishes failed initial checks and retries synchronous heartbeat errors on focus', async () => {
  mock.mutate.mockImplementationOnce(() => {
    throw new Error('Connection interrupted');
  });
  const h = renderHook(() => useEventPresentation(event));
  await waitFor(() => expect(h.result.current.connectionChecking).toBe(false));
  expect(h.result.current.online).toBe(false);
  act(() => fireEvent.focus(window));
  await waitFor(() => expect(h.result.current.online).toBe(true));
  expect(mock.mutate).toHaveBeenCalledTimes(2);
  h.unmount();
});
it('honors reduced motion while presenting live tally changes and missing documents', () => {
  const document = createEventTemplate('vote', event);
  const media = window.matchMedia;
  window.matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
  const h = renderHook(({ d }) => useAnimatedStudioDocument(d), {
    initialProps: { d: document as typeof document | null },
  });
  expect(h.result.current).toBe(document);
  h.rerender({ d: null });
  expect(h.result.current).toBeNull();
  h.unmount();
  window.matchMedia = media;
});
