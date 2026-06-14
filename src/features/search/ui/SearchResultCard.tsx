import { featureThemeClassName } from '@/features/shared/theme';
import { Search } from 'lucide-react';
import { DynamicTimelineCard } from '@/features/timeline/ui/LazyCardComponents';
import {
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardHeader,
  TimelineCardBadge,
} from '@/features/timeline/ui/cards/TimelineCardBase';
import { buildTimelineCardProps } from '../logic/buildTimelineCardProps';
import type { SearchContentItem } from '../types/search.types';
import type { SearchDocument, SearchDocumentCardPayload } from '../types/search-document.types';

type SearchResultType = SearchContentItem['type'];

const TIMELINE_SEARCH_TYPES = new Set<SearchResultType>([
  'amendment',
  'blog',
  'election',
  'event',
  'group',
  'image',
  'statement',
  'todo',
  'user',
  'video',
  'vote',
]);

const SEARCH_TIMELINE_CARD_CLASS =
  'h-full [&_[data-timeline-card-media]]:max-h-36 [&_[data-timeline-card-media]]:overflow-hidden';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asPayload(value: unknown): SearchDocumentCardPayload {
  return isRecord(value) ? (value as SearchDocumentCardPayload) : {};
}

function getSearchType(document: SearchDocument, payload: SearchDocumentCardPayload) {
  const rawType = String(payload.type || document.entity_type || '').trim();
  return TIMELINE_SEARCH_TYPES.has(rawType as SearchResultType)
    ? (rawType as SearchResultType)
    : null;
}

function collectTags(document: SearchDocument, payload: SearchDocumentCardPayload) {
  const payloadTags = Array.isArray(payload.tags) ? payload.tags : [];
  const topicTags = (document.topics ?? []).map(topic => topic.topic);
  return Array.from(new Set([...payloadTags, ...topicTags].filter(Boolean)));
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getStat(
  payload: SearchDocumentCardPayload,
  ...keys: readonly string[]
): number | undefined {
  if (!isRecord(payload.stats)) return undefined;

  for (const key of keys) {
    const value = asNumber(payload.stats[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function asDate(value: number | string | Date | null | undefined): Date | undefined {
  if (value == null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function cleanSubtitle(value: string | null | undefined) {
  if (!value) return undefined;
  return value.startsWith('@') ? undefined : value;
}

function toContentItem(document: SearchDocument): SearchContentItem | null {
  const payload = asPayload(document.card_payload);
  const type = getSearchType(document, payload);
  if (!type) return null;

  const createdAt = asDate(document.created_at) ?? new Date();
  const updatedAt = asDate(document.updated_at);
  const tags = collectTags(document, payload);
  const groupName = document.group?.name ?? undefined;
  const subtitle = document.subtitle ?? undefined;
  const handle = payload.handle ?? (subtitle?.startsWith('@') ? subtitle.slice(1) : undefined);

  const item: SearchContentItem = {
    id: document.entity_id,
    type,
    title: document.title,
    description: document.summary || document.search_text || undefined,
    imageUrl: document.image_url,
    createdAt,
    updatedAt,
    tags,
    groupId: document.group_id,
    groupName,
    subtitle,
    handle,
    location: payload.location ?? cleanSubtitle(subtitle),
    status: payload.status,
    dueDate: asDate(payload.due_at),
    startDate: asDate(payload.starts_at),
    endDate: asDate(payload.ends_at),
    isCompleted: payload.status === 'completed',
    memberCount: getStat(payload, 'members'),
    eventCount: getStat(payload, 'events'),
    attendeeCount: getStat(payload, 'participants', 'attendees'),
    electionsCount: getStat(payload, 'elections'),
    amendmentsCount: getStat(payload, 'amendments'),
    groupCount: getStat(payload, 'groups'),
    amendmentCount: getStat(payload, 'amendments'),
    collaboratorCount: getStat(payload, 'collaborators'),
    supportingGroupsCount: getStat(payload, 'supporting_groups'),
    changeRequestCount: getStat(payload, 'change_requests'),
    commentCount: getStat(payload, 'comments'),
    upvotes: getStat(payload, 'upvotes', 'likes', 'supporters'),
    downvotes: getStat(payload, 'downvotes'),
    assigneeCount: getStat(payload, 'assignees', 'assigned'),
    totalCandidates: getStat(payload, 'candidates'),
    authorId: document.owner_user_id,
    authorName: document.owner_user_id ? document.subtitle : undefined,
    authorAvatar: type === 'user' ? document.image_url : undefined,
    stats: {
      reactions: getStat(payload, 'reactions', 'likes', 'upvotes', 'supporters'),
      comments: getStat(payload, 'comments'),
      views: getStat(payload, 'views'),
      members: getStat(payload, 'members'),
    },
  };

  if (type === 'blog') {
    item.authorName = groupName ?? document.subtitle;
    item.authorAvatar = undefined;
  }

  if (type === 'statement') {
    item.authorName = document.subtitle ?? document.owner_user_id ?? '';
    item.groupName = groupName;
  }

  if (type === 'user') {
    item.authorId = document.entity_id;
    item.authorName = document.title;
    item.authorAvatar = document.image_url;
  }

  if (type === 'image' || type === 'video') {
    item.authorName = document.subtitle ?? groupName;
    item.groupName = groupName;
  }

  return item;
}

function SearchFallbackCard({ document }: { document: SearchDocument }) {
  const payload = asPayload(document.card_payload);
  const tags = collectTags(document, payload).slice(0, 3);

  return (
    <TimelineCardBase
      contentType="action"
      className="h-full"
      href={`/search?result=${encodeURIComponent(document.id)}`}
    >
      <TimelineCardHeader
        contentType="action"
        title={document.title || 'Result'}
        href={`/search?result=${encodeURIComponent(document.id)}`}
        subtitle={document.subtitle || document.group?.name || undefined}
        badge={<TimelineCardBadge label={document.entity_type || 'Result'} icon={Search} />}
      />

      <TimelineCardContent>
        {(document.summary || document.search_text) && (
          <p className="text-muted-foreground mb-3 line-clamp-4 text-sm">
            {document.summary || document.search_text}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span
                key={tag}
                className={featureThemeClassName('searchSearchResultCardNeutralContrastBadge')}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </TimelineCardContent>
    </TimelineCardBase>
  );
}

export function SearchResultCard({ document }: { document: SearchDocument }) {
  const item = toContentItem(document);

  if (!item) {
    return (
      <div className="h-full overflow-hidden rounded-xl">
        <SearchFallbackCard document={document} />
      </div>
    );
  }

  const { cardType, cardProps } = buildTimelineCardProps(item);
  if (!cardType || !cardProps) {
    return null;
  }

  return (
    <div className="h-full overflow-hidden rounded-xl">
      <DynamicTimelineCard
        cardType={cardType}
        cardProps={{
          ...cardProps,
          className: SEARCH_TIMELINE_CARD_CLASS,
        }}
        className={SEARCH_TIMELINE_CARD_CLASS}
      />
    </div>
  );
}
