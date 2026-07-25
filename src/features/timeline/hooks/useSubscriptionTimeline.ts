'use client';

import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import type { SubscriptionPageRow, TimelineFeedPageRow } from '@/zero/common/queries';

export function useSubscriptionTimeline() {
  const now = useMemo(() => Date.now(), []);
  const { user: authUser } = useAuth();
  // Don't query if user is not authenticated
  const shouldQuery = !!authUser?.id;

  // Fetch all subscriptions for the current user
  const [subscriptionRowsData, subscriptionResult] = useQuery(
    shouldQuery
      ? queries.common.subscriptionPage({
          subscriberId: authUser.id,
          limit: 101,
          start: null,
          dir: 'forward',
        })
      : null
  );
  const subscriptionRows: readonly SubscriptionPageRow[] = subscriptionRowsData ?? [];
  const subscriptionsLoading = shouldQuery && subscriptionResult.type === 'unknown';
  const subscriptionsData = { subscribers: subscriptionRows };

  // Get all entity IDs we're subscribed to
  const subscribedEntityIds = useMemo(() => {
    if (!subscriptionsData?.subscribers) return null;

    return {
      users: subscriptionsData.subscribers
        .filter((sub): sub is typeof sub & { user: NonNullable<typeof sub.user> } => !!sub.user)
        .map(sub => sub.user.id),
      groups: subscriptionsData.subscribers
        .filter((sub): sub is typeof sub & { group: NonNullable<typeof sub.group> } => !!sub.group)
        .map(sub => sub.group.id),
      amendments: subscriptionsData.subscribers
        .filter(
          (sub): sub is typeof sub & { amendment: NonNullable<typeof sub.amendment> } =>
            !!sub.amendment
        )
        .map(sub => sub.amendment.id),
      events: subscriptionsData.subscribers
        .filter((sub): sub is typeof sub & { event: NonNullable<typeof sub.event> } => !!sub.event)
        .map(sub => sub.event.id),
      blogs: subscriptionsData.subscribers
        .filter((sub): sub is typeof sub & { blog: NonNullable<typeof sub.blog> } => !!sub.blog)
        .map(sub => sub.blog.id),
    };
  }, [subscriptionsData]);

  // Fetch timeline events for subscribed entities
  // Build a flat list of entity IDs to query timeline events
  const timelineEntityIds = useMemo(() => {
    if (!subscribedEntityIds) return [];
    return [
      ...subscribedEntityIds.users,
      ...subscribedEntityIds.groups,
      ...subscribedEntityIds.amendments,
      ...subscribedEntityIds.events,
      ...subscribedEntityIds.blogs,
    ];
  }, [subscribedEntityIds]);

  const [timelineRowsData, timelineResult] = useQuery(
    timelineEntityIds.length > 0
      ? queries.common.timelineFeedPage({
          entityIds: timelineEntityIds,
          contentTypes: [],
          now,
          limit: 101,
          start: null,
          dir: 'forward',
        })
      : null
  );
  const timelineRows: readonly TimelineFeedPageRow[] = timelineRowsData ?? [];
  const timelineLoading = timelineEntityIds.length > 0 && timelineResult.type === 'unknown';
  const timelineData = { timelineEvents: timelineRows };

  // Sort timeline events by date (most recent first)
  const sortedEvents = useMemo(() => {
    if (!timelineData?.timelineEvents) return [];

    return [...timelineData.timelineEvents].sort(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    );
  }, [timelineData]);

  return {
    events: sortedEvents,
    isLoading: shouldQuery ? subscriptionsLoading || timelineLoading : false,
    subscribedEntityIds,
  };
}
