/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installNavigationProbe } from '../browser-navigation';

afterEach(() => {
  const scope = globalThis as any;
  scope.__benchmarkPaint?.observer?.disconnect();
  scope.__benchmarkLongTaskObserver?.disconnect();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function probe() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 10,
    left: 10,
    width: 100,
    height: 30,
    right: 110,
    bottom: 40,
  } as DOMRect);
  installNavigationProbe();
  return {
    scope: globalThis as any,
    frame: () => frames.splice(0).forEach(callback => callback(performance.now())),
  };
}

describe('navigation paint measurement', () => {
  it('accepts a visible matching node even when an earlier duplicate remains hidden', () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><p style="opacity:0">Target</p><h1>Target</h1></main>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target' });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });
  it('finds content inserted while an earlier hidden duplicate still awaits paint', async () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><p style="opacity:0">Target</p></main>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target' });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    const title = document.createElement('h1');
    title.textContent = 'Target';
    document.querySelector('main')!.append(title);
    await Promise.resolve();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });
  it('requires the real virtualized page arguments and IDs for authoritative readiness', () => {
    history.replaceState(null, '', '/messages');
    const { scope } = probe();
    scope.__beginBenchmarkNavigation({
      path: '/messages',
      text: 'Message',
      queryNames: ['messages.messagePage'],
      queryArgs: { conversationId: 'expected' },
      id: 'message',
    });
    scope.__zeroPerformanceReady('messages.messagePage', true, performance.now());
    scope.__zeroPerformanceReady('messages.messagePage', true, performance.now(), {
      args: { conversationId: 'other' },
      ids: ['message'],
    });
    expect(scope.__benchmarkPaint.authoritative).toBeNull();
    scope.__zeroPerformanceReady('messages.messagePage', true, performance.now(), {
      args: { conversationId: 'expected' },
      ids: ['other'],
    });
    expect(scope.__benchmarkPaint.authoritative).toBeNull();
    scope.__zeroPerformanceReady('messages.messagePage', true, performance.now(), {
      args: { conversationId: 'expected' },
      ids: ['message'],
    });
    expect(scope.__benchmarkPaint.authoritative).toBeGreaterThanOrEqual(0);
  });
  it('records the public connection state without changing it or recording auth data', () => {
    const callbacks: ((state: { name: string }) => void)[] = [];
    const current = { name: 'connecting', sensitive: 'excluded' };
    vi.stubGlobal('__zero', {
      clientID: 'client',
      connection: {
        state: {
          current,
          subscribe: (callback: (typeof callbacks)[number]) => callbacks.push(callback),
        },
      },
    });
    const { scope } = probe();
    const event = { phase: 'render' };
    scope.__zeroPerformanceView(event);
    scope.__zeroPerformanceView(event);
    callbacks[0]({ name: 'connected' });
    expect(callbacks).toHaveLength(1);
    expect(scope.__zeroPerformanceConnectionEvents.map((entry: any) => entry.state)).toEqual([
      'connecting',
      'connected',
    ]);
    expect(
      scope.__zeroPerformanceConnectionEvents.every(
        (entry: any) => Object.keys(entry).sort().join(',') === 'at,clientID,state'
      )
    ).toBe(true);
    expect(current.name).toBe('connecting');
  });
  it('rejects a conversation preview when the actual message is not displayed', () => {
    history.replaceState(null, '', '/messages');
    document.body.innerHTML = '<main><p>Message</p></main>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({
      path: '/messages',
      text: 'Message',
      contentSelector: '#message-expected',
    });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    document.body.innerHTML =
      '<main><article id="message-expected"><p>Message</p></article></main>';
    scope.__beginBenchmarkNavigation({
      path: '/messages',
      text: 'Message',
      contentSelector: '#message-expected',
    });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });
  it('checks retained authoritative views at paint and excludes released or mismatching views', () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><h1>Target</h1></main>';
    const { scope, frame } = probe();
    const event = {
      activationID: 'view',
      phase: 'commit',
      name: 'messages.messagesWindow',
      args: { conversation_id: 'expected' },
      type: 'complete',
      ids: ['message'],
      at: performance.now(),
    };
    const target = {
      path: '/target',
      text: 'Target',
      queryNames: ['messages.messagesWindow'],
      queryArgs: { conversation_id: 'expected' },
    };
    scope.__zeroPerformanceView(event);
    scope.__beginBenchmarkNavigation(target);
    frame();
    expect(scope.__benchmarkPaint.authoritative).toBeGreaterThanOrEqual(
      scope.__benchmarkPaint.displayed
    );
    scope.__zeroPerformanceView({ ...event, phase: 'release' });
    scope.__beginBenchmarkNavigation(target);
    frame();
    expect(scope.__benchmarkPaint.authoritative).toBeNull();
    scope.__zeroPerformanceView({ ...event, args: { conversation_id: 'other' } });
    scope.__beginBenchmarkNavigation(target);
    frame();
    expect(scope.__benchmarkPaint.authoritative).toBeNull();
  });
  it('waits for transparent content to become visible instead of treating a layout box as paint', () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main style="opacity:0"><h1>Target</h1></main>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target' });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    document.querySelector('main')!.style.opacity = '1';
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });

  it('requires the target route and search parameters even when its text already exists', () => {
    document.body.innerHTML = '<main><h1>Target</h1></main>';
    const { scope, frame } = probe();
    const target = { path: '/target/', text: 'Target', search: { q: 'expected' } };
    history.replaceState(null, '', '/other?q=expected');
    scope.__beginBenchmarkNavigation(target);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    history.replaceState(null, '', '/target?q=wrong');
    scope.__beginBenchmarkNavigation(target);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    history.replaceState(null, '', '/target?q=expected');
    scope.__beginBenchmarkNavigation(target);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });
});
