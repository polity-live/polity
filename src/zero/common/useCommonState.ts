import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

/**
 * Reactive state hook for common cross-domain data.
 * Returns query-derived state — no mutations.
 *
 * All queries are conditional — only fire when their required args are provided.
 */
export function useCommonState(
  args: {
    // Entity-based queries
    entity_id?: string;
    entity_type?: string;
    user_id?: string;
    group_id?: string;
    amendment_id?: string;
    event_id?: string;
    blog_id?: string;
    // User subscription queries
    subscriberId?: string;
    subscriberIdForTimeline?: string;
    subscriberUserId?: string;
    // Timeline queries
    timelineEntityIds?: string[];
    timelineContentTypes?: string[];
    timelineContentLimit?: number;
    // Hashtag queries
    loadAllHashtags?: boolean;
    loadOnboardingHashtagUsage?: boolean;
  } = {}
) {
  const now = useMemo(() => Date.now(), []);
  // ── Entity-based queries ───────────────────────────────────────────
  const hasEntityFilter = !!(
    args.user_id ||
    args.group_id ||
    args.amendment_id ||
    args.event_id ||
    args.blog_id
  );

  const [subscribers, subscribersResult] = useQuery(
    hasEntityFilter
      ? queries.common.subscribers({
          user_id: args.user_id,
          group_id: args.group_id,
          amendment_id: args.amendment_id,
          event_id: args.event_id,
          blog_id: args.blog_id,
        })
      : undefined
  );

  // ── Per-entity junction hashtag queries ────────────────────────────
  const [userHashtags, userHashtagsResult] = useQuery(
    args.user_id ? queries.common.userHashtags({ user_id: args.user_id }) : undefined
  );

  const [groupHashtags, groupHashtagsResult] = useQuery(
    args.group_id ? queries.common.groupHashtags({ group_id: args.group_id }) : undefined
  );

  const [amendmentHashtags, amendmentHashtagsResult] = useQuery(
    args.amendment_id
      ? queries.common.amendmentHashtags({ amendment_id: args.amendment_id })
      : undefined
  );

  const [eventHashtags, eventHashtagsResult] = useQuery(
    args.event_id ? queries.common.eventHashtags({ event_id: args.event_id }) : undefined
  );

  const [blogHashtags, blogHashtagsResult] = useQuery(
    args.blog_id ? queries.common.blogHashtags({ blog_id: args.blog_id }) : undefined
  );

  // ── All canonical hashtags (for typeahead) ─────────────────────────
  const [allHashtags, allHashtagsResult] = useQuery(
    args.loadAllHashtags ? queries.common.allHashtags({}) : undefined
  );

  const [onboardingHashtagUsage, onboardingHashtagUsageResult] = useQuery(
    args.loadOnboardingHashtagUsage ? queries.common.onboardingHashtagUsage({ now }) : undefined
  );

  const hasLinkFilter = !!(args.group_id || args.user_id);
  const [links, linksResult] = useQuery(
    hasLinkFilter
      ? queries.common.links({
          group_id: args.group_id,
          user_id: args.user_id,
        })
      : undefined
  );

  const timelineEntityFilter =
    args.entity_type && args.entity_id
      ? { entity_type: args.entity_type, entity_id: args.entity_id, now }
      : undefined;
  const hasTimelineEntityFilter = !!timelineEntityFilter;
  const [timeline, timelineResult] = useQuery(
    timelineEntityFilter ? queries.common.timelineByEntity(timelineEntityFilter) : undefined
  );

  const [reactions, reactionsResult] = useQuery(
    timelineEntityFilter ? queries.common.reactions(timelineEntityFilter) : undefined
  );

  // ── User subscription queries ──────────────────────────────────────
  const [userSubscriptions, userSubsResult] = useQuery(
    args.subscriberId
      ? queries.common.userSubscriptions({ subscriber_id: args.subscriberId })
      : undefined
  );

  const [userSubscriptionsForTimeline, userSubsTimelineResult] = useQuery(
    args.subscriberIdForTimeline
      ? queries.common.userSubscriptionsForTimeline({ subscriber_id: args.subscriberIdForTimeline })
      : undefined
  );

  const [userSubscribers, userSubscribersResult] = useQuery(
    args.subscriberUserId
      ? queries.common.userSubscribers({ user_id: args.subscriberUserId })
      : undefined
  );

  // ── Timeline queries ───────────────────────────────────────────────
  const timelineEntityIds =
    args.timelineEntityIds && args.timelineEntityIds.length > 0
      ? args.timelineEntityIds
      : undefined;
  const hasTimelineEntityIds = !!timelineEntityIds;
  const [timelineByEntityIds, timelineByEntityIdsResult] = useQuery(
    timelineEntityIds
      ? queries.common.timelineEventsByEntityIds({ entity_ids: timelineEntityIds, now })
      : undefined
  );

  const timelineContentTypes =
    args.timelineContentTypes && args.timelineContentTypes.length > 0
      ? args.timelineContentTypes
      : undefined;
  const hasTimelineContentTypes = !!timelineContentTypes;
  const [timelineByContentTypes, timelineByContentTypesResult] = useQuery(
    timelineContentTypes
      ? queries.common.timelineEventsByContentTypes({
          content_types: timelineContentTypes,
          limit: args.timelineContentLimit ?? 50,
          now,
        })
      : undefined
  );

  const isLoading =
    (hasEntityFilter && subscribersResult.type === 'unknown') ||
    (!!args.user_id && userHashtagsResult.type === 'unknown') ||
    (!!args.group_id && groupHashtagsResult.type === 'unknown') ||
    (!!args.amendment_id && amendmentHashtagsResult.type === 'unknown') ||
    (!!args.event_id && eventHashtagsResult.type === 'unknown') ||
    (!!args.blog_id && blogHashtagsResult.type === 'unknown') ||
    (!!args.loadAllHashtags && allHashtagsResult.type === 'unknown') ||
    (!!args.loadOnboardingHashtagUsage && onboardingHashtagUsageResult.type === 'unknown') ||
    (hasLinkFilter && linksResult.type === 'unknown') ||
    (hasTimelineEntityFilter && timelineResult.type === 'unknown') ||
    (hasTimelineEntityFilter && reactionsResult.type === 'unknown') ||
    (!!args.subscriberId && userSubsResult.type === 'unknown') ||
    (!!args.subscriberIdForTimeline && userSubsTimelineResult.type === 'unknown') ||
    (!!args.subscriberUserId && userSubscribersResult.type === 'unknown') ||
    (hasTimelineEntityIds && timelineByEntityIdsResult.type === 'unknown') ||
    (hasTimelineContentTypes && timelineByContentTypesResult.type === 'unknown');

  return {
    subscribers,
    userHashtags,
    groupHashtags,
    amendmentHashtags,
    eventHashtags,
    blogHashtags,
    allHashtags,
    onboardingHashtagUsage,
    links,
    timeline,
    reactions,
    userSubscriptions,
    userSubscriptionsForTimeline,
    userSubscribers,
    timelineByEntityIds,
    timelineByContentTypes,
    isLoading,
  };
}
