import { useMemo } from 'react';
import { useQuery } from '@/zero/observed-query';
import { queries } from '../queries';

interface ActionStateOptions {
  amendmentId?: string;
  userId?: string;
}

export type AmendmentCollaborationStatus =
  'invited' | 'requested' | 'active' | 'collaborator' | 'member' | 'admin';

/** Subscription controls need scalar counts and the existing protected subscriber rows. */
export function useAmendmentSubscriptionState({ amendmentId }: ActionStateOptions = {}) {
  const [amendment, amendmentResult] = useQuery(
    amendmentId ? queries.amendments.byId({ id: amendmentId }) : undefined
  );
  const [subscribers, subscriberResult] = useQuery(
    amendmentId ? queries.amendments.subscribers({ amendment_id: amendmentId }) : undefined
  );
  const subscriberCount =
    subscriberResult.type === 'unknown'
      ? (amendment?.subscriber_count ?? 0)
      : (subscribers?.length ?? amendment?.subscriber_count ?? 0);
  return {
    subscribers,
    subscriberCount,
    isLoading:
      Boolean(amendmentId) &&
      (amendmentResult.type === 'unknown' || subscriberResult.type === 'unknown'),
  };
}

/** Preserve invitation/self/manager access without subscribing to the complete detail tree. */
export function useAmendmentCollaborationState({ amendmentId, userId }: ActionStateOptions = {}) {
  const [amendment, amendmentResult] = useQuery(
    amendmentId ? queries.amendments.byId({ id: amendmentId }) : undefined
  );
  const [collaborators, collaboratorsResult] = useQuery(
    amendmentId ? queries.amendments.collaborators({ amendment_id: amendmentId }) : undefined
  );
  const [ownRows, ownResult] = useQuery(
    amendmentId && userId
      ? queries.amendments.userCollaboration({ amendment_id: amendmentId, user_id: userId })
      : undefined
  );
  const collaboration = ownRows?.[0] ?? null;
  const status = (collaboration?.status as AmendmentCollaborationStatus | undefined) ?? null;
  const collaboratorCount = useMemo(
    () =>
      amendment?.collaborator_count ??
      collaborators?.filter(
        c =>
          c.status === 'active' ||
          c.status === 'collaborator' ||
          c.status === 'member' ||
          c.status === 'admin'
      ).length ??
      0,
    [amendment?.collaborator_count, collaborators]
  );
  return {
    collaboration,
    status,
    isCollaborator:
      status === 'active' || status === 'collaborator' || status === 'member' || status === 'admin',
    isAdmin: status === 'admin',
    hasRequested: status === 'requested',
    isInvited: status === 'invited',
    collaboratorCount,
    isLoading:
      Boolean(amendmentId) &&
      (amendmentResult.type === 'unknown' ||
        collaboratorsResult.type === 'unknown' ||
        (Boolean(userId) && ownResult.type === 'unknown')),
  };
}
