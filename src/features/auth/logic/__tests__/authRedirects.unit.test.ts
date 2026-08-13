import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  consumePendingSignInRedirect,
  getAuthRedirectUrl,
  getSafeAuthRedirect,
  getSafeSignInRedirect,
  storePendingSignInRedirect,
} from '../authRedirects';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getAuthRedirectUrl', () => {
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

describe('pending sign-in redirects', () => {
  it('preserves safe local paths, queries and hashes while rejecting unsafe targets', () => {
    vi.stubGlobal('window', { location: { origin: 'https://polity.example' } });

    expect(getSafeSignInRedirect('/group/abc/settings?tab=members#roles')).toBe(
      '/group/abc/settings?tab=members#roles'
    );
    expect(getSafeSignInRedirect(null)).toBe('/');
    expect(getSafeSignInRedirect('https://attacker.invalid/capture')).toBe('/');
    expect(getSafeSignInRedirect('//attacker.invalid/capture')).toBe('/');
    expect(getSafeSignInRedirect('/auth/sign-in?redirect=/settings')).toBe('/');
  });

  it('fails closed when the configured browser origin cannot be parsed', () => {
    vi.stubGlobal('window', { location: { origin: 'not an origin' } });

    expect(getSafeSignInRedirect('/settings')).toBe('/');
  });

  it('stores, consumes and removes a safe pending destination', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    } as unknown as Storage;
    vi.stubGlobal('window', {
      location: { origin: 'https://polity.example' },
      sessionStorage: storage,
    });

    storePendingSignInRedirect('/event/abc/agenda?mode=live#queue');
    expect(consumePendingSignInRedirect()).toBe('/event/abc/agenda?mode=live#queue');
    expect(storage.removeItem).toHaveBeenCalledWith('polity_pending_sign_in_redirect');
  });

  it('keeps storage denial and server rendering non-fatal', () => {
    const deniedStorage = {
      getItem: vi.fn(() => {
        throw new Error('storage denied');
      }),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('storage denied');
      }),
    } as unknown as Storage;
    vi.stubGlobal('window', {
      location: { origin: 'https://polity.example' },
      sessionStorage: deniedStorage,
    });

    expect(() => storePendingSignInRedirect('/settings')).not.toThrow();
    expect(consumePendingSignInRedirect()).toBe('/');

    vi.stubGlobal('window', undefined);
    expect(() => storePendingSignInRedirect('/settings')).not.toThrow();
    expect(consumePendingSignInRedirect()).toBe('/');
  });
});
