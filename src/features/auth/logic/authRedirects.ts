export type AllowedAuthRedirect = '/' | '/auth/reset-password';

const ALLOWED_AUTH_REDIRECTS = new Set<AllowedAuthRedirect>(['/', '/auth/reset-password']);

function getAuthOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return import.meta.env.VITE_APP_URL || 'http://localhost:3000';
}

export function getAuthRedirectUrl(path: string): string {
  return new URL(path, getAuthOrigin()).toString();
}

export function getSafeAuthRedirect(value: string | null): AllowedAuthRedirect {
  if (value && ALLOWED_AUTH_REDIRECTS.has(value as AllowedAuthRedirect)) {
    return value as AllowedAuthRedirect;
  }
  return '/';
}
