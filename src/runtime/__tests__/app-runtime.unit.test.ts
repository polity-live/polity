import { describe, expect, it } from 'vitest';
import { shouldUsePublicRuntime } from '../app-runtime';

describe('shouldUsePublicRuntime', () => {
  it('bypasses the connected runtime for anonymous visits to the public root', () => {
    expect(shouldUsePublicRuntime('/', false)).toBe(true);
  });

  it('switches authenticated root visits to the connected runtime', () => {
    expect(shouldUsePublicRuntime('/', true)).toBe(false);
  });

  it('keeps guest entity and authentication routes on the connected runtime', () => {
    expect(shouldUsePublicRuntime('/group/public-group', false)).toBe(false);
    expect(shouldUsePublicRuntime('/event/public-event', false)).toBe(false);
    expect(shouldUsePublicRuntime('/amendment/public-amendment', false)).toBe(false);
    expect(shouldUsePublicRuntime('/auth/sign-in', false)).toBe(false);
  });
});
