import type { Zero } from '@rocicorp/zero';
import { createCoreZeroPreloadEntries } from './global';
import {
  createIntentTaskForHref,
  createMessagesPreloadTask,
  createSearchPreloadTask,
} from './route-manifests';
import { retainZeroPreloadHandle } from './preload-registry';
import type { SearchRoutePreloadParams } from './search-context';

/** Register current-page demand before the provider mounts its child query effects. */
export function initializeAppQueries(zero: Zero) {
  if (!zero.userID || zero.userID === 'anon' || typeof window === 'undefined') return;
  const address = new URL(window.location.href);
  const pathname = address.pathname.replace(/\/$/, '') || '/';
  const task =
    pathname === '/search'
      ? createSearchPreloadTask(
          zero.userID,
          Object.fromEntries(address.searchParams) as SearchRoutePreloadParams
        )
      : pathname === '/messages'
        ? createMessagesPreloadTask(address.searchParams.get('conversationId') ?? undefined)
        : createIntentTaskForHref(pathname, zero.userID);
  const entries = [...createCoreZeroPreloadEntries(zero.userID), ...(task?.entries ?? [])];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    const handle = retainZeroPreloadHandle(
      zero as unknown as Parameters<typeof retainZeroPreloadHandle>[0],
      { ...entry, ttl: entry.ttl ?? '10m' }
    );
    // The normal route/shell effects join this registry entry. Preserve started
    // work until completion, then release only this initializer's reference.
    void handle.complete.then(handle.release, handle.release);
  }
}
