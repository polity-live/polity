import type { Edge, Node } from '@xyflow/react';
import type {
  NetworkConnectionDirection,
  NetworkConnectionDirectionFilter,
  NetworkDepthFilter,
  EditableRightsLabelEdgeData,
  NetworkEdgeRelationshipDirection,
  NetworkRelationshipDepth,
  NetworkUserConnectionDirection,
} from '@/features/network/types/networkEdge.types';
import type { NetworkRelationshipKind } from '@/features/network/logic/networkRelationshipHelpers';
import {
  getAnimatedFlowDirection,
  getVisibleFlowDirection,
  getVisibleRelationshipStrokeColor,
} from '@/features/network/logic/networkEdgeHelpers';

function hasForwardEdgeDirection(direction: NetworkEdgeRelationshipDirection | undefined) {
  return direction === 'forward' || direction === 'bidirectional';
}

function hasBackwardEdgeDirection(direction: NetworkEdgeRelationshipDirection | undefined) {
  return direction === 'backward' || direction === 'bidirectional';
}

function matchesRelationshipStatus(
  relationshipKind: NetworkRelationshipKind | undefined,
  filterValue: NetworkRelationshipKind
) {
  return (relationshipKind ?? 'active') === filterValue;
}

function matchesRelationshipDepth(
  relationshipDepth: NetworkRelationshipDepth | undefined,
  filterValue: NetworkDepthFilter
) {
  if (filterValue === 'all') {
    return true;
  }

  return (relationshipDepth ?? 'direct') === filterValue;
}

function mergeConnectionDirections(
  directions: readonly (NetworkConnectionDirection | undefined)[]
): NetworkConnectionDirection | undefined {
  let hasIncoming = false;
  let hasOutgoing = false;

  directions.forEach(direction => {
    if (!direction) {
      return;
    }

    if (direction === 'bidirectional') {
      hasIncoming = true;
      hasOutgoing = true;
      return;
    }

    if (direction === 'incoming') {
      hasIncoming = true;
      return;
    }

    hasOutgoing = true;
  });

  if (hasIncoming && hasOutgoing) {
    return 'bidirectional';
  }

  if (hasIncoming) {
    return 'incoming';
  }

  if (hasOutgoing) {
    return 'outgoing';
  }

  return undefined;
}

function getEdgeLevelConnectionDirection(
  edgeData: EditableRightsLabelEdgeData | undefined
): NetworkConnectionDirection | undefined {
  const userConnectionDirections = Array.isArray(edgeData?.userConnectionDirections)
    ? edgeData.userConnectionDirections
    : [];

  return mergeConnectionDirections(userConnectionDirections);
}

function matchesConnectionDirection(
  direction: NetworkConnectionDirection | undefined,
  filterValue: NetworkConnectionDirectionFilter
) {
  if (filterValue === 'all') {
    return true;
  }

  return direction === 'bidirectional' || direction === filterValue;
}

function pickRecordValues<T>(record: Record<string, T> | undefined, rights: readonly string[]) {
  if (!record) {
    return undefined;
  }

  return Object.fromEntries(
    rights
      .filter(right => Object.prototype.hasOwnProperty.call(record, right))
      .map(right => [right, record[right]])
  ) as Record<string, T>;
}

function applyVisibleRights(edge: Edge, visibleRights: string[]): Edge | null {
  const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;

  if (!edgeData?.rights) {
    return edge;
  }

  if (visibleRights.length === 0) {
    return null;
  }

  const visibleRightEdgeDirections = pickRecordValues(edgeData.rightEdgeDirections, visibleRights);
  const visibleDirectionValues = visibleRights
    .map(right => visibleRightEdgeDirections?.[right])
    .filter((direction): direction is NetworkEdgeRelationshipDirection => !!direction);
  const visibleRightRelationshipKinds = pickRecordValues(
    edgeData.visibleRightRelationshipKinds ?? edgeData.rightRelationshipKinds,
    visibleRights
  );
  const visibleRightConnectionDirections = pickRecordValues(
    edgeData.visibleRightConnectionDirections ?? edgeData.rightConnectionDirections,
    visibleRights
  );
  const visibleFlowDirection = getVisibleFlowDirection(visibleRightEdgeDirections);
  const visibleConnectionDirection =
    mergeConnectionDirections(
      visibleRights.map(right => visibleRightConnectionDirections?.[right])
    ) ?? getEdgeLevelConnectionDirection(edgeData);
  const hasForwardDirection =
    visibleDirectionValues.length === 0 || visibleDirectionValues.some(hasForwardEdgeDirection);
  const hasBackwardDirection = visibleDirectionValues.some(hasBackwardEdgeDirection);
  const animatedFlowDirection = getAnimatedFlowDirection(visibleFlowDirection);

  return {
    ...edge,
    animated: animatedFlowDirection !== null,
    markerStart: hasBackwardDirection ? (edge.markerStart ?? edge.markerEnd) : undefined,
    markerEnd: hasForwardDirection ? (edge.markerEnd ?? edge.markerStart) : undefined,
    style: {
      ...edge.style,
      stroke: getVisibleRelationshipStrokeColor({
        fallbackColor: typeof edge.style?.stroke === 'string' ? edge.style.stroke : '#64748b',
        connectionDirection: visibleConnectionDirection,
        rightEdgeDirections: visibleRightEdgeDirections,
      }),
      animationDirection: animatedFlowDirection === 'backward' ? 'reverse' : undefined,
    },
    data: {
      ...edgeData,
      visibleRights,
      visibleRightRelationshipKinds,
      visibleRightConnectionDirections,
      visibleConnectionDirection,
      visibleFlowDirection,
    },
  };
}

/**
 * Filter edges by selected right types. Edges without rights data (e.g. member edges)
 * are always kept. Returns filtered edges with updated rights data for the custom edge renderer.
 */
export function filterEdgesByRights(
  edges: Edge[],
  selectedRights: Set<string>,
  alwaysShowEdgeIds?: Set<string>
): Edge[] {
  return edges
    .map(edge => {
      if (alwaysShowEdgeIds?.has(edge.id)) return edge;

      const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;

      if (!edgeData?.rights) return edge;

      const rights = edgeData.rights as string[];
      if (rights.length === 0) return edge; // Member edges

      const visibleRights = rights.filter(right => selectedRights.has(right));

      return applyVisibleRights(edge, visibleRights);
    })
    .filter((edge): edge is Edge => edge !== null);
}

export function filterEdgesByRelationshipStatus(
  edges: Edge[],
  relationshipStatusFilter: NetworkRelationshipKind,
  alwaysShowEdgeIds?: Set<string>
): Edge[] {
  return edges
    .map(edge => {
      if (alwaysShowEdgeIds?.has(edge.id)) {
        return edge;
      }

      const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;
      const visibleRights = Array.isArray(edgeData?.visibleRights)
        ? (edgeData.visibleRights as string[])
        : Array.isArray(edgeData?.rights)
          ? (edgeData.rights as string[])
          : [];

      if (visibleRights.length === 0) {
        if (
          !matchesRelationshipStatus(edgeData?.relationshipKinds?.[0], relationshipStatusFilter)
        ) {
          return null;
        }

        return edge;
      }

      const nextVisibleRights = visibleRights.filter(right =>
        matchesRelationshipStatus(
          edgeData?.visibleRightRelationshipKinds?.[right] ??
            edgeData?.rightRelationshipKinds?.[right],
          relationshipStatusFilter
        )
      );

      return applyVisibleRights(edge, nextVisibleRights);
    })
    .filter((edge): edge is Edge => edge !== null);
}

export function filterEdgesByConnectionDirections(
  edges: Edge[],
  selectedConnectionDirections: Set<NetworkUserConnectionDirection>,
  alwaysShowEdgeIds?: Set<string>
): Edge[] {
  const showAllConnectionDirections = selectedConnectionDirections.size === 2;
  const directionFilter: NetworkConnectionDirectionFilter = showAllConnectionDirections
    ? 'all'
    : selectedConnectionDirections.has('incoming')
      ? 'incoming'
      : 'outgoing';

  return edges
    .map(edge => {
      if (alwaysShowEdgeIds?.has(edge.id)) {
        return edge;
      }

      const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;
      const edgeRights = Array.isArray(edgeData?.visibleRights)
        ? edgeData.visibleRights
        : Array.isArray(edgeData?.rights)
          ? edgeData.rights
          : [];

      if (edgeRights.length === 0) {
        const edgeConnectionDirection = getEdgeLevelConnectionDirection(edgeData);
        return matchesConnectionDirection(edgeConnectionDirection, directionFilter) ? edge : null;
      }

      const nextVisibleRights = edgeRights.filter(right =>
        matchesConnectionDirection(
          edgeData?.visibleRightConnectionDirections?.[right] ??
            edgeData?.rightConnectionDirections?.[right] ??
            (edgeData?.visibleRightConnectionDirections || edgeData?.rightConnectionDirections
              ? undefined
              : getEdgeLevelConnectionDirection(edgeData)),
          directionFilter
        )
      );

      return applyVisibleRights(edge, nextVisibleRights);
    })
    .filter((edge): edge is Edge => edge !== null);
}

export function filterEdgesByRelationshipDepth(
  edges: Edge[],
  relationshipDepthFilter: NetworkDepthFilter,
  alwaysShowEdgeIds?: Set<string>
): Edge[] {
  return edges.filter(edge => {
    if (alwaysShowEdgeIds?.has(edge.id)) {
      return true;
    }

    const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;

    return matchesRelationshipDepth(edgeData?.relationshipDepth, relationshipDepthFilter);
  });
}

/**
 * Filter nodes to only show those connected via visible edges.
 * Nodes listed in alwaysIncludeIds are always kept.
 */
export function filterNodesByEdges<T extends Node>(
  nodes: T[],
  edges: Edge[],
  alwaysIncludeIds: string[]
): T[] {
  const connectedNodeIds = new Set<string>(alwaysIncludeIds);

  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  return nodes.filter(node => connectedNodeIds.has(node.id));
}
