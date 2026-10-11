'use client';

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@/zero/observed-query';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import type {
  ProjectedAmendmentCollaborationState,
  ProjectedEventParticipationState,
  ProjectedGroupMembershipState,
  ProjectedMembershipRow,
  ProjectedSubscriptionState,
} from './types/projected-card-state';

type SubscribableEntityType = 'user' | 'group' | 'amendment' | 'event' | 'blog';

interface GroupStateArgs {
  id: string;
  memberCount: number;
  groupType?: string | null;
  connectedGroupId?: string | null;
  primarySiblingMembershipMode?: string | null;
}

interface EventStateArgs {
  id: string;
  participantCount: number;
  eventType?: string | null;
  visibility: string;
  groupId?: string | null;
}

interface SearchCardStateContextValue {
  getSubscriptionState: (
    entityType: SubscribableEntityType,
    entityId: string,
    subscriberCount: number
  ) => ProjectedSubscriptionState;
  getGroupState: (args: GroupStateArgs) => ProjectedGroupMembershipState;
  getEventState: (args: EventStateArgs) => ProjectedEventParticipationState;
  getAmendmentState: (
    amendmentId: string,
    collaboratorCount: number
  ) => ProjectedAmendmentCollaborationState;
}

const SearchCardStateContext = createContext<SearchCardStateContextValue | null>(null);

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

function membershipRole(membership: {
  membership_roles?: readonly {
    role?: { name?: string | null; sort_order?: number | null } | null;
  }[];
}) {
  const roles = (membership.membership_roles ?? [])
    .flatMap(link => (link.role ? [link.role] : []))
    .sort((left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1));
  return roles[0] ? { name: roles[0].name } : null;
}

function appendToIndex<T>(index: Map<string, T[]>, key: string | null | undefined, value: T) {
  if (!key) return;
  const rows = index.get(key);
  if (rows) {
    rows.push(value);
  } else {
    index.set(key, [value]);
  }
}

// Each domain retains its projections across unrelated viewer-query stages.
function memoizeProjection<Args extends unknown[], State extends object>(
  project: (...args: Args) => State
) {
  const cache = new Map<string, State>();
  return (...args: Args): State => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached) return cached;
    const state = project(...args);
    cache.set(key, state);
    return state;
  };
}

export function SearchCardStateProvider({
  children,
  contentTypes,
}: {
  children: ReactNode;
  contentTypes?: readonly string[];
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const includes = (type: string) => !contentTypes?.length || contentTypes.includes(type);
  const groupCards = includes('group');
  const eventCards = includes('event');
  const amendmentCards = includes('amendment');
  const requiredStage = eventCards ? 6 : amendmentCards ? 5 : groupCards ? 3 : 1;
  const [activatedUserId, setActivatedUserId] = useState<string | null>(null);
  const [queryStage, setQueryStage] = useState(0);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    let idleHandle: number | null = null;
    let fallbackHandle: ReturnType<typeof setTimeout> | null = null;

    setActivatedUserId(null);
    setQueryStage(0);
    if (!userId) return;

    const animationFrame = idleWindow.requestAnimationFrame(() => {
      const activate = () => {
        startTransition(() => {
          setActivatedUserId(userId);
          setQueryStage(1);
        });
      };

      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(activate, { timeout: 250 });
      } else {
        fallbackHandle = setTimeout(activate, 16);
      }
    });

    return () => {
      idleWindow.cancelAnimationFrame(animationFrame);
      if (idleHandle !== null) {
        idleWindow.cancelIdleCallback?.(idleHandle);
      }
      if (fallbackHandle !== null) {
        clearTimeout(fallbackHandle);
      }
    };
  }, [userId]);

  const enabled = Boolean(userId && activatedUserId === userId);
  const [subscriptions, subscriptionsResult] = useQuery(
    enabled && queryStage >= 1 ? queries.common.viewerSubscriptions({}) : undefined
  );
  const [memberships, membershipsResult] = useQuery(
    enabled && (groupCards || eventCards) && queryStage >= 2
      ? queries.rbac.viewerMemberships({})
      : undefined
  );
  const [guestAccesses, guestAccessesResult] = useQuery(
    enabled && groupCards && queryStage >= 3 ? queries.rbac.viewerGuestAccesses({}) : undefined
  );
  const [participations, participationsResult] = useQuery(
    enabled && eventCards && queryStage >= 4 ? queries.rbac.viewerParticipations({}) : undefined
  );
  const [collaborations, collaborationsResult] = useQuery(
    enabled && amendmentCards && queryStage >= 5
      ? queries.amendments.viewerCollaborations({})
      : undefined
  );
  const [delegations, delegationsResult] = useQuery(
    enabled && eventCards && queryStage >= 6 ? queries.events.viewerDelegations({}) : undefined
  );

  useEffect(() => {
    if (!enabled || queryStage < 1 || queryStage >= requiredStage) return;

    const resultTypes = [
      subscriptionsResult.type,
      groupCards || eventCards ? membershipsResult.type : 'complete',
      groupCards ? guestAccessesResult.type : 'complete',
      eventCards ? participationsResult.type : 'complete',
      amendmentCards ? collaborationsResult.type : 'complete',
    ];
    if (resultTypes[queryStage - 1] === 'unknown') return;

    const idleWindow = window as IdleWindow;
    let fallbackHandle: ReturnType<typeof setTimeout> | null = null;
    const advance = () => {
      startTransition(() => {
        setQueryStage(previous => (previous === queryStage ? previous + 1 : previous));
      });
    };
    const idleHandle =
      typeof idleWindow.requestIdleCallback === 'function'
        ? idleWindow.requestIdleCallback(advance, { timeout: 250 })
        : null;
    if (idleHandle === null) {
      fallbackHandle = setTimeout(advance, 16);
    }

    return () => {
      if (idleHandle !== null) {
        idleWindow.cancelIdleCallback?.(idleHandle);
      }
      if (fallbackHandle !== null) {
        clearTimeout(fallbackHandle);
      }
    };
  }, [
    collaborationsResult.type,
    amendmentCards,
    enabled,
    eventCards,
    guestAccessesResult.type,
    groupCards,
    membershipsResult.type,
    participationsResult.type,
    queryStage,
    requiredStage,
    subscriptionsResult.type,
  ]);

  const subscriptionsByEntity = useMemo(() => {
    const index = new Map<string, { id: string; subscriber_id: string }[]>();
    for (const subscription of subscriptions ?? []) {
      const projected = {
        id: subscription.id,
        subscriber_id: subscription.subscriber_id,
      };
      if (subscription.user_id) {
        appendToIndex(index, `user:${subscription.user_id}`, projected);
      }
      if (subscription.group_id) {
        appendToIndex(index, `group:${subscription.group_id}`, projected);
      }
      if (subscription.amendment_id) {
        appendToIndex(index, `amendment:${subscription.amendment_id}`, projected);
      }
      if (subscription.event_id) {
        appendToIndex(index, `event:${subscription.event_id}`, projected);
      }
      if (subscription.blog_id) {
        appendToIndex(index, `blog:${subscription.blog_id}`, projected);
      }
    }
    return index;
  }, [subscriptions]);

  const membershipsByGroup = useMemo(() => {
    const index = new Map<string, ProjectedMembershipRow[]>();
    for (const membership of memberships ?? []) {
      appendToIndex(index, membership.group_id, {
        id: membership.id,
        status: membership.status,
        role: membershipRole(membership),
      });
    }
    return index;
  }, [memberships]);

  const guestAccessesByGroup = useMemo(() => {
    const index = new Map<string, { id: string; status: string }[]>();
    for (const guestAccess of guestAccesses ?? []) {
      appendToIndex(index, guestAccess.group_id, {
        id: guestAccess.id,
        status: guestAccess.status,
      });
    }
    return index;
  }, [guestAccesses]);

  const participationsByEvent = useMemo(() => {
    const index = new Map<string, { id: string; user_id: string; status: string }[]>();
    for (const participation of participations ?? []) {
      appendToIndex(index, participation.event_id, {
        id: participation.id,
        user_id: participation.user_id,
        status: participation.status,
      });
    }
    return index;
  }, [participations]);

  const collaborationsByAmendment = useMemo(() => {
    const index = new Map<string, { id: string; status: string }[]>();
    for (const collaboration of collaborations ?? []) {
      appendToIndex(index, collaboration.amendment_id, {
        id: collaboration.id,
        status: collaboration.status,
      });
    }
    return index;
  }, [collaborations]);

  const delegationsByEvent = useMemo(() => {
    const index = new Map<string, { user_id: string; status: string }[]>();
    for (const delegation of delegations ?? []) {
      appendToIndex(index, delegation.event_id, {
        user_id: delegation.user_id,
        status: delegation.status,
      });
    }
    return index;
  }, [delegations]);

  const subscriptionLoading =
    Boolean(userId) && (!enabled || queryStage < 1 || subscriptionsResult.type === 'unknown');
  const membershipLoading =
    Boolean(userId) &&
    (!enabled ||
      queryStage < 3 ||
      membershipsResult.type === 'unknown' ||
      (groupCards && guestAccessesResult.type === 'unknown'));
  const participationLoading =
    Boolean(userId) &&
    (!enabled ||
      queryStage < 6 ||
      participationsResult.type === 'unknown' ||
      membershipsResult.type === 'unknown' ||
      delegationsResult.type === 'unknown');
  const collaborationLoading =
    Boolean(userId) && (!enabled || queryStage < 5 || collaborationsResult.type === 'unknown');

  const getSubscriptionState = useMemo<SearchCardStateContextValue['getSubscriptionState']>(
    () =>
      memoizeProjection(
        (entityType: SubscribableEntityType, entityId: string, subscriberCount: number) => ({
          subscriberCount,
          subscriptions: subscriptionsByEntity.get(`${entityType}:${entityId}`) ?? [],
          isLoading: subscriptionLoading,
        })
      ),
    [subscriptionsByEntity, subscriptionLoading, userId]
  );
  const getGroupState = useMemo<SearchCardStateContextValue['getGroupState']>(
    () =>
      memoizeProjection((args: GroupStateArgs) => ({
        group: {
          id: args.id,
          group_type: args.groupType,
          connected_group_id: args.connectedGroupId,
          primary_sibling_membership_mode: args.primarySiblingMembershipMode,
        },
        memberships: membershipsByGroup.get(args.id) ?? [],
        connectedGroupMemberships: args.connectedGroupId
          ? (membershipsByGroup.get(args.connectedGroupId) ?? [])
          : [],
        guestAccesses: guestAccessesByGroup.get(args.id) ?? [],
        memberCount: args.memberCount,
        isLoading: membershipLoading,
      })),
    [membershipsByGroup, guestAccessesByGroup, membershipLoading, userId]
  );
  const getEventState = useMemo<SearchCardStateContextValue['getEventState']>(
    () =>
      memoizeProjection((args: EventStateArgs) => ({
        event: {
          id: args.id,
          event_type: args.eventType,
          visibility: args.visibility,
          group: args.groupId
            ? {
                id: args.groupId,
                memberships: (membershipsByGroup.get(args.groupId) ?? []).map(row => ({
                  user_id: userId,
                  status: row.status,
                })),
              }
            : null,
          delegates: delegationsByEvent.get(args.id) ?? [],
        },
        participants: participationsByEvent.get(args.id) ?? [],
        participantCount: args.participantCount,
        isLoading: participationLoading,
      })),
    [membershipsByGroup, delegationsByEvent, participationsByEvent, participationLoading, userId]
  );
  const getAmendmentState = useMemo<SearchCardStateContextValue['getAmendmentState']>(
    () =>
      memoizeProjection((amendmentId: string, collaboratorCount: number) => ({
        collaborations: collaborationsByAmendment.get(amendmentId) ?? [],
        collaboratorCount,
        isLoading: collaborationLoading,
      })),
    [collaborationsByAmendment, collaborationLoading, userId]
  );
  const value = useMemo<SearchCardStateContextValue>(
    () => ({
      getSubscriptionState,
      getGroupState,
      getEventState,
      getAmendmentState,
    }),
    [getSubscriptionState, getGroupState, getEventState, getAmendmentState]
  );

  return (
    <SearchCardStateContext.Provider value={value}>{children}</SearchCardStateContext.Provider>
  );
}

export function useSearchCardState() {
  return useContext(SearchCardStateContext);
}
