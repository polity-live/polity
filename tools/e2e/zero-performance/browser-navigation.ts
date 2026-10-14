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
    const record = (state: { name: string }) => {
      const at = performance.now();
      scope.__zeroPerformanceConnectionEvents.push({
        clientID: zero.clientID,
        state: state.name,
        at,
      });
      const navigation = scope.__benchmarkPaint;
      // Only initial document boot waits for connection readiness. In-app
      // navigation always starts at the user's action, including reconnects.
      if (state.name === 'connected' && navigation?.cold && navigation.start === null) {
        navigation.start = at;
        navigation.cold.connectedAt = at;
        navigation.cold.clientID = zero.clientID;
      }
    };
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
    const nativeVisibility = typeof element.checkVisibility === 'function';
    if (
      nativeVisibility &&
      !element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
        contentVisibilityAuto: true,
      })
    )
      return false;
    if (!nativeVisibility && !element.getClientRects().length) return false;
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
    // The native box-tree check includes ancestor opacity and skipped content.
    // Avoid per-ancestor computed-style serialization inside the measured frame.
    if (nativeVisibility) return true;
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
  scope.__benchmarkPaint?.frameObserver?.disconnect();
  if (scope.__benchmarkPaint) scope.__benchmarkPaint.frameObserver = undefined;
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
  const supportsLongAnimationFrames =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame');
  // Export after the measured navigation. Keep native entries until then so
  // script attribution serialization cannot compete with its paint callback.
  scope.__snapshotBenchmarkNavigationFrames = () => {
    const state = scope.__benchmarkPaint;
    if (state?.frameObserver) {
      state.longAnimationFrames.push(...state.frameObserver.takeRecords());
      state.frameObserver.disconnect();
      state.frameObserver = undefined;
    }
    const start = state?.cold?.documentStart ?? state?.start;
    const end =
      state?.start != null && state.displayed != null && state.authoritative != null
        ? state.start + Math.max(state.displayed, state.authoritative)
        : undefined;
    const numbers = (entry: any, fields: string[]) =>
      Object.fromEntries(
        fields
          .map(field => [field, entry[field]])
          .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      );
    const sourceURL = (value: unknown) => {
      if (typeof value !== 'string') return undefined;
      if (!value) return value;
      try {
        const url = new URL(value);
        if (url.protocol === 'data:' || url.protocol === 'javascript:') return undefined;
        url.username = '';
        url.password = '';
        url.search = '';
        url.hash = '';
        return url.href;
      } catch {
        // Opaque attribution has no inferred application source.
        return undefined;
      }
    };
    return {
      supported: state?.frameDiagnosticsSupported ?? Boolean(supportsLongAnimationFrames),
      selection: 'frames-overlapping-measured-window',
      browserTimeOrigin: performance.timeOrigin,
      start,
      end,
      // Whole native frames may begin before the action and still contain its
      // script. Preserve all timings and attribution across the window overlap.
      frames:
        typeof start === 'number' && typeof end === 'number'
          ? (state?.longAnimationFrames ?? [])
              .filter(
                (entry: PerformanceEntry) =>
                  entry.startTime <= end && entry.startTime + entry.duration >= start
              )
              .map((entry: any) => ({
                ...numbers(entry, [
                  'startTime',
                  'duration',
                  'blockingDuration',
                  'renderStart',
                  'styleAndLayoutStart',
                  'firstUIEventTimestamp',
                ]),
                scripts: Array.from(entry.scripts ?? [], (script: any) => ({
                  ...numbers(script, [
                    'startTime',
                    'duration',
                    'executionStart',
                    'pauseDuration',
                    'forcedStyleAndLayoutDuration',
                    'sourceCharPosition',
                  ]),
                  sourceURL: sourceURL(script.sourceURL),
                  sourceFunctionName:
                    typeof script.sourceFunctionName === 'string'
                      ? script.sourceFunctionName
                      : undefined,
                  invokerType:
                    typeof script.invokerType === 'string' ? script.invokerType : undefined,
                  windowAttribution:
                    typeof script.windowAttribution === 'string'
                      ? script.windowAttribution
                      : undefined,
                })),
              }))
          : [],
    };
  };
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
      state.start !== null &&
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
      state.start !== null &&
      location.pathname.replace(/\/$/, '') === state.target.path.replace(/\/$/, '') &&
      matchesView(event, state.target)
    ) {
      state.authoritative = event.at - state.start;
    }
  };
  scope.__beginBenchmarkNavigation = (
    target: NavigationTarget,
    start = performance.now(),
    cold = false
  ) => {
    const previous = scope.__benchmarkPaint;
    previous?.observer?.disconnect();
    previous?.frameObserver?.disconnect();
    if (previous) previous.frameObserver = undefined;
    const state = {
      start: cold ? null : start,
      cold: cold ? { documentStart: start, connectedAt: null, clientID: null } : undefined,
      displayed: null as number | null,
      authoritative: null as number | null,
      target,
      observer: undefined as MutationObserver | undefined,
      frameObserver: undefined as PerformanceObserver | undefined,
      frameDiagnosticsSupported: Boolean(supportsLongAnimationFrames),
      longAnimationFrames: [] as PerformanceEntry[],
      observedContent: null as Element | null,
      observedAncestors: [] as Node[],
      pendingFrame: false,
      candidates: [] as { node: Node; element: Element }[],
    };
    scope.__benchmarkPaint = state;
    if (supportsLongAnimationFrames) {
      try {
        const frameObserver = new PerformanceObserver(list => {
          if (scope.__benchmarkPaint === state && state.frameObserver === frameObserver)
            state.longAnimationFrames.push(...list.getEntries());
        });
        state.frameObserver = frameObserver;
        frameObserver.observe({ type: 'long-animation-frame', buffered: true });
      } catch {
        state.frameObserver?.disconnect();
        state.frameObserver = undefined;
        state.frameDiagnosticsSupported = false;
      }
    }
    const contentRoot = () =>
      target.contentSelector ? document.querySelector(target.contentSelector) : document.body;
    const ancestors = (content: Element | null) => {
      const result: Node[] = [];
      for (let parent = content?.parentNode; parent; parent = parent.parentNode)
        result.push(parent);
      return result;
    };
    const sameAncestors = (parents: Node[]) =>
      parents.length === state.observedAncestors.length &&
      parents.every((parent, index) => parent === state.observedAncestors[index]);
    const observeContent = (content: Element | null) => {
      const parents = ancestors(content);
      if (state.observedContent === content && sameAncestors(parents)) return;
      state.observer?.disconnect();
      state.observedContent = content;
      state.observedAncestors = parents;
      if (!content) {
        state.observer?.observe(document, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        return;
      }
      state.observer?.observe(content, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      // Watch structural replacements/reparenting without recording text work
      // in unrelated headers, navigation, sidebars or portals.
      for (const parent of parents) state.observer?.observe(parent, { childList: true });
    };
    const inspect = (inAnimationFrame = false, mutations?: MutationRecord[]) => {
      if (scope.__benchmarkPaint !== state || state.displayed !== null) return;
      if (location.pathname.replace(/\/$/, '') !== target.path.replace(/\/$/, '')) {
        observeContent(null);
        return;
      }
      const search = new URLSearchParams(location.search);
      if (
        Object.entries(target.search ?? {}).some(([key, value]) =>
          target.consumedSearch?.includes(key) ? search.has(key) : search.get(key) !== value
        )
      ) {
        observeContent(null);
        return;
      }
      if (!document.body) {
        observeContent(null);
        return;
      }
      const content = contentRoot();
      const sameContent = content === state.observedContent && sameAncestors(ancestors(content));
      observeContent(content);
      if (!content) return;
      const candidates = new Map<Node, { node: Node; element: Element }>();
      const collectText = (node: Node) => {
        if (!content.contains(node) || node.textContent?.trim() !== target.text) return;
        const element = node.parentElement;
        if (
          !element ||
          element.closest('nav,aside') ||
          (target.contentSelector && !element.closest(target.contentSelector))
        )
          return;
        candidates.set(node, { node, element });
      };
      const collectSubtree = (root: Node) => {
        if (root.nodeType === Node.TEXT_NODE) collectText(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) collectText(node);
      };
      if (mutations && sameContent) {
        // Mutation records describe every changed text/subtree. Retain valid
        // candidates and inspect only changed nodes, avoiding repeated whole-page
        // diagnostic scans inside the measured navigation interval.
        for (const candidate of state.candidates) collectText(candidate.node);
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') collectText(mutation.target);
          else
            for (const added of mutation.addedNodes) {
              if (content.contains(added)) collectSubtree(added);
            }
        }
      } else collectSubtree(content);
      state.candidates = [...candidates.values()];
      if (!state.candidates.length) return;
      // Check layout only in the animation frame, after React's DOM work.
      // A layout box can still be transparent or outside the viewport. Recheck
      // the candidate each frame until it can actually be painted.
      const paint = () => {
        state.pendingFrame = false;
        if (
          scope.__benchmarkPaint === state &&
          state.displayed === null &&
          state.start !== null &&
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
        // The initial RAF inspection already runs at a real paint opportunity.
        // Mutation callbacks still schedule their visibility check for a RAF.
        if (inAnimationFrame) paint();
        else {
          state.pendingFrame = true;
          requestAnimationFrame(paint);
        }
      }
    };
    state.observer = new MutationObserver(records => {
      if (scope.__benchmarkPaint !== state || state.displayed !== null) return;
      const content = contentRoot();
      if (
        content !== state.observedContent ||
        !sameAncestors(ancestors(content)) ||
        !content ||
        records.some(record => content.contains(record.target))
      )
        inspect(false, records);
    });
    state.observer.observe(document, { childList: true, subtree: true, characterData: true });
    inspect();
    requestAnimationFrame(() => inspect(true));
  };
}
