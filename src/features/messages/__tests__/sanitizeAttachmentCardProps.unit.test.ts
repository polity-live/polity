import { describe, expect, it } from 'vitest';
import { sanitizeAttachmentCardProps } from '../logic/sanitizeAttachmentCardProps';

describe('sanitizeAttachmentCardProps', () => {
  it('preserves absent, null, string, numeric, and boolean text-like values', () => {
    expect(
      sanitizeAttachmentCardProps({
        description: undefined,
        excerpt: null,
        content: 'text',
        bio: 42,
        question: false,
        untouched: 7,
      })
    ).toEqual({
      description: undefined,
      excerpt: null,
      content: 'text',
      bio: '42',
      question: 'false',
      untouched: 7,
    });
  });

  it('normalizes nested rich-text descriptions before timeline cards render', () => {
    const sanitized = sanitizeAttachmentCardProps({
      group: {
        id: 'group-1',
        name: 'Group',
        description: [
          {
            type: 'p',
            children: [{ text: 'Line one' }],
          },
          {
            type: 'p',
            children: [{ text: 'Line two' }],
          },
        ],
        hashtags: [{ id: 'tag-1', tag: 'civic' }],
      },
    });

    expect(sanitized).toEqual({
      group: {
        id: 'group-1',
        name: 'Group',
        description: 'Line one\nLine two',
        hashtags: [{ id: 'tag-1', tag: 'civic' }],
      },
    });
  });

  it('turns empty rich text into null and recursively sanitizes arrays', () => {
    expect(
      sanitizeAttachmentCardProps({
        cards: [{ caption: [{ type: 'p', children: [{ text: '' }] }] }],
      })
    ).toEqual({ cards: [{ caption: null }] });
  });
});
