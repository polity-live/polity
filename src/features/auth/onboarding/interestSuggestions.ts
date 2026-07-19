export const INTEREST_SUGGESTION_LIMIT = 10;

export interface HashtagUsageRow {
  tag?: string | null;
  user_hashtags?: readonly unknown[];
  group_hashtags?: readonly unknown[];
  amendment_hashtags?: readonly unknown[];
  event_hashtags?: readonly unknown[];
  blog_hashtags?: readonly unknown[];
  statement_hashtags?: readonly unknown[];
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/^#/, '');
}

function usageCount(row: HashtagUsageRow) {
  return (
    (row.user_hashtags?.length ?? 0) +
    (row.group_hashtags?.length ?? 0) +
    (row.amendment_hashtags?.length ?? 0) +
    (row.event_hashtags?.length ?? 0) +
    (row.blog_hashtags?.length ?? 0) +
    (row.statement_hashtags?.length ?? 0)
  );
}

/** Returns the most-used canonical hashtags available through the Zero query. */
export function rankInterestSuggestions(
  hashtags: readonly HashtagUsageRow[],
  limit = INTEREST_SUGGESTION_LIMIT
) {
  const ranked = new Map<string, { tag: string; count: number }>();

  for (const hashtag of hashtags) {
    if (!hashtag.tag) continue;

    const tag = normalizeTag(hashtag.tag);
    if (!tag) continue;

    const key = tag.toLocaleLowerCase();
    const current = ranked.get(key);
    const count = usageCount(hashtag);

    if (current) {
      current.count += count;
    } else {
      ranked.set(key, { tag, count });
    }
  }

  return Array.from(ranked.values())
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.tag.localeCompare(right.tag, undefined, { sensitivity: 'accent' })
    )
    .slice(0, limit)
    .map(({ tag }) => tag);
}

/** Completes database recommendations with localized defaults, without duplicates. */
export function completeInterestSuggestions(
  suggestedTags: readonly string[],
  fallbackTags: readonly string[],
  limit = INTEREST_SUGGESTION_LIMIT
) {
  const seen = new Set<string>();

  return [...suggestedTags, ...fallbackTags]
    .map(normalizeTag)
    .filter(tag => {
      const key = tag.toLocaleLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
