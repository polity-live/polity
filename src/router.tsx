import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { loadConnectedAppRuntime } from './runtime/app-runtime';
import { loadAuthenticatedShell } from './layout/app-shell';

export function getRouter() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    // Fetch frame code alongside the initial route and auth validation. Loading
    // these modules does not mount providers or activate any queries.
    void loadConnectedAppRuntime().catch(() => undefined);
    void loadAuthenticatedShell().catch(() => undefined);
  }
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
  });
}
