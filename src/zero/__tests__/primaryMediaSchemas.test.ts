import { describe, expect, it } from 'vitest';

import { updateAmendmentSchema } from '../amendments/schema';
import { updateBlogSchema } from '../blogs/schema';
import { eventUpdateSchema } from '../events/schema';
import { groupUpdateSchema } from '../groups/schema';
import { userUpdateSchema } from '../users/schema';
import { normalizeUserPrimaryMediaUpdate } from '../shared/primaryMedia';

const updateSchemas = [
  ['amendment', updateAmendmentSchema],
  ['blog', updateBlogSchema],
  ['event', eventUpdateSchema],
  ['group', groupUpdateSchema],
] as const;

describe.each(updateSchemas)('%s primary media schema', (_entityType, schema) => {
  it('accepts an image or a video', () => {
    expect(
      schema.safeParse({ id: 'entity-id', image_url: 'image.jpg', video_url: null }).success
    ).toBe(true);
    expect(
      schema.safeParse({ id: 'entity-id', image_url: null, video_url: 'video.mp4' }).success
    ).toBe(true);
  });

  it('rejects an image and video together', () => {
    const result = schema.safeParse({
      id: 'entity-id',
      image_url: 'image.jpg',
      video_url: 'video.mp4',
    });

    expect(result.success).toBe(false);
  });
});

describe('user primary media schema', () => {
  it('accepts an avatar or a video', () => {
    expect(userUpdateSchema.safeParse({ avatar: 'avatar.jpg', video_url: null }).success).toBe(
      true
    );
    expect(userUpdateSchema.safeParse({ avatar: null, video_url: 'video.mp4' }).success).toBe(true);
  });

  it('rejects an avatar and video together', () => {
    expect(
      userUpdateSchema.safeParse({ avatar: 'avatar.jpg', video_url: 'video.mp4' }).success
    ).toBe(false);
  });

  it('normalizes empty values and clears the opposite user medium', () => {
    expect(normalizeUserPrimaryMediaUpdate({ avatar: '', video_url: 'video.mp4' })).toEqual({
      avatar: null,
      video_url: 'video.mp4',
    });
    expect(normalizeUserPrimaryMediaUpdate({ avatar: 'avatar.jpg' })).toEqual({
      avatar: 'avatar.jpg',
      video_url: null,
    });
  });
});
