import { useQuery as zeroUseQuery } from '@rocicorp/zero/react';
import { useEffect, useRef } from 'react';
import { stableStringify } from './preloads/preload-registry';
export * from '@rocicorp/zero/react';

export interface QueryViewObservation {
  activationID: string;
  activatedAt: number;
  phase: 'render' | 'commit' | 'release';
  clientID?: string;
  name: string;
  args: unknown;
  at: number;
  readAt: number;
  type: string;
  ids: string[];
}
let viewSequence = 0;

/** Observes the public hook's result only when the isolated benchmark installs a sink. */
const observedUseQuery = (...input: Parameters<typeof zeroUseQuery>) => {
  const observe = (
    globalThis as typeof globalThis & {
      __zeroPerformanceView?: (event: QueryViewObservation) => void;
    }
  ).__zeroPerformanceView;
  const activation = useRef<{ key: string; id: string; at: number } | undefined>(undefined);
  const request = input[0];
  const key =
    observe && request && 'query' in request
      ? stableStringify({ name: request.query.queryName, args: request.args })
      : '';
  const readAt = observe ? performance.now() : undefined;
  if (!key) activation.current = undefined;
  if (key && activation.current?.key !== key)
    activation.current = { key, id: `view:${++viewSequence}`, at: readAt as number };
  const current = key ? activation.current : undefined;
  const result = zeroUseQuery(...input);
  if (observe && current && readAt !== undefined && request && 'query' in request && result[1]) {
    const rows: any[] = Array.isArray(result[0]) ? result[0] : result[0] ? [result[0]] : [];
    observe({
      activationID: current.id,
      activatedAt: current.at,
      phase: 'render',
      name: request.query.queryName,
      args: request.args,
      at: performance.now(),
      readAt,
      type: result[1].type,
      ids: rows.map(row => row.id).filter(id => typeof id === 'string'),
    });
  }
  useEffect(() => {
    if (
      !observe ||
      !current ||
      !request ||
      !('query' in request) ||
      !result[1] ||
      readAt === undefined
    )
      return;
    const rows: any[] = Array.isArray(result[0]) ? result[0] : result[0] ? [result[0]] : [];
    observe({
      activationID: current.id,
      activatedAt: current.at,
      phase: 'commit',
      name: request.query.queryName,
      args: request.args,
      at: performance.now(),
      readAt,
      type: result[1].type,
      ids: rows.map(row => row.id).filter(id => typeof id === 'string'),
    });
  }, [observe, key, result[0], result[1]?.type]);
  useEffect(() => {
    if (!observe || !current || !request || !('query' in request)) return;
    return () =>
      observe({
        activationID: current.id,
        activatedAt: current.at,
        phase: 'release',
        name: request.query.queryName,
        args: request.args,
        at: performance.now(),
        readAt: current.at,
        type: 'released',
        ids: [],
      });
  }, [observe, key]);
  return result;
};

// The isolated browser installs its sink before importing application modules.
// Choose once: ordinary production hooks incur no observation refs or effects,
// and a mounted component never changes its hook order if a sink is removed.
export const useQuery = (
  (
    globalThis as typeof globalThis & {
      __zeroPerformanceView?: (event: QueryViewObservation) => void;
    }
  ).__zeroPerformanceView
    ? observedUseQuery
    : zeroUseQuery
) as typeof zeroUseQuery;

export function observeRouteReadiness(
  name: string,
  complete: boolean,
  details?: { args: unknown; ids: string[] }
) {
  const observe = (
    globalThis as typeof globalThis & {
      __zeroPerformanceReady?: (
        name: string,
        complete: boolean,
        at: number,
        details?: { args: unknown; ids: string[] }
      ) => void;
    }
  ).__zeroPerformanceReady;
  if (details) observe?.(name, complete, performance.now(), details);
  else observe?.(name, complete, performance.now());
}
