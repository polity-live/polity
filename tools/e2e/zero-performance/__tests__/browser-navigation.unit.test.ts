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
  scope.__benchmarkPaint?.frameObserver?.disconnect();
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

function longFrameObservers(supportedTypes = ['long-animation-frame']) {
  const instances: Observer[] = [];
  class Observer {
    static supportedEntryTypes = supportedTypes;
    observe = vi.fn();
    disconnect = vi.fn();
    queued: PerformanceEntry[] = [];
    takeRecords = vi.fn(() => this.queued.splice(0));
    callback: PerformanceObserverCallback;
    constructor(callback: PerformanceObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }
    emit(...entries: unknown[]) {
      this.callback(
        { getEntries: () => entries } as PerformanceObserverEntryList,
        this as unknown as PerformanceObserver
      );
    }
  }
  vi.stubGlobal('PerformanceObserver', Observer);
  return instances;
}

describe('original navigation frame diagnostics', () => {
  it('exports whole native frames overlapping the completed original navigation cut', () => {
    const observers = longFrameObservers();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100);
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><h1>Target</h1></main>';
    const { scope, frame } = probe();
    const styles = vi.spyOn(globalThis, 'getComputedStyle');
    const geometry = vi.spyOn(Element.prototype, 'getClientRects');
    scope.__beginBenchmarkNavigation({
      path: '/target',
      text: 'Target',
      queryNames: ['users.current'],
    });
    expect(observers[0].observe).toHaveBeenCalledWith({
      type: 'long-animation-frame',
      buffered: true,
    });
    const circularWindow: { self?: unknown } = {};
    circularWindow.self = circularWindow;
    const nativeFrame = {
      startTime: 105,
      duration: 80,
      blockingDuration: 17,
      renderStart: 130,
      styleAndLayoutStart: 133,
      firstUIEventTimestamp: 104,
      scripts: [
        {
          startTime: 106,
          duration: 65,
          executionStart: 107,
          pauseDuration: 0,
          forcedStyleAndLayoutDuration: 12.5,
          sourceURL: 'https://user:secret@probe.test/assets/route.js?token=secret#private',
          sourceFunctionName: 'renderRoute',
          sourceCharPosition: 0,
          invokerType: 'user-callback',
          windowAttribution: 'self',
          window: circularWindow,
        },
        { duration: 7, sourceURL: '', sourceFunctionName: '', sourceCharPosition: -1 },
        {
          duration: 6,
          sourceURL: 'opaque source',
          sourceCharPosition: '0',
          forcedStyleAndLayoutDuration: NaN,
        },
        { duration: 6 },
        { duration: 6, sourceURL: 'data:text/javascript,private-source' },
      ],
    };
    observers[0].emit(
      { startTime: 20, duration: 70 },
      { startTime: 90, duration: 30 },
      nativeFrame,
      { startTime: 141, duration: 80 }
    );
    clock.mockReturnValue(120);
    scope.__zeroPerformanceReady('users.current', true, performance.now());
    clock.mockReturnValue(140);
    frame();
    const paint = {
      start: scope.__benchmarkPaint.start,
      displayed: scope.__benchmarkPaint.displayed,
      authoritative: scope.__benchmarkPaint.authoritative,
    };
    const styleCount = styles.mock.calls.length;
    const geometryCount = geometry.mock.calls.length;
    clock.mockReturnValue(5_000);
    const snapshot = scope.__snapshotBenchmarkNavigationFrames();
    expect(snapshot).toMatchObject({
      supported: true,
      selection: 'frames-overlapping-measured-window',
      browserTimeOrigin: performance.timeOrigin,
      start: 100,
      end: 140,
    });
    expect(snapshot.frames.map((entry: PerformanceEntry) => entry.startTime)).toEqual([90, 105]);
    const attributedFrame = snapshot.frames[1];
    expect(snapshot.frames[0]).toEqual({ startTime: 90, duration: 30, scripts: [] });
    expect(attributedFrame).toMatchObject({
      startTime: 105,
      duration: 80,
      renderStart: 130,
      styleAndLayoutStart: 133,
      blockingDuration: 17,
      firstUIEventTimestamp: 104,
    });
    expect(attributedFrame.scripts[0]).toEqual({
      startTime: 106,
      duration: 65,
      executionStart: 107,
      pauseDuration: 0,
      forcedStyleAndLayoutDuration: 12.5,
      sourceURL: 'https://probe.test/assets/route.js',
      sourceFunctionName: 'renderRoute',
      sourceCharPosition: 0,
      invokerType: 'user-callback',
      windowAttribution: 'self',
    });
    expect(attributedFrame.scripts[1]).toMatchObject({
      sourceURL: '',
      sourceFunctionName: '',
      sourceCharPosition: -1,
    });
    expect(JSON.stringify(attributedFrame.scripts.slice(2))).toBe(
      '[{"duration":6},{"duration":6},{"duration":6}]'
    );
    expect(nativeFrame.duration).toBe(80);
    expect(nativeFrame.scripts[0].sourceURL).toContain('token=secret');
    expect(JSON.stringify(snapshot)).not.toMatch(/secret|private-source|"window":/);
    expect(styles).toHaveBeenCalledTimes(styleCount);
    expect(geometry).toHaveBeenCalledTimes(geometryCount);
    expect(scope.__benchmarkPaint).toMatchObject(paint);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(scope.__snapshotBenchmarkNavigationFrames()).toEqual(snapshot);
    observers[0].emit({ startTime: 110, duration: 60 });
    expect(scope.__snapshotBenchmarkNavigationFrames()).toEqual(snapshot);
  });

  it('drains pending native records and discards stale navigation observers', () => {
    const observers = longFrameObservers();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100);
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><h1>Target</h1></main>';
    const { scope, frame } = probe();
    const target = { path: '/target', text: 'Target', queryNames: ['users.current'] };
    scope.__beginBenchmarkNavigation(target);
    observers[0].emit({ startTime: 105, duration: 60 });
    clock.mockReturnValue(200);
    scope.__beginBenchmarkNavigation(target);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    observers[0].emit({ startTime: 205, duration: 60 });
    observers[1].queued.push({ startTime: 210, duration: 75 } as PerformanceEntry);
    scope.__zeroPerformanceReady('users.current', true, performance.now());
    clock.mockReturnValue(240);
    frame();
    const snapshot = scope.__snapshotBenchmarkNavigationFrames();
    expect(snapshot).toMatchObject({ supported: true, start: 200, end: 240 });
    expect(snapshot.frames).toEqual([{ startTime: 210, duration: 75, scripts: [] }]);
    expect(observers[1].takeRecords).toHaveBeenCalledTimes(1);
    expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps the cold connection anchor while including genuine document boot frames', () => {
    const observers = longFrameObservers();
    const callbacks: ((state: { name: string }) => void)[] = [];
    vi.stubGlobal('__zero', {
      clientID: 'cold-frame-client',
      connection: {
        state: {
          current: { name: 'connecting' },
          subscribe: (callback: (typeof callbacks)[number]) => callbacks.push(callback),
        },
      },
    });
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100);
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><h1>Target</h1></main>';
    const { scope, frame } = probe();
    scope.__beginBenchmarkNavigation(
      { path: '/target', text: 'Target', queryNames: ['users.current'] },
      0,
      true
    );
    scope.__zeroPerformanceView({ phase: 'render' });
    observers[0].emit({ startTime: 50, duration: 70 });
    expect(scope.__benchmarkPaint.start).toBeNull();
    clock.mockReturnValue(150);
    callbacks[0]({ name: 'connected' });
    clock.mockReturnValue(170);
    scope.__zeroPerformanceReady('users.current', true, performance.now());
    clock.mockReturnValue(180);
    frame();
    expect(scope.__benchmarkPaint).toMatchObject({ start: 150, displayed: 30, authoritative: 20 });
    expect(scope.__snapshotBenchmarkNavigationFrames()).toEqual({
      supported: true,
      selection: 'frames-overlapping-measured-window',
      browserTimeOrigin: performance.timeOrigin,
      start: 0,
      end: 180,
      frames: [{ startTime: 50, duration: 70, scripts: [] }],
    });
  });

  it.each(['absent', 'unsupported'])(
    'keeps paint and authoritative readiness unchanged when the observer is %s',
    kind => {
      const observers = longFrameObservers([]);
      if (kind === 'absent') vi.stubGlobal('PerformanceObserver', undefined);
      vi.spyOn(performance, 'now').mockReturnValue(100);
      history.replaceState(null, '', '/target');
      document.body.innerHTML = '<main><h1>Target</h1></main>';
      const { scope, frame } = probe();
      scope.__beginBenchmarkNavigation({
        path: '/target',
        text: 'Target',
        queryNames: ['users.current'],
      });
      scope.__zeroPerformanceReady('users.current', true, performance.now());
      frame();
      expect(scope.__benchmarkPaint).toMatchObject({ start: 100, displayed: 0, authoritative: 0 });
      expect(scope.__snapshotBenchmarkNavigationFrames()).toEqual({
        supported: false,
        selection: 'frames-overlapping-measured-window',
        browserTimeOrigin: performance.timeOrigin,
        start: 100,
        end: 100,
        frames: [],
      });
      expect(observers).toHaveLength(0);
    }
  );

  it('does not invent a completed snapshot and cleans up observers on reinstallation or rejection', () => {
    const observers = longFrameObservers();
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><h1>Other</h1></main>';
    const { scope, frame } = probe();
    const target = { path: '/target', text: 'Target' };
    scope.__beginBenchmarkNavigation(target);
    frame();
    observers[0].emit({ startTime: performance.now(), duration: 60 });
    expect(scope.__snapshotBenchmarkNavigationFrames()).toMatchObject({
      supported: true,
      end: undefined,
      frames: [],
    });
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    scope.__beginBenchmarkNavigation(target);
    installNavigationProbe();
    expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
    observers[1].emit({ startTime: performance.now(), duration: 60 });
    expect(scope.__benchmarkPaint.longAnimationFrames).toEqual([]);
    vi.stubGlobal(
      'PerformanceObserver',
      class {
        static supportedEntryTypes = ['long-animation-frame'];
        observe() {
          throw new Error('Observer type rejected');
        }
        disconnect = vi.fn();
      }
    );
    installNavigationProbe();
    expect(() => scope.__beginBenchmarkNavigation(target)).not.toThrow();
    expect(scope.__snapshotBenchmarkNavigationFrames().supported).toBe(false);
    expect(scope.__benchmarkPaint.displayed).toBeNull();
  });
});

describe('navigation paint measurement', () => {
  it('records candidates first discovered by the initial RAF in that real frame', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10);
    history.replaceState(null, '', '/old');
    document.body.innerHTML = '<main><h1>Target</h1></main>';
    const { scope, frame } = probe();
    scope.__zeroPerformanceView({
      activationID: 'retained',
      phase: 'commit',
      name: 'messages.messagePage',
      args: { conversationId: 'expected' },
      ids: ['message'],
      type: 'complete',
      at: 9,
    });
    scope.__beginBenchmarkNavigation({
      path: '/target',
      text: 'Target',
      contentSelector: 'main',
      queryNames: ['messages.messagePage'],
      queryArgs: { conversationId: 'expected' },
      id: 'message',
    });
    history.replaceState(null, '', '/target');
    expect(scope.__benchmarkPaint.start).toBe(10);
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    expect(scope.__benchmarkPaint.authoritative).toBeNull();
    clock.mockReturnValue(26);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBe(16);
    expect(scope.__benchmarkPaint.authoritative).toBe(16);
    clock.mockReturnValue(42);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBe(16);
    expect(scope.__benchmarkPaint.authoritative).toBe(16);
  });

  it('keeps candidates discovered by an outside-frame mutation waiting for the next RAF', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10);
    history.replaceState(null, '', '/target');
    document.body.innerHTML = '<main><h1>Other</h1></main>';
    const { scope, frame } = probe();
    const geometry = vi.spyOn(Element.prototype, 'getClientRects');
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target', contentSelector: 'main' });
    clock.mockReturnValue(26);
    frame();
    clock.mockReturnValue(27);
    document.querySelector('h1')!.textContent = 'Target';
    await Promise.resolve();
    expect(geometry).not.toHaveBeenCalled();
    expect(scope.__benchmarkPaint.displayed).toBeNull();
    clock.mockReturnValue(42);
    frame();
    expect(scope.__benchmarkPaint.displayed).toBe(32);
    expect(scope.__benchmarkPaint.authoritative).toBeNull();
  });

  it('does not duplicate a paint already queued before the initial RAF inspection', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(10);
    history.replaceState(null, '', '/old');
    document.body.innerHTML = '<main><h1>Other</h1></main>';
    const { scope, frame } = probe();
    const geometry = vi.spyOn(Element.prototype, 'getClientRects');
    scope.__beginBenchmarkNavigation({ path: '/target', text: 'Target', contentSelector: 'main' });
    history.replaceState(null, '', '/target');
    document.querySelector('h1')!.textContent = 'Target';
    await Promise.resolve();
    expect(scope.__benchmarkPaint.pendingFrame).toBe(true);
    expect(geometry).not.toHaveBeenCalled();
    frame();
    expect(geometry).toHaveBeenCalledTimes(1);
    expect(scope.__benchmarkPaint.displayed).toBe(0);
    frame();
    expect(geometry).toHaveBeenCalledTimes(1);
  });

  it.each(['hidden', 'transparent', 'offscreen', 'replaced', 'missing'])(
    'rejects %s content discovered by the initial RAF until it is really paintable',
    async condition => {
      const clock = vi.spyOn(performance, 'now').mockReturnValue(10);
      history.replaceState(null, '', '/old');
      document.body.innerHTML = '<section><main><h1>Target</h1></main></section>';
      if (condition === 'hidden') document.querySelector('section')!.style.visibility = 'hidden';
      if (condition === 'transparent') document.querySelector('section')!.style.opacity = '0';
      if (condition === 'missing') document.querySelector('h1')!.textContent = 'Other';
      const { scope, frame } = probe();
      const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect');
      if (condition === 'offscreen')
        bounds.mockReturnValue({
          top: innerHeight + 1,
          left: 10,
          width: 100,
          height: 30,
          right: 110,
          bottom: innerHeight + 31,
        } as DOMRect);
      scope.__beginBenchmarkNavigation({
        path: '/target',
        text: 'Target',
        contentSelector: 'main',
      });
      if (condition === 'replaced') {
        document.querySelector('main')!.outerHTML = '<main><h1>Other</h1></main>';
        await Promise.resolve();
      }
      history.replaceState(null, '', '/target');
      clock.mockReturnValue(26);
      frame();
      expect(scope.__benchmarkPaint.displayed).toBeNull();
      expect(scope.__benchmarkPaint.authoritative).toBeNull();
      document.querySelector('section')!.style.visibility = 'visible';
      document.querySelector('section')!.style.opacity = '1';
      bounds.mockReturnValue({
        top: 10,
        left: 10,
        width: 100,
        height: 30,
        right: 110,
        bottom: 40,
      } as DOMRect);
      document.querySelector('h1')!.textContent = 'Target';
      await Promise.resolve();
      expect(scope.__benchmarkPaint.displayed).toBeNull();
      clock.mockReturnValue(42);
      frame();
      expect(scope.__benchmarkPaint.displayed).toBe(32);
      expect(scope.__benchmarkPaint.authoritative).toBeNull();
    }
  );

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
