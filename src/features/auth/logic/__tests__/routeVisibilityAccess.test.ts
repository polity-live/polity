import { describe, expect, it } from 'vitest';

import {
  getEffectiveRouteVisibility,
  normalizeRouteVisibility,
  resolveRouteVisibilityAccess,
} from '../routeVisibilityAccess';

describe('routeVisibilityAccess', () => {
  it('normalizes absent and known values while failing closed for unknown values', () => {
    expect(normalizeRouteVisibility(null)).toBe('public');
    expect(normalizeRouteVisibility('public')).toBe('public');
    expect(normalizeRouteVisibility('authenticated')).toBe('authenticated');
    expect(normalizeRouteVisibility('private')).toBe('private');
    expect(normalizeRouteVisibility('legacy')).toBe('private');
  });

  it('selects the most restrictive visibility independent of input order', () => {
    expect(getEffectiveRouteVisibility([])).toBe('public');
    expect(getEffectiveRouteVisibility(['public', 'authenticated'])).toBe('authenticated');
    expect(getEffectiveRouteVisibility(['authenticated', 'public'])).toBe('authenticated');
    expect(getEffectiveRouteVisibility(['private', 'authenticated'])).toBe('private');
    expect(getEffectiveRouteVisibility(['authenticated', 'private'])).toBe('private');
  });

  it('allows public routes and authenticated routes with a session', () => {
    expect(resolveRouteVisibilityAccess(['public'], false)).toEqual({
      allowed: true,
      visibility: 'public',
    });
    expect(resolveRouteVisibilityAccess(['authenticated'], true)).toEqual({
      allowed: true,
      reason: undefined,
      visibility: 'authenticated',
    });
  });

  it('denies private routes without explicit private access', () => {
    expect(resolveRouteVisibilityAccess(['private'], true)).toEqual({
      allowed: false,
      reason: 'private',
      visibility: 'private',
    });
  });

  it('allows private routes when the caller has private access', () => {
    expect(resolveRouteVisibilityAccess(['private'], true, true)).toEqual({
      allowed: true,
      reason: undefined,
      visibility: 'private',
    });
  });

  it('still requires authentication for authenticated routes', () => {
    expect(resolveRouteVisibilityAccess(['authenticated'], false, true)).toEqual({
      allowed: false,
      reason: 'login-required',
      visibility: 'authenticated',
    });
  });
});
