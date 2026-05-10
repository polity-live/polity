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
});
