import { describe, expect, it } from 'vitest';

import {
  EMPTY_RICH_TEXT_VALUE,
  hasRichTextContent,
  richTextToPlainText,
  toRichTextValue,
  toZeroRichTextValue,
} from '../richText';

describe('rich text normalization', () => {
  it('sanitizes structured arrays, leaves text nodes, and repairs invalid nodes', () => {
    expect(
      toRichTextValue([
        { type: 'p', children: [{ text: 'Hello' }] },
        { type: 'p', children: [] },
        { type: 'p' },
        'invalid',
      ])
    ).toEqual([
      { type: 'p', children: [{ text: 'Hello' }] },
      { type: 'p', children: [{ text: '' }] },
      { type: 'p', children: [{ text: '' }] },
      { type: 'p', children: [{ text: '' }] },
    ]);
  });

  it('parses JSON arrays and falls back for empty, invalid, and non-array JSON', () => {
    expect(toRichTextValue('[{"type":"p","children":[{"text":"JSON"}]}]')).toHaveLength(1);
    expect(toRichTextValue('[]')).toBe(EMPTY_RICH_TEXT_VALUE);
    expect(toRichTextValue('{')).toEqual([{ type: 'p', children: [{ text: '{' }] }]);
    expect(toRichTextValue('"plain"')).toEqual([{ type: 'p', children: [{ text: '"plain"' }] }]);
    expect(toRichTextValue(null)).toBe(EMPTY_RICH_TEXT_VALUE);
  });

  it('converts normalized plain text paragraphs and empty text', () => {
    expect(toRichTextValue(' First\r\n\r\n Second ')).toEqual([
      { type: 'p', children: [{ text: 'First' }] },
      { type: 'p', children: [{ text: 'Second' }] },
    ]);
    expect(toRichTextValue('   ')).toBe(EMPTY_RICH_TEXT_VALUE);
  });

  it('extracts text recursively and normalizes excess line breaks', () => {
    const value = [
      { type: 'p', children: [{ text: 'First' }, { bold: true }] },
      { type: 'p', children: [{ text: 'Second' }] },
      null,
    ];
    expect(richTextToPlainText(value)).toBe('First\nSecond');
    expect(richTextToPlainText('  plain  ')).toBe('plain');
    expect(richTextToPlainText({ unknown: true })).toBe('');
    expect(hasRichTextContent(value)).toBe(true);
    expect(hasRichTextContent(null)).toBe(false);
  });

  it('converts editor values to mutable Zero JSON', () => {
    expect(toZeroRichTextValue([{ type: 'p', children: [{ text: 'Saved' }] }])).toEqual([
      { type: 'p', children: [{ text: 'Saved' }] },
    ]);
  });
});
