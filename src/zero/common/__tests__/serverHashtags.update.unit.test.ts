import { beforeEach, describe, expect, it, vi } from 'vitest';

const commonMutators = vi.hoisted(() => ({
  addHashtag: vi.fn(),
  linkGroupHashtag: vi.fn(),
  unlinkGroupHashtag: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    common: {
      addHashtag: { fn: commonMutators.addHashtag },
      linkGroupHashtag: { fn: commonMutators.linkGroupHashtag },
      unlinkGroupHashtag: { fn: commonMutators.unlinkGroupHashtag },
    },
  },
}));

import { syncEntityHashtagsForUpdate } from '../server-hashtags';

describe('syncEntityHashtagsForUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes stale links, preserves existing tags and adds only new tags', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce([
          { id: 'link-keep', hashtag_id: 'tag-keep', hashtag: { id: 'tag-keep', tag: 'keep' } },
          { id: 'link-old', hashtag_id: 'tag-old', hashtag: { id: 'tag-old', tag: 'old' } },
        ])
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };
    const ctx = { userID: 'user-1', email: '' };

    await syncEntityHashtagsForUpdate(tx as never, ctx as never, 'group', 'group-1', [
      'keep',
      'new',
      'new',
    ]);

    expect(commonMutators.unlinkGroupHashtag).toHaveBeenCalledWith(
      expect.objectContaining({ args: { id: 'link-old' } })
    );
    expect(commonMutators.unlinkGroupHashtag).not.toHaveBeenCalledWith(
      expect.objectContaining({ args: { id: 'link-keep' } })
    );
    expect(commonMutators.addHashtag).toHaveBeenCalledTimes(1);
    expect(commonMutators.addHashtag).toHaveBeenCalledWith(
      expect.objectContaining({ args: expect.objectContaining({ tag: 'new' }) })
    );
    expect(commonMutators.linkGroupHashtag).toHaveBeenCalledTimes(1);
  });
});
