import { describe, expect, it } from 'vitest';

import { tutorialRouteMatches } from '../tutorialRoute';

describe('tutorialRouteMatches', () => {
  it('accepts route-owned search parameters when the checkpoint only requires the path', () => {
    expect(
      tutorialRouteMatches(
        '/amendment/amendment-1/process?branch=branch-1',
        '/amendment/amendment-1/process'
      )
    ).toBe(true);
  });

  it('requires every search parameter explicitly declared by the checkpoint', () => {
    expect(tutorialRouteMatches('/settings?tab=ai&section=skills', '/settings?tab=ai')).toBe(true);
    expect(tutorialRouteMatches('/settings?tab=profile', '/settings?tab=ai')).toBe(false);
  });

  it('rejects a different path', () => {
    expect(tutorialRouteMatches('/home?tab=ai', '/settings?tab=ai')).toBe(false);
  });
});
