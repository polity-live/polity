import { describe, expect, it } from 'vitest';

import { resolveRouteVisibilityAccess } from '../routeVisibilityAccess';

describe('routeVisibilityAccess', () => {
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
