import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAuthRedirectUrl, getSafeAuthRedirect } from '../authRedirects';

describe('getAuthRedirectUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds an absolute redirect without requiring a browser global', () => {
    expect(getAuthRedirectUrl('/auth/callback')).toMatch(/^https?:\/\/[^/]+\/auth\/callback$/);
  });

  it('uses the current origin in a browser', () => {
    vi.stubGlobal('window', { location: { origin: 'https://browser.example' } });

    expect(getAuthRedirectUrl('/auth/callback')).toBe('https://browser.example/auth/callback');
  });

  it('uses the configured fallback origin outside a browser', () => {
    vi.stubGlobal('window', undefined);

    expect(getAuthRedirectUrl('/auth/callback')).toMatch(/^https?:\/\/[^/]+\/auth\/callback$/);
  });
});

describe('getSafeAuthRedirect', () => {
  it('allows only known internal auth destinations', () => {
    expect(getSafeAuthRedirect('/auth/reset-password')).toBe('/auth/reset-password');
    expect(getSafeAuthRedirect('/')).toBe('/');
  });

  it('rejects external and unknown redirects', () => {
    expect(getSafeAuthRedirect('https://example.com')).toBe('/');
    expect(getSafeAuthRedirect('//example.com')).toBe('/');
    expect(getSafeAuthRedirect('/admin')).toBe('/');
    expect(getSafeAuthRedirect(null)).toBe('/');
  });
});
