/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installNavigationProbe, inspectorFrameSummary } from '../browser-navigation';

describe('inspector wire diagnostics', () => {
  it('ignores authentication, application data and unrelated frames', () => {
    expect(
      inspectorFrameSummary('["inspect",{"op":"authenticate","value":"secret"}]')
    ).toBeUndefined();
    expect(
      inspectorFrameSummary('["inspect",{"op":"authenticated","value":true}]')
    ).toBeUndefined();
    expect(inspectorFrameSummary('["pokePart",{"token":"secret"}]')).toBeUndefined();
  });
  it('retains actual metric values and sizes without query arguments or AST values', () => {
    const payload = JSON.stringify([
      'inspect',
      {
        op: 'queries',
        value: [
          {
            name: 'groups.byId',
            args: [{ id: 'private-resource' }],
            ast: { table: 'group', literal: 'secret' },
            rowCount: 0,
            got: true,
            deleted: false,
            metrics: { 'query-hydration-server-ms': 2.5, 'query-update-server': [1000, 1.3, 2] },
          },
        ],
      },
    ]);
    const summary = inspectorFrameSummary(payload);
    expect(summary).toMatchObject({
      direction: 'received',
      bytes: payload.length,
      queries: [{ name: 'groups.byId', rows: 0, serverMs: 2.5, updateHistogram: [1000, 1.3, 2] }],
    });
    expect(JSON.stringify(summary)).not.toMatch(/secret|private-resource|literal/);
    expect(
      inspectorFrameSummary('["inspect",{"op":"queries","clientID":"private-client"}]')
    ).toEqual({ operation: 'queries', direction: 'sent' });
  });
});

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
  it('ignores unrelated header text while observing actual content text changes', async () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<header><span>Other</span></header><main><h1>Other</h1></main>';
    const { scope, frame } = probe();
    const walk = vi.spyOn(document, 'createTreeWalker');
    const main = document.querySelector('main');
    const textWalks = () =>
      walk.mock.calls.filter(
        ([root, whatToShow]) => root === main && whatToShow === NodeFilter.SHOW_TEXT
      ).length;
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target', contentSelector: 'main' });
    frame();
    const walks = textWalks();
    for (let index = 0; index < 5; index++) {
      document.querySelector('header span')!.textContent = `Target ${index}`;
      await Promise.resolve();
    }
    frame();
    expect(textWalks()).toBe(walks);
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    document.querySelector('main h1')!.firstChild!.nodeValue = 'Target';
    await Promise.resolve();
    expect(textWalks()).toBeGreaterThan(walks);
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
    const completedWalks = textWalks();
    document.querySelector('main h1')!.firstChild!.nodeValue = 'Other';
    await Promise.resolve();
    expect(textWalks()).toBe(completedWalks);
  });

  it('excludes navigation and aside duplicates inside the selected content root', async () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML =
      '<header>Target</header><main><nav>Target</nav><aside>Target</aside><h1>Other</h1></main>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target', contentSelector: 'main' });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    document.querySelector('main h1')!.textContent = 'Target';
    await Promise.resolve();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });

  it('finds a selected root inserted late inside an existing container', async () => {
    history.replaceState(null, '', '/messages');
    document.body.innerHTML = '<header>Message</header><main><section></section></main>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({
      path: '/messages',
      text: 'Message',
      contentSelector: '#message-expected',
    });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    document.querySelector('section')!.innerHTML =
      '<article id="message-expected"><p>Message</p></article>';
    await Promise.resolve();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });

  it('keeps document bootstrap active before the body and destination route exist', async () => {
    history.replaceState(null, '', '/other');
    const { scope, frame } = probe();
    const body = document.body;
    body.remove();
    try {
      scope.__beginBenchmarkNavigation({
        path: '/target',
        text: 'Target',
        contentSelector: 'main',
      });
      frame();
      expect(scope.__benchmarkPaint.displayed).toBeNull();
      history.replaceState(null, '', '/target');
      frame();
      expect(scope.__benchmarkPaint.displayed).toBeNull();
      body.innerHTML = '<main><h1>Target</h1></main>';
      document.documentElement.append(body);
      await Promise.resolve();
      expect(scope.__benchmarkPaint.displayed).toBeNull();
      frame();
      expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
    } finally {
      if (!document.body) document.documentElement.append(body);
    }
  });

  it('observes replaced roots and returns to bootstrap after removal until a new root arrives', async () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<section><main style="opacity:0"><h1>Target</h1></main></section>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target', contentSelector: 'main' });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    const replacement = document.createElement('section');
    replacement.innerHTML = '<main style="opacity:0"><h1>Target</h1></main>';
    document.querySelector('section')!.replaceWith(replacement);
    await Promise.resolve();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    replacement.querySelector('main')!.remove();
    await Promise.resolve();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    replacement.innerHTML = '<div><main><h1>Target</h1></main></div>';
    await Promise.resolve();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });

  it('rechecks new ancestors after reparenting before accepting viewport-visible content', async () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML =
      '<section style="opacity:0"><main><h1>Target</h1></main></section><div style="visibility:hidden"></div>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target', contentSelector: 'main' });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    const destination = document.querySelector('div')!;
    destination.append(document.querySelector('main')!);
    await Promise.resolve();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    destination.style.visibility = 'visible';
    const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    bounds.mockReturnValue({
      top: innerHeight + 1,
      left: 10,
      width: 100,
      height: 30,
      right: 110,
      bottom: innerHeight + 31,
    } as DOMRect);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    bounds.mockReturnValue({
      top: 10,
      left: 10,
      width: 100,
      height: 30,
      right: 110,
      bottom: 40,
    } as DOMRect);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });

  it('requires visible destination content inside the selected main region', async () => {
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<header><h1>Target</h1></header><main><h1>Other</h1></main>';
    const { scope, frame } = probe();
    const main = document.querySelector('main');
    const walk = vi.spyOn(document, 'createTreeWalker');
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target', contentSelector: 'main' });
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    const textWalks = walk.mock.calls.filter(
      ([, whatToShow]) => whatToShow === NodeFilter.SHOW_TEXT
    );
    expect(textWalks.length).toBeGreaterThan(0);
    expect(textWalks.every(([root]) => root === main)).toBe(true);
    document.querySelector('main h1')!.textContent = 'Target';
    await Promise.resolve();
    frame();
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
  });
  it('starts cold navigation only at the public connected event and keeps normal navigation immediate', () => {
    const callbacks: ((state: { name: string }) => void)[] = [];
    vi.stubGlobal('__zero', {
      clientID: 'cold-client',
      connection: {
        state: {
          current: { name: 'connecting' },
          subscribe: (callback: (typeof callbacks)[number]) => callbacks.push(callback),
        },
      },
    });
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><h1>Target</h1></main>';
    const { scope, frame } = probe();
    const target = { path: '/target', text: 'Target', queryNames: ['users.current'] };
    scope.__beginBenchmarkNavigation(target, 0, true);
    scope.__zeroPerformanceView({ phase: 'render' });
    frame();
    scope.__zeroPerformanceReady('users.current', true, performance.now());
    expect(scope.__benchmarkPaint.start).toBeNull();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    expect(scope.__benchmarkPaint.authoritative).toBeNull();
    callbacks[0]({ name: 'connected' });
    const connectedAt = scope.__zeroPerformanceConnectionEvents[1].at;
    expect(scope.__benchmarkPaint.start).toBe(connectedAt);
    expect(scope.__benchmarkPaint.cold).toEqual({
      documentStart: 0,
      connectedAt,
      clientID: 'cold-client',
    });
    frame();
    scope.__zeroPerformanceReady('users.current', true, performance.now());
    expect(scope.__benchmarkPaint.displayed).toBeGreaterThanOrEqual(0);
    expect(scope.__benchmarkPaint.authoritative).toBeGreaterThanOrEqual(0);
    callbacks[0]({ name: 'connected' });
    expect(scope.__benchmarkPaint.start).toBe(connectedAt);
    scope.__beginBenchmarkNavigation(target, 123);
    expect(scope.__benchmarkPaint.start).toBe(123);
    expect(scope.__benchmarkPaint.cold).toBeUndefined();
  });
  it('requires a matching authoritative view for group revocation, including after release', () => {
    const { scope } = probe();
    const state = () => scope.__zeroPerformanceGroupAccess('private', 100);
    expect(state()).toEqual({ observed: false, complete: false, present: false });
    const event = {
      activationID: 'group-view',
      phase: 'commit',
      name: 'groups.byIdBasic',
      args: { id: 'other' },
      type: 'complete',
      ids: [],
      at: 101,
    };
    scope.__zeroPerformanceView(event);
    expect(state().observed).toBe(false);
    scope.__zeroPerformanceView({ ...event, args: { id: 'private' }, type: 'unknown' });
    expect(state()).toEqual({ observed: true, complete: false, present: false });
    scope.__zeroPerformanceView({ ...event, args: { id: 'private' }, ids: ['private'] });
    expect(state()).toEqual({ observed: true, complete: true, present: true });
    scope.__zeroPerformanceView({ ...event, phase: 'release' });
    expect(state()).toEqual({ observed: true, complete: true, present: true });
    scope.__zeroPerformanceView({ ...event, args: { id: 'private' } });
    expect(state()).toEqual({ observed: true, complete: true, present: false });
    scope.__zeroPerformanceView({ ...event, phase: 'release' });
    expect(state()).toEqual({ observed: true, complete: true, present: false });
    expect(scope.__zeroPerformanceGroupAccess('private', 102)).toEqual({
      observed: false,
      complete: false,
      present: false,
    });
  });
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
