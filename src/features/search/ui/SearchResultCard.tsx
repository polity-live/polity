import { Search } from 'lucide-react';
import { getHashtagToneClasses } from '@/features/shared/theme';
import { DynamicTimelineCard } from '@/features/timeline/ui/LazyCardComponents';
import {
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardHeader,
  TimelineCardBadge,
} from '@/features/timeline/ui/cards/TimelineCardBase';
import { buildTimelineCardProps } from '../logic/buildTimelineCardProps';
import {
  getSearchContentItemHref,
  getSearchDocumentHref,
  getSearchResultPermalink,
  normalizeSearchMediaSourceType,
} from '../logic/searchResultHref';
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

const SEARCH_TIMELINE_CARD_CLASS = [
  'entity-search-card-no-spotlight',
  'border-0 bg-transparent shadow-none hover:shadow-none',
  '[&_[data-timeline-card-header]]:rounded-t-2xl',
  '[&_[data-timeline-card-header]]:border',
  '[&_[data-timeline-card-header]]:border-b-0',
  '[&_[data-timeline-card-media]]:max-h-36',
  '[&_[data-timeline-card-media]]:overflow-hidden',
  '[&_[data-timeline-card-media]]:rounded-t-2xl',
  '[&_[data-timeline-card-media]]:border',
  '[&_[data-timeline-card-media]]:border-border/70',
  '[&_[data-timeline-card-media]]:border-b-0',
  '[&_[data-timeline-card-content]]:rounded-b-2xl',
  '[&_[data-timeline-card-content]]:border-x',
  '[&_[data-timeline-card-content]]:border-b',
  '[&_[data-timeline-card-content]]:border-border/70',
  '[&_[data-timeline-card-content]]:bg-card',
  '[&_[data-timeline-card-content]]:shadow-sm',
  '[&_[data-timeline-card-actions]]:mt-3',
  '[&_[data-timeline-card-actions]]:border-0',
  '[&_[data-timeline-card-actions]]:bg-transparent',
  '[&_[data-timeline-card-actions]]:px-4',
  '[&_[data-timeline-card-actions]]:py-0',
].join(' ');

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

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getFirstString(
  records: readonly Record<string, unknown>[],
  ...keys: readonly string[]
): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = asString(record[key]);
      if (value) return value;
    }
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

  const payloadRecord = payload as Record<string, unknown>;
  const metadata = isRecord(payload.metadata) ? payload.metadata : {};
  const createdAt = asDate(document.created_at) ?? new Date();
  const updatedAt = asDate(document.updated_at);
  const tags = collectTags(document, payload);
  const groupName = document.group?.name ?? undefined;
  const subtitle = document.subtitle ?? undefined;
  const handle = payload.handle ?? (subtitle?.startsWith('@') ? subtitle.slice(1) : undefined);
  const agendaEventId = getFirstString(
    [payloadRecord, metadata],
    'agendaEventId',
    'agenda_event_id',
    'eventId',
    'event_id'
  );
  const agendaItemId = getFirstString([payloadRecord, metadata], 'agendaItemId', 'agenda_item_id');
  const sourceType = normalizeSearchMediaSourceType(
    getFirstString(
      [payloadRecord, metadata],
      'sourceType',
      'source_type',
      'entityType',
      'entity_type'
    )
  );
  const sourceId = getFirstString(
    [payloadRecord, metadata],
    'sourceId',
    'source_id',
    'entityId',
    'entity_id'
  );

  const item: SearchContentItem = {
    id: document.entity_id,
    type,
    title: document.title,
    description: document.summary || document.search_text || undefined,
    imageUrl: document.image_url,
    sourceType,
    sourceId,
    createdAt,
    updatedAt,
    tags,
    groupId: document.group_id,
    groupName,
    subtitle,
    handle,
    location: payload.location ?? cleanSubtitle(subtitle),
    status: payload.status,
    agendaEventId,
    agendaItemId,
    dueDate: asDate(payload.due_at),
    startDate: asDate(payload.starts_at),
    endDate: asDate(payload.ends_at),
    isCompleted: payload.status === 'completed',
    archived: Boolean(payload.archived_at),
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

  item.href = getSearchContentItemHref(item, getSearchResultPermalink(document));

  return item;
}

function SearchFallbackCard({ document }: { document: SearchDocument }) {
  const payload = asPayload(document.card_payload);
  const tags = collectTags(document, payload).slice(0, 3);
  const hashtagTone = getHashtagToneClasses();

  return (
    <TimelineCardBase
      contentType="action"
      className={SEARCH_TIMELINE_CARD_CLASS}
      href={getSearchDocumentHref(document)}
    >
      <TimelineCardHeader
        contentType="action"
        title={document.title || 'Result'}
        href={getSearchDocumentHref(document)}
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
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${hashtagTone.badge}`}
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
      <div className="civic-page-reveal rounded-xl">
        <SearchFallbackCard document={document} />
      </div>
    );
  }

  const { cardType, cardProps } = buildTimelineCardProps(item);
  if (!cardType || !cardProps) {
    return null;
  }

  return (
    <div className="civic-page-reveal rounded-xl">
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
