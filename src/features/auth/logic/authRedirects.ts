export type AllowedAuthRedirect = '/' | '/auth/reset-password';

const ALLOWED_AUTH_REDIRECTS = new Set<AllowedAuthRedirect>(['/', '/auth/reset-password']);
const PENDING_SIGN_IN_REDIRECT_KEY = 'polity_pending_sign_in_redirect';

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

export function getSafeSignInRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const parsed = new URL(value, getAuthOrigin());
    if (parsed.origin !== getAuthOrigin() || parsed.pathname.startsWith('/auth')) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

export function storePendingSignInRedirect(value: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_SIGN_IN_REDIRECT_KEY, getSafeSignInRedirect(value));
}

export function consumePendingSignInRedirect() {
  if (typeof window === 'undefined') return '/';
  const value = window.sessionStorage.getItem(PENDING_SIGN_IN_REDIRECT_KEY);
  window.sessionStorage.removeItem(PENDING_SIGN_IN_REDIRECT_KEY);
  return getSafeSignInRedirect(value);
}
