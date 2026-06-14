import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

interface GroupConnectionStateOptions {
  groupId?: string;
  groupAId?: string;
  groupBId?: string;
  connectionId?: string;
}

export function useGroupConnectionState(options: GroupConnectionStateOptions = {}) {
  const { groupId, groupAId, groupBId, connectionId } = options;

  const [groupConnections, groupConnectionsResult] = useQuery(
    groupId ? queries.network.groupConnectionsByGroup({ groupId }) : undefined
  );
  const [pairConnections, pairConnectionsResult] = useQuery(
    groupAId && groupBId
      ? queries.network.groupConnectionsByPair({ groupAId, groupBId })
      : undefined
  );
  const [groupConnectionRequests, groupConnectionRequestsResult] = useQuery(
    groupId ? queries.network.groupConnectionRequestsByGroup({ groupId }) : undefined
  );
  const [pairConnectionRequests, pairConnectionRequestsResult] = useQuery(
    groupAId && groupBId
      ? queries.network.groupConnectionRequestsByPair({ groupAId, groupBId })
      : undefined
  );
  const [connection, connectionResult] = useQuery(
    connectionId ? queries.network.groupConnectionById({ id: connectionId }) : undefined
  );
  const [allConnections, allConnectionsResult] = useQuery(queries.network.allGroupConnections({}));

  return {
    groupConnections: groupConnections ?? [],
    groupConnectionsLoading: groupConnectionsResult.type === 'unknown',
    pairConnections: pairConnections ?? [],
    pairConnectionsLoading: pairConnectionsResult.type === 'unknown',
    groupConnectionRequests: groupConnectionRequests ?? [],
    groupConnectionRequestsLoading: groupConnectionRequestsResult.type === 'unknown',
    pairConnectionRequests: pairConnectionRequests ?? [],
    pairConnectionRequestsLoading: pairConnectionRequestsResult.type === 'unknown',
    connection,
    connectionLoading: connectionResult.type === 'unknown',
    allConnections: allConnections ?? [],
    allConnectionsLoading: allConnectionsResult.type === 'unknown',
  };
}
