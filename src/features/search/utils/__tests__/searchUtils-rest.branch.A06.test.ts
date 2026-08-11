import { describe, expect, it } from 'vitest';

import {
  filterByQuery,
  getUserAvatar,
  getUserDisplayName,
  matchesHashtag,
  matchesUserQuery,
  sortResults,
} from '../searchUtils';

describe('search utils branch remainder', () => {
  it('covers hashtag junction precedence, invalid tags, and match alternatives', () => {
    expect(matchesHashtag({ user_hashtags: [] }, 'topic')).toBe(false);
    expect(
      matchesHashtag(
        {
          user_hashtags: undefined,
          group_hashtags: undefined,
          amendment_hashtags: undefined,
          event_hashtags: undefined,
          blog_hashtags: [{ hashtag: { id: '1', tag: 'BigTopic' } }],
        },
        'topic'
      )
    ).toBe(true);
    expect(matchesHashtag({ hashtags: [null, { id: 'bad', tag: '' }] } as never, 'topic')).toBe(
      false
    );
    expect(matchesHashtag({ hashtags: [{ id: '1', tag: 'exact' }] }, '#EXACT')).toBe(true);
  });

  it('covers null text and user display-name fallbacks', () => {
    expect(filterByQuery(null, 'q')).toBe(false);
    expect(filterByQuery(undefined, 'q')).toBe(false);
    expect(getUserDisplayName({ first_name: 'Ada' })).toBe('Ada');
    expect(getUserDisplayName({ name: 'Named' })).toBe('Named');
    expect(getUserDisplayName({ handle: 'handled' })).toBe('handled');
    expect(getUserDisplayName(undefined)).toBe('');
  });

  it('covers every avatar fallback', () => {
    expect(getUserAvatar({ avatar: 'a', avatarUrl: 'b', imageURL: 'c' })).toBe('a');
    expect(getUserAvatar({ avatarUrl: 'b', imageURL: 'c' })).toBe('b');
    expect(getUserAvatar({ imageURL: 'c', avatarFile: { url: 'd' } })).toBe('c');
    expect(getUserAvatar({ avatarFile: { url: 'd' } })).toBe('d');
    expect(getUserAvatar({ avatarFile: null })).toBe('');
    expect(getUserAvatar(undefined)).toBe('');
  });

  it('covers empty and contact-location user searches', () => {
    expect(matchesUserQuery(undefined, '')).toBe(true);
    expect(matchesUserQuery({ contactLocation: 'Berlin' }, 'ber')).toBe(true);
    expect(matchesUserQuery(null, 'missing')).toBe(false);
  });

  it('covers all date and title sorting fallbacks without mutating input', () => {
    const items = [
      { id: 'epoch' },
      { id: 'joined', joined_at: '2024-01-01' },
      { id: 'dated', date: '2024-02-01' },
      { id: 'created', created_at: '2024-03-01' },
    ];
    expect(sortResults(items, 'date').map(item => item.id)).toEqual([
      'created',
      'dated',
      'joined',
      'epoch',
    ]);
    expect(items[0].id).toBe('epoch');
    expect(
      sortResults([{ id: 'created', created_at: '2024-03-01' }, { id: 'epoch' }], 'date')
    ).toHaveLength(2);
    expect(sortResults([{ title: 'B' }, { name: 'A' }, {}], 'title')).toEqual([
      {},
      { name: 'A' },
      { title: 'B' },
    ]);
    expect(sortResults([{}, { name: 'A' }], 'name')).toEqual([{}, { name: 'A' }]);
    expect(sortResults(items, 'other')).not.toBe(items);
  });
});
