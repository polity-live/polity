import type { Connection, ConnectionState } from '@rocicorp/zero';

const RELOAD_CONNECTION_RACE = 'No validated connection is available for shared query work.';

/** A reload can race Zero's background CVR catch-up before the new connection
 * validates. Zero pauses this protocol error until the host calls connect().
 * Keep the persisted store and token, and bound retries to this exact error.
 */
export function recoverReloadConnection(connection: Connection) {
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subscription: { unsubscribe?: () => void } = {};
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    subscription.unsubscribe?.();
  };
  const observe = (state: ConnectionState) => {
    if (state.name === 'closed') {
      stop();
      return;
    }
    if (state.name !== 'error' || state.reason !== RELOAD_CONNECTION_RACE) {
      clearTimeout(timer);
      timer = undefined;
      return;
    }
    if (timer !== undefined || attempts >= 3) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        attempts++;
        // Rejection is reflected in the subscribed connection state. Retain the
        // error UI if the bounded recovery fails rather than reloading data.
        void connection.connect().catch(() => undefined);
      },
      50 * 2 ** attempts
    );
  };
  subscription.unsubscribe = connection.state.subscribe(observe);
  observe(connection.state.current);
  return stop;
}
