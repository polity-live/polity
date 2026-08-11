import { describe, expect, it } from 'vitest';

import { parseHashtags, parseMentions, tokenizeText } from '../mentionHelpers';

describe('mention helpers', () => {
  it('parses mentions and hashtags only at token boundaries', () => {
    expect(parseMentions('@ada text mail@example.test @grace-hopper')).toEqual([
      { type: 'mention', value: 'ada', start: 0, end: 4 },
      { type: 'mention', value: 'grace-hopper', start: 28, end: 41 },
    ]);
    expect(parseHashtags('#climate text value#ignored #public-transport')).toEqual([
      { type: 'hashtag', value: 'climate', start: 0, end: 8 },
      { type: 'hashtag', value: 'public-transport', start: 28, end: 45 },
    ]);
  });

  it('tokenizes leading, adjacent, intervening, and trailing text in source order', () => {
    expect(tokenizeText('Hi @ada #climate!')).toEqual([
      { type: 'text', value: 'Hi ', start: 0, end: 3 },
      { type: 'mention', value: 'ada', start: 3, end: 7, sortKey: 3 },
      { type: 'text', value: ' ', start: 7, end: 8 },
      { type: 'hashtag', value: 'climate', start: 8, end: 16, sortKey: 8 },
      { type: 'text', value: '!', start: 16, end: 17 },
    ]);
    expect(tokenizeText('@ada')).toEqual([
      { type: 'mention', value: 'ada', start: 0, end: 4, sortKey: 0 },
    ]);
    expect(tokenizeText('plain')).toEqual([{ type: 'text', value: 'plain', start: 0, end: 5 }]);
  });
});
