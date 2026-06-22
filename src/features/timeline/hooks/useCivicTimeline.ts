'use client';

import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import { useUserState } from '@/zero/users/useUserState';
import { useCommonState } from '@/zero/common';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { useAgendaState, type AgendaStateItem } from '@/zero/agendas/useAgendaState';
import { getAgendaDisplayTimes } from '@/features/agendas/logic/getAgendaDisplayTimes';
import { getAgendaRuntimeStatus } from '@/features/agendas/logic/getAgendaRuntimeStatus';
import { useSubscribedTimeline, type TimelineItem } from './useSubscribedTimeline';
import { useSubscriptionTimeline } from './useSubscriptionTimeline';
import type { TimelineFilters } from './useTimelineFilters';
import type { TimelineRadiusFilter } from '../ui/TimelineFilterPanel';
import type { DecisionItem } from '@/features/decision-terminal/ui/types';
import { formatLocation, formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  buildCivicTimelineItems,
  CIVIC_TIMELINE_CONTENT_TYPES,
  deriveCivicCoordinates,
  formatDistanceKm,
  getCivicTimelineTimestamp,
  groupCivicTimelineItems,
  isWithinTimelineRadius,
  type CivicTimelineCoordinates,
  type CivicTimelineItem,
  type CivicTimelineReason,
  type CivicTimelineSection,
  type CivicTimelineType,
} from '../logic/civicTimeline';

const DISCOVER_TYPES = ['event', 'amendment', 'group', 'blog', 'statement', 'election'];

interface SearchDocumentLike {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  search_text?: string | null;
  group_id?: string | null;
  owner_user_id?: string | null;
  image_url?: string | null;
  card_payload?: unknown;
  created_at: number;
  updated_at?: number | null;
  engagement_score?: number | null;
  trending_score?: number | null;
  topics?: readonly { topic?: string | null }[];
  group?: {
    id?: string | null;
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    country?: string | null;
    region?: string | null;
    post_code?: string | null;
    city?: string | null;
    street?: string | null;
    house_number?: string | null;
  } | null;
}

export interface UseCivicTimelineOptions {
  userId: string;
  userEmail?: string;
  filters: TimelineFilters;
  radiusKm: TimelineRadiusFilter;
  decisions: DecisionItem[];
  decisionsLoading?: boolean;
}

export interface UseCivicTimelineReturn {
  items: CivicTimelineItem[];
  sections: CivicTimelineSection[];
  mapItems: CivicTimelineItem[];
  availableTopics: string[];
  userCoordinates: CivicTimelineCoordinates | null;
  isLoading: boolean;
  discoverCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asDate(value: Date | number | string | null | undefined): Date | undefined {
  if (value == null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeTimelineType(value?: string | null): CivicTimelineType | null {
  const normalized = value === 'activity' || value === 'action' ? 'workflow' : value;

  if (
    normalized === 'group' ||
    normalized === 'event' ||
    normalized === 'amendment' ||
    normalized === 'agenda_item' ||
    normalized === 'vote' ||
    normalized === 'election' ||
    normalized === 'statement' ||
    normalized === 'blog' ||
    normalized === 'workflow' ||
    normalized === 'user'
  ) {
    return normalized;
  }

  return null;
}

function getHref(type: CivicTimelineType, entityId: string, fallbackHref = '/search') {
  switch (type) {
    case 'group':
      return `/group/${entityId}`;
    case 'event':
      return `/event/${entityId}`;
    case 'amendment':
      return `/amendment/${entityId}`;
    case 'blog':
      return `/blog/${entityId}`;
    case 'statement':
      return `/statement/${entityId}`;
    case 'user':
      return `/user/${entityId}`;
    case 'vote':
    case 'election':
    case 'agenda_item':
    case 'workflow':
    default:
      return fallbackHref;
  }
}

function getReasonForItem(item: {
  type: CivicTimelineType;
  isUrgent?: boolean;
  isDiscover?: boolean;
  coordinates?: CivicTimelineCoordinates | null;
  userCoordinates?: CivicTimelineCoordinates | null;
  tags?: string[];
  interestTags?: string[];
}): CivicTimelineReason {
  if (item.isUrgent) return 'urgent_decision';
  if (
    item.isDiscover &&
    getMatchingInterestTags(item.tags ?? [], item.interestTags ?? []).length > 0
  ) {
    return 'interest_match';
  }
  if (item.isDiscover)
    return item.coordinates && item.userCoordinates ? 'near_you' : 'public_discovery';
  if (item.type === 'vote' || item.type === 'election') return 'active_now';
  return 'subscribed';
}

function getPrimaryActionLabel(type: CivicTimelineType) {
  switch (type) {
    case 'vote':
      return 'Vote';
    case 'election':
      return 'View candidates';
    case 'event':
      return 'Open event';
    case 'agenda_item':
      return 'Open agenda';
    case 'amendment':
      return 'Read amendment';
    case 'blog':
      return 'Read';
    case 'statement':
      return 'Discuss';
    case 'group':
      return 'Open group';
    case 'user':
      return 'View profile';
    case 'workflow':
    default:
      return 'View';
  }
}

function getStatsLabel(item: Pick<CivicTimelineItem, 'stats' | 'type'>) {
  if (typeof item.stats?.participants === 'number' && item.stats.participants > 0) {
    return `${item.stats.participants} attending`;
  }
  if (typeof item.stats?.candidates === 'number' && item.stats.candidates > 0) {
    return `${item.stats.candidates} candidates`;
  }
  if (typeof item.stats?.comments === 'number' && item.stats.comments > 0) {
    return `${item.stats.comments} comments`;
  }
  if (typeof item.stats?.members === 'number' && item.stats.members > 0) {
    return `${item.stats.members} members`;
  }
  return null;
}

function getMatchingInterestTags(tags: string[], interestTags: string[]) {
  if (tags.length === 0 || interestTags.length === 0) return [];

  const interestSet = new Set(interestTags.map(tag => tag.toLowerCase()));
  return tags.filter(tag => interestSet.has(tag.toLowerCase()));
}

function getTagsFromJunctions(
  junctions?: readonly { hashtag?: { tag?: string | null } | null }[] | null
) {
  return (
    junctions?.map(junction => junction.hashtag?.tag).filter((tag): tag is string => !!tag) ?? []
  );
}

function mapSubscribedItem(item: TimelineItem): CivicTimelineItem | null {
  const type = normalizeTimelineType(item.type);
  if (!type) return null;

  const entityId = item.entityId ?? item.eventId ?? item.groupId ?? item.authorId ?? item.id;
  const href =
    type === 'agenda_item' && item.agendaEventId && item.agendaItemId
      ? `/event/${item.agendaEventId}/agenda/${item.agendaItemId}`
      : getHref(type, entityId);
  const coordinates = deriveCivicCoordinates(item);
  const timestamp = getCivicTimelineTimestamp({
    timestamp: item.createdAt,
    startDate: item.startDate,
  });

  const civicItem: CivicTimelineItem = {
    id: `subscribed:${type}:${item.id}`,
    entityId,
    type,
    title: item.title,
    description: item.description,
    href,
    sourceName: item.groupName ?? item.eventName ?? item.authorName,
    sourceHref: item.groupId
      ? `/group/${item.groupId}`
      : item.eventId
        ? `/event/${item.eventId}`
        : undefined,
    timestamp,
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status,
    locationLabel: item.location,
    coordinates,
    tags: item.tags,
    stats: {
      reactions: item.stats?.reactions,
      comments: item.commentCount ?? item.stats?.comments ?? undefined,
      views: item.stats?.views,
      members: item.memberCount ?? item.stats?.members,
      participants: item.attendeeCount,
    },
    relationshipStrength: 1,
    reason: 'subscribed',
    primaryActionLabel: getPrimaryActionLabel(type),
  };

  return {
    ...civicItem,
    statsLabel: getStatsLabel(civicItem),
  };
}

function mapTimelineEvent(
  event: ReturnType<typeof useSubscriptionTimeline>['events'][number]
): CivicTimelineItem | null {
  const type = normalizeTimelineType(event.content_type || event.entity_type || undefined);
  if (!type) return null;
  const endDate = asDate(event.ends_at);
  if (type === 'statement' && endDate && endDate.getTime() <= Date.now()) {
    return null;
  }

  const eventEntity = event.event;
  const group = event.group;
  const user = event.user;
  const entityId =
    event.entity_id ||
    eventEntity?.id ||
    event.amendment?.id ||
    event.blog?.id ||
    event.statement?.id ||
    event.election?.id ||
    group?.id ||
    user?.id ||
    event.id;
  const agendaEventId = event.election?.agenda_item?.event?.id;
  const agendaItemId = event.election?.agenda_item?.id;
  const href =
    (type === 'vote' || type === 'election') && agendaEventId && agendaItemId
      ? `/event/${agendaEventId}/agenda/${agendaItemId}`
      : getHref(type, entityId);
  const coordinates = deriveCivicCoordinates(eventEntity, group, user);
  const locationLabel = eventEntity
    ? formatNamedLocation(eventEntity.location_name, eventEntity)
    : group
      ? formatLocation(group)
      : user
        ? formatLocation(user)
        : undefined;
  const tags =
    event.tags ??
    getTagsFromJunctions(event.event?.event_hashtags).concat(
      getTagsFromJunctions(event.amendment?.amendment_hashtags),
      getTagsFromJunctions(event.blog?.blog_hashtags),
      getTagsFromJunctions(event.user?.user_hashtags)
    );
  const timestamp = asDate(event.created_at) ?? new Date();
  const startDate = asDate(eventEntity?.start_date) ?? undefined;
  const civicItem: CivicTimelineItem = {
    id: `timeline-event:${event.id}`,
    entityId,
    type,
    title:
      event.title ||
      eventEntity?.title ||
      group?.name ||
      user?.handle ||
      translateText('features.timeline.fallbacks.timelineUpdate'),
    description: event.description,
    href,
    sourceName: group?.name ?? eventEntity?.title ?? user?.handle,
    sourceHref: group?.id
      ? `/group/${group.id}`
      : eventEntity?.id
        ? `/event/${eventEntity.id}`
        : undefined,
    timestamp,
    startDate,
    endDate,
    status:
      type === 'vote' ? event.vote_status : type === 'election' ? event.election_status : undefined,
    locationLabel,
    coordinates,
    tags: Array.from(new Set(tags.filter(Boolean))),
    stats: {
      reactions: event.stats?.reactions,
      comments: event.stats?.comments,
      views: event.stats?.views,
      members: event.stats?.members,
      participants: eventEntity?.participants?.length,
    },
    relationshipStrength: 0.95,
    reason: type === 'vote' || type === 'election' ? 'active_now' : 'subscribed',
    primaryActionLabel: getPrimaryActionLabel(type),
  };

  return {
    ...civicItem,
    statsLabel: getStatsLabel(civicItem),
  };
}

export function mapAgendaItemToCivicTimelineItem(item: AgendaStateItem): CivicTimelineItem | null {
  const event = item.event;
  if (!event?.id) return null;

  const runtimeStatus = getAgendaRuntimeStatus({
    id: item.id,
    status: item.status,
    start_time: item.start_time,
    end_time: item.end_time,
    activated_at: item.activated_at,
    completed_at: item.completed_at,
  });
  const displayTimes = getAgendaDisplayTimes({
    status: runtimeStatus,
    duration: item.duration,
    activated_at: item.activated_at,
    completed_at: item.completed_at,
    start_time: item.start_time,
    end_time: item.end_time,
    calculated_start_time: item.calculated_start_time,
    calculated_end_time: item.calculated_end_time,
  });
  const timestamp = asDate(displayTimes.displayStartTime) ?? asDate(item.created_at) ?? new Date();
  const endDate = asDate(displayTimes.displayEndTime);
  const coordinates = deriveCivicCoordinates(event);
  const locationLabel = formatNamedLocation(event.location_name, event);
  const href = `/event/${event.id}/agenda/${item.id}`;
  const civicItem: CivicTimelineItem = {
    id: `agenda:${item.id}`,
    entityId: item.id,
    type: 'agenda_item',
    title: item.title || item.amendment?.title || 'Agenda item',
    description: item.description,
    href,
    sourceName: event.title,
    sourceHref: `/event/${event.id}`,
    timestamp,
    startDate: timestamp,
    endDate,
    status: runtimeStatus,
    locationLabel,
    coordinates,
    tags: [],
    stats: {
      candidates: Array.isArray(item.election)
        ? item.election.length
        : item.election
          ? 1
          : undefined,
    },
    relationshipStrength: 0.9,
    reason: runtimeStatus === 'in-progress' ? 'active_now' : 'member_context',
    primaryActionLabel: getPrimaryActionLabel('agenda_item'),
  };

  return {
    ...civicItem,
    statsLabel: getStatsLabel(civicItem),
  };
}

function mapDecisionItem(decision: DecisionItem): CivicTimelineItem {
  const type = decision.type === 'election' ? 'election' : 'vote';
  const href = decision.href || '#';
  const civicItem: CivicTimelineItem = {
    id: `decision:${decision.id}`,
    entityId: decision.id,
    type,
    title: decision.title,
    description: decision.summary ?? decision.body,
    href,
    sourceName: decision.agendaItem?.name ?? decision.entity?.name ?? decision.body,
    sourceHref: decision.agendaItem?.href ?? decision.entity?.href,
    timestamp: decision.startsAt ?? decision.endsAt,
    startDate: decision.startsAt,
    endDate: decision.endsAt,
    status: decision.status,
    tags: [],
    stats: {
      participants: decision.votedCount,
      members: decision.totalMembers,
      candidates: decision.candidates?.length,
    },
    relationshipStrength: decision.isUrgent ? 0.9 : 0.75,
    urgency: decision.isUrgent
      ? 1
      : decision.isClosingSoon
        ? 0.8
        : decision.isOpeningSoon
          ? 0.55
          : 0.35,
    reason: decision.isUrgent ? 'urgent_decision' : 'active_now',
    primaryActionLabel: getPrimaryActionLabel(type),
  };

  return {
    ...civicItem,
    statsLabel: getStatsLabel(civicItem),
  };
}

function mapSearchDocument(
  document: SearchDocumentLike,
  userCoordinates: CivicTimelineCoordinates | null,
  interestTags: string[]
): CivicTimelineItem | null {
  const payload = isRecord(document.card_payload) ? document.card_payload : {};
  const type = normalizeTimelineType(asString(payload.type) ?? document.entity_type);
  if (!type || !CIVIC_TIMELINE_CONTENT_TYPES.includes(type)) return null;

  const metadata = isRecord(payload.metadata) ? payload.metadata : {};
  const coordinates = deriveCivicCoordinates(payload, metadata, document.group);
  const topics =
    document.topics?.map(topic => topic.topic).filter((tag): tag is string => !!tag) ?? [];
  const payloadTags = Array.isArray(payload.tags)
    ? payload.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const startsAt = asDate(payload.starts_at as number | string | null | undefined);
  const endsAt = asDate(payload.ends_at as number | string | null | undefined);
  const timestamp = startsAt ?? asDate(document.created_at) ?? new Date();
  const entityId = document.entity_id;
  const href = getHref(type, entityId, `/search?result=${encodeURIComponent(document.id)}`);
  const locationLabel =
    asString(payload.location) ??
    (document.group ? formatLocation(document.group) : undefined) ??
    document.subtitle;
  const engagementScore = document.engagement_score ?? document.trending_score ?? 0;
  const tags = Array.from(new Set([...payloadTags, ...topics]));
  const reasonTags = getMatchingInterestTags(tags, interestTags);
  const reason = getReasonForItem({
    type,
    isDiscover: true,
    coordinates,
    userCoordinates,
    tags,
    interestTags,
  });
  const civicItem: CivicTimelineItem = {
    id: `discover:${document.id}`,
    entityId,
    type,
    title: document.title,
    description: document.summary || document.search_text,
    href,
    sourceName: document.group?.name ?? document.subtitle,
    sourceHref: document.group?.id ? `/group/${document.group.id}` : undefined,
    timestamp,
    startDate: startsAt,
    endDate: endsAt,
    status: asString(payload.status),
    locationLabel,
    coordinates,
    tags,
    stats: {
      reactions: asNumber(isRecord(payload.stats) ? payload.stats.reactions : undefined),
      comments: asNumber(isRecord(payload.stats) ? payload.stats.comments : undefined),
      members: asNumber(isRecord(payload.stats) ? payload.stats.members : undefined),
      participants: asNumber(isRecord(payload.stats) ? payload.stats.participants : undefined),
      candidates: asNumber(isRecord(payload.stats) ? payload.stats.candidates : undefined),
    },
    engagementScore,
    relationshipStrength: coordinates ? 0.35 : 0.2,
    isDiscover: true,
    reason,
    reasonTags,
    primaryActionLabel: getPrimaryActionLabel(type),
  };

  return {
    ...civicItem,
    statsLabel: getStatsLabel(civicItem),
  };
}

function passesDateFilter(item: CivicTimelineItem, dateRange: TimelineFilters['dateRange']) {
  if (dateRange === 'all') return true;

  const now = new Date();
  const timestamp = getCivicTimelineTimestamp(item).getTime();

  if (dateRange === 'today') {
    return new Date(timestamp).toDateString() === now.toDateString();
  }

  const maxAge =
    dateRange === 'week'
      ? 7 * 86_400_000
      : dateRange === 'month'
        ? 30 * 86_400_000
        : 365 * 86_400_000;

  return Math.abs(now.getTime() - timestamp) <= maxAge;
}

function getEngagementValue(item: CivicTimelineItem) {
  return (
    item.engagementScore ??
    (item.stats?.reactions ?? 0) +
      (item.stats?.comments ?? 0) +
      (item.stats?.views ?? 0) +
      (item.stats?.members ?? 0)
  );
}

function applyFilters(
  items: CivicTimelineItem[],
  filters: TimelineFilters,
  radiusKm: TimelineRadiusFilter,
  userCoordinates: CivicTimelineCoordinates | null
) {
  return items.filter(item => {
    if (!filters.contentTypes.includes(item.type)) return false;
    if (!passesDateFilter(item, filters.dateRange)) return false;
    if (!isWithinTimelineRadius(item, radiusKm, userCoordinates)) return false;

    if (filters.topics.length > 0) {
      const itemTags = item.tags ?? [];
      if (!itemTags.some(tag => filters.topics.includes(tag))) return false;
    }

    if (filters.engagement === 'popular') return getEngagementValue(item) >= 5;
    if (filters.engagement === 'rising')
      return (item.scoreBreakdown?.urgency ?? item.urgency ?? 0) > 0;
    if (filters.engagement === 'discussed') return (item.stats?.comments ?? 0) > 0;

    return true;
  });
}

export function useCivicTimeline({
  userId,
  userEmail,
  filters,
  radiusKm,
  decisions,
  decisionsLoading = false,
}: UseCivicTimelineOptions): UseCivicTimelineReturn {
  const { user: dbUser, isLoading: userLoading } = useUserState({ userId });
  const { userHashtags } = useCommonState({ user_id: userId });
  const subscribedTimeline = useSubscribedTimeline({
    userId,
    userEmail,
    pageSize: 80,
    sortBy: 'recent',
  });
  const subscriptionTimeline = useSubscriptionTimeline();

  const subscribedEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of subscribedTimeline.items) {
      if (item.eventId) ids.add(item.eventId);
    }
    for (const event of subscriptionTimeline.events) {
      if (event.event?.id) ids.add(event.event.id);
    }
    return Array.from(ids);
  }, [subscribedTimeline.items, subscriptionTimeline.events]);

  const { agendaItems, isLoading: agendaLoading } = useAgendaState({
    eventIds: subscribedEventIds.length > 0 ? subscribedEventIds : undefined,
  });

  const [discoverRows, discoverResult] = useQuery(
    queries.search.searchDocumentPage({
      query: '',
      types: DISCOVER_TYPES,
      topics: [],
      createdAfter: null,
      engagement: 'all',
      sort: 'trending',
      snapshotAt: null,
      limit: 60,
      start: null,
      dir: 'forward',
    })
  );

  const userCoordinates = useMemo(() => deriveCivicCoordinates(dbUser), [dbUser]);
  const interestTags = useMemo(() => extractHashtagTags(userHashtags), [userHashtags]);

  const primaryItems = useMemo(() => {
    const items: CivicTimelineItem[] = [];

    items.push(...subscribedTimeline.items.flatMap(item => mapSubscribedItem(item) ?? []));
    items.push(...subscriptionTimeline.events.flatMap(event => mapTimelineEvent(event) ?? []));
    items.push(...agendaItems.flatMap(item => mapAgendaItemToCivicTimelineItem(item) ?? []));
    items.push(...decisions.map(mapDecisionItem));

    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.type}:${item.entityId ?? item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [agendaItems, decisions, subscribedTimeline.items, subscriptionTimeline.events]);

  const discoverItems = useMemo(
    () =>
      ((discoverRows ?? []) as unknown as SearchDocumentLike[]).flatMap(
        document => mapSearchDocument(document, userCoordinates, interestTags) ?? []
      ),
    [discoverRows, interestTags, userCoordinates]
  );

  const filteredPrimaryItems = useMemo(
    () => applyFilters(primaryItems, filters, radiusKm, userCoordinates),
    [filters, primaryItems, radiusKm, userCoordinates]
  );

  const filteredDiscoverItems = useMemo(
    () => applyFilters(discoverItems, filters, radiusKm, userCoordinates),
    [discoverItems, filters, radiusKm, userCoordinates]
  );

  const items = useMemo(
    () =>
      buildCivicTimelineItems({
        primaryItems: filteredPrimaryItems,
        discoverItems: filteredDiscoverItems,
        context: {
          userId,
          coordinates: userCoordinates,
          interestTags,
        },
        minPrimaryItems: 8,
      }),
    [filteredDiscoverItems, filteredPrimaryItems, interestTags, userCoordinates, userId]
  );

  const sections = useMemo(() => groupCivicTimelineItems(items), [items]);

  const mapItems = useMemo(
    () =>
      items
        .filter(item => item.coordinates)
        .map(item => ({
          ...item,
          statsLabel: item.statsLabel ?? formatDistanceKm(item.distanceKm),
        })),
    [items]
  );

  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>();
    for (const item of [...primaryItems, ...discoverItems]) {
      for (const tag of item.tags ?? []) {
        topicSet.add(tag);
      }
    }
    return Array.from(topicSet).slice(0, 40);
  }, [discoverItems, primaryItems]);

  return {
    items,
    sections,
    mapItems,
    availableTopics,
    userCoordinates,
    isLoading:
      userLoading ||
      subscribedTimeline.isLoading ||
      subscriptionTimeline.isLoading ||
      agendaLoading ||
      decisionsLoading ||
      discoverResult.type === 'unknown',
    discoverCount: items.filter(item => item.isDiscover).length,
  };
}
