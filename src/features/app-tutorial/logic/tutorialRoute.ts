const TUTORIAL_ROUTE_BASE = 'https://polity.local';

/**
 * Tutorial routes describe the location required by a checkpoint. A route may
 * add its own normalized search state (for example the selected amendment
 * branch), which must not make an otherwise valid checkpoint unreachable.
 */
export function tutorialRouteMatches(currentRoute: string, expectedRoute: string) {
  const current = new URL(currentRoute, TUTORIAL_ROUTE_BASE);
  const expected = new URL(expectedRoute, TUTORIAL_ROUTE_BASE);

  if (current.pathname !== expected.pathname) return false;

  return [...expected.searchParams].every(
    ([key, value]) => current.searchParams.get(key) === value
  );
}
