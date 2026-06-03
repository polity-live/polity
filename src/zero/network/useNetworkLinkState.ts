import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

interface NetworkLinkStateOptions {
  groupId?: string;
  groupAId?: string;
  groupBId?: string;
  linkId?: string;
}

export function useNetworkLinkState(options: NetworkLinkStateOptions = {}) {
  const { groupId, groupAId, groupBId, linkId } = options;

  const [groupLinks, groupLinksResult] = useQuery(
    groupId ? queries.network.networkLinksByGroup({ groupId }) : undefined
  );
  const [pairLinks, pairLinksResult] = useQuery(
    groupAId && groupBId ? queries.network.networkLinksByPair({ groupAId, groupBId }) : undefined
  );
  const [groupChangeRequests, groupChangeRequestsResult] = useQuery(
    groupId ? queries.network.networkLinkChangeRequestsByGroup({ groupId }) : undefined
  );
  const [pairChangeRequests, pairChangeRequestsResult] = useQuery(
    groupAId && groupBId
      ? queries.network.networkLinkChangeRequestsByPair({ groupAId, groupBId })
      : undefined
  );
  const [link, linkResult] = useQuery(
    linkId ? queries.network.networkLinkById({ id: linkId }) : undefined
  );
  const [allLinks, allLinksResult] = useQuery(queries.network.allNetworkLinks({}));

  return {
    groupLinks: groupLinks ?? [],
    groupLinksLoading: groupLinksResult.type === 'unknown',
    pairLinks: pairLinks ?? [],
    pairLinksLoading: pairLinksResult.type === 'unknown',
    groupChangeRequests: groupChangeRequests ?? [],
    groupChangeRequestsLoading: groupChangeRequestsResult.type === 'unknown',
    pairChangeRequests: pairChangeRequests ?? [],
    pairChangeRequestsLoading: pairChangeRequestsResult.type === 'unknown',
    link,
    linkLoading: linkResult.type === 'unknown',
    allLinks: allLinks ?? [],
    allLinksLoading: allLinksResult.type === 'unknown',
  };
}
