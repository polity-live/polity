import { required, withDeadline } from './required';
import {
  chromium,
  type Page,
  type Browser,
  type BrowserContext,
  type WebSocket,
  type CDPSession,
} from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { seedCreatePrerequisites } from '../../../e2e/fixtures/seed';
import { seedMessageFlow } from '../../../e2e/fixtures/domains/communications';
import { db } from '../../../e2e/fixtures/db';
import { OWNER, OUTSIDER, OWNER_ID } from './catalog';
import { BUDGETS } from './metrics';
import {
  installNavigationProbe,
  inspectorFrameSummary,
  type NavigationTarget,
} from './browser-navigation';
import {
  preloadRuns,
  viewRuns,
  queryObservationFailures,
  retainViewClientSamples,
  hasUnmeasuredActiveViews,
  type ViewClientSamples,
  type QueryObservation,
} from './journey-metrics';
import type { PreloadLifecycleEvent } from '../../../src/zero/preloads/query-lifecycle';
import type { QueryViewObservation } from '../../../src/zero/observed-query';
import { preloadKey } from '../../../src/zero/preloads/preload-registry';
import { ALPHA_WARNING_SESSION_KEY } from '../../../src/features/shared/constants';
import { measureMutationBrowserActions, type MutationBrowserResult } from './mutation-browser';

export interface JourneyResult {
  route: string;
  visit: string;
  visibleMs: number;
  authoritativeMs?: number;
  cachedDisplayMs?: number;
  boot?: {
    documentStart: number;
    connectedAt: number;
    clientID: string;
    visibleMs: number;
    authoritativeMs: number;
  };
  queries: QueryObservation[];
  inspectionMs?: number;
  preloadEvents?: PreloadLifecycleEvent[];
  viewEvents?: QueryViewObservation[];
  failures: string[];
  target?: NavigationTarget;
  diagnostic?: {
    url: string;
    body: string;
    errors: string[];
    activeViews?: QueryViewObservation[];
    layout?: unknown;
    sync?: { expectedName: string; localName: string | null; localPresent: boolean };
  };
  processing?: {
    browserTimeOrigin: number;
    connections: { clientID: string; state: string; at: number }[];
    navigationStart: number;
    longTasks: { start: number; duration: number }[];
    assets: { path: string; start: number; duration: number }[];
    requests?: { path: string; start: number; duration: number; initiator: string }[];
  };
}
export async function measureJourneys(
  onUpdate: (records: JourneyResult[]) => Promise<void> = async () => {
    /* Optional diagnostic sink. */
  },
  onMutationUpdate: (records: MutationBrowserResult[]) => Promise<void> = async () => {
    /* Optional mutation diagnostic sink. */
  }
) {
  const seed = await seedCreatePrerequisites('benchmark', OWNER_ID);
  const conversation = await seedMessageFlow('benchmark', OWNER_ID, OUTSIDER.userID);
  const cookies: { name: string; value: string; options: any }[] = [];
  const auth = createServerClient(
    required(process.env.SUPABASE_URL),
    required(process.env.SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => [],
        setAll: values => {
          cookies.push(...values);
        },
      },
    }
  );
  const { data, error } = await auth.auth.signInWithPassword({
    email: OWNER.email,
    password: 'e2e-password-123456',
  });
  if (error || data.user?.id !== OWNER_ID || !cookies.length)
    throw new Error('Journey session provisioning failed');
  const browser = process.env.ZERO_PERFORMANCE_BROWSER_ENDPOINT
    ? await chromium.connect(process.env.ZERO_PERFORMANCE_BROWSER_ENDPOINT)
    : await chromium.launch({ headless: true });
  const records: JourneyResult[] = [];
  const clientSamples: ViewClientSamples = new Map();
  const warnings: string[] = [];
  const errorCounts = { page: 0, console: 0, react: {} as Record<string, number> };
  const countReactError = (message: string) => {
    const code = message.match(/Minified React error #(\d+)/)?.[1];
    if (code) errorCounts.react[code] = (errorCounts.react[code] ?? 0) + 1;
  };
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const state = globalThis as any;
      state.__zeroPerformancePreloadEvents = [];
      state.__zeroPerformancePreload = (event: unknown) =>
        state.__zeroPerformancePreloadEvents.push(event);
    });
    // tsx/esbuild keeps local function names using this helper in serialized callbacks.
    await context.addInitScript(
      `globalThis.__name = (value) => value; (${installNavigationProbe.toString()})();`
    );
    await context.addCookies(
      cookies.map(({ name, value, options }) => ({
        name,
        value,
        domain: new URL(required(process.env.VITE_APP_URL)).hostname,
        path: options.path ?? '/',
        httpOnly: options.httpOnly ?? false,
        secure: options.secure ?? false,
        sameSite:
          options.sameSite === 'strict' || options.sameSite === true
            ? ('Strict' as const)
            : options.sameSite === 'none'
              ? ('None' as const)
              : ('Lax' as const),
      }))
    );
    await context.addInitScript(
      ({ alphaWarningKey }) => {
        localStorage.setItem('i18nextLng', 'en');
        sessionStorage.setItem(alphaWarningKey, 'true');
      },
      {
        alphaWarningKey: ALPHA_WARNING_SESSION_KEY,
      }
    );
    const page = await context.newPage();
    const sockets = new Set<WebSocket>();
    page.on('websocket', socket => sockets.add(socket));
    const pageErrors: string[] = [];
    let renderLoopErrors = 0;
    page.on('pageerror', error => {
      errorCounts.page++;
      countReactError(error.message);
      pageErrors.push(error.message);
    });
    page.on('console', message => {
      if (message.type() === 'error') {
        errorCounts.console++;
        countReactError(message.text());
      }
      if (
        message.type() === 'error' &&
        /Maximum update depth exceeded|Too many re-renders/.test(message.text())
      ) {
        renderLoopErrors++;
        if (renderLoopErrors <= 3) console.info('zero-performance-react-render-loop');
      }
      if (message.type() === 'warning' && /Slow query/i.test(message.text()))
        warnings.push(message.text());
      if (message.text().startsWith('zero-performance-inspector:')) console.info(message.text());
    });
    const routes: NavigationTarget[] = [
      {
        path: '/search',
        text: seed.groupName,
        contentSelector: 'main',
        // Name one fixture explicitly, rather than relying on tied creation-time ordering.
        search: { q: seed.groupName, types: 'group' },
        queryArgs: { query: seed.groupName, types: ['group'] },
        queryNames: ['search.searchDocumentPage'],
      },
      {
        path: `/group/${seed.groupId}`,
        text: seed.groupName,
        contentSelector: 'main',
        queryNames: ['groups.wikiOverview'],
        id: seed.groupId,
      },
      {
        path: `/event/${seed.eventId}`,
        text: seed.eventTitle,
        contentSelector: 'main',
        queryNames: ['events.wikiData'],
        id: seed.eventId,
      },
      {
        path: `/event/${seed.eventId}/agenda/`,
        text: seed.agendaItemTitle,
        contentSelector: 'main',
        queryNames: ['events.agendaItemsFull'],
        id: seed.agendaItemId,
      },
      {
        path: `/amendment/${seed.amendmentId}`,
        text: seed.amendmentTitle,
        contentSelector: 'main',
        queryNames: ['amendments.byIdWiki'],
        id: seed.amendmentId,
      },
      {
        path: '/messages',
        text: conversation.content,
        contentSelector: `#message-${conversation.messageId}`,
        search: { conversationId: conversation.conversationId },
        consumedSearch: ['conversationId'],
        queryArgs: { conversationId: conversation.conversationId },
        queryNames: ['messages.messagePage'],
        id: conversation.messageId,
      },
    ];
    for (const visit of ['first', 'back', 'repeat']) {
      // Leave the last destination so every return/repeat actually remounts its visible view.
      if (visit !== 'first') {
        const departure = visit === 'back' ? routes[0] : routes[1];
        await navigate(page, departure.path, departure.search ?? {}, departure);
        // router.navigate can resolve before React commits the destination. Ensure
        // the previous page is actually gone before measuring its return visit.
        await page.waitForFunction(
          () => {
            const state = (globalThis as any).__benchmarkPaint;
            return state?.displayed != null && state?.authoritative != null;
          },
          undefined,
          { timeout: 15_000 }
        );
        // Preserve the real local timings of this departure view before it is released.
        // Inspection remains outside the following timed navigation.
        await inspect(page, clientSamples);
      }
      const itinerary = visit === 'back' ? [...routes].reverse() : routes;
      for (const route of itinerary) {
        console.info(`Journey ${visit}: ${route.path}`);
        const record: JourneyResult = {
          route: route.path,
          visit,
          visibleMs: NaN,
          queries: [],
          failures: [],
          target: route,
        };
        records.push(record);
        try {
          if (page.url() === 'about:blank') {
            await page.addInitScript(
              `globalThis.__name = (value) => value; (${installNavigationProbe.toString()})(); globalThis.__beginBenchmarkNavigation(${JSON.stringify(route)}, 0, true);`
            );
            await page.goto(
              `${process.env.VITE_APP_URL}${route.path}${route.search ? '?' + new URLSearchParams(route.search).toString() : ''}`,
              { waitUntil: 'domcontentloaded' }
            );
          } else if (visit === 'back' && new URL(page.url()).pathname !== route.path) {
            await withDeadline(
              page.evaluate(target => {
                (globalThis as any).__beginBenchmarkNavigation(target);
                history.back();
              }, route),
              'Browser evaluate'
            );
          } else {
            await navigate(page, route.path, route.search ?? {}, route);
          }
          await page.waitForFunction(
            () => (globalThis as any).__benchmarkPaint?.displayed != null,
            undefined,
            { timeout: 15_000 }
          );
          record.visibleMs = await withDeadline(
            page.evaluate(() => (globalThis as any).__benchmarkPaint.displayed),
            'Browser evaluate'
          );
          await page.waitForFunction(
            () => (globalThis as any).__benchmarkPaint?.authoritative != null,
            undefined,
            { timeout: 15_000 }
          );
          record.authoritativeMs = await withDeadline(
            page.evaluate(() => (globalThis as any).__benchmarkPaint.authoritative),
            'Browser evaluate'
          );
          record.boot = await page.evaluate(() => {
            const state = (globalThis as any).__benchmarkPaint;
            if (!state.cold) return undefined;
            return {
              ...state.cold,
              visibleMs: state.start + state.displayed - state.cold.documentStart,
              authoritativeMs: state.start + state.authoritative - state.cold.documentStart,
            };
          });
          record.processing = await withDeadline(
            page.evaluate(() => {
              const state = (globalThis as any).__benchmarkPaint;
              const end = state.start + Math.max(state.displayed, state.authoritative);
              const diagnosticStart = state.cold?.documentStart ?? state.start;
              return {
                browserTimeOrigin: performance.timeOrigin,
                connections: (globalThis as any).__zeroPerformanceConnectionEvents ?? [],
                navigationStart: state.start,
                // Keep only paths and timing; query strings and authentication
                // headers may contain credentials and are never exported.
                requests: (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
                  .filter(
                    entry =>
                      ['fetch', 'xmlhttprequest'].includes(entry.initiatorType) &&
                      entry.startTime >= diagnosticStart &&
                      entry.startTime <= end
                  )
                  .map(entry => ({
                    path: new URL(entry.name).pathname,
                    start: entry.startTime,
                    duration: entry.duration,
                    initiator: entry.initiatorType,
                  })),
                longTasks: ((globalThis as any).__benchmarkLongTasks ?? []).filter(
                  (task: any) => task.start >= diagnosticStart && task.start <= end
                ),
                assets: (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
                  .filter(entry => {
                    const address = new URL(entry.name);
                    return (
                      address.origin === location.origin &&
                      address.pathname.startsWith('/assets/') &&
                      entry.startTime >= diagnosticStart &&
                      entry.startTime <= end
                    );
                  })
                  .map(entry => ({
                    path: new URL(entry.name).pathname,
                    start: entry.startTime,
                    duration: entry.duration,
                  })),
              };
            }),
            'Browser evaluate'
          );
          if (required(record.authoritativeMs) > BUDGETS.totalMs)
            record.failures.push(`Authoritative content exceeds ${BUDGETS.totalMs} ms`);
          if (visit !== 'first') {
            record.cachedDisplayMs = record.visibleMs;
            if (record.cachedDisplayMs > BUDGETS.clientMs)
              record.failures.push(`Cached display exceeds ${BUDGETS.clientMs} ms`);
          }
          if (record.visibleMs > BUDGETS.totalMs)
            record.failures.push(`Visible content exceeds ${BUDGETS.totalMs} ms`);
          // Observe idle preloading as well as the visible route.
          await page.waitForTimeout(5_100);
          const inspectionAt = performance.now();
          record.queries = await inspect(page, clientSamples);
          record.inspectionMs = performance.now() - inspectionAt;
          const events = await withDeadline(
            page.evaluate(() => ({
              preloads: (globalThis as any).__zeroPerformancePreloadEvents,
              views: (globalThis as any).__zeroPerformanceViewEvents,
            })),
            'Browser evaluate'
          );
          record.preloadEvents = events.preloads;
          record.viewEvents = events.views;
          for (const query of record.queries) {
            record.failures.push(
              ...queryObservationFailures(query).map(failure => `Query ${query.name}: ${failure}`)
            );
          }
        } catch (error) {
          record.failures.push(error instanceof Error ? error.message : String(error));
          try {
            record.diagnostic = {
              url: page.url(),
              body: (await page.locator('body').innerText()).slice(0, 8_000),
              errors: [...pageErrors],
              activeViews: await withDeadline(
                page.evaluate(() => (globalThis as any).__zeroPerformanceActiveViews()),
                'Browser evaluate'
              ),
              layout: await withDeadline(
                page.evaluate(target => {
                  const content = target.contentSelector
                    ? document.querySelector(target.contentSelector)
                    : document.body;
                  const walker = document.createTreeWalker(
                    content ?? document.body,
                    NodeFilter.SHOW_TEXT
                  );
                  const candidates = [];
                  let node;
                  while ((node = walker.nextNode())) {
                    if (node.textContent?.trim() !== target.text || !node.parentElement) continue;
                    const element = node.parentElement;
                    candidates.push({
                      tag: element.tagName,
                      rect: element.getBoundingClientRect().toJSON(),
                      ancestors: Array.from(
                        (function* () {
                          for (let p: Element | null = element; p; p = p.parentElement) yield p;
                        })()
                      ).map(p => ({
                        tag: p.tagName,
                        id: p.id,
                        opacity: getComputedStyle(p).opacity,
                        display: getComputedStyle(p).display,
                        visibility: getComputedStyle(p).visibility,
                      })),
                    });
                  }
                  return {
                    width: innerWidth,
                    height: innerHeight,
                    scrollY,
                    contentFound: Boolean(content),
                    candidates,
                  };
                }, route),
                'Browser evaluate'
              ),
            };
            const screenshots = path.join(
              required(process.env.ZERO_PERFORMANCE_OUTPUT),
              'screenshots'
            );
            await mkdir(screenshots, { recursive: true });
            await page.screenshot({
              path: path.join(screenshots, `${records.length}-failure.png`),
            });
            record.queries = await inspect(page, clientSamples);
          } catch (diagnosticError) {
            record.failures.push(`Failure diagnostics: ${String(diagnosticError)}`);
          }
        }
        await onUpdate(records);
      }
    }
    if (process.env.ZERO_PERFORMANCE_CPU_PROFILE === '1') {
      // Replay only after the timed navigation samples. Profiling is diagnostic
      // work and its overhead must never become part of the acceptance timings.
      const profiler = await withDeadline(context.newCDPSession(page), 'Browser newCDPSession');
      let profiling = false;
      let tracing = false;
      const timeline: unknown[] = [];
      profiler.on('Tracing.dataCollected', ({ value }) => {
        // Export timing fields only; trace payloads can contain application data.
        for (const { name, cat, ph, ts, dur, pid, tid } of value)
          timeline.push({ name, cat, ph, ts, dur, pid, tid });
      });
      try {
        await withDeadline(
          page.evaluate(() => {
            const scope = globalThis as any;
            const original = window.getComputedStyle;
            const reads = new Map<string, number>();
            // Attribute the profile's layout/style reads to static component markers,
            // without retaining text, IDs, query arguments or authentication values.
            window.getComputedStyle = function (element, pseudo) {
              const key = JSON.stringify({
                tag: element.tagName,
                slot: element.getAttribute('data-slot'),
                role: element.getAttribute('role'),
                state: element.getAttribute('data-state'),
                owner: element.closest('[data-slot]')?.getAttribute('data-slot') ?? null,
              });
              reads.set(key, (reads.get(key) ?? 0) + 1);
              return original.call(window, element, pseudo);
            };
            scope.__finishBenchmarkStyleReads = () => {
              window.getComputedStyle = original;
              delete scope.__finishBenchmarkStyleReads;
              return [...reads].map(([key, count]) => ({ ...JSON.parse(key), count }));
            };
          }),
          'Browser evaluate'
        );
        await withDeadline(profiler.send('Profiler.enable'), 'Browser send');
        await withDeadline(
          profiler.send('Profiler.setSamplingInterval', { interval: 1000 }),
          'Browser send'
        );
        await withDeadline(profiler.send('Profiler.start'), 'Browser send');
        profiling = true;
        await withDeadline(
          profiler.send('Tracing.start', {
            categories: 'devtools.timeline,blink.user_timing',
            options: 'record-as-much-as-possible',
          }),
          'Browser send'
        );
        tracing = true;
        for (const [index, route] of routes.entries()) {
          await withDeadline(
            page.evaluate(index => performance.mark(`zero-route-${index}-start`), index),
            'Browser evaluate'
          );
          await navigate(page, route.path, route.search ?? {}, route);
          await page.waitForFunction(
            () => {
              const state = (globalThis as any).__benchmarkPaint;
              return state?.displayed !== null && state?.authoritative !== null;
            },
            undefined,
            { timeout: 15_000 }
          );
          await withDeadline(
            page.evaluate(index => performance.mark(`zero-route-${index}-end`), index),
            'Browser evaluate'
          );
        }
      } catch (error) {
        // Diagnostic replay must not prevent the subscribed update/revocation
        // checks from running. Preserve the failure on the real navigation record.
        required(records.at(-1)).failures.push(`Navigation CPU diagnostics: ${String(error)}`);
      } finally {
        try {
          if (tracing) {
            const completed = new Promise<void>(resolve =>
              profiler.once('Tracing.tracingComplete', () => resolve())
            );
            await withDeadline(profiler.send('Tracing.end'), 'Browser send');
            await withDeadline(completed, 'Navigation timeline export');
            await writeFile(
              path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'navigation-timeline.json'),
              JSON.stringify({ routes: routes.map(route => route.queryNames), events: timeline })
            );
          }
        } catch (error) {
          required(records.at(-1)).failures.push(`Navigation timeline export: ${String(error)}`);
        }
        try {
          if (profiling) {
            const { profile } = await withDeadline(profiler.send('Profiler.stop'), 'Browser send');
            await writeFile(
              path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'navigation.cpuprofile'),
              JSON.stringify(profile)
            );
          }
        } catch (error) {
          required(records.at(-1)).failures.push(`Navigation CPU export: ${String(error)}`);
        } finally {
          try {
            const reads = await withDeadline(
              page.evaluate(() => (globalThis as any).__finishBenchmarkStyleReads?.() ?? null),
              'Browser evaluate'
            );
            if (reads !== null)
              await writeFile(
                path.join(
                  required(process.env.ZERO_PERFORMANCE_OUTPUT),
                  'navigation-style-reads.json'
                ),
                JSON.stringify(reads)
              );
          } catch (error) {
            required(records.at(-1)).failures.push(`Navigation style export: ${String(error)}`);
          } finally {
            await withDeadline(profiler.detach(), 'Navigation CPU detach').catch(error => {
              required(records.at(-1)).failures.push(`Navigation CPU cleanup: ${String(error)}`);
            });
          }
        }
      }
    }
    if (warnings.length)
      records.push({
        route: '*',
        visit: 'warnings',
        visibleMs: 0,
        queries: [],
        failures: warnings,
      });
    await measureMutationBrowserActions(page, seed, conversation, onMutationUpdate);
    // A real subscribed result must lose private data after membership revocation.
    const subscribedGroup = required(routes[1]);
    await navigate(page, subscribedGroup.path, subscribedGroup.search ?? {}, subscribedGroup);
    await page.waitForFunction(
      () => {
        const state = (globalThis as any).__benchmarkPaint;
        return state?.displayed != null && state?.authoritative != null;
      },
      undefined,
      { timeout: 15_000 }
    );
    await inspect(page, clientSamples);
    const updatedName = `${seed.groupName} updated`;
    const updateAt = Date.now();
    await db()`update public."group" set name=${updatedName} where id=${seed.groupId}`;
    const update: JourneyResult = {
      route: `/group/${seed.groupId}`,
      visit: 'data-update',
      visibleMs: NaN,
      queries: [],
      failures: [],
    };
    records.push(update);
    try {
      await page
        .getByText(updatedName, { exact: false })
        .filter({ visible: true })
        .first()
        .waitFor({ state: 'visible', timeout: BUDGETS.totalMs });
      update.visibleMs = Date.now() - updateAt;
      if (update.visibleMs > BUDGETS.totalMs)
        update.failures.push('Subscribed data update exceeds budget');
    } catch (error) {
      update.failures.push(String(error));
      try {
        const local = await withDeadline(
          page.evaluate(async id => {
            const rows = await (globalThis as any).__zero.inspector.client.rows('group');
            const row = rows.find((candidate: any) => candidate.id === id);
            return { localName: row?.name ?? null, localPresent: Boolean(row) };
          }, seed.groupId),
          'Subscribed update diagnostics'
        );
        update.diagnostic = {
          url: page.url(),
          body: (await page.locator('body').innerText()).slice(0, 8_000),
          errors: [...pageErrors],
          activeViews: await withDeadline(
            page.evaluate(() => (globalThis as any).__zeroPerformanceActiveViews()),
            'Browser evaluate'
          ),
          sync: { expectedName: updatedName, ...local },
        };
      } catch (diagnosticError) {
        update.failures.push(`Data-update diagnostics: ${String(diagnosticError)}`);
      }
    }
    try {
      update.queries = await inspect(page, clientSamples);
    } catch (error) {
      update.failures.push(`Data-update inspection: ${String(error)}`);
    }
    const hadGroup = await withDeadline(
      page.evaluate(
        async id =>
          (await (globalThis as any).__zero.inspector.client.rows('group')).some(
            (row: any) => row.id === id
          ),
        seed.groupId
      ),
      'Browser evaluate'
    );
    if (!hadGroup) throw new Error('Revocation has no positive subscribed result');
    // Prepare the debugger while the page is responsive; sampling begins only
    // after the timed revocation. Attaching to an already blocked renderer can
    // itself fail before a useful CPU profile can be collected.
    const inspectorProfiler =
      process.env.ZERO_PERFORMANCE_CPU_PROFILE === '1' ||
      process.env.ZERO_PERFORMANCE_INSPECTOR_PROFILE === '1'
        ? await withDeadline(context.newCDPSession(page), 'Inspector CPU session')
        : undefined;
    const debugScripts = new Map<string, string>();
    if (inspectorProfiler) {
      inspectorProfiler.on('Debugger.scriptParsed', event => {
        if (!event.url) return;
        try {
          debugScripts.set(event.scriptId, new URL(event.url).pathname);
        } catch {
          // Anonymous serialized browser callbacks have no source URL.
        }
      });
      await withDeadline(inspectorProfiler.send('Profiler.enable'), 'Inspector CPU enable');
      await withDeadline(inspectorProfiler.send('Debugger.enable'), 'Inspector debugger enable');
      await withDeadline(
        inspectorProfiler.send('Profiler.setSamplingInterval', { interval: 1000 }),
        'Inspector CPU interval'
      );
      // Diagnostic runs need a profile even when revocation itself blocks the
      // renderer before readiness. These samples never replace acceptance data.
      await withDeadline(inspectorProfiler.send('Profiler.start'), 'Inspector CPU start');
    }
    const revokedBrowserAt = await withDeadline(
      page.evaluate(() => performance.now()),
      'Revocation observation boundary'
    );
    const revokedAt = Date.now();
    await db().begin(async sql => {
      await sql`update public."group" set visibility='private', owner_id=${OUTSIDER.userID} where id=${seed.groupId}`;
      await sql`update public.group_membership set status='inactive' where group_id=${seed.groupId} and user_id=${OWNER_ID}`;
      await sql`update public.group_guest_access set status='revoked' where group_id=${seed.groupId} and user_id=${OWNER_ID}`;
      const [remaining] = await sql`
        select g.owner_id=${OWNER_ID} as owns_group, g.visibility <> 'private' as visible,
          exists(select 1 from public.group_membership m where m.group_id=g.id and m.user_id=${OWNER_ID} and m.status in ('active','admin','member','invited')) as membership,
          exists(select 1 from public.group_guest_access a where a.group_id=g.id and a.user_id=${OWNER_ID} and a.status in ('active','invited')) as guest
        from public."group" g where g.id=${seed.groupId}`;
      if (!remaining || Object.values(remaining).some(Boolean))
        throw new Error('Revocation fixture still grants group discovery');
    });
    let rootAccess = { observed: false, complete: false, present: true };
    while (Date.now() - revokedAt < BUDGETS.totalMs) {
      rootAccess = await withDeadline(
        page.evaluate(
          ({ id, since }) => (globalThis as any).__zeroPerformanceGroupAccess(id, since),
          { id: seed.groupId, since: revokedBrowserAt }
        ),
        'Revocation authoritative view'
      ).catch(async error => {
        if (inspectorProfiler) await captureBlockedRenderer(inspectorProfiler, debugScripts);
        throw error;
      });
      if (rootAccess.observed && rootAccess.complete && !rootAccess.present) break;
      await page.waitForTimeout(25);
    }
    // A real authoritative root result drives readiness. Inspect the complete
    // replica afterwards, rather than forcing refresh/persist on every sync tick.
    // The replica check remains required and inside the unchanged deadline.
    let leaked = await withDeadline(
      page.evaluate(
        async id =>
          (await (globalThis as any).__zero.inspector.client.rows('group')).some(
            (row: any) => row.id === id
          ),
        seed.groupId
      ),
      'Revocation local replica'
    );
    while (leaked && Date.now() - revokedAt < BUDGETS.totalMs) {
      await page.waitForTimeout(25);
      leaked = await withDeadline(
        page.evaluate(
          async id =>
            (await (globalThis as any).__zero.inspector.client.rows('group')).some(
              (row: any) => row.id === id
            ),
          seed.groupId
        ),
        'Revocation local replica'
      );
    }
    const revocation: JourneyResult = {
      route: `/group/${seed.groupId}`,
      visit: 'revoke-membership',
      visibleMs: Date.now() - revokedAt,
      queries: [],
      failures: [
        ...(!rootAccess.observed || !rootAccess.complete || rootAccess.present
          ? ['Missing authoritative group revocation result']
          : []),
        ...(leaked ? ['Private group remains synced after membership revocation'] : []),
        ...((await withDeadline(
          page.getByText(updatedName, { exact: true }).filter({ visible: true }).count(),
          'Revocation visible content'
        ))
          ? ['Private group remains visible after membership revocation']
          : []),
      ],
    };
    records.push(revocation);
    // Observe public Playwright socket events only after all timed samples.
    // This distinguishes a missing server response from renderer processing;
    // store metadata, never wire payloads or authentication frames.
    const wireFrames: unknown[] = [];
    let wireWrites = Promise.resolve();
    const recordFrame = (event: { payload: string | Buffer }) => {
      let summary: ReturnType<typeof inspectorFrameSummary>;
      try {
        summary = inspectorFrameSummary(event.payload.toString());
      } catch {
        revocation.failures.push('Invalid inspector diagnostic frame');
        return;
      }
      if (!summary) return;
      wireFrames.push(summary);
      wireWrites = wireWrites.then(() =>
        writeFile(
          path.join(
            required(process.env.ZERO_PERFORMANCE_OUTPUT),
            'revocation-inspector-wire.json'
          ),
          JSON.stringify({ scope: 'post-acceptance-diagnostic', frames: wireFrames })
        )
      );
    };
    for (const socket of sockets) {
      socket.on('framesent', recordFrame);
      socket.on('framereceived', recordFrame);
    }
    const revocationInspectionAt = performance.now();
    try {
      revocation.queries = await inspect(page, clientSamples);
      revocation.inspectionMs = performance.now() - revocationInspectionAt;
    } catch (error) {
      revocation.failures.push(`Revocation inspection: ${String(error)}`);
      if (inspectorProfiler) {
        try {
          await captureBlockedRenderer(inspectorProfiler, debugScripts);
        } catch {
          revocation.failures.push('Blocked renderer stack diagnosis failed');
        }
      }
    } finally {
      for (const socket of sockets) {
        socket.off('framesent', recordFrame);
        socket.off('framereceived', recordFrame);
      }
      await wireWrites;
      await writeFile(
        path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'revocation-inspector-wire.json'),
        JSON.stringify({
          scope: 'post-acceptance-diagnostic',
          frames: wireFrames,
          renderLoopErrors,
        })
      );
      if (inspectorProfiler) {
        try {
          const { profile } = await withDeadline(
            inspectorProfiler.send('Profiler.stop'),
            'Inspector CPU export'
          );
          await writeFile(
            path.join(
              required(process.env.ZERO_PERFORMANCE_OUTPUT),
              'revocation-inspector.cpuprofile'
            ),
            JSON.stringify(profile)
          );
        } catch (error) {
          revocation.failures.push(`Inspector CPU export: ${String(error)}`);
        } finally {
          await withDeadline(inspectorProfiler.detach(), 'Browser detach');
        }
      }
    }
    // Retained-query export runs after navigation and synchronization acceptance.
    if (process.env.ZERO_PERFORMANCE_CPU_PROFILE === '1') {
      try {
        // The mandatory revocation inspection just collected the full client
        // snapshot, including background and TTL queries. Export that same
        // snapshot rather than issuing an identical second Inspector RPC.
        const inspectionMs = required(revocation.inspectionMs);
        if (!revocation.queries.length) throw new Error('Missing retained query snapshot');
        await writeFile(
          path.join(
            required(process.env.ZERO_PERFORMANCE_OUTPUT),
            'navigation-retained-queries.json'
          ),
          JSON.stringify({
            scope: 'client',
            source: 'revocation-inspection',
            inspectionMs,
            queries: revocation.queries,
          })
        );
      } catch (error) {
        records
          .at(-1)
          ?.failures.push(
            `Retained query diagnostics: ${error instanceof Error ? error.message : String(error)}`
          );
      }
      try {
        await profileColdBoot(browser, await context.storageState(), {
          path: '/search',
          text: seed.eventTitle,
          contentSelector: 'main',
          search: { q: seed.eventTitle, types: 'event' },
          queryArgs: { query: seed.eventTitle, types: ['event'] },
          queryNames: ['search.searchDocumentPage'],
        });
      } catch (error) {
        revocation.failures.push(`Cold boot diagnostics: ${String(error)}`);
      }
    }
    // Retained-query export runs after navigation and synchronization acceptance.
    if (process.env.ZERO_PERFORMANCE_CPU_PROFILE === '1') {
      try {
        const retainedAt = performance.now();
        const retainedQueries = await withDeadline(
          page.evaluate(async () => {
            const zero = (globalThis as any).__zero;
            return (await zero.inspector.clientGroup.queries()).map((query: any) => ({
              name: query.name,
              id: query.id,
              clientID: query.clientID,
              args: query.args,
              deleted: query.deleted,
              client: query.hydrateClient,
              server: query.hydrateServer,
              total: query.hydrateTotal,
              ttl: query.ttl,
              inactive: query.inactivatedAt,
            }));
          }),
          'Retained query diagnostics'
        );
        await writeFile(
          path.join(
            required(process.env.ZERO_PERFORMANCE_OUTPUT),
            'navigation-retained-queries.json'
          ),
          JSON.stringify({
            inspectionMs: performance.now() - retainedAt,
            queries: retainedQueries,
          })
        );
      } catch (error) {
        records
          .at(-1)
          ?.failures.push(
            `Retained query diagnostics: ${error instanceof Error ? error.message : String(error)}`
          );
      }
    }
    return records;
  } finally {
    await writeFile(
      path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'browser-error-counts.json'),
      JSON.stringify(errorCounts)
    );
    await onUpdate(records);
    await withDeadline(browser.close(), 'Browser close');
  }
}

/** Interrupt a failed diagnostic renderer briefly to retain its stack, without locals or arguments. */
async function captureBlockedRenderer(session: CDPSession, scripts: Map<string, string>) {
  const paused = new Promise<{
    callFrames: {
      functionName: string;
      url: string;
      location: { scriptId: string; lineNumber: number; columnNumber?: number };
    }[];
  }>(resolve => session.once('Debugger.paused', resolve));
  try {
    await withDeadline(session.send('Debugger.pause'), 'Renderer diagnostic pause', 5_000);
    const event = await withDeadline(paused, 'Renderer diagnostic stack', 5_000);
    await writeFile(
      path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'blocked-renderer-stack.json'),
      JSON.stringify({
        scope: 'after-failed-acceptance',
        frames: event.callFrames.map(frame => ({
          name: frame.functionName,
          path: scripts.get(frame.location.scriptId),
          line: frame.location.lineNumber + 1,
          column:
            frame.location.columnNumber === undefined ? undefined : frame.location.columnNumber + 1,
        })),
      })
    );
    const observations = await withDeadline(
      session.send('Runtime.evaluate', {
        expression: `JSON.stringify((() => {
          const events = globalThis.__zeroPerformanceViewEvents ?? [];
          const counts = {};
          for (const event of events.slice(-10000)) {
            const key = event.name + ':' + event.phase;
            counts[key] = (counts[key] ?? 0) + 1;
          }
          return {total: events.length, recent: counts};
        })())`,
        returnByValue: true,
      }),
      'Renderer observation counters',
      5_000
    );
    if (typeof observations.result.value !== 'string')
      throw new Error('Missing renderer observation counters');
    await writeFile(
      path.join(
        required(process.env.ZERO_PERFORMANCE_OUTPUT),
        'blocked-renderer-observations.json'
      ),
      observations.result.value
    );
    const { profile } = await withDeadline(
      session.send('Profiler.stop'),
      'Paused renderer CPU export'
    );
    await writeFile(
      path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'blocked-renderer.cpuprofile'),
      JSON.stringify(profile)
    );
  } finally {
    await withDeadline(session.send('Debugger.resume'), 'Renderer diagnostic resume', 5_000);
  }
}

/** A separate fresh browser context, after all acceptance samples have finished. */
async function profileColdBoot(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  target: NavigationTarget
) {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  const profiler = await withDeadline(context.newCDPSession(page), 'Browser newCDPSession');
  let profiling = false;
  const timeline: unknown[] = [];
  profiler.on('Tracing.dataCollected', ({ value }) => {
    for (const { name, cat, ph, ts, dur, pid, tid } of value)
      timeline.push({ name, cat, ph, ts, dur, pid, tid });
  });
  let tracing = false;
  try {
    await page.addInitScript(
      `globalThis.__name = (value) => value; (${installNavigationProbe.toString()})(); globalThis.__beginBenchmarkNavigation(${JSON.stringify(target)}, 0);`
    );
    await page.addInitScript(
      ({ key }) => {
        localStorage.setItem('i18nextLng', 'en');
        sessionStorage.setItem(key, 'true');
      },
      { key: ALPHA_WARNING_SESSION_KEY }
    );
    await withDeadline(profiler.send('Profiler.enable'), 'Browser send');
    await withDeadline(
      profiler.send('Profiler.setSamplingInterval', { interval: 1000 }),
      'Browser send'
    );
    await withDeadline(profiler.send('Profiler.start'), 'Browser send');
    profiling = true;
    await withDeadline(
      profiler.send('Tracing.start', {
        categories: 'devtools.timeline,blink.user_timing',
        options: 'record-as-much-as-possible',
      }),
      'Browser send'
    );
    tracing = true;
    await page.goto(
      `${required(process.env.VITE_APP_URL)}${target.path}?${new URLSearchParams(target.search).toString()}`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForFunction(
      () => {
        const state = (globalThis as any).__benchmarkPaint;
        return state?.displayed != null && state?.authoritative != null;
      },
      undefined,
      { timeout: 15_000 }
    );
    await writeFile(
      path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'navigation-cold-readiness.json'),
      JSON.stringify(
        await withDeadline(
          page.evaluate(() => ({
            diagnostic: true,
            visibleMs: (globalThis as any).__benchmarkPaint.displayed,
            authoritativeMs: (globalThis as any).__benchmarkPaint.authoritative,
            connections: (globalThis as any).__zeroPerformanceConnectionEvents,
          })),
          'Browser evaluate'
        )
      )
    );
  } finally {
    try {
      if (profiling) {
        const { profile } = await withDeadline(profiler.send('Profiler.stop'), 'Cold CPU export');
        await writeFile(
          path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'navigation-cold.cpuprofile'),
          JSON.stringify(profile)
        );
      }
      if (tracing) {
        const completed = new Promise<void>(resolve =>
          profiler.once('Tracing.tracingComplete', () => resolve())
        );
        await withDeadline(profiler.send('Tracing.end'), 'Browser send');
        await withDeadline(completed, 'Cold timeline export');
        await writeFile(
          path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'navigation-cold-timeline.json'),
          JSON.stringify({ events: timeline })
        );
      }
    } finally {
      await withDeadline(profiler.detach(), 'Browser detach');
      await withDeadline(context.close(), 'Browser close');
    }
  }
}

async function navigate(page: Page, path: string, search: unknown = {}, target?: NavigationTarget) {
  await withDeadline(
    page.evaluate(
      async ({ to, search, target }) => {
        const router = (globalThis as any).__TSR_ROUTER__;
        if (!router) throw new Error('Missing application router');
        if (target) (globalThis as any).__beginBenchmarkNavigation(target);
        await router.navigate({ to, search });
      },
      { to: path, search, target }
    ),
    'Browser navigation'
  );
}

async function inspect(page: Page, clientSamples: ViewClientSamples): Promise<QueryObservation[]> {
  const startedAt = performance.now();
  let snapshot = await inspectOnce(page, clientSamples);
  // This runs after the timed navigation. Retain genuine local readings before
  // releasing short-lived departure views; a missed/released view remains an error.
  while (hasUnmeasuredActiveViews(snapshot) && performance.now() - startedAt < 1_000) {
    snapshot = await inspectOnce(page, clientSamples);
  }
  return snapshot;
}

async function inspectOnce(
  page: Page,
  clientSamples: ViewClientSamples
): Promise<QueryObservation[]> {
  await withDeadline(
    page.evaluate(
      async password => {
        const zero = (globalThis as any).__zero;
        (globalThis as any).__benchmarkInspectorStage = 'identity';
        if (!zero) throw new Error('Missing Zero instance during navigation');
        if (zero.userID !== password.userID)
          throw new Error('Browser is not authenticated as the benchmark actor');
        // Authentication belongs to the server worker's client group, rather
        // than the lifetime of this browser's Zero object. Reauthenticate each
        // diagnostic snapshot, outside the timed navigation.
        (globalThis as any).__benchmarkInspectorStage = 'authenticate';
        if (!(await zero.inspector.authenticate(password.adminPassword)))
          throw new Error('Browser inspector authentication rejected');
      },
      { adminPassword: required(process.env.ZERO_ADMIN_PASSWORD), userID: OWNER_ID }
    ),
    'Browser inspector authentication'
  );
  const serializedSnapshot = await withDeadline(
    page.evaluate(
      async ({ userID }) => {
        const zero = (globalThis as any).__zero;
        if (!zero || zero.userID !== userID)
          throw new Error('Browser identity changed before query inspection');
        (globalThis as any).__benchmarkInspectorStage = 'preload-readiness';
        // Wait only for currently observed activations, up to their unchanged one-second deadline.
        // Reading these app events does not issue inspector/analyzer requests.
        const cutoff = performance.now();
        const starts = stateEvents().filter(
          (event: PreloadLifecycleEvent) => event.phase === 'preload-start' && event.at <= cutoff
        );
        while (
          starts.some(
            (start: PreloadLifecycleEvent) =>
              !stateEvents().some(
                (event: PreloadLifecycleEvent) =>
                  event.activationID === start.activationID &&
                  event.at >= start.at &&
                  ['preload-complete', 'preload-error'].includes(event.phase)
              ) && performance.now() - start.at < 1_000
          )
        ) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        (globalThis as any).__benchmarkInspectorStage = 'queries';
        console.info(
          `zero-performance-inspector:${JSON.stringify({ phase: 'queries', views: ((globalThis as any).__zeroPerformanceViewEvents ?? []).length, preloads: stateEvents().length })}`
        );
        const queries = await zero.inspector.client.queries();
        (globalThis as any).__benchmarkInspectorStage = 'captured';
        console.info(
          `zero-performance-inspector:${JSON.stringify({ phase: 'captured', queries: queries.length })}`
        );
        const captured = new Set(starts.map((event: PreloadLifecycleEvent) => event.activationID));
        return JSON.stringify({
          measuredAt: performance.now(),
          // Hook subscriptions can join an already materialized query while the
          // Inspector request is in flight. Capture their live state at this
          // snapshot rather than dropping them at the earlier preload cutoff.
          views: (globalThis as any).__zeroPerformanceViewEvents ?? [],
          events: stateEvents().filter((event: PreloadLifecycleEvent) =>
            captured.has(event.activationID)
          ),
          queries: queries.map((query: any) => ({
            name: query.name,
            id: query.id,
            args: query.args,
            clientID: query.clientID,
            got: query.got,
            client: query.hydrateClient,
            server: query.hydrateServer,
            total: query.hydrateTotal,
            rows: query.rowCount,
            ttl: query.ttl,
            inactive: query.inactivatedAt,
          })),
        });
        function stateEvents() {
          return (globalThis as any).__zeroPerformancePreloadEvents ?? [];
        }
      },
      { userID: OWNER_ID }
    ),
    'Browser query inspection'
  ).catch(async error => {
    const state = await withDeadline(
      page.evaluate(() => ({
        stage: (globalThis as any).__benchmarkInspectorStage,
        connection: (globalThis as any).__zero?.connection?.state?.current?.name,
        connections: ((globalThis as any).__zeroPerformanceConnectionEvents ?? []).slice(-5),
      })),
      'Inspector failure state',
      1_000
    ).catch(() => ({ stage: 'unavailable' }));
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; ${JSON.stringify(state)}`
    );
  });
  const snapshot = JSON.parse(serializedSnapshot);
  const events = snapshot.events as PreloadLifecycleEvent[];
  const observations: QueryObservation[] = snapshot.queries.map((query: any) => {
    const key = preloadKey(`queries.${query.name}`, query.args?.[0] ?? {});
    const preloads = preloadRuns(
      events.filter(event => event.key === key && event.clientID === query.clientID)
    );
    const views = viewRuns(
      (snapshot.views as QueryViewObservation[]).filter(
        event =>
          event.clientID === query.clientID &&
          event.name === query.name &&
          preloadKey(`queries.${event.name}`, event.args ?? {}) === key
      )
    );
    return {
      ...query,
      views,
      kind:
        !views.length && query.client === null && query.total === null ? 'preload' : 'materialized',
      preloads,
    };
  });
  // Keep activations that disappeared from the inspector after release/eviction.
  for (const key of new Set(events.map(event => `${event.clientID}/${event.key}`))) {
    const matching = events.filter(event => `${event.clientID}/${event.key}` === key);
    const first = matching[0];
    if (!first) continue;
    const separator = first.key.indexOf(':');
    const name = first.key.slice(0, separator).replace(/^queries\./, '');
    const args = JSON.parse(first.key.slice(separator + 1));
    if (
      observations.some(
        query =>
          query.clientID === first.clientID &&
          query.name === name &&
          preloadKey(`queries.${query.name}`, (query.args as any[])?.[0] ?? {}) === first.key
      )
    )
      continue;
    const preloads = preloadRuns(matching);
    observations.push({
      id: first.key,
      clientID: first.clientID,
      name,
      args: [args],
      kind: 'preload',
      got: preloads.every(run => run.authoritativeAt !== null && !run.error),
      client: null,
      server: null,
      total: null,
      ttl: first.ttl,
      inactive: null,
      preloads,
    });
  }
  // A dropped view still needs its local metrics; eviction must not hide an activation.
  for (const event of snapshot.views as QueryViewObservation[]) {
    if (event.phase !== 'commit') continue;
    const key = preloadKey(`queries.${event.name}`, event.args ?? {});
    if (
      observations.some(
        query =>
          query.clientID === event.clientID &&
          query.name === event.name &&
          preloadKey(`queries.${query.name}`, (query.args as any[])?.[0] ?? {}) === key
      )
    )
      continue;
    const views = viewRuns(
      (snapshot.views as QueryViewObservation[]).filter(
        other =>
          other.clientID === event.clientID &&
          other.name === event.name &&
          preloadKey(`queries.${other.name}`, other.args ?? {}) === key
      )
    );
    observations.push({
      id: event.activationID,
      clientID: event.clientID ?? '',
      name: event.name,
      args: [event.args],
      kind: 'materialized',
      got: views.every(view => view.authoritativeAt !== null),
      client: null,
      server: null,
      total: null,
      ttl: null,
      inactive: null,
      preloads: [],
      views,
    });
  }
  return observations.map(query =>
    retainViewClientSamples(query, snapshot.measuredAt, clientSamples)
  );
}
