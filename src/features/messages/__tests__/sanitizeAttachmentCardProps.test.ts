import { describe, expect, it } from 'vitest';
import { sanitizeAttachmentCardProps } from '../logic/sanitizeAttachmentCardProps';

describe('sanitizeAttachmentCardProps', () => {
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
});
