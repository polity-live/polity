import type { ReactNode } from 'react';
import type { NetworkRelationshipKind } from '../logic/networkRelationshipHelpers';
import type { GroupRelationshipType } from './network.types';

export type NetworkEdgeRelationshipDirection = 'forward' | 'backward' | 'bidirectional';

export type NetworkUserConnectionDirection = 'incoming' | 'outgoing';

export type NetworkConnectionDirection = NetworkUserConnectionDirection | 'bidirectional';

export type NetworkRelationshipDepth = 'direct' | 'indirect';

export type NetworkDepthFilter = 'all' | NetworkRelationshipDepth;

export type NetworkConnectionDirectionFilter = 'all' | NetworkUserConnectionDirection;

export interface NetworkEdgeBendPoint {
  x: number;
  y: number;
}

export interface EditableRightsLabelEdgeData {
  rights?: string[];
  visibleRights?: string[];
  relationshipKinds?: NetworkRelationshipKind[];
  rightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  visibleRightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  relationshipType?: GroupRelationshipType | 'membership';
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  visibleRightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  visibleConnectionDirection?: NetworkConnectionDirection;
  userConnectionDirections?: NetworkUserConnectionDirection[];
  relationshipDepth?: NetworkRelationshipDepth;
  sourceName?: string | null;
  targetName?: string | null;
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
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>;
  connectionDirection?: NetworkConnectionDirection;
  userConnectionDirections?: NetworkUserConnectionDirection[];
  relationshipDepth?: NetworkRelationshipDepth;
  label?: string | null | ReactNode;
}
