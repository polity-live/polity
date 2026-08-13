import { describe, expect, it } from 'vitest';

import { SEARCH_CARD_GRADIENTS } from '../search-card-gradients';

describe('SEARCH_CARD_GRADIENTS', () => {
  it('defines a non-empty theme gradient for every searchable entity', () => {
    expect(Object.keys(SEARCH_CARD_GRADIENTS).sort()).toEqual(
      ['amendment', 'blog', 'event', 'group', 'user'].sort()
    );
    for (const gradient of Object.values(SEARCH_CARD_GRADIENTS)) {
      expect(gradient).not.toBe('');
    }
  });
});
