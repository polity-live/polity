export function resolveZeroAPIURL(
  appURL: string,
  cacheURL: string,
  configuredURL: string | undefined,
  development: boolean
): string {
  if (configuredURL) return configuredURL;
  if (!development) return appURL;

  const app = new URL(appURL);
  const cache = new URL(cacheURL);
  const local = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';
  if (local(app.hostname) && local(cache.hostname) && cache.port === '4848') {
    // The local Zero cache runs in Docker and reaches Vite through this host name.
    app.hostname = 'host.docker.internal';
    return app.origin;
  }
  return appURL;
}
