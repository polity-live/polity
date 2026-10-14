import { expect, it } from 'vitest';
import {
  correlateTimelines,
  queryTimeline,
  timelineTotals,
  localTimelineSegments,
} from '../query-timeline';
import type { Measurement } from '../metrics';

it('separates measured elapsed and SDK hydration without inventing missing events', () => {
  const timeline = queryTimeline('q', 0, 'c');
  expect(Object.values(timeline.events)).toEqual([null, null, null, null, null, null]);
  expect(timeline.clock).toBe('node-performance-now');
  timelineTotals(timeline, 1090.9, 40);
  expect(timeline.totalSource).toBe('elapsed');
  timelineTotals(timeline, 40, 1090.9);
  expect(timeline.totalSource).toBe('sdk-hydration');
  expect(timeline.budgetExceededBy).toEqual(['sdk-hydration']);
  timelineTotals(timeline, 1100, 1200);
  expect(timeline.budgetExceededBy).toEqual(['elapsed', 'sdk-hydration']);
  timelineTotals(timeline, 50, 50);
  expect(timeline.totalSource).toBe('both');
  timelineTotals(timeline, NaN, 50);
  expect(timeline.totalSource).toBe('unknown');
});
it('binds timeline API evidence only by measurement and client correlation', () => {
  const timeline = queryTimeline('q', 0, 'c'),
    unmatched = queryTimeline('q', 1, 'other');
  correlateTimelines([timeline, unmatched], [
    {
      key: 'q',
      samples: [{ queryID: 'query', clientCorrelationID: 'c', api: { requestID: 'request' } }],
    },
  ] as Measurement[]);
  expect(timeline.api).toEqual({
    requestID: 'request',
    evidence: 'report.json#/apiDiagnostics',
    clock: 'api-server',
  });
  expect(timeline.queryID).toBe('query');
  expect(unmatched.api).toBeNull();
});
it('derives local wait intervals but leaves transport and absent events unknown', () => {
  const timeline = queryTimeline('q', 0, 'c');
  expect(localTimelineSegments(timeline).completeCallbackWaitMs).toBeNull();
  timeline.events = {
    materializeStart: 10,
    materializeEnd: 14,
    listenerStart: 14,
    listenerEnd: 15,
    firstCallback: 20,
    completeCallback: 21,
  };
  timeline.elapsedMs = 12;
  expect(localTimelineSegments(timeline)).toEqual({
    materializeSyncMs: 4,
    listenerRegistrationMs: 1,
    firstCallbackWaitMs: 6,
    completeCallbackWaitMs: 7,
    completionResumeMs: 1,
    transportMs: null,
  });
});
