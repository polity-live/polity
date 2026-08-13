import { beforeEach, describe, expect, it, vi } from 'vitest';

const common = vi.hoisted(() => {
  const names = [
    'addHashtag',
    'linkGroupHashtag',
    'linkEventHashtag',
    'linkAmendmentHashtag',
    'linkBlogHashtag',
    'linkStatementHashtag',
    'unlinkGroupHashtag',
    'unlinkEventHashtag',
    'unlinkAmendmentHashtag',
    'unlinkBlogHashtag',
    'unlinkStatementHashtag',
  ];
  return Object.fromEntries(names.map(name => [name, vi.fn()])) as Record<
    string,
    ReturnType<typeof vi.fn>
  >;
});

vi.mock('../../mutators', () => ({
  mutators: {
    common: Object.fromEntries(Object.entries(common).map(([name, fn]) => [name, { fn }])),
  },
}));

import {
  normalizeHashtagTags,
  syncEntityHashtagsForCreate,
  syncEntityHashtagsForUpdate,
} from '../server-hashtags';

beforeEach(() => vi.clearAllMocks());

describe('server hashtag branch parity', () => {
  it('normalizes absent, blank, duplicate, and padded tags', () => {
    expect(normalizeHashtagTags(undefined)).toEqual([]);
    expect(normalizeHashtagTags([' tag ', '', 'tag', 'other'])).toEqual(['tag', 'other']);
  });

  it.each([
    ['group', 'linkGroupHashtag'],
    ['event', 'linkEventHashtag'],
    ['amendment', 'linkAmendmentHashtag'],
    ['blog', 'linkBlogHashtag'],
    ['statement', 'linkStatementHashtag'],
  ] as const)(
    'creates canonical rows and %s junctions only when absent',
    async (entityType, linkName) => {
      const tx = { run: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null) };
      await syncEntityHashtagsForCreate(
        tx as never,
        { userID: 'user-1' } as never,
        entityType,
        `${entityType}-1`,
        ['new']
      );
      expect(common.addHashtag).toHaveBeenCalledOnce();
      expect(common[linkName]).toHaveBeenCalledOnce();

      vi.clearAllMocks();
      const existingTx = {
        run: vi
          .fn()
          .mockResolvedValueOnce({ id: 'existing-hashtag', tag: 'existing' })
          .mockResolvedValueOnce({ id: 'existing-link' }),
      };
      await syncEntityHashtagsForCreate(
        existingTx as never,
        { userID: 'user-1' } as never,
        entityType,
        `${entityType}-1`,
        ['existing']
      );
      expect(common.addHashtag).not.toHaveBeenCalled();
      expect(common[linkName]).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['group', 'unlinkGroupHashtag'],
    ['event', 'unlinkEventHashtag'],
    ['amendment', 'unlinkAmendmentHashtag'],
    ['blog', 'unlinkBlogHashtag'],
    ['statement', 'unlinkStatementHashtag'],
  ] as const)('loads and prunes stale %s junctions', async (entityType, unlinkName) => {
    const tx = {
      run: vi.fn().mockResolvedValueOnce([
        { id: 'missing-tag', hashtag_id: 'missing', hashtag: null },
        { id: 'stale-tag', hashtag_id: 'stale', hashtag: { id: 'stale', tag: 'stale' } },
        { id: 'kept-tag', hashtag_id: 'kept', hashtag: { id: 'kept', tag: 'kept' } },
      ]),
    };
    await syncEntityHashtagsForUpdate(
      tx as never,
      { userID: 'user-1' } as never,
      entityType,
      `${entityType}-1`,
      ['kept']
    );
    expect(common[unlinkName]).toHaveBeenCalledTimes(2);
  });
});
