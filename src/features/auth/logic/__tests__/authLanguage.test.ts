import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  consumePendingGoogleLanguage,
  normalizeAuthLanguage,
  storePendingGoogleLanguage,
} from '../authLanguage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth language persistence', () => {
  it('normalizes German explicitly and every other input to English', () => {
    expect(normalizeAuthLanguage('de')).toBe('de');
    expect(normalizeAuthLanguage('en')).toBe('en');
    expect(normalizeAuthLanguage(undefined)).toBe('en');
  });

  it('is a no-op during server rendering', () => {
    vi.stubGlobal('window', undefined);
    expect(storePendingGoogleLanguage('de')).toBeUndefined();
    expect(consumePendingGoogleLanguage()).toBeNull();
  });

  it.each([
    ['de', 'de'],
    ['en', 'en'],
    ['fr', null],
    [null, null],
  ] as const)('consumes and removes a stored %s language once', (stored, expected) => {
    const sessionStorage = {
      getItem: vi.fn().mockReturnValue(stored),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('window', { sessionStorage });

    storePendingGoogleLanguage('de');
    expect(sessionStorage.setItem).toHaveBeenCalledWith('polity_pending_google_language', 'de');
    expect(consumePendingGoogleLanguage()).toBe(expected);
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('polity_pending_google_language');
  });
});
