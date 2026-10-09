import { required, withDeadline } from './required';
import { chromium, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { seedCreatePrerequisites } from '../../../e2e/fixtures/seed';
import { seedMessageFlow } from '../../../e2e/fixtures/domains/communications';
import { db } from '../../../e2e/fixtures/db';
import { OWNER, OUTSIDER, OWNER_ID } from './catalog';
import { BUDGETS } from './metrics';
import { installNavigationProbe, type NavigationTarget } from './browser-navigation';
import {
  preloadRuns,
  viewRuns,
  queryObservationFailures,
  retainViewClientSamples,
  type ViewClientSamples,
  type QueryObservation,
} from './journey-metrics';
import type { PreloadLifecycleEvent } from '../../../src/zero/preloads/query-lifecycle';
import type { QueryViewObservation } from '../../../src/zero/observed-query';
import { preloadKey } from '../../../src/zero/preloads/preload-registry';
import { ALPHA_WARNING_SESSION_KEY } from '../../../src/features/shared/constants';

export interface JourneyResult {
  route: string;
  visit: string;
  visibleMs: number;
  authoritativeMs?: number;
  cachedDisplayMs?: number;
  queries: QueryObservation[];
  inspectionMs?: number;
  preloadEvents?: PreloadLifecycleEvent[];
  viewEvents?: QueryViewObservation[];
  failures: string[];
  diagnostic?: {
    url: string;
    body: string;
    errors: string[];
    activeViews?: QueryViewObservation[];
    layout?: unknown;
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
  const browser = await chromium.launch({ headless: true });
  const records: JourneyResult[] = [];
  const clientSamples: ViewClientSamples = new Map();
  const warnings: string[] = [];
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
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'warning' && /Slow query/i.test(message.text()))
        warnings.push(message.text());
    });
    const routes: NavigationTarget[] = [
      {
        path: '/search',
        text: seed.groupName,
        // Name one fixture explicitly, rather than relying on tied creation-time ordering.
        search: { q: seed.groupName, types: 'group' },
        queryNames: ['search.searchDocumentPage'],
      },
      {
        path: `/group/${seed.groupId}`,
        text: seed.groupName,
        queryNames: ['groups.wikiOverview'],
        id: seed.groupId,
      },
      {
        path: `/event/${seed.eventId}`,
        text: seed.eventTitle,
        queryNames: ['events.wikiData'],
        id: seed.eventId,
      },
      {
        path: `/event/${seed.eventId}/agenda/`,
        text: seed.agendaItemTitle,
        queryNames: ['events.agendaItemsFull'],
        id: seed.agendaItemId,
      },
      {
        path: `/amendment/${seed.amendmentId}`,
        text: seed.amendmentTitle,
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
        };
        records.push(record);
        try {
          if (page.url() === 'about:blank') {
            await page.addInitScript(
              `globalThis.__name = (value) => value; (${installNavigationProbe.toString()})(); globalThis.__beginBenchmarkNavigation(${JSON.stringify(route)}, 0);`
            );
            await page.goto(
              `${process.env.VITE_APP_URL}${route.path}${route.search ? '?' + new URLSearchParams(route.search).toString() : ''}`,
              { waitUntil: 'domcontentloaded' }
            );
          } else if (visit === 'back' && new URL(page.url()).pathname !== route.path) {
            await page.evaluate(target => {
              (globalThis as any).__beginBenchmarkNavigation(target);
              history.back();
            }, route);
          } else {
            await navigate(page, route.path, route.search ?? {}, route);
          }
          await page.waitForFunction(
            () => (globalThis as any).__benchmarkPaint?.displayed != null,
            undefined,
            { timeout: 15_000 }
          );
          record.visibleMs = await page.evaluate(
            () => (globalThis as any).__benchmarkPaint.displayed
          );
          await page.waitForFunction(
            () => (globalThis as any).__benchmarkPaint?.authoritative != null,
            undefined,
            { timeout: 15_000 }
          );
          record.authoritativeMs = await page.evaluate(
            () => (globalThis as any).__benchmarkPaint.authoritative
          );
          record.processing = await page.evaluate(() => {
            const state = (globalThis as any).__benchmarkPaint;
            const end = state.start + Math.max(state.displayed, state.authoritative);
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
                    entry.startTime >= state.start &&
                    entry.startTime <= end
                )
                .map(entry => ({
                  path: new URL(entry.name).pathname,
                  start: entry.startTime,
                  duration: entry.duration,
                  initiator: entry.initiatorType,
                })),
              longTasks: ((globalThis as any).__benchmarkLongTasks ?? []).filter(
                (task: any) => task.start >= state.start && task.start <= end
              ),
              assets: (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
                .filter(entry => {
                  const address = new URL(entry.name);
                  return (
                    address.origin === location.origin &&
                    address.pathname.startsWith('/assets/') &&
                    entry.startTime >= state.start &&
                    entry.startTime <= end
                  );
                })
                .map(entry => ({
                  path: new URL(entry.name).pathname,
                  start: entry.startTime,
                  duration: entry.duration,
                })),
            };
          });
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
          const events = await page.evaluate(() => ({
            preloads: (globalThis as any).__zeroPerformancePreloadEvents,
            views: (globalThis as any).__zeroPerformanceViewEvents,
          }));
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
              activeViews: await page.evaluate(() =>
                (globalThis as any).__zeroPerformanceActiveViews()
              ),
              layout: await page.evaluate(target => {
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
      const profiler = await context.newCDPSession(page);
      await profiler.send('Profiler.enable');
      await profiler.send('Profiler.setSamplingInterval', { interval: 1000 });
      await profiler.send('Profiler.start');
      try {
        for (const route of routes) {
          await navigate(page, route.path, route.search ?? {}, route);
          await page.waitForFunction(
            () => {
              const state = (globalThis as any).__benchmarkPaint;
              return state?.displayed !== null && state?.authoritative !== null;
            },
            undefined,
            { timeout: 15_000 }
          );
        }
      } catch (error) {
        // Diagnostic replay must not prevent the subscribed update/revocation
        // checks from running. Preserve the failure on the real navigation record.
        required(records.at(-1)).failures.push(`Navigation CPU diagnostics: ${String(error)}`);
      } finally {
        const { profile } = await profiler.send('Profiler.stop');
        await writeFile(
          path.join(required(process.env.ZERO_PERFORMANCE_OUTPUT), 'navigation.cpuprofile'),
          JSON.stringify(profile)
        );
        await profiler.detach();
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
    }
    try {
      update.queries = await inspect(page, clientSamples);
    } catch (error) {
      update.failures.push(`Data-update inspection: ${String(error)}`);
    }
    const hadGroup = await page.evaluate(
      async id =>
        (await (globalThis as any).__zero.inspector.client.rows('group')).some(
          (row: any) => row.id === id
        ),
      seed.groupId
    );
    if (!hadGroup) throw new Error('Revocation has no positive subscribed result');
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
    let leaked = true;
    while (Date.now() - revokedAt < BUDGETS.totalMs) {
      leaked = await page.evaluate(async id => {
        const zero = (globalThis as any).__zero;
        if (!zero) throw new Error('Missing Zero instance');
        const rows = await zero.inspector.client.rows('group');
        return rows.some((row: any) => row.id === id);
      }, seed.groupId);
      if (!leaked) break;
      await page.waitForTimeout(25);
    }
    const revocation: JourneyResult = {
      route: `/group/${seed.groupId}`,
      visit: 'revoke-membership',
      visibleMs: Date.now() - revokedAt,
      queries: [],
      failures: [
        ...(leaked ? ['Private group remains synced after membership revocation'] : []),
        ...((await page.getByText(updatedName, { exact: true }).filter({ visible: true }).count())
          ? ['Private group remains visible after membership revocation']
          : []),
      ],
    };
    records.push(revocation);
    try {
      revocation.queries = await inspect(page, clientSamples);
    } catch (error) {
      revocation.failures.push(`Revocation inspection: ${String(error)}`);
    }
    return records;
  } finally {
    await onUpdate(records);
    await browser.close();
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
  const snapshot = await withDeadline(
    page.evaluate(
      async password => {
        const zero = (globalThis as any).__zero;
        if (!zero) throw new Error('Missing Zero instance during navigation');
        if (zero.userID !== password.userID)
          throw new Error('Browser is not authenticated as the benchmark actor');
        if ((globalThis as any).__benchmarkInspectorZero !== zero) {
          if (!(await zero.inspector.authenticate(password.adminPassword)))
            throw new Error('Browser inspector authentication rejected');
          (globalThis as any).__benchmarkInspectorZero = zero;
        }
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
        const queries = await zero.inspector.client.queries();
        const captured = new Set(starts.map((event: PreloadLifecycleEvent) => event.activationID));
        return {
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
        };
        function stateEvents() {
          return (globalThis as any).__zeroPerformancePreloadEvents ?? [];
        }
      },
      { adminPassword: required(process.env.ZERO_ADMIN_PASSWORD), userID: OWNER_ID }
    ),
    'Browser query inspection'
  );
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
