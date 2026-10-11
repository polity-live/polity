// @vitest-environment jsdom
import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { toast } from '@/features/shared/ui/ui/sonner';
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
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
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

it('reuses the session device, calibrates the server clock and exposes media and query failures', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  const deviceId = crypto.randomUUID();
  sessionStorage.setItem(`polity-show:${event}:device`, deviceId);
  const document = createEventTemplate('cover', event);
  mock.rows.eventProject = [{ id: event }];
  mock.rows.document = [{ document, content_revision: 4 }];
  mock.rows.assets = [[{ id: 'media', name: 'Sound', mime_type: 'audio/mpeg' }]];
  mock.rows.presentationDevices = [[]];
  mock.rows.eventPresentation = [
    { frame_id: 'first', controller_device_id: deviceId, lease_until: 200000 },
  ];
  const h = renderHook(() => useEventPresentation(event));
  await act(() => Promise.resolve());
  mock.rows.presentationDevices = [[{ id: deviceId, last_seen: 102000 }]];
  h.rerender();
  expect(h.result.current.deviceId).toBe(deviceId);
  expect(h.result.current.clockOffset).toBe(2000);
  expect(h.result.current.now).toBe(102000);
  expect(h.result.current.hasControl).toBe(true);
  expect(h.result.current.assets).toEqual([
    { id: 'media', name: 'Sound', mime: 'audio/mpeg', url: '/api/studio/media/media' },
  ]);
  act(() => vi.advanceTimersByTime(10000));
  expect(h.result.current.page).toBe(1);
  mock.rows.eventPresentation = [{ frame_id: 'second' }];
  h.rerender();
  expect(h.result.current.page).toBe(0);
  mock.deviceStatus = 'error';
  h.rerender();
  expect(h.result.current.online).toBe(false);
  expect(h.result.current.connectionChecking).toBe(false);
  h.unmount();
});

it('contains export failures and reports server command errors without claiming a successful command', async () => {
  const notify = vi.spyOn(toast, 'error').mockImplementation(() => 'toast');
  const empty = renderHook(() => useEventPresentation(event));
  await act(() => Promise.resolve());
  await act(() => empty.result.current.exportSnapshot('frame', 'png'));
  expect(mock.requestExport).not.toHaveBeenCalled();
  mock.rows.eventProject = [{ id: event }];
  mock.rows.document = [{ document: createEventTemplate('cover', event), content_revision: 4 }];
  empty.rerender();
  const unavailable = new Error('Export unavailable');
  mock.requestExport.mockRejectedValueOnce(unavailable);
  await act(() => empty.result.current.exportSnapshot('frame', 'png'));
  expect(mock.notifyError).toHaveBeenCalledWith(unavailable);
  for (const failure of [new Error('Authority revoked'), 'Network failed']) {
    mock.confirmed.mockRejectedValueOnce(failure);
    await act(async () => {
      await expect(empty.result.current.command({ action: 'claim' })).rejects.toBe(failure);
    });
  }
  expect(notify).toHaveBeenCalledWith('Authority revoked');
  expect(notify).toHaveBeenCalledTimes(2);
  empty.unmount();
});

it('starts offline, skips heartbeats and ignores a pending acknowledgement after unmount', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const offline = renderHook(() => useEventPresentation(event));
  expect(offline.result.current.connectionChecking).toBe(false);
  expect(offline.result.current.online).toBe(false);
  expect(mock.mutate).not.toHaveBeenCalled();
  offline.unmount();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  let acknowledge!: () => void;
  mock.confirmed.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        acknowledge = resolve;
      })
  );
  const pending = renderHook(() => useEventPresentation(event));
  pending.unmount();
  await act(async () => acknowledge());
  expect(mock.mutate).toHaveBeenCalledOnce();
});

it('renders an unregistered device safely on the server without browser globals', () => {
  vi.stubGlobal('window', undefined);
  vi.stubGlobal('navigator', undefined);
  function ServerScreen() {
    const show = useEventPresentation(event);
    return <span>{show.deviceId || 'unregistered'}</span>;
  }
  expect(renderToString(<ServerScreen />)).toContain('unregistered');
  expect(mock.mutate).not.toHaveBeenCalled();
});

it('ignores an already queued offline heartbeat after its subscription has been disposed', async () => {
  const intervals = vi.spyOn(globalThis, 'setInterval');
  const h = renderHook(() => useEventPresentation(event));
  await act(() => Promise.resolve());
  const heartbeat = intervals.mock.calls.find(([, delay]) => delay === 5000)![0] as () => void;
  h.unmount();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(async () => heartbeat());
  expect(mock.mutate).toHaveBeenCalledOnce();
});

it('subscribes to readable linked results and recognizes an explicit countdown format', () => {
  vi.useFakeTimers();
  const document = createEventTemplate('cover', event);
  const countdown = document.nodes.find(node => node.liveBinding?.field === 'countdown');
  if (!countdown?.liveBinding) throw new Error('countdown');
  countdown.liveBinding.field = 'title';
  countdown.liveBinding.format = 'countdown';
  mock.rows.liveSources = [
    [
      {
        source_type: 'agenda_item',
        source_id: event,
        payload: { result_source_type: 'vote', result_source_id: crypto.randomUUID() },
      },
    ],
  ];
  const h = renderHook(() => useLiveStudioState(document));
  expect(h.result.current.sources).toHaveLength(2);
  act(() => vi.advanceTimersByTime(1000));
  expect(h.result.current.projected).not.toBeNull();
  h.unmount();
});
