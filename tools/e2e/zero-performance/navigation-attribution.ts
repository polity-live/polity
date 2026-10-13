import { SourceMap } from 'node:module';

/** CPU sampling belongs only to the post-acceptance replay, never to an original timing. */
export function attributeNavigationProfile(profile: any, maps: Map<string, any>) {
  const decoded = new Map<string, SourceMap>();
  for (const [url, payload] of maps) {
    try {
      decoded.set(url, new SourceMap(payload));
    } catch {
      /* Unavailable map. */
    }
  }
  const durations = new Map<number, number>();
  for (let index = 0; index < (profile.samples ?? []).length; index++) {
    const delta = profile.timeDeltas?.[index];
    if (Number.isFinite(delta) && delta >= 0)
      durations.set(
        profile.samples[index],
        (durations.get(profile.samples[index]) ?? 0) + delta / 1000
      );
  }
  return {
    format: 'zero-navigation-attribution/v1',
    scope: 'post-acceptance-fresh-context-history-diagnostic',
    attribution:
      'Sampled self time across the diagnostic replay; not the duration or cause of an original failed navigation.',
    functions: (profile.nodes ?? [])
      .map((node: any) => {
        const frame = node.callFrame ?? {},
          payload = maps.get(frame.url);
        let source: any = null;
        if (payload) {
          try {
            const entry =
              decoded.get(frame.url)?.findEntry(frame.lineNumber, frame.columnNumber) ?? {};
            if (
              'originalSource' in entry &&
              typeof entry.originalSource === 'string' &&
              'originalLine' in entry &&
              typeof entry.originalLine === 'number' &&
              'originalColumn' in entry &&
              typeof entry.originalColumn === 'number'
            )
              source = {
                file: entry.originalSource,
                line: entry.originalLine + 1,
                column: entry.originalColumn + 1,
                name: null,
              };
          } catch {
            /* Invalid maps are unavailable evidence, not a function attribution. */
          }
        }
        return {
          functionName: frame.functionName || '(anonymous)',
          url: frame.url,
          line: frame.lineNumber,
          column: frame.columnNumber,
          sampledSelfMs: durations.get(node.id) ?? 0,
          source,
          sourceMapStatus: source ? 'mapped' : payload ? 'unmapped' : 'unavailable',
        };
      })
      .filter((node: any) => node.sampledSelfMs > 0)
      .sort((a: any, b: any) => b.sampledSelfMs - a.sampledSelfMs),
  };
}

/** All cuts and events come from one Chrome trace clock; nested durations are not summed. */
export function attributeBackTrace(events: any[]) {
  const cuts = new Map<number, { start?: number; end?: number }>();
  for (const event of events) {
    const match = /^history-diagnostic-back-(\d+)-(start|end)$/.exec(event.name);
    if (!match || !Number.isFinite(event.ts)) continue;
    const cut = cuts.get(Number(match[1])) ?? {};
    cut[match[2] as 'start' | 'end'] = event.ts;
    cuts.set(Number(match[1]), cut);
  }
  return [...cuts.entries()].map(([index, cut]) => {
    const start = cut.start ?? NaN,
      end = cut.end ?? NaN;
    const valid = Number.isFinite(start) && Number.isFinite(end) && end >= start;
    return {
      index,
      clock: 'chromium-trace-us',
      scope: 'post-acceptance-fresh-context-history-diagnostic',
      status: valid ? 'observed' : 'unknown',
      start: cut.start ?? null,
      end: cut.end ?? null,
      events: valid
        ? events
            .filter(
              event =>
                Number.isFinite(event.ts) &&
                Number.isFinite(event.dur) &&
                event.dur >= 0 &&
                event.ts < end &&
                event.ts + event.dur > start
            )
            .map(event => ({
              name: event.name,
              durationMs: event.dur / 1000,
              overlapMs: (Math.min(event.ts + event.dur, end) - Math.max(event.ts, start)) / 1000,
              stack: event.stack ?? [],
            }))
        : [],
    };
  });
}

export function diagnosticSourceMapURL(reference: string, assetURL: string, appURL: string) {
  try {
    const url = new URL(reference, assetURL),
      app = new URL(appURL);
    if (
      !['localhost', '127.0.0.1'].includes(app.hostname) ||
      url.origin !== app.origin ||
      url.search ||
      url.hash ||
      !/^\/assets\/[A-Za-z0-9_$.-]+\.js\.map$/.test(url.pathname)
    )
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}
