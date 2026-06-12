import type { ReactNode } from 'react';
import type { NetworkRelationshipKind } from '../logic/networkRelationshipHelpers';
import type {
  CanonicalMembershipMode,
  GroupRelationshipType,
  RelativeMembershipDirection,
} from './network.types';

export type NetworkEdgeRelationshipDirection = 'forward' | 'backward' | 'bidirectional';

export type NetworkUserConnectionDirection = 'incoming' | 'outgoing';

export type NetworkConnectionDirection = NetworkUserConnectionDirection | 'bidirectional';

export type NetworkRelationshipDepth = 'direct' | 'indirect';

export type NetworkDepthFilter = 'all' | NetworkRelationshipDepth;

export type NetworkEdgeAnchorStrategy = 'default' | 'inner-auto';

export type NetworkConnectionDirectionFilter = 'all' | NetworkUserConnectionDirection;

export interface NetworkEdgeBendPoint {
  x: number;
  y: number;
}

export interface EditableRightsLabelEdgeData extends Record<string, unknown> {
  rights?: string[];
  visibleRights?: string[];
  relationshipKinds?: NetworkRelationshipKind[];
  rightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  visibleRightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  relationshipType?: GroupRelationshipType | 'membership';
  membershipMode?: CanonicalMembershipMode | null;
  membershipDirection?: RelativeMembershipDirection | null;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  visibleFlowDirection?: NetworkEdgeRelationshipDirection | null;
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  visibleRightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  visibleConnectionDirection?: NetworkConnectionDirection;
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
  rightDisplayDirections?: Record<string, NetworkConnectionDirection>;
  anchorStrategy?: NetworkEdgeAnchorStrategy;
  useInnerVerticalAnchors?: boolean;
  bendPoints?: NetworkEdgeBendPoint[];
  edgeEditingEnabled?: boolean;
  onBendPointsChange?: (edgeId: string, bendPoints: NetworkEdgeBendPoint[]) => void;
}

export interface NetworkRelationshipDialogData {
  id?: string;
  source?: string;
  target?: string;
  sourceName?: string | null;
  targetName?: string | null;
  rights?: string[];
  relationshipKinds?: NetworkRelationshipKind[];
  rightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  relationshipType?: GroupRelationshipType | 'membership';
  membershipMode?: CanonicalMembershipMode | null;
  membershipDirection?: RelativeMembershipDirection | null;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  connectionDirection?: NetworkConnectionDirection;
  userConnectionDirections?: NetworkUserConnectionDirection[];
  relationshipDepth?: NetworkRelationshipDepth;
  currentGroupId?: string;
  currentGroupName?: string | null;
  selectedGroupId?: string;
  selectedGroupName?: string | null;
  rightDisplayDirections?: Record<string, NetworkConnectionDirection>;
  label?: string | null | ReactNode;
}
