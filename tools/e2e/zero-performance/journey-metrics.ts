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

/** Retain real Inspector readings while each completed view is still subscribed. */
export function retainViewClientSamples(
  query: QueryObservation,
  measuredAt: number,
  samples: ViewClientSamples
): QueryObservation {
  return {
    ...query,
    views: query.views?.map(view => {
      const key = `${query.clientID}/${view.activationID}`;
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
    if (event.phase === 'release') run.releasedAt = event.at;
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
  if (query.kind === 'materialized') {
    const retainedLocal =
      Boolean(query.views?.length) &&
      query.views?.every(
        view =>
          valid(view.clientMs) &&
          valid(view.clientMeasuredAt) &&
          valid(view.authoritativeAt) &&
          view.clientMeasuredAt >= view.authoritativeAt &&
          (view.releasedAt === null || view.clientMeasuredAt <= view.releasedAt)
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
