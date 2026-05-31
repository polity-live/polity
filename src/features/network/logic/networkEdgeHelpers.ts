import { MarkerType, type Edge } from '@xyflow/react';
import { getHierarchyRelationshipPair } from './groupRelationshipOrientation';
import type { NetworkRelationshipKind } from './networkRelationshipHelpers';
import type {
  NetworkConnectionDirection,
  EditableRightsLabelEdgeData,
  NetworkRelationshipDepth,
  NetworkEdgeRelationshipDirection,
  NetworkRelationshipDialogData,
  NetworkUserConnectionDirection,
} from '../types/networkEdge.types';
import type { GroupRelationshipType, NormalizedGroupRelationship } from '../types/network.types';

type TranslationFn = (key: string, defaultValue?: string) => string;
type DirectionInput = Exclude<NetworkEdgeRelationshipDirection, 'bidirectional'>;

interface CreateNetworkRelationshipEdgeDataArgs {
  rights: string[];
  relationshipKinds?: NetworkRelationshipKind[];
  rightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  relationshipType?: GroupRelationshipType | 'membership';
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  userConnectionDirections?: NetworkUserConnectionDirection[];
  relationshipDepth?: NetworkRelationshipDepth;
  sourceName?: string | null;
  targetName?: string | null;
}

export const NETWORK_CONNECTION_DIRECTION_COLORS: Record<NetworkConnectionDirection, string> = {
  bidirectional: '#7c3aed',
  incoming: '#2563eb',
  outgoing: '#d97706',
};

function isForwardDirection(direction: NetworkEdgeRelationshipDirection | undefined) {
  return direction === 'forward' || direction === 'bidirectional';
}

function isBackwardDirection(direction: NetworkEdgeRelationshipDirection | undefined) {
  return direction === 'backward' || direction === 'bidirectional';
}

export function addUniqueValue<T>(values: T[], value: T) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

export function mergeNetworkRightRelationshipKind(
  existingKind: NetworkRelationshipKind | undefined,
  nextKind: NetworkRelationshipKind | null
) {
  if (!nextKind) {
    return existingKind;
  }

  if (!existingKind) {
    return nextKind;
  }

  if (existingKind === 'active' || nextKind === 'active') {
    return 'active';
  }

  return existingKind;
}

export function mergeNetworkEdgeRelationshipDirection(
  existingDirection: NetworkEdgeRelationshipDirection | undefined,
  nextDirection: DirectionInput
): NetworkEdgeRelationshipDirection {
  if (!existingDirection || existingDirection === nextDirection) {
    return nextDirection;
  }

  return 'bidirectional';
}

export function mergeNetworkConnectionDirection(
  existingDirection: NetworkConnectionDirection | undefined,
  nextDirection: NetworkUserConnectionDirection
): NetworkConnectionDirection {
  if (!existingDirection || existingDirection === nextDirection) {
    return nextDirection;
  }

  return 'bidirectional';
}

export function getNetworkConnectionDirectionColor(
  direction: NetworkConnectionDirection | undefined,
  fallbackColor: string
) {
  return direction ? NETWORK_CONNECTION_DIRECTION_COLORS[direction] : fallbackColor;
}

export function hasBidirectionalRelationshipDirections(
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>
) {
  const directionValues = Object.values(rightEdgeDirections ?? {});

  if (directionValues.length === 0) {
    return false;
  }

  if (directionValues.includes('bidirectional')) {
    return true;
  }

  return directionValues.some(isForwardDirection) && directionValues.some(isBackwardDirection);
}

export function getRelationshipStrokeColor(
  fallbackColor: string,
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>
) {
  return hasBidirectionalRelationshipDirections(rightEdgeDirections)
    ? NETWORK_CONNECTION_DIRECTION_COLORS.bidirectional
    : fallbackColor;
}

export function getVisibleRelationshipStrokeColor({
  fallbackColor,
  connectionDirection,
  rightEdgeDirections,
}: {
  fallbackColor: string;
  connectionDirection?: NetworkConnectionDirection;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
}) {
  if (hasBidirectionalRelationshipDirections(rightEdgeDirections)) {
    return NETWORK_CONNECTION_DIRECTION_COLORS.bidirectional;
  }

  return getNetworkConnectionDirectionColor(connectionDirection, fallbackColor);
}

export function getAnchorUsageConnectionDirection({
  edgeDirection,
  anchorSide,
}: {
  edgeDirection: NetworkEdgeRelationshipDirection;
  anchorSide: 'source' | 'target';
}): NetworkConnectionDirection {
  if (edgeDirection === 'bidirectional') {
    return 'bidirectional';
  }

  if (anchorSide === 'source') {
    return edgeDirection === 'forward' ? 'incoming' : 'outgoing';
  }

  return edgeDirection === 'forward' ? 'outgoing' : 'incoming';
}

function getConnectionDirectionFromFilters(
  connectionDirections: readonly NetworkUserConnectionDirection[]
): NetworkConnectionDirection | undefined {
  const hasIncoming = connectionDirections.includes('incoming');
  const hasOutgoing = connectionDirections.includes('outgoing');

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

function filterRecordToVisibleRights<T>(
  record: Record<string, T> | undefined,
  visibleRights: readonly string[]
) {
  if (!record) {
    return undefined;
  }

  return Object.fromEntries(
    visibleRights
      .filter(right => Object.prototype.hasOwnProperty.call(record, right))
      .map(right => [right, record[right]])
  ) as Record<string, T>;
}

export function buildSingleDirectionRightEdgeDirections(
  rights: readonly string[],
  direction: DirectionInput = 'forward'
) {
  return Object.fromEntries(rights.map(right => [right, direction])) as Record<
    string,
    NetworkEdgeRelationshipDirection
  >;
}

export function buildHierarchyRightEdgeDirections(
  relationships: readonly NormalizedGroupRelationship[],
  parentGroupId: string,
  childGroupId: string
) {
  const directions: Record<string, NetworkEdgeRelationshipDirection> = {};

  relationships.forEach(relationship => {
    const hierarchyPair = getHierarchyRelationshipPair(relationship);
    if (
      !hierarchyPair ||
      hierarchyPair.parentGroupId !== parentGroupId ||
      hierarchyPair.childGroupId !== childGroupId
    ) {
      return;
    }

    const right = relationship.with_right ?? '';
    if (!right) {
      return;
    }

    const nextDirection =
      relationship.group_id === parentGroupId && relationship.related_group_id === childGroupId
        ? 'forward'
        : relationship.group_id === childGroupId && relationship.related_group_id === parentGroupId
          ? 'backward'
          : null;

    if (!nextDirection) {
      return;
    }

    directions[right] = mergeNetworkEdgeRelationshipDirection(directions[right], nextDirection);
  });

  return directions;
}

export function buildRelationshipEdgeMarkers(
  strokeColor: string,
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>
) {
  const directionValues = Object.values(rightEdgeDirections ?? {});
  const hasBackwardDirection = directionValues.some(isBackwardDirection);
  const hasForwardDirection =
    directionValues.length === 0 || directionValues.some(isForwardDirection);

  return {
    markerStart: hasBackwardDirection
      ? {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        }
      : undefined,
    markerEnd: hasForwardDirection
      ? {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        }
      : undefined,
  };
}

export function createNetworkRelationshipEdgeData({
  rights,
  relationshipKinds = [],
  rightRelationshipKinds = {},
  relationshipType,
  rightEdgeDirections,
  rightConnectionDirections,
  userConnectionDirections,
  relationshipDepth,
  sourceName,
  targetName,
}: CreateNetworkRelationshipEdgeDataArgs): EditableRightsLabelEdgeData {
  return {
    rights,
    relationshipKinds,
    rightRelationshipKinds,
    relationshipType,
    rightEdgeDirections,
    rightConnectionDirections,
    userConnectionDirections,
    relationshipDepth,
    sourceName,
    targetName,
  };
}

function buildRelationshipStatusLabel(
  relationshipKinds: readonly NetworkRelationshipKind[],
  fallbackLabel: string | null,
  t: TranslationFn
) {
  const requestLabels = relationshipKinds
    .filter(kind => kind === 'incoming' || kind === 'outgoing')
    .map(kind =>
      kind === 'incoming'
        ? t('common.network.incomingRequest', 'Incoming request')
        : t('common.network.outgoingRequest', 'Outgoing request')
    );

  return requestLabels.join(', ') || fallbackLabel;
}

export function buildNetworkRelationshipDialogData(
  edge: Edge,
  t: TranslationFn
): NetworkRelationshipDialogData {
  const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;
  const visibleRights = Array.isArray(edgeData?.visibleRights)
    ? (edgeData.visibleRights as string[])
    : Array.isArray(edgeData?.rights)
      ? (edgeData.rights as string[])
      : [];
  const visibleRightRelationshipKinds = filterRecordToVisibleRights(
    edgeData?.visibleRightRelationshipKinds ?? edgeData?.rightRelationshipKinds,
    visibleRights
  ) as Record<string, NetworkRelationshipKind> | undefined;
  const relationshipKinds = visibleRightRelationshipKinds
    ? Array.from(new Set(Object.values(visibleRightRelationshipKinds)))
    : Array.isArray(edgeData?.relationshipKinds)
      ? (edgeData.relationshipKinds as NetworkRelationshipKind[])
      : [];
  const userConnectionDirections = Array.isArray(edgeData?.userConnectionDirections)
    ? (edgeData.userConnectionDirections as NetworkUserConnectionDirection[])
    : undefined;

  return {
    source: edge.source,
    target: edge.target,
    sourceName: typeof edgeData?.sourceName === 'string' ? edgeData.sourceName : null,
    targetName: typeof edgeData?.targetName === 'string' ? edgeData.targetName : null,
    rights: visibleRights,
    relationshipKinds,
    rightRelationshipKinds: visibleRightRelationshipKinds,
    relationshipType:
      edgeData?.relationshipType === 'parent' ||
      edgeData?.relationshipType === 'child' ||
      edgeData?.relationshipType === 'sibling' ||
      edgeData?.relationshipType === 'membership'
        ? edgeData.relationshipType
        : undefined,
    rightEdgeDirections: filterRecordToVisibleRights(
      edgeData?.rightEdgeDirections,
      visibleRights
    ) as Record<string, NetworkEdgeRelationshipDirection> | undefined,
    rightConnectionDirections: filterRecordToVisibleRights(
      edgeData?.visibleRightConnectionDirections ?? edgeData?.rightConnectionDirections,
      visibleRights
    ) as Record<string, NetworkConnectionDirection> | undefined,
    connectionDirection:
      edgeData?.visibleConnectionDirection ??
      getConnectionDirectionFromFilters(userConnectionDirections ?? []),
    userConnectionDirections,
    relationshipDepth: edgeData?.relationshipDepth,
    label: buildRelationshipStatusLabel(
      relationshipKinds,
      typeof edge.label === 'string' ? edge.label : null,
      t
    ),
  };
}
