export type SearchSortOption = 'recent' | 'engagement' | 'trending';
export type SearchDirection = 'forward' | 'backward';
export type SearchEngagementFilter = 'all' | 'popular' | 'rising' | 'discussed';

export interface SearchBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SearchStart {
  id: string;
  created_at: number;
  engagement_score?: number;
  trending_score?: number;
}

export interface SearchListContext {
  query: string;
  types: string[];
  topics: string[];
  createdAfter: number | null;
  engagement: SearchEngagementFilter;
  sort: SearchSortOption;
  snapshotAt: number | null;
  bounds?: SearchBounds | null;
}

/** Keep the serialized request identical for visible pages and their preloads. */
export function searchDocumentPageArgs(
  context: SearchListContext,
  page: { limit: number; start: SearchStart | null; dir: SearchDirection }
) {
  return {
    query: context.query,
    types: context.types,
    topics: context.topics,
    createdAfter: context.createdAfter,
    engagement: context.engagement,
    sort: context.sort,
    snapshotAt: context.snapshotAt,
    limit: page.limit,
    start: page.start,
    dir: page.dir,
    bounds: context.bounds ?? null,
  };
}

export function normalizeSearchQuery(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[%_*?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function tokenizeSearchQuery(input: string): string[] {
  return normalizeSearchQuery(input).split(' ').filter(Boolean);
}

export function searchPattern(input: string): string {
  const tokens = tokenizeSearchQuery(input);
  return tokens.length > 0 ? `%${tokens.join('%')}%` : '';
}

export function prefixPattern(input: string): string {
  const normalized = normalizeSearchQuery(input);
  return normalized ? `${normalized}%` : '';
}

export function searchSortField(
  sort: SearchSortOption
): 'created_at' | 'engagement_score' | 'trending_score' {
  if (sort === 'engagement') return 'engagement_score';
  if (sort === 'trending') return 'trending_score';
  return 'created_at';
}

export function sortDirection(dir: SearchDirection): 'asc' | 'desc' {
  return dir === 'forward' ? 'desc' : 'asc';
}

export function searchStartRow(
  start: SearchStart | null | undefined,
  sort: SearchSortOption
): Partial<SearchStart> | null {
  if (!start) return null;
  if (sort === 'engagement') {
    return {
      engagement_score: start.engagement_score ?? 0,
      created_at: start.created_at,
      id: start.id,
    };
  }
  if (sort === 'trending') {
    return {
      trending_score: start.trending_score ?? 0,
      created_at: start.created_at,
      id: start.id,
    };
  }
  return {
    created_at: start.created_at,
    id: start.id,
  };
}
