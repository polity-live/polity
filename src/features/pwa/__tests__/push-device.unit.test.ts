/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPushDeviceId,
  isIosDevice,
  isStandalonePwa,
  requiresIosHomeScreenInstall,
} from '../push-device';

describe('push device identity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps a stable device id across calls', () => {
    const first = getPushDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(getPushDeviceId()).toBe(first);
  });

  it('returns safe defaults without browser globals', () => {
    vi.stubGlobal('window', undefined);
    expect(getPushDeviceId()).toBeNull();
    expect(isStandalonePwa()).toBe(false);
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', undefined);
    expect(isIosDevice()).toBe(false);
  });

  it('detects native and desktop-class iOS devices', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    expect(isIosDevice()).toBe(true);

    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Desktop' });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 2 });
    expect(isIosDevice()).toBe(true);

    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    expect(isIosDevice()).toBe(false);
  });

  it('detects both standard and iOS standalone modes and install requirements', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    expect(isStandalonePwa()).toBe(true);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    expect(isStandalonePwa()).toBe(true);

    Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
    expect(requiresIosHomeScreenInstall()).toBe(true);
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Desktop' });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    expect(requiresIosHomeScreenInstall()).toBe(false);
  });
});
