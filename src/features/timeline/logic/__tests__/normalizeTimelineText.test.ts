import { describe, expect, it } from 'vitest';
import { normalizeTimelineText } from '../normalizeTimelineText';

describe('normalizeTimelineText', () => {
  it('normalizes absent, blank, and non-empty strings', () => {
    expect(normalizeTimelineText(undefined)).toBeUndefined();
    expect(normalizeTimelineText(null)).toBeUndefined();
    expect(normalizeTimelineText('   ')).toBeUndefined();
    expect(normalizeTimelineText('  Timeline  ')).toBe('Timeline');
  });

  it('converts rich-text nodes into plain text', () => {
    expect(
      normalizeTimelineText([
        {
          type: 'p',
          children: [{ text: 'Line one' }],
        },
        {
          type: 'p',
          children: [{ text: 'Line two' }],
        },
      ])
    ).toBe('Line one\nLine two');
  });

  it('returns undefined for empty rich text', () => {
    expect(
      normalizeTimelineText([
        {
          type: 'p',
          children: [{ text: '' }],
        },
      ])
    ).toBeUndefined();
  });

  it('reads plain text from legacy JSON descriptions', () => {
    expect(
      normalizeTimelineText({
        city: 'Berlin',
        plain: '  Neighborhood planning meetup  ',
        venue: 'City Hall',
      })
    ).toBe('Neighborhood planning meetup');
  });

  it('rejects legacy objects without a usable plain string', () => {
    expect(normalizeTimelineText({ other: 'value' })).toBeUndefined();
    expect(normalizeTimelineText({ plain: 42 })).toBeUndefined();
    expect(normalizeTimelineText({ plain: '  ' })).toBeUndefined();
  });
});
