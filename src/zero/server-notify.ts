/**
 * Server-side notification dispatcher.
 *
 * Thin wrapper around notification-helpers. Server mutator overrides may
 * either fire-and-forget or await the returned promise when delivery must
 * finish before the mutation returns. Errors are logged but never bubble up
 * to the caller.
 */
import * as helpers from '@/features/notifications/utils/notification-helpers.ts';

const LOG = '[ServerNotify]';

type Params = Record<string, string | number | null | undefined>;

// Dynamic dispatch: helpers have varying signatures, but fireNotification
// only passes primitive params from server mutators.
type HelperFn = (...args: never[]) => Promise<unknown>;

/**
 * Calls the named notification helper and returns its completion promise.
 * Callers may ignore the promise for fire-and-forget delivery. Errors are
 * swallowed so notification failures never affect the mutation.
 */
export function fireNotification(helperName: string, params: Params): Promise<void> {
  const fn = (helpers as unknown as Record<string, HelperFn | undefined>)[helperName];
  if (typeof fn !== 'function') {
    console.error(LOG, `Unknown helper: ${helperName}`);
    return Promise.resolve();
  }
  return (fn as (p: Params) => Promise<unknown>)(params)
    .then(() => undefined)
    .catch((err: unknown) => console.error(LOG, `${helperName} failed:`, err));
}
