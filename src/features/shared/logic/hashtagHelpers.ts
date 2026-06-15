/**
 * Consolidated hashtag helper functions.
 * Re-exports from zero/common/hashtagHelpers + adds text parsing utilities.
 */

import { getHashtagToneClasses } from '@/features/shared/theme';

export { extractHashtags, extractHashtagTags } from '@/zero/common/hashtagHelpers';

export const HASHTAG_BADGE_GRADIENTS = [getHashtagToneClasses().badge] as const;

export function getHashtagGradient(tag: string): string {
  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) {
    const char = tag.charCodeAt(index);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }

  return HASHTAG_BADGE_GRADIENTS[Math.abs(hash) % HASHTAG_BADGE_GRADIENTS.length];
}

/**
 * Parse #hashtag tokens from raw text (e.g. statement text).
 * Returns an array of tag strings (without the # prefix).
 */
export function parseHashtagsFromText(text: string): string[] {
  if (!text) return [];
  const regex = /(?:^|(?<=\s))#([\w-]+)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const tag = match[1];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}
