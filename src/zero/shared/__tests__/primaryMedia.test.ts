import { describe, expect, it } from 'vitest';

import {
  hasExclusivePrimaryMedia,
  hasExclusiveUserPrimaryMedia,
  normalizeUserPrimaryMediaUpdate,
} from '../primaryMedia';

describe('primary media helpers', () => {
  it('requires image/video and avatar/video exclusivity', () => {
    expect(hasExclusivePrimaryMedia({})).toBe(true);
    expect(hasExclusivePrimaryMedia({ image_url: 'image', video_url: null })).toBe(true);
    expect(hasExclusivePrimaryMedia({ image_url: 'image', video_url: 'video' })).toBe(false);
    expect(hasExclusiveUserPrimaryMedia({})).toBe(true);
    expect(hasExclusiveUserPrimaryMedia({ avatar: 'avatar', video_url: null })).toBe(true);
    expect(hasExclusiveUserPrimaryMedia({ avatar: 'avatar', video_url: 'video' })).toBe(false);
  });

  it('normalizes empty and mutually exclusive updates', () => {
    expect(normalizeUserPrimaryMediaUpdate({ extra: 1 } as never)).toEqual({ extra: 1 });
    expect(normalizeUserPrimaryMediaUpdate({ avatar: '', video_url: '' })).toEqual({
      avatar: null,
      video_url: null,
    });
    expect(normalizeUserPrimaryMediaUpdate({ avatar: 'avatar' })).toEqual({
      avatar: 'avatar',
      video_url: null,
    });
    expect(normalizeUserPrimaryMediaUpdate({ video_url: 'video' })).toEqual({
      avatar: null,
      video_url: 'video',
    });
  });
});
