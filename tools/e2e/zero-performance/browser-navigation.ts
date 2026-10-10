export interface NavigationTarget {
  path: string;
  text: string;
  contentSelector?: string;
  search?: Record<string, string>;
  queryNames?: string[];
  id?: string;
  consumedSearch?: string[];
  queryArgs?: Record<string, unknown>;
}

/** Diagnostic metadata only; never retain socket arguments, AST values or credentials. */
export function inspectorFrameSummary(payload: string) {
  if (!/^\[\s*"inspect"\s*,/.test(payload)) return undefined;
  const message = JSON.parse(payload);
  const body = message[1];
  if (body?.op !== 'queries') return undefined;
  if (!Array.isArray(body.value))
    return { operation: 'queries' as const, direction: 'sent' as const };
  return {
    operation: 'queries' as const,
    direction: 'received' as const,
    bytes: Buffer.byteLength(payload),
    queries: body.value.map((row: any) => ({
      name: row.name,
      astBytes: row.ast === undefined ? undefined : Buffer.byteLength(JSON.stringify(row.ast)),
      rows: row.rowCount,
      got: row.got,
      deleted: row.deleted,
      serverMs: row.metrics?.['query-hydration-server-ms'],
      updateHistogram: row.metrics?.['query-update-server'],
    })),
  };
}

/** Installed before application code; all timings use the browser's monotonic clock. */
export function installNavigationProbe() {
  const scope = globalThis as any;
  const activeViews = new Map<string, any>();
  const groupAccessViews = new Map<string, any>();
  const observedConnections = new WeakSet<object>();
  scope.__zeroPerformanceConnectionEvents = [];
  const observeConnection = () => {
    const zero = scope.__zero;
    if (!zero?.connection?.state || observedConnections.has(zero)) return;
    observedConnections.add(zero);
    const record = (state: { name: string }) =>
      scope.__zeroPerformanceConnectionEvents.push({
        clientID: zero.clientID,
        state: state.name,
        at: performance.now(),
      });
    record(zero.connection.state.current);
    zero.connection.state.subscribe(record);
  };
  scope.__zeroPerformanceActiveViews = () => [...activeViews.values()];
  scope.__zeroPerformanceGroupAccess = (id: string, since: number) => {
    // Route guards can remove the wiki view before it commits an empty result.
    // Retain the actual guard's last committed result across its redirect. A
    // release alone is never evidence of denial, nor is a pre-mutation result.
    const views = [...groupAccessViews.values()].filter(
      view => view.args?.id === id && view.at >= since
    );
    return {
      observed: views.length > 0,
      complete: views.length > 0 && views.every(view => view.type === 'complete'),
      present: views.some(view => view.ids.includes(id)),
    };
  };
  const matchesView = (event: any, target: NavigationTarget) =>
    target.queryNames?.includes(event.name) &&
    event.type === 'complete' &&
    Object.entries(target.queryArgs ?? {}).every(
      ([key, value]) => JSON.stringify(event.args?.[key]) === JSON.stringify(value)
    ) &&
    (!target.id || event.ids.includes(target.id));
  const visible = (element: Element) => {
    if (!element.getClientRects().length) return false;
    const bounds = element.getBoundingClientRect();
    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      bounds.bottom <= 0 ||
      bounds.top >= innerHeight ||
      bounds.right <= 0 ||
      bounds.left >= innerWidth
    )
      return false;
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0'
      )
        return false;
    }
    return true;
  };
  scope.__zeroPerformanceViewEvents = [];
  scope.__benchmarkLongTaskObserver?.disconnect();
  scope.__benchmarkLongTasks = [];
  if (
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes.includes('longtask')
  ) {
    scope.__benchmarkLongTaskObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries())
        scope.__benchmarkLongTasks.push({ start: entry.startTime, duration: entry.duration });
    });
    scope.__benchmarkLongTaskObserver.observe({ type: 'longtask', buffered: true });
  }
  scope.__zeroPerformanceReady = (
    name: string,
    complete: boolean,
    at: number,
    details?: { args: unknown; ids: string[] }
  ) => {
    const state = scope.__benchmarkPaint;
    if (
      complete &&
      state &&
      state.authoritative === null &&
      location.pathname.replace(/\/$/, '') === state.target.path.replace(/\/$/, '') &&
      state.target.queryNames?.includes(name) &&
      Object.entries(state.target.queryArgs ?? {}).every(
        ([key, value]) => JSON.stringify((details?.args as any)?.[key]) === JSON.stringify(value)
      ) &&
      (!state.target.id || details?.ids.includes(state.target.id))
    )
      state.authoritative = at - state.start;
  };
  scope.__zeroPerformanceView = (event: any) => {
    observeConnection();
    event.clientID = scope.__zero?.clientID;
    scope.__zeroPerformanceViewEvents.push(event);
    if (
      event.phase === 'commit' &&
      (event.name === 'groups.byIdBasic' || event.name === 'groups.wikiOverview')
    )
      groupAccessViews.set(event.activationID, event);
    if (event.phase === 'commit') activeViews.set(event.activationID, event);
    if (event.phase === 'release') activeViews.delete(event.activationID);
    const state = scope.__benchmarkPaint;
    if (
      state &&
      event.phase === 'commit' &&
      state.authoritative === null &&
      location.pathname.replace(/\/$/, '') === state.target.path.replace(/\/$/, '') &&
      matchesView(event, state.target)
    ) {
      state.authoritative = event.at - state.start;
    }
  };
  scope.__beginBenchmarkNavigation = (target: NavigationTarget, start = performance.now()) => {
    const previous = scope.__benchmarkPaint;
    previous?.observer?.disconnect();
    const state = {
      start,
      displayed: null as number | null,
      authoritative: null as number | null,
      target,
      observer: undefined as MutationObserver | undefined,
      pendingFrame: false,
      candidates: [] as { node: Node; element: Element }[],
    };
    scope.__benchmarkPaint = state;
    const inspect = () => {
      if (scope.__benchmarkPaint !== state || state.displayed !== null) return;
      if (location.pathname.replace(/\/$/, '') !== target.path.replace(/\/$/, '')) return;
      const search = new URLSearchParams(location.search);
      if (
        Object.entries(target.search ?? {}).some(([key, value]) =>
          target.consumedSearch?.includes(key) ? search.has(key) : search.get(key) !== value
        )
      )
        return;
      if (!document.body) return;
      const content = target.contentSelector
        ? document.querySelector(target.contentSelector)
        : document.body;
      if (!content) return;
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      const candidates: { node: Node; element: Element }[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent?.trim() !== target.text) continue;
        const element = node.parentElement;
        if (
          !element ||
          element.closest('nav,aside') ||
          (target.contentSelector && !element.closest(target.contentSelector))
        )
          continue;
        candidates.push({ node, element });
      }
      state.candidates = candidates;
      if (!candidates.length) return;
      // Check layout only in the animation frame, after React's DOM work.
      // A layout box can still be transparent or outside the viewport. Recheck
      // the candidate each frame until it can actually be painted.
      const paint = () => {
        state.pendingFrame = false;
        if (
          scope.__benchmarkPaint === state &&
          state.displayed === null &&
          location.pathname.replace(/\/$/, '') === target.path.replace(/\/$/, '') &&
          state.candidates.some(
            ({ node, element }) =>
              node.textContent?.trim() === target.text && element.isConnected && visible(element)
          )
        ) {
          state.displayed = performance.now() - state.start;
          // A retained, still-mounted authoritative view need not render again
          // during back navigation. Check its live observation at the real paint
          // instant; released views and mismatching query arguments cannot qualify.
          if (
            state.authoritative === null &&
            [...activeViews.values()].some(event => matchesView(event, target))
          )
            state.authoritative = performance.now() - state.start;
          state.observer?.disconnect();
        } else if (scope.__benchmarkPaint === state && state.displayed === null) {
          if (
            state.candidates.some(
              ({ node, element }) => element.isConnected && node.textContent?.trim() === target.text
            ) &&
            location.pathname.replace(/\/$/, '') === target.path.replace(/\/$/, '')
          ) {
            state.pendingFrame = true;
            requestAnimationFrame(paint);
          } else inspect();
        }
      };
      if (!state.pendingFrame) {
        state.pendingFrame = true;
        requestAnimationFrame(paint);
      }
    };
    state.observer = new MutationObserver(inspect);
    state.observer.observe(document, { childList: true, subtree: true, characterData: true });
    inspect();
    requestAnimationFrame(inspect);
  };
}
