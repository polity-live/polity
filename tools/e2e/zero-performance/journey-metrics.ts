import { BUDGETS } from './metrics';
import type { PreloadLifecycleEvent } from '../../../src/zero/preloads/query-lifecycle';
import type { QueryViewObservation } from '../../../src/zero/observed-query';

export interface QueryObservation {
  id: string;
  clientID: string;
  name: string | null;
  args: unknown;
  kind: 'preload' | 'materialized';
  got: boolean;
  client: number | null;
  server: number | null;
  total: number | null;
  ttl: unknown;
  inactive: unknown;
  views?: {
    activationID: string;
    activatedAt: number;
    authoritativeAt: number | null;
    releasedAt: number | null;
    clientMs?: number;
    clientMeasuredAt?: number;
    /** A logical consumer can join an already subscribed, continuously complete SDK view. */
    sharedWithActivationID?: string;
    interrupted?: boolean;
  }[];
  preloads: {
    activationID: string;
    activatedAt: number;
    authoritativeAt: number | null;
    releasedAt: number | null;
    error: boolean;
  }[];
}

export type ViewClientSamples = Map<string, { clientMs: number; clientMeasuredAt: number }>;

/** A new view can complete while the previous asynchronous Inspector snapshot is in flight. */
export function hasUnmeasuredActiveViews(queries: QueryObservation[]) {
  return queries.some(query =>
    query.views?.some(
      view =>
        view.releasedAt === null && (view.authoritativeAt === null || view.clientMs === undefined)
    )
  );
}

/** Retain real Inspector readings; a shared consumer references their original provenance. */
export function retainViewClientSamples(
  query: QueryObservation,
  measuredAt: number,
  samples: ViewClientSamples
): QueryObservation {
  const measured = {
    ...query,
    views: query.views?.map(view => {
      const key = JSON.stringify([
        query.clientID,
        // Inspector can evict the SDK ID after release. Named query identity and
        // the exact activation still identify the original measured lifetime.
        query.name ?? query.id,
        query.args,
        view.activationID,
      ]);
      if (
        view.releasedAt === null &&
        view.authoritativeAt !== null &&
        typeof query.client === 'number' &&
        Number.isFinite(query.client) &&
        query.client >= 0 &&
        Number.isFinite(measuredAt) &&
        measuredAt >= view.authoritativeAt
      ) {
        const previous = samples.get(key);
        if (!previous || query.client > previous.clientMs)
          samples.set(key, { clientMs: query.client, clientMeasuredAt: measuredAt });
      }
      return { ...view, ...samples.get(key) };
    }),
  };
  return {
    ...measured,
    views: measured.views?.map(view => {
      if (view.clientMs !== undefined || view.releasedAt === null) return view;
      const owner = measured.views?.find(candidate => sharesMeasuredView(view, candidate));
      return owner ? { ...view, sharedWithActivationID: owner.activationID } : view;
    }),
  };
}

type ViewRun = NonNullable<QueryObservation['views']>[number];
const validLocalSample = (view: ViewRun) =>
  typeof view.clientMs === 'number' &&
  Number.isFinite(view.clientMs) &&
  view.clientMs >= 0 &&
  typeof view.clientMeasuredAt === 'number' &&
  Number.isFinite(view.clientMeasuredAt) &&
  typeof view.authoritativeAt === 'number' &&
  Number.isFinite(view.authoritativeAt) &&
  view.clientMeasuredAt >= view.authoritativeAt &&
  (view.releasedAt === null || view.clientMeasuredAt <= view.releasedAt);

/** Only an uninterrupted, complete subscription covering the entire consumer lifetime proves sharing.
 * TTL retention, a later remount, retries and another query/client do not provide this proof.
 * Named queries with identical normalized arguments/context have the same registered result format.
 */
function sharesMeasuredView(consumer: ViewRun, owner: ViewRun) {
  return (
    consumer.activationID !== owner.activationID &&
    !consumer.interrupted &&
    !owner.interrupted &&
    !owner.sharedWithActivationID &&
    validLocalSample(owner) &&
    consumer.releasedAt !== null &&
    consumer.authoritativeAt !== null &&
    owner.authoritativeAt !== null &&
    owner.authoritativeAt <= consumer.activatedAt &&
    owner.activatedAt <= consumer.activatedAt &&
    consumer.authoritativeAt >= consumer.activatedAt &&
    consumer.authoritativeAt <= consumer.releasedAt &&
    (owner.releasedAt === null || owner.releasedAt >= consumer.releasedAt)
  );
}

export function viewRuns(events: QueryViewObservation[]): NonNullable<QueryObservation['views']> {
  const runs = new Map<string, NonNullable<QueryObservation['views']>[number]>();
  const committed = new Set(
    events.filter(event => event.phase === 'commit').map(event => event.activationID)
  );
  for (const event of events.filter(
    event => committed.has(event.activationID) && event.phase !== 'render'
  )) {
    if (!event.activationID) throw new Error('Missing view activation identity');
    let run = runs.get(event.activationID);
    if (run && run.activatedAt !== event.activatedAt)
      throw new Error('View activation identity reused for a different lifetime');
    if (!run) {
      run = {
        activationID: event.activationID,
        activatedAt: event.activatedAt,
        authoritativeAt: null,
        releasedAt: null,
      };
      runs.set(event.activationID, run);
    }
    if (event.type === 'complete' && run.authoritativeAt === null) run.authoritativeAt = event.at;
    if (run.authoritativeAt !== null && !['complete', 'released'].includes(event.type))
      run.interrupted = true;
    if (event.phase === 'release') run.releasedAt = event.at;
  }
  // Error/unknown renders can be superseded before React commits; they still invalidate sharing.
  for (const event of events) {
    const run = runs.get(event.activationID);
    if (
      run &&
      run.authoritativeAt !== null &&
      event.at >= run.authoritativeAt &&
      event.phase !== 'release' &&
      event.type !== 'complete'
    )
      run.interrupted = true;
  }
  return [...runs.values()];
}

export function preloadRuns(events: PreloadLifecycleEvent[]) {
  const runs: QueryObservation['preloads'] = [];
  const byID = new Map<string, QueryObservation['preloads'][number]>();
  for (const event of events) {
    if (event.phase === 'preload-start') {
      if (!event.activationID || byID.has(event.activationID))
        throw new Error('Missing or duplicate preload activation identity');
      const run = {
        activationID: event.activationID,
        activatedAt: event.at,
        authoritativeAt: null as number | null,
        releasedAt: null as number | null,
        error: false,
      };
      runs.push(run);
      byID.set(event.activationID, run);
      continue;
    }
    const run = byID.get(event.activationID);
    if (!run) throw new Error(`Preload event without activation: ${event.key}`);
    if (event.phase === 'preload-complete') run.authoritativeAt = event.at;
    if (event.phase === 'preload-error') run.error = true;
    if (event.phase === 'preload-release') run.releasedAt = event.at;
  }
  return runs;
}

export function queryObservationFailures(query: QueryObservation, absoluteBudgets = true) {
  const failures: string[] = [];
  const valid = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (!query.id || !query.clientID || !query.name || !query.got)
    failures.push('Missing authoritative query identity/result');
  if (query.server !== null && !valid(query.server))
    failures.push('Invalid server hydration metric');
  else if (absoluteBudgets && query.server !== null && query.server > BUDGETS.serverMs)
    failures.push(`Server materialization exceeds ${BUDGETS.serverMs} ms`);
  if (query.kind === 'materialized') {
    const retainedLocal =
      Boolean(query.views?.length) &&
      query.views?.every(view =>
        view.sharedWithActivationID
          ? view.clientMs === undefined &&
            view.clientMeasuredAt === undefined &&
            query.views?.some(
              owner =>
                owner.activationID === view.sharedWithActivationID &&
                sharesMeasuredView(view, owner)
            )
          : validLocalSample(view)
      );
    if (
      (query.views?.length ? !retainedLocal : !valid(query.client)) ||
      (query.total === null ? !query.views?.length : !valid(query.total))
    )
      failures.push('Missing materialization metrics');
    else if (absoluteBudgets) {
      if (
        (query.client !== null && query.client > BUDGETS.clientMs) ||
        query.views?.some(view => view.clientMs !== undefined && view.clientMs > BUDGETS.clientMs)
      )
        failures.push(`Client exceeds ${BUDGETS.clientMs} ms`);
      if (query.total !== null && query.total > BUDGETS.totalMs)
        failures.push(`Total exceeds ${BUDGETS.totalMs} ms`);
    }
  } else if (query.kind !== 'preload' || !query.preloads.length)
    failures.push('Missing preload observations');
  for (const run of query.views ?? []) {
    if (
      !run.activationID ||
      !valid(run.activatedAt) ||
      !valid(run.authoritativeAt) ||
      run.authoritativeAt < run.activatedAt
    )
      failures.push('Missing authoritative view completion');
    else if (absoluteBudgets && run.authoritativeAt - run.activatedAt > BUDGETS.totalMs)
      failures.push(`Total exceeds ${BUDGETS.totalMs} ms`);
    if (run.releasedAt !== null && (!valid(run.releasedAt) || run.releasedAt < run.activatedAt))
      failures.push('Invalid view release');
  }
  for (const run of query.preloads) {
    if (
      !run.activationID ||
      !valid(run.activatedAt) ||
      !valid(run.authoritativeAt) ||
      run.authoritativeAt < run.activatedAt ||
      run.error
    )
      failures.push('Missing or failed preload completion');
    else if (absoluteBudgets && run.authoritativeAt - run.activatedAt > BUDGETS.totalMs)
      failures.push(`Preload exceeds ${BUDGETS.totalMs} ms`);
    if (run.releasedAt !== null && (!valid(run.releasedAt) || run.releasedAt < run.activatedAt))
      failures.push('Invalid preload release');
  }
  return [...new Set(failures)];
}
