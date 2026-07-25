import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

interface GroupConnectionStateOptions {
  groupId?: string;
  groupAId?: string;
  groupBId?: string;
  connectionId?: string;
  enabled?: boolean;
  includeAll?: boolean;
}

export function useGroupConnectionState(options: GroupConnectionStateOptions = {}) {
  const { groupId, groupAId, groupBId, connectionId, enabled = true, includeAll } = options;
  const hasSpecificScope = Boolean(groupId || (groupAId && groupBId) || connectionId);
  const shouldLoadAll =
    enabled && (includeAll === true || (!hasSpecificScope && includeAll !== false));

  const [groupConnections, groupConnectionsResult] = useQuery(
    enabled && groupId ? queries.network.groupConnectionsByGroup({ groupId }) : undefined
  );
  const [pairConnections, pairConnectionsResult] = useQuery(
    enabled && groupAId && groupBId
      ? queries.network.groupConnectionsByPair({ groupAId, groupBId })
      : undefined
  );
  const [groupConnectionRequests, groupConnectionRequestsResult] = useQuery(
    enabled && groupId ? queries.network.groupConnectionRequestsByGroup({ groupId }) : undefined
  );
  const [pairConnectionRequests, pairConnectionRequestsResult] = useQuery(
    enabled && groupAId && groupBId
      ? queries.network.groupConnectionRequestsByPair({ groupAId, groupBId })
      : undefined
  );
  const [connection, connectionResult] = useQuery(
    enabled && connectionId ? queries.network.groupConnectionById({ id: connectionId }) : undefined
  );
  const [allConnections, allConnectionsResult] = useQuery(
    shouldLoadAll ? queries.network.allGroupConnections({}) : undefined
  );

  return {
    groupConnections: groupConnections ?? [],
    groupConnectionsLoading:
      Boolean(enabled && groupId) && groupConnectionsResult.type === 'unknown',
    pairConnections: pairConnections ?? [],
    pairConnectionsLoading:
      Boolean(enabled && groupAId && groupBId) && pairConnectionsResult.type === 'unknown',
    groupConnectionRequests: groupConnectionRequests ?? [],
    groupConnectionRequestsLoading:
      Boolean(enabled && groupId) && groupConnectionRequestsResult.type === 'unknown',
    pairConnectionRequests: pairConnectionRequests ?? [],
    pairConnectionRequestsLoading:
      Boolean(enabled && groupAId && groupBId) && pairConnectionRequestsResult.type === 'unknown',
    connection,
    connectionLoading: Boolean(enabled && connectionId) && connectionResult.type === 'unknown',
    allConnections: allConnections ?? [],
    allConnectionsLoading: shouldLoadAll && allConnectionsResult.type === 'unknown',
  };
}
