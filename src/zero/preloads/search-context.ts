import type {
  DateRangeFilter,
  EngagementFilter,
  TimelineSortOption,
} from '@/features/timeline/hooks/useTimelineFilters';
import { ALL_CONTENT_TYPES } from '@/features/timeline/hooks/useTimelineFilters';
import type { ContentType } from '@/features/timeline/constants/content-type-config';

export interface SearchRoutePreloadParams {
  q?: string;
  types?: string;
  range?: DateRangeFilter;
  topics?: string;
  hashtag?: string;
  engagement?: EngagementFilter;
  sort?: TimelineSortOption;
}

interface SearchDocumentPagePreloadArgs {
  query: string;
  types: string[];
  topics: string[];
  createdAfter: number | null;
  engagement: EngagementFilter;
  sort: TimelineSortOption;
  snapshotAt: number | null;
  limit: number;
  start: null;
  dir: 'forward' | 'backward';
  bounds: null;
}

export const HOME_DISCOVER_SEARCH_ARGS: SearchDocumentPagePreloadArgs = {
  query: '',
  types: ['event', 'amendment', 'group', 'blog', 'statement', 'election'],
  topics: [],
  createdAfter: null,
  engagement: 'all',
  sort: 'trending',
  snapshotAt: null,
  limit: 60,
  start: null,
  dir: 'forward',
  bounds: null,
};

export const DEFAULT_SEARCH_PAGE_ARGS: SearchDocumentPagePreloadArgs = {
  query: '',
  types: [],
  topics: [],
  createdAfter: null,
  engagement: 'all',
  sort: 'recent',
  snapshotAt: null,
  limit: 60,
  start: null,
  dir: 'forward',
  bounds: null,
};

function createdAfterForRange(range?: DateRangeFilter): number | null {
  const now = new Date();

  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  if (range === 'week') return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (range === 'month') return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  if (range === 'year') return now.getTime() - 365 * 24 * 60 * 60 * 1000;

  return null;
}

function parseContentTypes(typesParam?: string): ContentType[] {
  if (!typesParam) return [];

  const parsed = typesParam
    .split(',')
    .map(type => type.trim())
    .filter((type): type is ContentType => ALL_CONTENT_TYPES.includes(type as ContentType));

  return parsed.length === ALL_CONTENT_TYPES.length ? [] : parsed;
}

function parseTopics(topicsParam?: string, hashtagParam?: string): string[] {
  const topics = topicsParam
    ? topicsParam
        .split(',')
        .map(topic => topic.trim())
        .filter(Boolean)
    : [];

  if (hashtagParam && !topics.includes(hashtagParam)) {
    topics.push(hashtagParam);
  }

  return topics;
}

function normalizeEngagement(engagement?: EngagementFilter): EngagementFilter {
  return engagement === 'popular' || engagement === 'rising' || engagement === 'discussed'
    ? engagement
    : 'all';
}

function normalizeSort(sort?: TimelineSortOption): TimelineSortOption {
  return sort === 'trending' || sort === 'engagement' ? sort : 'recent';
}

export function createSearchDocumentPageArgs(
  search: SearchRoutePreloadParams
): SearchDocumentPagePreloadArgs {
  return {
    query: search.q ?? '',
    types: parseContentTypes(search.types),
    topics: parseTopics(search.topics, search.hashtag),
    createdAfter: createdAfterForRange(search.range),
    engagement: normalizeEngagement(search.engagement),
    sort: normalizeSort(search.sort),
    snapshotAt: null,
    limit: 60,
    start: null,
    dir: 'forward',
    bounds: null,
  };
}
