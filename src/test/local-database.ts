/** Preserve ordinary local tests while allowing only the runner's verified isolated target. */
export function isLocalTestDatabase(
  value: string,
  environment: Record<string, string | undefined> = process.env
) {
  const address = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(address.hostname)) return false;
  if (environment.ZERO_PERFORMANCE_LAYER !== 'integrity') return address.port === '54322';
  const port = Number(address.port);
  return (
    address.hostname === '127.0.0.1' &&
    port >= 55625 &&
    port <= 55815 &&
    (port - 55625) % 10 === 0 &&
    value === environment.ZERO_UPSTREAM_DB &&
    environment.SUPABASE_URL === `http://127.0.0.1:${port - 1}` &&
    ['DATABASE_URL', 'SUPABASE_DB_URL', 'STUDIO_DATABASE_URL', 'STUDIO_TEST_DATABASE_URL'].every(
      name => environment[name] === value
    )
  );
}
