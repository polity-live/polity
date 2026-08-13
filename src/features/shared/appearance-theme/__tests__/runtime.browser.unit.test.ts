// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { POLITY_THEME } from '../presets';
import {
  APPEARANCE_THEME_CACHE_KEY,
  APPEARANCE_THEME_CSS_CACHE_KEY,
  APPEARANCE_THEME_STYLE_ID,
  applyAppearanceTheme,
  applyThemeMetadata,
  parseCachedAppearanceTheme,
} from '../runtime';

afterEach(() => {
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('data-appearance-theme');
  document.documentElement.removeAttribute('style');
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('appearance theme browser runtime', () => {
  it('creates and updates the runtime style and caches its payload', () => {
    applyAppearanceTheme(POLITY_THEME);

    const style = document.getElementById(APPEARANCE_THEME_STYLE_ID);
    expect(style).toBeTruthy();
    expect(style?.textContent).toContain('--badge-success-bg');
    expect(document.documentElement.dataset.appearanceTheme).toBe(POLITY_THEME.slug);
    expect(localStorage.getItem(APPEARANCE_THEME_CACHE_KEY)).toBe(JSON.stringify(POLITY_THEME));
    expect(localStorage.getItem(APPEARANCE_THEME_CSS_CACHE_KEY)).toBe(style?.textContent);

    applyAppearanceTheme({ ...POLITY_THEME, slug: 'updated' });
    expect(document.querySelectorAll(`#${APPEARANCE_THEME_STYLE_ID}`)).toHaveLength(1);
    expect(document.documentElement.dataset.appearanceTheme).toBe('updated');
  });

  it('still applies a theme when browser storage rejects writes', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    applyAppearanceTheme(POLITY_THEME);

    expect(document.getElementById(APPEARANCE_THEME_STYLE_ID)).toBeTruthy();
    expect(error).toHaveBeenCalledWith('Failed to cache appearance theme:', expect.any(Error));
  });

  it('creates and reuses metadata for dark and light modes', () => {
    applyThemeMetadata(true, POLITY_THEME);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
      'dark'
    );
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      POLITY_THEME.dark.background
    );

    applyThemeMetadata(false, POLITY_THEME);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelectorAll('meta[name="color-scheme"]')).toHaveLength(1);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      POLITY_THEME.light.background
    );
  });

  it('parses only complete cached themes', () => {
    expect(parseCachedAppearanceTheme(null)).toBeNull();
    expect(parseCachedAppearanceTheme('')).toBeNull();
    expect(parseCachedAppearanceTheme('{')).toBeNull();
    expect(parseCachedAppearanceTheme('null')).toBeNull();
    expect(parseCachedAppearanceTheme('{}')).toBeNull();
    expect(parseCachedAppearanceTheme('{"id":"x"}')).toBeNull();
    expect(parseCachedAppearanceTheme('{"id":"x","light":{}}')).toBeNull();
    expect(parseCachedAppearanceTheme('{"id":"x","light":{},"dark":{}}')).toBeNull();
    expect(parseCachedAppearanceTheme(JSON.stringify(POLITY_THEME))).toEqual(POLITY_THEME);
  });
});
