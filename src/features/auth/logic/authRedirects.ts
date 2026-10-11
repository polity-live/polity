export type AllowedAuthRedirect = '/' | '/auth/reset-password' | `/invite/${string}`;

const ALLOWED_AUTH_REDIRECTS = new Set<AllowedAuthRedirect>(['/', '/auth/reset-password']);
const PENDING_SIGN_IN_REDIRECT_KEY = 'polity_pending_sign_in_redirect';

function getAuthOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return import.meta.env.VITE_APP_URL || 'http://localhost:3000';
}

export function getAuthRedirectUrl(path: string): string {
  const url = new URL(path, getAuthOrigin());
  const pending = peekPendingInvitationRedirect();
  if (url.pathname === '/auth/callback' && pending) url.searchParams.set('next', pending);
  return url.toString();
}

export function getSafeAuthRedirect(value: string | null): AllowedAuthRedirect {
  if (value && /^\/invite\/[A-Za-z0-9_-]{43}$/.test(value)) return value as AllowedAuthRedirect;
  if (value && ALLOWED_AUTH_REDIRECTS.has(value as AllowedAuthRedirect)) {
    return value as AllowedAuthRedirect;
  }
  return '/';
}

export function peekPendingInvitationRedirect(): `/invite/${string}` | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_SIGN_IN_REDIRECT_KEY);
    return value && /^\/invite\/[A-Za-z0-9_-]{43}$/.test(value)
      ? (value as `/invite/${string}`)
      : null;
  } catch {
    return null;
  }
}

export function getInvitationOnboardingDestination(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem('polity_invitation_onboarding_destination');
    return value && /^\/group\/[0-9a-f-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function getSafeSignInRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const authOrigin = getAuthOrigin();
    const parsed = new URL(value, authOrigin);
    if (parsed.origin !== authOrigin || parsed.pathname.startsWith('/auth')) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

export function storePendingSignInRedirect(value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_SIGN_IN_REDIRECT_KEY, getSafeSignInRedirect(value));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function consumePendingSignInRedirect() {
  if (typeof window === 'undefined') return '/';
  try {
    const value = window.sessionStorage.getItem(PENDING_SIGN_IN_REDIRECT_KEY);
    window.sessionStorage.removeItem(PENDING_SIGN_IN_REDIRECT_KEY);
    return getSafeSignInRedirect(value);
  } catch {
    return '/';
  }
}
