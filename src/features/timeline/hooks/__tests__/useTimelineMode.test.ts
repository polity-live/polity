import { describe, expect, it } from 'vitest';
import { normalizeTimelineMode } from '../useTimelineMode';

describe('normalizeTimelineMode', () => {
  it('migrates the legacy subscribed mode to timeline', () => {
    expect(normalizeTimelineMode('subscribed')).toBe('timeline');
  });

  it('keeps supported timeline modes and rejects unknown values', () => {
    expect(normalizeTimelineMode('timeline')).toBe('timeline');
    expect(normalizeTimelineMode('decisions')).toBe('decisions');
    expect(normalizeTimelineMode('explore')).toBeNull();
  });
});
