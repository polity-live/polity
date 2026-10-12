import type { APIResponse, Browser, BrowserContext, CDPSession, Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { installNavigationProbe, type NavigationTarget } from './browser-navigation';
import type { ViewClientSamples } from './journey-metrics';
import { required, withDeadline } from './required';

const IDLE_MS = 5_100;
const SCOPE = 'post-acceptance-fresh-context-history-diagnostic';
const WORK_DEADLINE_MS = 100_000;
const TOTAL_DEADLINE_MS = 120_000;

/** The revision supplies every destination and its query/visibility arguments. */
export function historyDiagnosticItinerary<T>(routes: readonly T[]) {
  if (!routes.length) throw new Error('Missing navigation diagnostic routes');
  return [
    { visit: 'first' as const, routes: [...routes] },
    { visit: 'back' as const, routes: [...routes].reverse() },
  ];
}

/** Only public JavaScript assets on the tested application origin can be retained. */
export function diagnosticAssetPath(value: string, appURL: string) {
  try {
    const asset = new URL(value);
    const app = new URL(appURL);
    if (
      !['127.0.0.1', 'localhost'].includes(app.hostname) ||
      asset.origin !== app.origin ||
      !/^\/assets\/[A-Za-z0-9_$.-]+\.(?:js|css)$/.test(asset.pathname)
    )
      return undefined;
    return asset.pathname;
  } catch {
    return undefined;
  }
}

interface DiagnosticOptions {
  browser: Browser;
  donorContext: BrowserContext;
  routes: readonly NavigationTarget[];
  appURL: string;
  output: string;
  alphaWarningKey: string;
  navigate: (
    page: Page,
    route: string,
    search: unknown,
    target: NavigationTarget
  ) => Promise<unknown>;
  inspect: (page: Page, samples: ViewClientSamples) => Promise<unknown>;
}

export function diagnosticError(error: unknown, stage: string) {
  if (error instanceof DiagnosticStageError) return { stage: error.stage, kind: error.kind };
  const kind =
    error instanceof Error && /timed out|timeout/i.test(error.message)
      ? 'TimeoutError'
      : error instanceof Error &&
          [
            'Error',
            'TypeError',
            'RangeError',
            'TimeoutError',
            'AbortError',
            'ProtocolError',
          ].includes(error.name)
        ? error.name
        : 'UnknownError';
  return { stage, kind };
}

class DiagnosticStageError extends Error {
  constructor(
    readonly stage: string,
    readonly kind: string
  ) {
    super('Navigation history diagnostic stage failed');
  }
}

function validateAssetResponse(response: APIResponse) {
  if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
  const contentType = response.headers()['content-type'] ?? '';
  if (!/(?:javascript|ecmascript|css)/i.test(contentType))
    throw new Error('Asset response is not JavaScript or CSS');
}

function validateAssetSize(body: Uint8Array, retainedBytes: number) {
  if (body.length > 8 * 1024 * 1024) throw new Error('Asset exceeds retention limit');
  if (retainedBytes + body.length > 32 * 1024 * 1024)
    throw new Error('Assets exceed retention limit');
}

/** Never appends acceptance results, changes fixtures, or instruments their page. */
export async function runNavigationHistoryDiagnostic(options: DiagnosticOptions) {
  const startedAt = Date.now();
  const run = <T>(
    operation: () => Promise<T>,
    label: string,
    cleanup = false,
    reserveMs = cleanup ? 6_000 : 0
  ) => {
    const remaining =
      startedAt + (cleanup ? TOTAL_DEADLINE_MS : WORK_DEADLINE_MS) - Date.now() - reserveMs;
    if (remaining <= 0) throw new DiagnosticStageError(label, 'DeadlineExceeded');
    return withDeadline(operation(), label, Math.min(cleanup ? 5_000 : 15_000, remaining)).catch(
      error => {
        throw new DiagnosticStageError(label, diagnosticError(error, label).kind);
      }
    );
  };
  const directory = path.join(options.output, 'navigation-history-diagnostic');
  let context: BrowserContext | undefined;
  let session: CDPSession | undefined;
  let profiling = false;
  let tracing = false;
  let profile: any;
  const timeline: unknown[] = [];
  const records: unknown[] = [];
  const errors: { stage: string; kind: string }[] = [];
  const assets: { path: string; file: string; bytes: number; sha256: string }[] = [];
  const assetErrors: { path: string; error: { stage: string; kind: string } }[] = [];
  const stylePaths = new Set<string>();
  try {
    if (!diagnosticAssetPath(new URL('/assets/probe.js', options.appURL).href, options.appURL))
      throw new Error('Navigation history diagnostic requires a local application origin');
    await mkdir(directory, { recursive: true });
    const cookies = await run(() => options.donorContext.cookies(), 'Diagnostic cookies');
    // A fresh context has no Zero IndexedDB/client lifetime from the acceptance page.
    context = await run(
      () => options.browser.newContext({ storageState: { cookies, origins: [] } }),
      'Diagnostic context'
    );
    await run(
      () =>
        required(context).addInitScript(() => {
          const scope = globalThis as any;
          scope.__zeroPerformancePreloadEvents = [];
          scope.__zeroPerformancePreload = (event: unknown) =>
            scope.__zeroPerformancePreloadEvents.push(event);
        }),
      'Diagnostic observation hooks'
    );
    await run(
      () =>
        required(context).addInitScript(alphaWarningKey => {
          localStorage.setItem('i18nextLng', 'en');
          sessionStorage.setItem(alphaWarningKey, 'true');
        }, options.alphaWarningKey),
      'Diagnostic display preferences'
    );
    const page = await run(() => required(context).newPage(), 'Diagnostic page');
    page.on('response', response => {
      const assetPath = diagnosticAssetPath(response.url(), options.appURL);
      if (assetPath?.endsWith('.css')) stylePaths.add(assetPath);
    });
    session = await run(() => required(context).newCDPSession(page), 'Diagnostic CPU session');
    session.on('Tracing.dataCollected', ({ value }) => {
      for (const event of value) {
        const { name, cat, ph, ts, dur, pid, tid } = event;
        // Keep static source/stack metadata, never arbitrary event arguments.
        const data = (
          event as unknown as { args?: { data?: { stackTrace?: unknown; type?: string } } }
        ).args?.data;
        const stack = (Array.isArray(data?.stackTrace) ? data.stackTrace : [])
          .filter((frame: any) => diagnosticAssetPath(frame.url, options.appURL))
          .map((frame: any) => ({
            functionName: frame.functionName,
            path: diagnosticAssetPath(frame.url, options.appURL),
            lineNumber: frame.lineNumber,
            columnNumber: frame.columnNumber,
          }));
        const type = data?.type;
        timeline.push({
          name,
          cat,
          ph,
          ts,
          dur,
          pid,
          tid,
          ...(stack?.length ? { stack } : {}),
          ...(name === 'EventDispatch' &&
          typeof type === 'string' &&
          ['popstate', 'scroll', 'resize'].includes(type)
            ? { eventType: type }
            : {}),
        });
      }
    });
    await run(() => required(session).send('Profiler.enable'), 'Diagnostic CPU enable');
    await run(
      () => required(session).send('Profiler.setSamplingInterval', { interval: 1000 }),
      'Diagnostic CPU interval'
    );
    await run(() => required(session).send('Profiler.start'), 'Diagnostic CPU start');
    profiling = true;
    await run(
      () =>
        required(session).send('Tracing.start', {
          categories:
            'devtools.timeline,disabled-by-default-devtools.timeline.stack,blink.user_timing',
          options: 'record-as-much-as-possible',
        }),
      'Diagnostic timeline start'
    );
    tracing = true;
    const samples: ViewClientSamples = new Map();
    const ready = () =>
      run(
        () =>
          page.waitForFunction(
            () => {
              const state = (globalThis as any).__benchmarkPaint;
              return state?.displayed != null && state?.authoritative != null;
            },
            undefined,
            { timeout: 15_000 }
          ),
        'Diagnostic route readiness'
      );
    for (const { visit, routes } of historyDiagnosticItinerary(options.routes)) {
      if (visit === 'back') {
        const departure = options.routes[0];
        await run(
          () => options.navigate(page, departure.path, departure.search ?? {}, departure),
          'Diagnostic departure'
        );
        await ready();
        // Match the revision's departure inspection before the back traversal.
        await run(() => options.inspect(page, samples), 'Diagnostic departure inspection');
      }
      for (const target of routes) {
        const index = options.routes.indexOf(target);
        await run(
          () =>
            page.evaluate(
              name => performance.mark(name),
              `history-diagnostic-${visit}-${index}-start`
            ),
          'Diagnostic start mark'
        );
        if (page.url() === 'about:blank') {
          await run(
            () =>
              page.addInitScript(
                `globalThis.__name = value => value; (${installNavigationProbe.toString()})(); performance.mark('history-diagnostic-first-${index}-start'); globalThis.__beginBenchmarkNavigation(${JSON.stringify(target)}, 0, true);`
              ),
            'Diagnostic cold navigation hooks'
          );
          const address = new URL(target.path, options.appURL);
          address.search = new URLSearchParams(target.search ?? {}).toString();
          await run(
            () => page.goto(address.href, { waitUntil: 'domcontentloaded' }),
            'Diagnostic first navigation'
          );
        } else if (visit === 'back' && new URL(page.url()).pathname !== target.path) {
          await run(
            () =>
              page.evaluate(target => {
                (globalThis as any).__beginBenchmarkNavigation(target);
                history.back();
              }, target),
            'Diagnostic history back'
          );
        } else {
          await run(
            () => options.navigate(page, target.path, target.search ?? {}, target),
            'Diagnostic navigation'
          );
        }
        await ready();
        await run(
          () =>
            page.evaluate(
              name => performance.mark(name),
              `history-diagnostic-${visit}-${index}-end`
            ),
          'Diagnostic end mark'
        );
        // Match the original idle period; these values are diagnostic, never gate results.
        await run(() => page.waitForTimeout(IDLE_MS), 'Diagnostic idle interval');
        await run(() => options.inspect(page, samples), 'Diagnostic query inspection');
        const frames = await run(
          () => page.evaluate(() => (globalThis as any).__snapshotBenchmarkNavigationFrames()),
          'Diagnostic original history frames'
        );
        records.push({ scope: SCOPE, visit, index, queryNames: target.queryNames, ...frames });
      }
    }
  } catch (error) {
    errors.push(diagnosticError(error, 'navigation'));
  } finally {
    if (session && profiling) {
      try {
        ({ profile } = await run(
          () => required(session).send('Profiler.stop'),
          'Diagnostic CPU export',
          true
        ));
      } catch (error) {
        errors.push(diagnosticError(error, 'CPU export'));
      }
    }
    if (session && tracing) {
      try {
        const completed = new Promise<void>(resolve =>
          required(session).once('Tracing.tracingComplete', () => resolve())
        );
        await run(() => required(session).send('Tracing.end'), 'Diagnostic timeline end', true);
        await run(() => completed, 'Diagnostic timeline export', true);
      } catch (error) {
        errors.push(diagnosticError(error, 'Timeline export'));
      }
    }
    // Retain the actual profiled bundle bytes after every diagnostic navigation cut.
    if (context && profile) {
      const paths = new Set<string>(
        profile.nodes
          .map((node: any) => diagnosticAssetPath(node.callFrame.url, options.appURL))
          .filter(Boolean)
      );
      for (const assetPath of stylePaths) paths.add(assetPath);
      let retainedBytes = 0;
      if (paths.size > 128)
        assetErrors.push({
          path: '*',
          error: { stage: 'Asset retention', kind: 'AssetCountLimit' },
        });
      for (const assetPath of [...paths].slice(0, 128)) {
        try {
          const response = await run(
            () =>
              required(context).request.get(new URL(assetPath, options.appURL).href, {
                maxRedirects: 0,
              }),
            'Diagnostic asset request',
            true,
            6_000
          );
          validateAssetResponse(response);
          const body = await run(() => response.body(), 'Diagnostic asset body', true, 6_000);
          validateAssetSize(body, retainedBytes);
          const filename = path.posix.basename(assetPath);
          await writeFile(path.join(directory, filename), body);
          retainedBytes += body.length;
          assets.push({
            path: assetPath,
            file: filename,
            bytes: body.length,
            sha256: createHash('sha256').update(body).digest('hex'),
          });
        } catch (error) {
          assetErrors.push({ path: assetPath, error: diagnosticError(error, 'Asset retention') });
        }
      }
    }
    try {
      if (session)
        await withDeadline(
          session.detach(),
          'Diagnostic CPU detach',
          Math.max(1, Math.min(1_000, startedAt + TOTAL_DEADLINE_MS - Date.now() - 5_000))
        );
    } catch (error) {
      errors.push(diagnosticError(error, 'CPU detach'));
    }
    try {
      // Initiate close even if the diagnostic budget has already expired.
      if (context)
        await withDeadline(
          context.close(),
          'Diagnostic context close',
          Math.max(1, Math.min(5_000, startedAt + TOTAL_DEADLINE_MS - Date.now()))
        );
    } catch (error) {
      errors.push(diagnosticError(error, 'Context close'));
    }
    try {
      await mkdir(directory, { recursive: true });
      if (profile)
        await writeFile(path.join(directory, 'navigation.cpuprofile'), JSON.stringify(profile));
      await writeFile(
        path.join(directory, 'navigation-timeline.json'),
        JSON.stringify({ scope: SCOPE, events: timeline })
      );
      await writeFile(
        path.join(directory, 'navigation-frames.ndjson'),
        records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '')
      );
      await writeFile(
        path.join(directory, 'manifest.json'),
        JSON.stringify({
          scope: SCOPE,
          idleMs: IDLE_MS,
          deadlineMs: TOTAL_DEADLINE_MS,
          records: records.length,
          assets,
          assetErrors,
          errors,
        })
      );
    } catch {
      // Diagnostic export cannot alter the revision's acceptance result list.
      console.warn('Navigation history diagnostic export failed.');
    }
  }
}
