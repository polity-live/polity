'use client';

/**
 * Hook for fetching subscribed timeline content
 * Returns content from groups, events, and users the current user follows
 */

import { useMemo, useCallback, useState } from 'react';
import { useUserGroupSubscriptions } from '@/zero/groups/useGroupState';
import { useUserEventSubscriptions } from '@/zero/events/useEventState';
import { normalizeTimelineText } from '@/features/timeline/logic/normalizeTimelineText';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface TimelineItem {
  id: string;
  entityId?: string;
  type:
    | 'group'
    | 'event'
    | 'amendment'
    | 'blog'
    | 'statement'
    | 'video'
    | 'image'
    | 'election'
    | 'vote'
    | 'todo'
    | 'action'
    | 'user';
  eventType?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  groupId?: string;
  groupName?: string;
  eventId?: string;
  eventName?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  city?: string;
  postcode?: string;
  latitude?: number | null;
  longitude?: number | null;
  attendeeCount?: number;
  electionsCount?: number;
  amendmentsCount?: number;
  memberCount?: number;
  eventCount?: number;
  amendmentCount?: number;
  createdAt: Date;
  updatedAt?: Date;
  status?: string;
  stats?: {
    reactions?: number;
    comments?: number;
    views?: number;
    members?: number;
  };
  tags?: string[];
  collaboratorCount?: number;
  supportingGroupsCount?: number;
  changeRequestCount?: number;
  commentCount?: number;
  groupCount?: number;
  handle?: string;
  subtitle?: string;
  // Agenda item links for vote/election cards navigation
  agendaEventId?: string;
  agendaItemId?: string;
  /** Whether this is a recurring event */
  isRecurring?: boolean;
  recurrencePattern?: string;
}

export interface UseSubscribedTimelineOptions {
  userId: string;
  userEmail?: string;
  /** Number of items per page */
  pageSize?: number;
  /** Content types to include */
  contentTypes?: TimelineItem['type'][];
  /** Sort order */
  sortBy?: 'recent' | 'popular' | 'trending';
}

export interface UseSubscribedTimelineResult {
  items: TimelineItem[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  /** Group IDs user is subscribed to */
  subscribedGroupIds: string[];
}

interface AgendaItemPreview {
  event_id?: string | null;
  election?: { id?: string } | null;
  amendmentVote?: { id?: string } | null;
}

/**
 * Fetch timeline content from subscribed groups and events
 */
export function useSubscribedTimeline(
  options: UseSubscribedTimelineOptions
): UseSubscribedTimelineResult {
  const { userId, pageSize = 20, sortBy = 'recent' } = options;
  const [page, setPage] = useState(0);

  // Query user's group memberships via facade
  const { memberships: membershipRows, isLoading: membershipLoading } =
    useUserGroupSubscriptions(userId);

  // Query user's event participations via facade
  const { participations: participationRows, isLoading: participationLoading } =
    useUserEventSubscriptions(userId);

  const membershipData = { groupMemberships: membershipRows };
  const participationData = { eventParticipants: participationRows };

  // Agenda items are already retrieved via related queries on event participation data
  const { data: agendaItemsData } = { data: { agendaItems: [] as AgendaItemPreview[] } };

  const agendaItemsByEventId = useMemo(() => {
    const map = new Map<string, Pick<AgendaItemPreview, 'election' | 'amendmentVote'>[]>();
    for (const item of agendaItemsData?.agendaItems ?? []) {
      const eventId = item.event_id;
      if (!eventId) continue;
      const list = map.get(eventId) ?? [];
      list.push(item);
      map.set(eventId, list);
    }
    return map;
  }, [agendaItemsData]);

  // Get subscribed group IDs
  const subscribedGroupIds = useMemo(() => {
    if (!membershipData?.groupMemberships) return [];
    return membershipData.groupMemberships
      .map(m => m.group?.id)
      .filter((id): id is string => Boolean(id));
  }, [membershipData]);

  // Transform memberships to timeline items
  const groupItems = useMemo((): TimelineItem[] => {
    if (!membershipData?.groupMemberships) return [];

    return membershipData.groupMemberships.flatMap(m => {
      const g = m.group;
      if (!g) return [] as TimelineItem[];

      return [
        {
          id: g.id,
          type: 'group' as const,
          title: g.name || translateText('features.timeline.fallbacks.unnamedGroup'),
          description: normalizeTimelineText(g.description),
          imageUrl: g.image_url ?? undefined,
          groupId: g.id,
          groupName: g.name || translateText('features.timeline.fallbacks.unnamedGroup'),
          latitude: g.latitude ?? undefined,
          longitude: g.longitude ?? undefined,
          memberCount: g.member_count,
          eventCount: g.events?.length,
          amendmentCount: g.amendments?.length,
          createdAt: new Date(g.created_at || Date.now()),
          tags: g.group_hashtags
            ?.map(j => j.hashtag?.tag)
            .filter((tag): tag is string => Boolean(tag)),
        },
      ];
    });
  }, [membershipData]);

  // Transform events to timeline items
  const eventItems = useMemo((): TimelineItem[] => {
    if (!participationData?.eventParticipants) return [];

    return participationData.eventParticipants.flatMap(p => {
      const e = p.event;
      if (!e) return [] as TimelineItem[];

      return [
        {
          id: e.id,
          type: 'event' as const,
          title: e.title || translateText('features.timeline.fallbacks.unnamedEvent'),
          description: normalizeTimelineText(e.description),
          imageUrl: e.image_url ?? undefined,
          eventId: e.id,
          eventName: e.title || translateText('features.timeline.fallbacks.unnamedEvent'),
          groupId: e.group_id ?? undefined,
          startDate: e.start_date ? new Date(e.start_date) : undefined,
          endDate: e.end_date ? new Date(e.end_date) : undefined,
          location: e.location_name ?? undefined,
          latitude: e.latitude ?? undefined,
          longitude: e.longitude ?? undefined,
          attendeeCount: e.participants?.length,
          electionsCount: agendaItemsByEventId.get(e.id)?.filter(item => Boolean(item?.election))
            .length,
          createdAt: new Date(e.created_at || Date.now()),
          status: e.status ?? undefined,
          tags: e.event_hashtags
            ?.map(j => j.hashtag?.tag)
            .filter((tag): tag is string => Boolean(tag)),
          isRecurring: Boolean(e.is_recurring),
          recurrencePattern: e.recurrence_pattern ?? undefined,
        },
      ];
    });
  }, [participationData]);

  // Combine and sort items (with deduplication)
  const allItems = useMemo(() => {
    const combined = [...groupItems, ...eventItems];

    // Deduplicate by ID to prevent React key warnings
    const seenIds = new Set<string>();
    const deduped = combined.filter(item => {
      if (seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);
      return true;
    });

    // Sort based on sortBy option
    switch (sortBy) {
      case 'popular':
        return deduped.sort((a, b) => {
          const aScore = (a.stats?.reactions || 0) + (a.stats?.comments || 0);
          const bScore = (b.stats?.reactions || 0) + (b.stats?.comments || 0);
          return bScore - aScore;
        });
      case 'trending':
        // For trending, prefer recent items with high engagement
        return deduped.sort((a, b) => {
          const aAge = Date.now() - a.createdAt.getTime();
          const bAge = Date.now() - b.createdAt.getTime();
          const aScore = (a.stats?.reactions || 0) / Math.max(aAge / 3600000, 1);
          const bScore = (b.stats?.reactions || 0) / Math.max(bAge / 3600000, 1);
          return bScore - aScore;
        });
      case 'recent':
      default:
        return deduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  }, [groupItems, eventItems, sortBy]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    return allItems.slice(0, (page + 1) * pageSize);
  }, [allItems, page, pageSize]);

  const loadMore = useCallback(() => {
    if (paginatedItems.length < allItems.length) {
      setPage(p => p + 1);
    }
  }, [paginatedItems.length, allItems.length]);

  const refresh = useCallback(() => {
    setPage(0);
  }, []);

  return {
    items: paginatedItems,
    isLoading: membershipLoading || participationLoading,
    error: null,
    hasMore: paginatedItems.length < allItems.length,
    loadMore,
    refresh,
    subscribedGroupIds,
  };
}
