import type { PrimaryEntityTone } from '@/features/shared/theme';
import { MarkerType, Position, type Edge } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { MEMBERSHIP_FLOW_RIGHT } from '@/features/shared/ui/status';
import { getHierarchyRelationshipPair } from './groupRelationshipOrientation';
import type { NetworkRelationshipKind } from './networkRelationshipHelpers';
import { getRelativeMembershipDirectionForRelationship } from './networkRelationshipHelpers';
import type {
  NetworkEdgeAnchorStrategy,
  NetworkConnectionDirection,
  EditableRightsLabelEdgeData,
  NetworkRelationshipDepth,
  NetworkEdgeRelationshipDirection,
  NetworkRelationshipDialogData,
  NetworkUserConnectionDirection,
} from '../types/networkEdge.types';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  NormalizedGroupRelationship,
  RelativeMembershipDirection,
} from '../types/network.types';

type TranslationFn = (key: string, defaultValue?: string) => string;
type DirectionInput = Exclude<NetworkEdgeRelationshipDirection, 'bidirectional'>;
export type CivicNetworkEdgeTone =
  'neutral' | 'accent' | 'info' | 'warning' | 'success' | 'danger' | 'group' | PrimaryEntityTone;

export interface CivicNetworkEdgeStyleArgs {
  tone?: CivicNetworkEdgeTone;
  color?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  dashed?: boolean;
  animationDirection?: 'reverse';
}

export interface CivicNetworkLabelStyleArgs {
  tone?: CivicNetworkEdgeTone;
  color?: string;
}

type CivicNetworkEdgeStyle = CSSProperties & {
  animationDirection?: 'reverse';
};

interface CreateNetworkRelationshipEdgeDataArgs {
  rights: string[];
  relationshipKinds?: NetworkRelationshipKind[];
  rightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  relationshipType?: GroupRelationshipType | 'membership';
  membershipMode?: CanonicalMembershipMode | null;
  membershipDirection?: RelativeMembershipDirection | null;
  membershipSourceGroupId?: string | null;
  membershipTargetGroupId?: string | null;
  membershipSourceGroupName?: string | null;
  membershipTargetGroupName?: string | null;
  membershipRequiredSourceRoleId?: string | null;
  membershipRequiredSourceRoleName?: string | null;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  visibleFlowDirection?: NetworkEdgeRelationshipDirection | null;
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  userConnectionDirections?: NetworkUserConnectionDirection[];
  relationshipDepth?: NetworkRelationshipDepth;
  sourceGroupId?: string;
  targetGroupId?: string;
  sourceName?: string | null;
  targetName?: string | null;
  currentGroupId?: string;
  currentGroupName?: string | null;
  selectedGroupId?: string;
  selectedGroupName?: string | null;
  rightDisplayDirections?: Record<string, GroupRelationshipDirection>;
  anchorStrategy?: NetworkEdgeAnchorStrategy;
  useInnerVerticalAnchors?: boolean;
  bendPoints?: import('../types/networkEdge.types').NetworkEdgeBendPoint[];
  edgeEditingEnabled?: boolean;
  onBendPointsChange?: (
    edgeId: string,
    bendPoints: import('../types/networkEdge.types').NetworkEdgeBendPoint[]
  ) => void;
}

interface ResolveNetworkRelationshipPreviewContextArgs {
  graphRootGroupId?: string;
  currentGroupId?: string;
  structuralType: GroupRelationshipType;
  sourceGroupId: string;
  targetGroupId: string;
  sourceGroupName: string | null;
  targetGroupName: string | null;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  memberSourceGroupId?: string | null;
  memberTargetGroupId?: string | null;
}

interface BuildNetworkRelationshipEdgeArgs {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourceGroupId: string;
  targetGroupId: string;
  structuralType: GroupRelationshipType;
  rights: string[];
  relationshipKinds?: NetworkRelationshipKind[];
  rightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  membershipMode?: CanonicalMembershipMode | null;
  memberSourceGroupId?: string | null;
  memberTargetGroupId?: string | null;
  membershipRequiredSourceRoleId?: string | null;
  membershipRequiredSourceRoleName?: string | null;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  relationshipDepth?: NetworkRelationshipDepth;
  fallbackStrokeColor: string;
  strokeDasharray?: string;
  sourceName?: string | null;
  targetName?: string | null;
  graphRootGroupId?: string;
  currentGroupId?: string;
  previewCurrentGroupId?: string;
  anchorStrategy?: NetworkEdgeAnchorStrategy;
  bendPoints?: import('../types/networkEdge.types').NetworkEdgeBendPoint[];
  edgeEditingEnabled?: boolean;
  onBendPointsChange?: (
    edgeId: string,
    bendPoints: import('../types/networkEdge.types').NetworkEdgeBendPoint[]
  ) => void;
}

interface NetworkEdgeAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResolvedInnerAutoEdgeAnchors {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

const CIVIC_NETWORK_EDGE_COLORS: Record<CivicNetworkEdgeTone, string> = {
  neutral: 'var(--border)',
  accent: 'var(--badge-accent-border)',
  info: 'var(--badge-info-border)',
  warning: 'var(--badge-warning-border)',
  success: 'var(--badge-success-border)',
  danger: 'var(--badge-danger-border)',
  group: 'var(--entity-group-border)',
  user: 'var(--entity-user-border)',
  event: 'var(--entity-event-border)',
  amendment: 'var(--entity-amendment-border)',
  blog: 'var(--entity-blog-border)',
};

export const NETWORK_CONNECTION_DIRECTION_COLORS: Record<NetworkConnectionDirection, string> = {
  bidirectional: CIVIC_NETWORK_EDGE_COLORS.accent,
  incoming: CIVIC_NETWORK_EDGE_COLORS.info,
  outgoing: CIVIC_NETWORK_EDGE_COLORS.warning,
};

export function getCivicNetworkEdgeColor(tone: CivicNetworkEdgeTone = 'neutral'): string {
  return CIVIC_NETWORK_EDGE_COLORS[tone] ?? CIVIC_NETWORK_EDGE_COLORS.neutral;
}

export function getCivicNetworkEdgeStyle({
  tone = 'neutral',
  color,
  strokeWidth = 2,
  strokeDasharray,
  dashed,
  animationDirection,
}: CivicNetworkEdgeStyleArgs = {}): CivicNetworkEdgeStyle {
  return {
    stroke: color ?? getCivicNetworkEdgeColor(tone),
    strokeWidth,
    strokeDasharray: strokeDasharray ?? (dashed ? '5 5' : undefined),
    animationDirection,
  };
}

export function getCivicNetworkLabelStyle({
  tone = 'neutral',
  color,
}: CivicNetworkLabelStyleArgs = {}) {
  const resolvedColor = color ?? getCivicNetworkEdgeColor(tone);

  return {
    labelStyle: {
      fill: 'var(--foreground)',
      color: 'var(--foreground)',
      fontWeight: 600,
    } satisfies CSSProperties,
    labelBgStyle: {
      fill: 'var(--card)',
      stroke: resolvedColor,
      strokeWidth: 1,
    } satisfies CSSProperties,
    labelBgPadding: [8, 5] as [number, number],
    labelBgBorderRadius: 8,
  };
}

export function resolveInnerAutoEdgeAnchors({
  sourceRect,
  targetRect,
}: {
  sourceRect: NetworkEdgeAnchorRect;
  targetRect: NetworkEdgeAnchorRect;
}): ResolvedInnerAutoEdgeAnchors {
  const sourceCenterX = sourceRect.x + sourceRect.width / 2;
  const sourceCenterY = sourceRect.y + sourceRect.height / 2;
  const targetCenterX = targetRect.x + targetRect.width / 2;
  const targetCenterY = targetRect.y + targetRect.height / 2;
  const deltaX = targetCenterX - sourceCenterX;
  const deltaY = targetCenterY - sourceCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    const sourceIsLeftOfTarget = sourceCenterX <= targetCenterX;

    return {
      sourceX: sourceIsLeftOfTarget ? sourceRect.x + sourceRect.width : sourceRect.x,
      sourceY: sourceCenterY,
      targetX: sourceIsLeftOfTarget ? targetRect.x : targetRect.x + targetRect.width,
      targetY: targetCenterY,
      sourcePosition: sourceIsLeftOfTarget ? Position.Right : Position.Left,
      targetPosition: sourceIsLeftOfTarget ? Position.Left : Position.Right,
    };
  }

  const sourceIsAboveTarget = sourceCenterY <= targetCenterY;

  return {
    sourceX: sourceCenterX,
    sourceY: sourceIsAboveTarget ? sourceRect.y + sourceRect.height : sourceRect.y,
    targetX: targetCenterX,
    targetY: sourceIsAboveTarget ? targetRect.y : targetRect.y + targetRect.height,
    sourcePosition: sourceIsAboveTarget ? Position.Bottom : Position.Top,
    targetPosition: sourceIsAboveTarget ? Position.Top : Position.Bottom,
  };
}

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

export function getVisibleFlowDirection(
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>
): NetworkEdgeRelationshipDirection | null {
  const directionValues = Object.values(rightEdgeDirections ?? {});

  if (directionValues.length === 0) {
    return null;
  }

  if (directionValues.includes('bidirectional')) {
    return 'bidirectional';
  }

  const hasForward = directionValues.some(direction => direction === 'forward');
  const hasBackward = directionValues.some(direction => direction === 'backward');

  if (hasForward && hasBackward) {
    return 'bidirectional';
  }

  if (hasForward) {
    return 'forward';
  }

  if (hasBackward) {
    return 'backward';
  }

  return null;
}

export function getAnimatedFlowDirection(
  visibleFlowDirection: NetworkEdgeRelationshipDirection | null | undefined
) {
  return visibleFlowDirection === 'forward' || visibleFlowDirection === 'backward'
    ? visibleFlowDirection
    : null;
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

function isMembershipFlowEnabled(membershipMode: CanonicalMembershipMode | null | undefined) {
  return Boolean(membershipMode && membershipMode !== 'none');
}

function getMembershipFlowDirection({
  sourceGroupId,
  targetGroupId,
  memberSourceGroupId,
  memberTargetGroupId,
}: {
  sourceGroupId: string;
  targetGroupId: string;
  memberSourceGroupId?: string | null;
  memberTargetGroupId?: string | null;
}): DirectionInput | null {
  if (!memberSourceGroupId || !memberTargetGroupId) {
    return null;
  }

  if (memberSourceGroupId === sourceGroupId && memberTargetGroupId === targetGroupId) {
    return 'forward';
  }

  if (memberSourceGroupId === targetGroupId && memberTargetGroupId === sourceGroupId) {
    return 'backward';
  }

  return null;
}

function withMembershipFlowChannel({
  rights,
  relationshipKinds,
  rightRelationshipKinds,
  rightEdgeDirections,
  membershipMode,
  sourceGroupId,
  targetGroupId,
  memberSourceGroupId,
  memberTargetGroupId,
}: {
  rights: string[];
  relationshipKinds: readonly NetworkRelationshipKind[];
  rightRelationshipKinds: Record<string, NetworkRelationshipKind>;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  membershipMode?: CanonicalMembershipMode | null;
  sourceGroupId: string;
  targetGroupId: string;
  memberSourceGroupId?: string | null;
  memberTargetGroupId?: string | null;
}) {
  const membershipDirection = isMembershipFlowEnabled(membershipMode)
    ? getMembershipFlowDirection({
        sourceGroupId,
        targetGroupId,
        memberSourceGroupId,
        memberTargetGroupId,
      })
    : null;

  if (!membershipDirection) {
    return {
      rights,
      rightRelationshipKinds,
      rightEdgeDirections,
    };
  }

  const structureKind = relationshipKinds[0] ?? 'active';

  return {
    rights: rights.includes(MEMBERSHIP_FLOW_RIGHT) ? rights : [...rights, MEMBERSHIP_FLOW_RIGHT],
    rightRelationshipKinds: {
      ...rightRelationshipKinds,
      [MEMBERSHIP_FLOW_RIGHT]: structureKind,
    },
    rightEdgeDirections: {
      ...(rightEdgeDirections ?? {}),
      [MEMBERSHIP_FLOW_RIGHT]: membershipDirection,
    },
  };
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

export function buildCurrentPerspectiveRightDisplayDirections({
  currentNodeId,
  sourceId,
  targetId,
  rightEdgeDirections,
}: {
  currentNodeId: string;
  sourceId: string;
  targetId: string;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
}): Record<string, GroupRelationshipDirection> | undefined {
  if (!rightEdgeDirections) {
    return undefined;
  }

  const currentIsSource = currentNodeId === sourceId;
  const currentIsTarget = currentNodeId === targetId;

  if (!currentIsSource && !currentIsTarget) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(rightEdgeDirections).map(([right, direction]) => {
      if (direction === 'bidirectional') {
        return [right, 'mutual'];
      }

      if (currentIsSource) {
        return [
          right,
          direction === 'forward'
            ? 'partner_grants_right_to_current'
            : 'current_grants_right_to_partner',
        ];
      }

      return [
        right,
        direction === 'forward'
          ? 'current_grants_right_to_partner'
          : 'partner_grants_right_to_current',
      ];
    })
  ) as Record<string, GroupRelationshipDirection>;
}

export function buildCurrentPerspectiveRightConnectionDirections({
  currentNodeId,
  sourceId,
  targetId,
  rightEdgeDirections,
}: {
  currentNodeId: string;
  sourceId: string;
  targetId: string;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
}): Record<string, NetworkConnectionDirection> | undefined {
  if (!rightEdgeDirections) {
    return undefined;
  }

  const currentIsSource = currentNodeId === sourceId;
  const currentIsTarget = currentNodeId === targetId;

  if (!currentIsSource && !currentIsTarget) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(rightEdgeDirections).map(([right, direction]) => {
      if (direction === 'bidirectional') {
        return [right, 'bidirectional'];
      }

      if (currentIsSource) {
        return [right, direction === 'forward' ? 'outgoing' : 'incoming'];
      }

      return [right, direction === 'forward' ? 'incoming' : 'outgoing'];
    })
  ) as Record<string, NetworkConnectionDirection>;
}

export function getNetworkUserConnectionDirections(
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>
): NetworkUserConnectionDirection[] {
  const values = Object.values(rightConnectionDirections ?? {});
  const directions: NetworkUserConnectionDirection[] = [];

  if (values.some(value => value === 'incoming' || value === 'bidirectional')) {
    directions.push('incoming');
  }

  if (values.some(value => value === 'outgoing' || value === 'bidirectional')) {
    directions.push('outgoing');
  }

  return directions;
}

function getPreviewRelationshipType(args: {
  structuralType: GroupRelationshipType;
  currentGroupId: string;
  sourceGroupId: string;
}) {
  if (args.structuralType === 'sibling') {
    return 'sibling';
  }

  if (args.currentGroupId === args.sourceGroupId) {
    return args.structuralType;
  }

  return args.structuralType === 'parent' ? 'child' : 'parent';
}

export function resolveNetworkRelationshipPreviewContext(
  args: ResolveNetworkRelationshipPreviewContextArgs
) {
  const visibleFlowDirection = getVisibleFlowDirection(args.rightEdgeDirections);
  const explicitCurrentGroupId =
    args.currentGroupId ??
    (args.graphRootGroupId === args.sourceGroupId || args.graphRootGroupId === args.targetGroupId
      ? args.graphRootGroupId
      : undefined);

  let resolvedCurrentGroupId = explicitCurrentGroupId ?? args.sourceGroupId;

  if (!explicitCurrentGroupId) {
    if (visibleFlowDirection === 'forward') {
      resolvedCurrentGroupId = args.sourceGroupId;
    } else if (visibleFlowDirection === 'backward') {
      resolvedCurrentGroupId = args.targetGroupId;
    } else if (args.memberSourceGroupId) {
      resolvedCurrentGroupId = args.memberSourceGroupId;
    }
  }

  const selectedGroupId =
    resolvedCurrentGroupId === args.sourceGroupId ? args.targetGroupId : args.sourceGroupId;

  return {
    relationshipType: getPreviewRelationshipType({
      structuralType: args.structuralType,
      currentGroupId: resolvedCurrentGroupId,
      sourceGroupId: args.sourceGroupId,
    }),
    currentGroupId: resolvedCurrentGroupId,
    currentGroupName:
      resolvedCurrentGroupId === args.sourceGroupId ? args.sourceGroupName : args.targetGroupName,
    selectedGroupId,
    selectedGroupName:
      selectedGroupId === args.sourceGroupId ? args.sourceGroupName : args.targetGroupName,
  } satisfies {
    relationshipType: GroupRelationshipType;
    currentGroupId: string;
    currentGroupName: string | null;
    selectedGroupId: string;
    selectedGroupName: string | null;
  };
}

export function getNetworkPreviewMembershipDirection(args: {
  currentGroupId: string;
  memberSourceGroupId?: string | null;
  memberTargetGroupId?: string | null;
}) {
  if (!args.memberSourceGroupId || !args.memberTargetGroupId) {
    return null;
  }

  return getRelativeMembershipDirectionForRelationship({
    relationship: {
      member_source_group_id: args.memberSourceGroupId,
      member_target_group_id: args.memberTargetGroupId,
    },
    currentGroupId: args.currentGroupId,
  });
}

export function orientRelationshipEdgeForCurrentPerspective({
  currentNodeId,
  sourceId,
  targetId,
  rightEdgeDirections,
}: {
  currentNodeId: string;
  sourceId: string;
  targetId: string;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
}) {
  const rightDisplayDirections = buildCurrentPerspectiveRightDisplayDirections({
    currentNodeId,
    sourceId,
    targetId,
    rightEdgeDirections,
  });

  if (!rightDisplayDirections || !rightEdgeDirections) {
    return {
      sourceId,
      targetId,
      rightEdgeDirections,
      rightDisplayDirections,
    };
  }

  return {
    sourceId,
    targetId,
    rightEdgeDirections,
    rightDisplayDirections,
  };
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

  if (directionValues.length === 0) {
    return {
      markerStart: undefined,
      markerEnd: undefined,
    };
  }

  const hasBackwardDirection = directionValues.some(isBackwardDirection);
  const hasForwardDirection = directionValues.some(isForwardDirection);

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

export function buildNetworkRelationshipEdge({
  edgeId,
  sourceId,
  targetId,
  sourceGroupId,
  targetGroupId,
  structuralType,
  rights,
  relationshipKinds = [],
  rightRelationshipKinds = {},
  membershipMode,
  memberSourceGroupId,
  memberTargetGroupId,
  membershipRequiredSourceRoleId,
  membershipRequiredSourceRoleName,
  rightEdgeDirections,
  relationshipDepth = 'direct',
  fallbackStrokeColor,
  strokeDasharray,
  sourceName = null,
  targetName = null,
  graphRootGroupId,
  currentGroupId,
  previewCurrentGroupId,
  anchorStrategy = 'inner-auto',
  bendPoints = [],
  edgeEditingEnabled = false,
  onBendPointsChange,
}: BuildNetworkRelationshipEdgeArgs): Edge<EditableRightsLabelEdgeData> {
  const flowChannels = withMembershipFlowChannel({
    rights,
    relationshipKinds,
    rightRelationshipKinds,
    rightEdgeDirections,
    membershipMode,
    sourceGroupId,
    targetGroupId,
    memberSourceGroupId,
    memberTargetGroupId,
  });
  const resolvedStrokeColor = getRelationshipStrokeColor(
    fallbackStrokeColor,
    flowChannels.rightEdgeDirections
  );
  const edgeMarkers = buildRelationshipEdgeMarkers(
    resolvedStrokeColor,
    flowChannels.rightEdgeDirections
  );
  const previewContext = resolveNetworkRelationshipPreviewContext({
    graphRootGroupId,
    currentGroupId: previewCurrentGroupId,
    structuralType,
    sourceGroupId,
    targetGroupId,
    sourceGroupName: sourceName,
    targetGroupName: targetName,
    rightEdgeDirections: flowChannels.rightEdgeDirections,
    memberSourceGroupId,
    memberTargetGroupId,
  });
  const pageCurrentGroupId = currentGroupId ?? graphRootGroupId ?? previewContext.currentGroupId;
  const visibleFlowDirection = getVisibleFlowDirection(flowChannels.rightEdgeDirections);
  const animatedFlowDirection = getAnimatedFlowDirection(visibleFlowDirection);
  const pageRightConnectionDirections =
    buildCurrentPerspectiveRightConnectionDirections({
      currentNodeId: pageCurrentGroupId,
      sourceId: sourceGroupId,
      targetId: targetGroupId,
      rightEdgeDirections: flowChannels.rightEdgeDirections,
    }) ?? {};
  const rightDisplayDirections = buildCurrentPerspectiveRightDisplayDirections({
    currentNodeId: previewContext.currentGroupId,
    sourceId: sourceGroupId,
    targetId: targetGroupId,
    rightEdgeDirections: flowChannels.rightEdgeDirections,
  });
  const membershipSourceGroupName =
    memberSourceGroupId === sourceGroupId
      ? sourceName
      : memberSourceGroupId === targetGroupId
        ? targetName
        : null;
  const membershipTargetGroupName =
    memberTargetGroupId === sourceGroupId
      ? sourceName
      : memberTargetGroupId === targetGroupId
        ? targetName
        : null;

  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'rightsLabel',
    animated: animatedFlowDirection !== null,
    style: getCivicNetworkEdgeStyle({
      color: resolvedStrokeColor,
      strokeDasharray,
      animationDirection: animatedFlowDirection === 'backward' ? 'reverse' : undefined,
    }),
    ...edgeMarkers,
    data: createNetworkRelationshipEdgeData({
      rights: flowChannels.rights,
      relationshipKinds,
      rightRelationshipKinds: flowChannels.rightRelationshipKinds,
      relationshipType: previewContext.relationshipType,
      membershipMode,
      membershipDirection: getNetworkPreviewMembershipDirection({
        currentGroupId: previewContext.currentGroupId,
        memberSourceGroupId,
        memberTargetGroupId,
      }),
      membershipSourceGroupId: memberSourceGroupId ?? null,
      membershipTargetGroupId: memberTargetGroupId ?? null,
      membershipSourceGroupName,
      membershipTargetGroupName,
      membershipRequiredSourceRoleId: membershipRequiredSourceRoleId ?? null,
      membershipRequiredSourceRoleName: membershipRequiredSourceRoleName ?? null,
      rightEdgeDirections: flowChannels.rightEdgeDirections,
      visibleFlowDirection,
      rightConnectionDirections: pageRightConnectionDirections,
      userConnectionDirections: getNetworkUserConnectionDirections(pageRightConnectionDirections),
      relationshipDepth,
      sourceGroupId,
      targetGroupId,
      sourceName,
      targetName,
      currentGroupId: previewContext.currentGroupId,
      currentGroupName: previewContext.currentGroupName,
      selectedGroupId: previewContext.selectedGroupId,
      selectedGroupName: previewContext.selectedGroupName,
      rightDisplayDirections,
      anchorStrategy,
      bendPoints,
      edgeEditingEnabled,
      onBendPointsChange,
    }),
  };
}

export function createNetworkRelationshipEdgeData({
  rights,
  relationshipKinds = [],
  rightRelationshipKinds = {},
  relationshipType,
  membershipMode,
  membershipDirection,
  membershipSourceGroupId,
  membershipTargetGroupId,
  membershipSourceGroupName,
  membershipTargetGroupName,
  membershipRequiredSourceRoleId,
  membershipRequiredSourceRoleName,
  rightEdgeDirections,
  visibleFlowDirection,
  rightConnectionDirections,
  userConnectionDirections,
  relationshipDepth,
  sourceGroupId,
  targetGroupId,
  sourceName,
  targetName,
  currentGroupId,
  currentGroupName,
  selectedGroupId,
  selectedGroupName,
  rightDisplayDirections,
  anchorStrategy,
  useInnerVerticalAnchors,
}: CreateNetworkRelationshipEdgeDataArgs): EditableRightsLabelEdgeData {
  return {
    rights,
    relationshipKinds,
    rightRelationshipKinds,
    relationshipType,
    membershipMode,
    membershipDirection,
    membershipSourceGroupId,
    membershipTargetGroupId,
    membershipSourceGroupName,
    membershipTargetGroupName,
    membershipRequiredSourceRoleId,
    membershipRequiredSourceRoleName,
    rightEdgeDirections,
    visibleFlowDirection,
    rightConnectionDirections,
    userConnectionDirections,
    relationshipDepth,
    sourceGroupId,
    targetGroupId,
    sourceName,
    targetName,
    currentGroupId,
    currentGroupName,
    selectedGroupId,
    selectedGroupName,
    rightDisplayDirections,
    anchorStrategy,
    useInnerVerticalAnchors,
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
        ? t('common.network.incomingRequest')
        : t('common.network.outgoingRequest')
    );

  return requestLabels.join(', ') || fallbackLabel;
}

export function buildNetworkRelationshipDialogData(
  edge: Edge,
  t: TranslationFn
): NetworkRelationshipDialogData {
  const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;
  const visibleFlowChannels = Array.isArray(edgeData?.visibleRights)
    ? (edgeData.visibleRights as string[])
    : Array.isArray(edgeData?.rights)
      ? (edgeData.rights as string[])
      : [];
  const visibleRights = visibleFlowChannels.filter(right => right !== MEMBERSHIP_FLOW_RIGHT);
  const visibleFlowRelationshipKinds = filterRecordToVisibleRights(
    edgeData?.visibleRightRelationshipKinds ?? edgeData?.rightRelationshipKinds,
    visibleFlowChannels
  ) as Record<string, NetworkRelationshipKind> | undefined;
  const visibleRightRelationshipKinds = filterRecordToVisibleRights(
    edgeData?.visibleRightRelationshipKinds ?? edgeData?.rightRelationshipKinds,
    visibleRights
  ) as Record<string, NetworkRelationshipKind> | undefined;
  const relationshipKinds = visibleFlowRelationshipKinds
    ? Array.from(new Set(Object.values(visibleFlowRelationshipKinds)))
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
    membershipMode:
      edgeData?.membershipMode === 'none' ||
      edgeData?.membershipMode === 'all_members' ||
      edgeData?.membershipMode === 'role_members' ||
      edgeData?.membershipMode === 'selected_source_groups'
        ? edgeData.membershipMode
        : undefined,
    membershipDirection:
      edgeData?.membershipDirection === 'current_members_to_partner' ||
      edgeData?.membershipDirection === 'partner_members_to_current'
        ? edgeData.membershipDirection
        : undefined,
    membershipSourceGroupId:
      typeof edgeData?.membershipSourceGroupId === 'string'
        ? edgeData.membershipSourceGroupId
        : null,
    membershipTargetGroupId:
      typeof edgeData?.membershipTargetGroupId === 'string'
        ? edgeData.membershipTargetGroupId
        : null,
    membershipSourceGroupName:
      typeof edgeData?.membershipSourceGroupName === 'string'
        ? edgeData.membershipSourceGroupName
        : null,
    membershipTargetGroupName:
      typeof edgeData?.membershipTargetGroupName === 'string'
        ? edgeData.membershipTargetGroupName
        : null,
    membershipRequiredSourceRoleId:
      typeof edgeData?.membershipRequiredSourceRoleId === 'string'
        ? edgeData.membershipRequiredSourceRoleId
        : null,
    membershipRequiredSourceRoleName:
      typeof edgeData?.membershipRequiredSourceRoleName === 'string'
        ? edgeData.membershipRequiredSourceRoleName
        : null,
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
    currentGroupId:
      typeof edgeData?.currentGroupId === 'string' ? edgeData.currentGroupId : undefined,
    currentGroupName:
      typeof edgeData?.currentGroupName === 'string' ? edgeData.currentGroupName : null,
    selectedGroupId:
      typeof edgeData?.selectedGroupId === 'string' ? edgeData.selectedGroupId : undefined,
    selectedGroupName:
      typeof edgeData?.selectedGroupName === 'string' ? edgeData.selectedGroupName : null,
    rightDisplayDirections: filterRecordToVisibleRights(
      edgeData?.rightDisplayDirections,
      visibleRights
    ) as Record<string, GroupRelationshipDirection> | undefined,
    label: buildRelationshipStatusLabel(
      relationshipKinds,
      typeof edge.label === 'string' ? edge.label : null,
      t
    ),
  };
}
