import { describe, expect, it } from 'vitest';

import {
  getOpenChangeRequestVisibilityScope,
  getResolvedChangeRequestVisibilityScope,
  isEventChangeRequestMode,
  normalizeInternalChangeRequestResolutionVisibility,
} from '../visibility';

describe('change-request visibility', () => {
  it.each([
    ['suggest_event', true],
    ['event_final_closing_vote', true],
    ['edit', false],
    ['suggest_internal', false],
  ] as const)('recognizes whether %s is an event mode', (mode, expected) => {
    expect(isEventChangeRequestMode(mode)).toBe(expected);
  });

  it('normalizes internal visibility and chooses the open scope by creation mode', () => {
    expect(normalizeInternalChangeRequestResolutionVisibility('collaborators')).toBe(
      'collaborators'
    );
    expect(normalizeInternalChangeRequestResolutionVisibility('public')).toBe('public');
    expect(normalizeInternalChangeRequestResolutionVisibility(null)).toBe('public');
    expect(getOpenChangeRequestVisibilityScope('suggest_event')).toBe('public');
    expect(getOpenChangeRequestVisibilityScope('edit')).toBe('collaborators');
  });

  it('always exposes event resolutions and normalizes internal resolutions', () => {
    expect(
      getResolvedChangeRequestVisibilityScope({
        resolvedInMode: 'event_final_closing_vote',
        internalResolutionVisibility: 'collaborators',
      })
    ).toBe('public');
    expect(
      getResolvedChangeRequestVisibilityScope({
        resolvedInMode: 'suggest_internal',
        internalResolutionVisibility: 'collaborators',
      })
    ).toBe('collaborators');
    expect(
      getResolvedChangeRequestVisibilityScope({
        resolvedInMode: 'edit',
      })
    ).toBe('public');
  });
});
