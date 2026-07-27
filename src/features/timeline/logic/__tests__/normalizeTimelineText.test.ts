import { describe, expect, it } from 'vitest';
import { normalizeTimelineText } from '../normalizeTimelineText';

describe('normalizeTimelineText', () => {
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
});
