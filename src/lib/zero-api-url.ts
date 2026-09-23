export function resolveZeroAPIURL(appURL: string, configuredURL: string | undefined): string {
  return configuredURL || appURL;
}
