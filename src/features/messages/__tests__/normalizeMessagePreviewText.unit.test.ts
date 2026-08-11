import { describe, expect, it } from 'vitest';
import { normalizeMessagePreviewText } from '../logic/normalizeMessagePreviewText';

describe('normalizeMessagePreviewText', () => {
  it('converts rich-text nodes into plain text for link previews', () => {
    expect(
      normalizeMessagePreviewText([
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

  it('returns undefined for empty values', () => {
    expect(normalizeMessagePreviewText(undefined)).toBeUndefined();
    expect(normalizeMessagePreviewText(null)).toBeUndefined();
    expect(normalizeMessagePreviewText('   ')).toBeUndefined();
    expect(
      normalizeMessagePreviewText([
        {
          type: 'p',
          children: [{ text: '' }],
        },
      ])
    ).toBeUndefined();
  });

  it('trims non-empty plain strings', () => {
    expect(normalizeMessagePreviewText('  Preview  ')).toBe('Preview');
  });
});
