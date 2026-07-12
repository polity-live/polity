export interface PrimaryMediaFields {
  image_url?: string | null;
  video_url?: string | null;
}

export const primaryMediaValidationMessage = 'Only one primary image or video may be set';

export function hasExclusivePrimaryMedia(value: PrimaryMediaFields): boolean {
  return value.image_url == null || value.video_url == null;
}

export interface UserPrimaryMediaFields {
  avatar?: string | null;
  video_url?: string | null;
}

export function hasExclusiveUserPrimaryMedia(value: UserPrimaryMediaFields): boolean {
  return value.avatar == null || value.video_url == null;
}

export function normalizeUserPrimaryMediaUpdate<T extends UserPrimaryMediaFields>(value: T): T {
  const avatar = value.avatar === '' ? null : value.avatar;
  const videoUrl = value.video_url === '' ? null : value.video_url;

  return {
    ...value,
    ...(value.avatar !== undefined && { avatar }),
    ...(value.video_url !== undefined && { video_url: videoUrl }),
    ...(avatar && { video_url: null }),
    ...(videoUrl && { avatar: null }),
  };
}
