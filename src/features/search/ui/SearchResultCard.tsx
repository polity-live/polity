import { memo, useMemo } from 'react';
import { Search } from 'lucide-react';
import { getHashtagToneClasses } from '@/features/shared/theme';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
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
import type {
  ProjectedSubscriptionState,
  ProjectedGroupMembershipState,
  ProjectedEventParticipationState,
  ProjectedAmendmentCollaborationState,
} from '../types/projected-card-state';
import { useSearchCardState } from '../SearchCardStateProvider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { resolveAppTutorialFixtureValue } from '@/features/app-tutorial/fixture-copy';
import { studioSearchKindLabel } from '../logic/studioSearchLabels';

type SearchResultType = SearchContentItem['type'];
interface SearchTimelineCardDefinition {
  item: SearchContentItem | null;
  cardType: ReturnType<typeof buildTimelineCardProps>['cardType'];
  cardProps: ReturnType<typeof buildTimelineCardProps>['cardProps'];
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

function SearchFallbackCard({ document }: { document: SearchDocument }) {
  const { t } = useTranslation();
  const fallback = t('common.entities.result');
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
        title={document.title || fallback}
        href={getSearchDocumentHref(document)}
        subtitle={
          studioSearchKindLabel(document, t) ||
          document.subtitle ||
          document.group?.name ||
          undefined
        }
        badge={
          <TimelineCardBadge
            label={
              document.entity_type === 'studio'
                ? t('features.timeline.contentTypes.studio')
                : document.entity_type || fallback
            }
            icon={Search}
          />
        }
      />

      <TimelineCardContent>
        {(document.summary ||
          (document.entity_type === 'studio' ? null : document.search_text)) && (
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

interface SearchTimelineCardProps {
  cardType: NonNullable<SearchTimelineCardDefinition['cardType']>;
  cardProps: NonNullable<SearchTimelineCardDefinition['cardProps']>;
  projectedSubscriptionState?: ProjectedSubscriptionState;
  projectedMembershipState?: ProjectedGroupMembershipState;
  projectedParticipationState?: ProjectedEventParticipationState;
  projectedCollaborationState?: ProjectedAmendmentCollaborationState;
}

// Context changes for other entity types must not re-render the full card tree.
const SearchTimelineCard = memo(function SearchTimelineCard({
  cardType,
  cardProps,
  ...projectedCardProps
}: SearchTimelineCardProps) {
  return (
    <DynamicTimelineCard
      cardType={cardType}
      fallback={
        <Skeleton aria-hidden data-search-card-loading className="h-full w-full rounded-2xl" />
      }
      cardProps={{ ...cardProps, ...projectedCardProps, className: SEARCH_TIMELINE_CARD_CLASS }}
      className={SEARCH_TIMELINE_CARD_CLASS}
    />
  );
});

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
  const projectedCardProps: Omit<SearchTimelineCardProps, 'cardType' | 'cardProps'> = {};
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

  return <SearchTimelineCard cardType={cardType} cardProps={cardProps} {...projectedCardProps} />;
}

export const SearchResultCard = memo(function SearchResultCard({
  document,
}: {
  document: SearchDocument;
}) {
  const { language } = useTranslation();
  const displayDocument = useMemo(
    () =>
      resolveAppTutorialFixtureValue(document, {
        tutorialRunId: document.tutorial_run_id,
        language,
      }),
    [document, language]
  );
  return (
    <div
      data-tutorial-anchor={document.tutorial_run_id ? 'tutorial-search-result' : undefined}
      className="h-full rounded-xl"
    >
      <InteractiveSearchResultCard document={displayDocument} />
    </div>
  );
});
