import type { NetworkRelationshipKind } from '../logic/networkRelationshipHelpers';

export interface NetworkEdgeBendPoint {
  x: number;
  y: number;
}

export interface EditableRightsLabelEdgeData {
  rights?: string[];
  visibleRights?: string[];
  relationshipKinds?: NetworkRelationshipKind[];
  rightRelationshipKinds?: Record<string, NetworkRelationshipKind>;
  sourceName?: string | null;
  targetName?: string | null;
  bendPoints?: NetworkEdgeBendPoint[];
  edgeEditingEnabled?: boolean;
  onBendPointsChange?: (edgeId: string, bendPoints: NetworkEdgeBendPoint[]) => void;
}
