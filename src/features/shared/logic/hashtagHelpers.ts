/**
 * Consolidated hashtag helper functions.
 * Re-exports from zero/common/hashtagHelpers + adds text parsing utilities.
 */

export { extractHashtags, extractHashtagTags } from '@/zero/common/hashtagHelpers';

export const HASHTAG_BADGE_GRADIENTS = [
  'bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-700 dark:to-rose-600',
  'bg-gradient-to-r from-violet-500 to-purple-400 dark:from-violet-700 dark:to-purple-600',
  'bg-gradient-to-r from-blue-500 to-cyan-400 dark:from-blue-700 dark:to-cyan-600',
  'bg-gradient-to-r from-teal-500 to-emerald-400 dark:from-teal-700 dark:to-emerald-600',
  'bg-gradient-to-r from-green-500 to-lime-400 dark:from-green-700 dark:to-lime-600',
  'bg-gradient-to-r from-amber-500 to-yellow-400 dark:from-amber-700 dark:to-yellow-600',
  'bg-gradient-to-r from-orange-500 to-red-400 dark:from-orange-700 dark:to-red-600',
  'bg-gradient-to-r from-fuchsia-500 to-pink-400 dark:from-fuchsia-700 dark:to-pink-600',
  'bg-gradient-to-r from-indigo-500 to-blue-400 dark:from-indigo-700 dark:to-blue-600',
  'bg-gradient-to-r from-cyan-500 to-teal-400 dark:from-cyan-700 dark:to-teal-600',
  'bg-gradient-to-r from-emerald-500 to-green-400 dark:from-emerald-700 dark:to-green-600',
  'bg-gradient-to-r from-rose-500 to-orange-400 dark:from-rose-700 dark:to-orange-600',
  'bg-gradient-to-r from-sky-500 to-indigo-400 dark:from-sky-700 dark:to-indigo-600',
  'bg-gradient-to-r from-lime-500 to-emerald-400 dark:from-lime-700 dark:to-emerald-600',
  'bg-gradient-to-r from-red-500 to-pink-400 dark:from-red-700 dark:to-pink-600',
] as const;

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
