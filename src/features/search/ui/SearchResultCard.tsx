import { memo } from 'react';
import { Search } from 'lucide-react';
import { getHashtagToneClasses } from '@/features/shared/theme';
import { Card } from '@/features/shared/ui/ui/card';
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
import { useSearchCardState } from '../SearchCardStateProvider';

type SearchResultType = SearchContentItem['type'];
interface SearchTimelineCardDefinition {
  item: SearchContentItem | null;
  cardType: ReturnType<typeof buildTimelineCardProps>['cardType'];
  cardProps: ReturnType<typeof buildTimelineCardProps>['cardProps'];
}
interface SearchCardModel {
  payload: SearchDocumentCardPayload;
  href: string;
  type: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  tags: string[];
  stats: { label: string; value: number | string }[];
}

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
const timelineCardDefinitionCache = new WeakMap<SearchDocument, SearchTimelineCardDefinition>();
const searchCardModelCache = new WeakMap<SearchDocument, SearchCardModel>();

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

function toContentItem(
  document: SearchDocument,
  model = getSearchCardModel(document)
): SearchContentItem | null {
  const payload = model.payload;
  const type = getSearchType(document, payload);
  if (!type) return null;

  const payloadRecord = payload as Record<string, unknown>;
  const metadata = isRecord(payload.metadata) ? payload.metadata : {};
  const createdAt = asDate(document.created_at) ?? new Date();
  const updatedAt = asDate(document.updated_at);
  const tags = model.tags;
  const groupName = document.group?.name ?? undefined;
  const subtitle = document.subtitle ?? undefined;
  const description =
    type === 'user' ? document.summary || undefined : document.summary || document.search_text;
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
    description,
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
    subscriberCount: getStat(payload, 'subscribers'),
    groupType: payload.group_type,
    connectedGroupId: payload.connected_group_id,
    primarySiblingMembershipMode: payload.primary_sibling_membership_mode,
    eventType: payload.event_type,
    visibility: document.visibility,
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

function getTimelineCardDefinition(document: SearchDocument): SearchTimelineCardDefinition {
  const cached = timelineCardDefinitionCache.get(document);
  if (cached) return cached;

  const item = toContentItem(document);
  const definition = item
    ? { item, ...buildTimelineCardProps(item) }
    : { item: null, cardType: null, cardProps: null };
  timelineCardDefinitionCache.set(document, definition);
  return definition;
}

function getSearchCardModel(document: SearchDocument): SearchCardModel {
  const cached = searchCardModelCache.get(document);
  if (cached) return cached;

  const payload = asPayload(document.card_payload);
  const stats = isRecord(payload.stats)
    ? Object.entries(payload.stats)
        .flatMap(([label, value]) =>
          typeof value === 'number' || typeof value === 'string' ? [{ label, value }] : []
        )
        .slice(0, 3)
    : [];
  const model = {
    payload,
    href: getSearchDocumentHref(document),
    type: String(payload.type || document.entity_type || 'Result'),
    title: document.title || 'Result',
    subtitle: document.subtitle || document.group?.name || undefined,
    excerpt: document.summary || document.search_text || undefined,
    tags: collectTags(document, payload),
    stats,
  };
  searchCardModelCache.set(document, model);
  return model;
}

function SearchPreviewCard({ document }: { document: SearchDocument }) {
  const model = getSearchCardModel(document);
  const hashtagTone = getHashtagToneClasses();

  return (
    <a
      href={model.href}
      aria-label={model.title}
      data-search-card-mode="preview"
      className="focus-visible:ring-ring block h-full rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card
        surface="search"
        shape="xl"
        className="hover:bg-accent/20 flex h-full flex-col overflow-hidden transition-colors"
      >
        <div className="border-border/70 bg-muted/35 border-b p-4">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {model.type}
          </span>
          <h2 className="mt-1 line-clamp-2 text-base font-semibold">{model.title}</h2>
          {model.subtitle ? (
            <p className="text-muted-foreground mt-1 truncate text-xs">{model.subtitle}</p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          {model.excerpt ? (
            <p className="text-muted-foreground line-clamp-5 text-sm">{model.excerpt}</p>
          ) : null}
          {model.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {model.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${hashtagTone.badge}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {model.stats.length > 0 ? (
            <dl className="text-muted-foreground mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs">
              {model.stats.map(stat => (
                <div key={stat.label} className="flex gap-1">
                  <dt>{stat.label}</dt>
                  <dd className="text-foreground font-medium">{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </Card>
    </a>
  );
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

function InteractiveSearchResultCard({ document }: { document: SearchDocument }) {
  const searchCardState = useSearchCardState();
  const { item, cardType, cardProps } = getTimelineCardDefinition(document);

  if (!item) {
    return <SearchFallbackCard document={document} />;
  }

  if (!cardType || !cardProps) {
    return null;
  }

  const entityId =
    item.type === 'group'
      ? (item.groupId ?? item.id)
      : item.type === 'event'
        ? (item.eventId ?? item.id)
        : item.id;
  const projectedCardProps: Record<string, unknown> = {};
  if (
    searchCardState &&
    (item.type === 'user' ||
      item.type === 'group' ||
      item.type === 'amendment' ||
      item.type === 'event' ||
      item.type === 'blog')
  ) {
    projectedCardProps.projectedSubscriptionState = searchCardState.getSubscriptionState(
      item.type,
      entityId,
      item.subscriberCount ?? 0
    );
  }
  if (searchCardState && item.type === 'group') {
    projectedCardProps.projectedMembershipState = searchCardState.getGroupState({
      id: entityId,
      memberCount: item.memberCount ?? 0,
      groupType: item.groupType,
      connectedGroupId: item.connectedGroupId,
      primarySiblingMembershipMode: item.primarySiblingMembershipMode,
    });
  }
  if (searchCardState && item.type === 'event') {
    projectedCardProps.projectedParticipationState = searchCardState.getEventState({
      id: entityId,
      participantCount: item.attendeeCount ?? 0,
      eventType: item.eventType,
      visibility: item.visibility ?? 'public',
      groupId: item.groupId,
    });
  }
  if (searchCardState && item.type === 'amendment') {
    projectedCardProps.projectedCollaborationState = searchCardState.getAmendmentState(
      entityId,
      item.collaboratorCount ?? 0
    );
  }

  return (
    <DynamicTimelineCard
      cardType={cardType}
      cardProps={{
        ...cardProps,
        ...projectedCardProps,
        className: SEARCH_TIMELINE_CARD_CLASS,
      }}
      className={SEARCH_TIMELINE_CARD_CLASS}
    />
  );
}

export const SearchResultCard = memo(function SearchResultCard({
  document,
  mode = 'interactive',
}: {
  document: SearchDocument;
  mode?: 'preview' | 'interactive';
}) {
  return (
    <div data-search-card-mode={mode} className="h-full rounded-xl">
      {mode === 'preview' ? (
        <SearchPreviewCard document={document} />
      ) : (
        <InteractiveSearchResultCard document={document} />
      )}
    </div>
  );
});
