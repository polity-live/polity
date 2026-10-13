import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  diagnosticAssetPath,
  diagnosticError,
  historyDiagnosticItinerary,
  runNavigationHistoryDiagnostic,
} from '../navigation-history-diagnostic';

vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));

function fixture() {
  const routes = [
    {
      path: '/search',
      text: 'Fixture',
      search: { q: 'Fixture', types: 'group' },
      queryArgs: { query: 'Fixture', types: ['group'] },
      queryNames: ['search.searchDocumentPage'],
    },
    {
      path: '/messages',
      text: 'Message',
      search: { conversationId: 'fixture-id' },
      queryArgs: { conversationId: 'fixture-id' },
      queryNames: ['messages.messagePage'],
    },
  ];
  const history: string[] = [];
  let historyIndex = -1;
  const actions: unknown[] = [];
  const session = {
    on: vi.fn(),
    once: vi.fn((_event: string, callback: () => void) => callback()),
    send: vi.fn(async (command: string) =>
      command === 'Profiler.stop' ? { profile: { nodes: [], samples: [], timeDeltas: [] } } : {}
    ),
    detach: vi.fn(async () => undefined),
  };
  const page = {
    on: vi.fn(),
    url: vi.fn(() => history[historyIndex] ?? 'about:blank'),
    addInitScript: vi.fn(async (_script: string) => undefined),
    evaluate: vi.fn(async (fn: string | ((...args: any[]) => unknown), value?: unknown) => {
      if (fn.toString().includes('history.back()')) {
        historyIndex -= 1;
        actions.push({ back: value });
      }
      if (fn.toString().includes('__snapshotBenchmarkNavigationFrames'))
        return { supported: true, start: 10, end: 20, frames: [] };
    }),
    goto: vi.fn(async (address: string, _options?: unknown) => {
      history.push(address);
      historyIndex++;
      actions.push({ goto: address });
    }),
    waitForFunction: vi.fn(async () => undefined),
    waitForTimeout: vi.fn(async (_milliseconds: number) => undefined),
  };
  const context = {
    addInitScript: vi.fn(async (_script: unknown, _argument?: unknown) => undefined),
    newPage: vi.fn(async () => page),
    newCDPSession: vi.fn(async () => session),
    request: { get: vi.fn() },
    close: vi.fn(async () => undefined),
  };
  const donorContext = {
    cookies: vi.fn(async () => [{ name: 'auth', value: 'secret', domain: '127.0.0.1', path: '/' }]),
  };
  const browser = { newContext: vi.fn(async () => context) };
  const navigate = vi.fn(
    async (_page: unknown, route: string, search: Record<string, string>, target: unknown) => {
      const address = new URL(route, 'http://127.0.0.1:15620');
      address.search = new URLSearchParams(search).toString();
      history.splice(historyIndex + 1);
      history.push(address.href);
      historyIndex++;
      actions.push({ navigate: target });
    }
  );
  const inspect = vi.fn(async () => undefined);
  return {
    routes,
    page,
    context,
    session,
    browser,
    donorContext,
    navigate,
    inspect,
    actions,
    options: {
      browser,
      donorContext,
      routes,
      navigate,
      inspect,
      appURL: 'http://127.0.0.1:15620',
      output: '/diagnostic-output',
      alphaWarningKey: 'alpha-warning',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('fresh-context navigation history diagnostic', () => {
  it('retains hidden source maps bound to the actual profiled bundle bytes', async () => {
    const f = fixture();
    const url = 'http://127.0.0.1:15620/assets/router.js';
    const profile = {
      nodes: [{ id: 1, callFrame: { url, functionName: 'route', lineNumber: 0, columnNumber: 0 } }],
      samples: [1],
      timeDeltas: [1000],
    };
    f.session.send.mockImplementation(async (command: string) =>
      command === 'Profiler.stop' ? { profile } : ({} as any)
    );
    f.context.request.get.mockImplementation(async (address: string) => ({
      ok: () => true,
      headers: () => ({ 'content-type': 'application/javascript' }),
      body: async () =>
        Buffer.from(
          address.endsWith('.map')
            ? JSON.stringify({
                version: 3,
                file: 'router.js',
                sources: ['router.ts'],
                names: [],
                mappings: 'AAAA',
              })
            : 'function route() {}'
        ),
    }));
    await runNavigationHistoryDiagnostic(f.options as any);
    expect(f.context.request.get).toHaveBeenCalledWith(`${url}.map`, { maxRedirects: 0 });
    const manifest = JSON.parse(
      String(
        vi
          .mocked(writeFile)
          .mock.calls.find(([name]) => String(name).endsWith('manifest.json'))?.[1]
      )
    );
    expect(manifest.sourceMaps[0].assetSha256).toBe(manifest.assets[0].sha256);
    const attribution = JSON.parse(
      String(
        vi
          .mocked(writeFile)
          .mock.calls.find(([name]) => String(name).endsWith('navigation-attribution.json'))?.[1]
      )
    );
    expect(attribution.functions[0].sourceMapStatus).toBe('mapped');
  });
  it('preserves route identities and arguments in the original first/back order', () => {
    const routes = [{ path: '/a', search: { q: 'a' } }, { path: '/b' }];
    const plan = historyDiagnosticItinerary(routes);
    expect(plan.map(entry => entry.visit)).toEqual(['first', 'back']);
    expect(plan[0].routes).toEqual(routes);
    expect(plan[1].routes).toEqual([routes[1], routes[0]]);
    expect(plan[1].routes[0]).toBe(routes[1]);
    expect(routes).toEqual([{ path: '/a', search: { q: 'a' } }, { path: '/b' }]);
  });

  it('installs one probe, keeps the main context untouched and closes before returning', async () => {
    const f = fixture();
    await runNavigationHistoryDiagnostic(f.options as any);
    expect(f.browser.newContext).toHaveBeenCalledWith({
      storageState: { cookies: await f.donorContext.cookies(), origins: [] },
    });
    const probeScripts = [
      ...f.context.addInitScript.mock.calls,
      ...f.page.addInitScript.mock.calls,
    ].filter(([script]) => typeof script === 'string' && script.includes('installNavigationProbe'));
    expect(probeScripts).toHaveLength(1);
    expect(f.page.addInitScript).toHaveBeenCalledTimes(1);
    expect(f.page.addInitScript.mock.calls[0][0]).toContain('installNavigationProbe');
    expect(f.page.addInitScript.mock.calls[0][0]).toContain('__beginBenchmarkNavigation');
    const initial = f.page.addInitScript.mock.calls[0][0];
    expect(initial.indexOf('installNavigationProbe')).toBeLessThan(
      initial.lastIndexOf('__beginBenchmarkNavigation')
    );
    expect(f.page.goto).toHaveBeenCalledWith(
      'http://127.0.0.1:15620/search?q=Fixture&types=group',
      { waitUntil: 'domcontentloaded' }
    );
    expect(f.actions).toEqual([
      { goto: 'http://127.0.0.1:15620/search?q=Fixture&types=group' },
      { navigate: f.routes[1] },
      { navigate: f.routes[0] },
      { back: f.routes[1] },
      { back: f.routes[0] },
    ]);
    expect(f.page.waitForTimeout.mock.calls).toEqual([[5100], [5100], [5100], [5100]]);
    expect(f.inspect).toHaveBeenCalledTimes(5);
    expect(f.inspect.mock.invocationCallOrder[2]).toBeLessThan(
      f.page.evaluate.mock.invocationCallOrder.find((_, index) =>
        f.page.evaluate.mock.calls[index][0].toString().includes('history.back()')
      )!
    );
    expect(f.context.close).toHaveBeenCalledTimes(1);
    expect(f.session.detach).toHaveBeenCalledTimes(1);
    expect(f.session.detach.mock.invocationCallOrder[0]).toBeLessThan(
      f.context.close.mock.invocationCallOrder[0]
    );
    expect(mkdir).toHaveBeenCalled();
    expect(
      vi.mocked(writeFile).mock.calls.some(([name]) => String(name).endsWith('manifest.json'))
    ).toBe(true);
  });

  it('initiates context close and retains sanitized partial sidecars when the deadline expires', async () => {
    const f = fixture();
    let time = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => time);
    f.page.waitForTimeout.mockImplementation(async () => {
      time = 200_000;
    });
    await runNavigationHistoryDiagnostic(f.options as any);
    expect(f.context.close).toHaveBeenCalledTimes(1);
    const manifest = JSON.parse(
      String(
        vi.mocked(writeFile).mock.calls.find(([name]) => String(name).endsWith('manifest.json'))![1]
      )
    );
    expect(manifest.errors).toContainEqual({
      stage: 'Diagnostic query inspection',
      kind: 'DeadlineExceeded',
    });
    expect(JSON.stringify(manifest)).not.toMatch(/secret|fixture-id|Fixture/);
  });

  it('retains only local public bundle paths and excludes redirects/content endpoints', () => {
    const app = 'http://127.0.0.1:15620';
    expect(diagnosticAssetPath(`${app}/assets/router-runtime-Abc12345.js?token=secret`, app)).toBe(
      '/assets/router-runtime-Abc12345.js'
    );
    expect(diagnosticAssetPath(`${app}/assets/style-Abc12345.css`, app)).toBe(
      '/assets/style-Abc12345.css'
    );
    for (const address of [
      'https://www.polity.live/assets/a.js',
      'http://127.0.0.1:15621/assets/a.js',
      `${app}/api/query`,
      `${app}/assets/%2e%2e%2fapi.js`,
      `${app}/assets/nested/a.js`,
    ])
      expect(diagnosticAssetPath(address, app)).toBeUndefined();
    expect(
      diagnosticAssetPath('https://www.polity.live/assets/a.js', 'https://www.polity.live')
    ).toBeUndefined();
    expect(diagnosticError(new Error('password=secret query=fixture-id'), 'request')).toEqual({
      stage: 'request',
      kind: 'Error',
    });
  });
});
