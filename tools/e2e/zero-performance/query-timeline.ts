import type { Execution } from './sharding';
import { BUDGETS, type Measurement } from './metrics';

export const QUERY_TIMELINE_FORMAT = 'zero-query-timeline/v1';
export type QueryEvent =
  | 'materializeStart'
  | 'materializeEnd'
  | 'listenerStart'
  | 'listenerEnd'
  | 'firstCallback'
  | 'completeCallback';
export interface QueryTimeline {
  key: string;
  iteration: number;
  execution?: Execution;
  clientCorrelationID: string;
  queryID: string | null;
  clock: 'node-performance-now';
  timeOrigin: number;
  events: Record<QueryEvent, number | null>;
  elapsedMs: number | null;
  sdkHydrateTotalMs: number | null;
  totalSource: 'elapsed' | 'sdk-hydration' | 'both' | 'unknown';
  budgetExceededBy: ('elapsed' | 'sdk-hydration')[];
  api: { requestID: string; evidence: string; clock: 'api-server' } | null;
}
export function queryTimeline(
  key: string,
  iteration: number,
  clientCorrelationID: string,
  execution?: Execution
): QueryTimeline {
  return {
    key,
    iteration,
    execution,
    clientCorrelationID,
    queryID: null,
    clock: 'node-performance-now',
    timeOrigin: performance.timeOrigin,
    events: {
      materializeStart: null,
      materializeEnd: null,
      listenerStart: null,
      listenerEnd: null,
      firstCallback: null,
      completeCallback: null,
    },
    elapsedMs: null,
    sdkHydrateTotalMs: null,
    totalSource: 'unknown',
    budgetExceededBy: [],
    api: null,
  };
}
export function timelineTotals(
  timeline: QueryTimeline,
  elapsedMs: number,
  sdkHydrateTotalMs: number
) {
  timeline.elapsedMs = elapsedMs;
  timeline.sdkHydrateTotalMs = sdkHydrateTotalMs;
  timeline.budgetExceededBy = [];
  if (Number.isFinite(elapsedMs) && elapsedMs > BUDGETS.totalMs)
    timeline.budgetExceededBy.push('elapsed');
  if (Number.isFinite(sdkHydrateTotalMs) && sdkHydrateTotalMs > BUDGETS.totalMs)
    timeline.budgetExceededBy.push('sdk-hydration');
  timeline.totalSource = ![elapsedMs, sdkHydrateTotalMs].every(
    value => Number.isFinite(value) && value >= 0
  )
    ? 'unknown'
    : elapsedMs === sdkHydrateTotalMs
      ? 'both'
      : elapsedMs > sdkHydrateTotalMs
        ? 'elapsed'
        : 'sdk-hydration';
}
export function correlateTimelines(timelines: QueryTimeline[], measurements: Measurement[]) {
  for (const timeline of timelines) {
    const sample = measurements
      .find(row => row.key === timeline.key)
      ?.samples.find(row => row.clientCorrelationID === timeline.clientCorrelationID);
    timeline.queryID = sample?.queryID ?? null;
    timeline.api = sample?.api
      ? {
          requestID: sample.api.requestID,
          evidence: 'report.json#/apiDiagnostics',
          clock: 'api-server',
        }
      : null;
  }
}

export function localTimelineSegments(timeline: QueryTimeline) {
  const difference = (end: number | null, start: number | null) =>
    timeline.clock === 'node-performance-now' &&
    end !== null &&
    start !== null &&
    Number.isFinite(end) &&
    Number.isFinite(start) &&
    end >= start
      ? end - start
      : null;
  const completedAfterStart = difference(
    timeline.events.completeCallback,
    timeline.events.materializeStart
  );
  return {
    materializeSyncMs: difference(timeline.events.materializeEnd, timeline.events.materializeStart),
    listenerRegistrationMs: difference(timeline.events.listenerEnd, timeline.events.listenerStart),
    firstCallbackWaitMs: difference(timeline.events.firstCallback, timeline.events.listenerStart),
    completeCallbackWaitMs: difference(
      timeline.events.completeCallback,
      timeline.events.listenerStart
    ),
    completionResumeMs: difference(timeline.elapsedMs, completedAfterStart),
    transportMs: null,
  };
}
