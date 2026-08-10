import type {
  NetworkEdgeRelationshipDirection,
  NetworkRelationshipDialogData,
} from '../types/networkEdge.types';
import type { GroupRelationshipDirection, GroupRelationshipType } from '../types/network.types';

export interface GroupRelationshipPreviewData {
  relationshipType: GroupRelationshipType;
  currentGroupName: string;
  currentGroupId?: string;
  selectedGroupName: string;
  selectedGroupId?: string;
  isIncomingPerspective: boolean;
}

export type GroupRelationshipDisplayDirection = Exclude<GroupRelationshipDirection, 'none'>;

function getGroupIdFromEdgeNodeId(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.replace(/^(parent-|child-)/, '');
}

function shouldSwapRelationshipPerspective(relationship: NetworkRelationshipDialogData) {
  const connectionDirections = Array.isArray(relationship.userConnectionDirections)
    ? relationship.userConnectionDirections
    : [];

  return (
    relationship.relationshipType !== 'sibling' &&
    connectionDirections.includes('incoming') &&
    !connectionDirections.includes('outgoing')
  );
}

export function getRelationshipPreviewData(
  relationship: NetworkRelationshipDialogData
): GroupRelationshipPreviewData | null {
  if (
    relationship.relationshipType !== 'parent' &&
    relationship.relationshipType !== 'child' &&
    relationship.relationshipType !== 'sibling'
  ) {
    return null;
  }

  const sourceName = relationship.sourceName ?? relationship.source ?? '';
  const targetName = relationship.targetName ?? relationship.target ?? '';
  const sourceGroupId = getGroupIdFromEdgeNodeId(relationship.source);
  const targetGroupId = getGroupIdFromEdgeNodeId(relationship.target);

  if (relationship.currentGroupName && relationship.selectedGroupName) {
    return {
      relationshipType: relationship.relationshipType,
      currentGroupName: relationship.currentGroupName,
      currentGroupId: relationship.currentGroupId,
      selectedGroupName: relationship.selectedGroupName,
      selectedGroupId: relationship.selectedGroupId,
      isIncomingPerspective: relationship.currentGroupId === targetGroupId,
    };
  }

  if (shouldSwapRelationshipPerspective(relationship)) {
    return {
      relationshipType: relationship.relationshipType === 'parent' ? 'child' : 'parent',
      currentGroupName: targetName,
      currentGroupId: targetGroupId,
      selectedGroupName: sourceName,
      selectedGroupId: sourceGroupId,
      isIncomingPerspective: true,
    };
  }

  return {
    relationshipType: relationship.relationshipType,
    currentGroupName: sourceName,
    currentGroupId: sourceGroupId,
    selectedGroupName: targetName,
    selectedGroupId: targetGroupId,
    isIncomingPerspective: false,
  };
}

export function getRelationshipDirectionForPreview({
  edgeDirection,
  isIncomingPerspective,
}: {
  edgeDirection: NetworkEdgeRelationshipDirection;
  isIncomingPerspective: boolean;
}): GroupRelationshipDisplayDirection {
  if (edgeDirection === 'bidirectional') {
    return 'mutual';
  }

  if (isIncomingPerspective) {
    return edgeDirection === 'forward'
      ? 'current_grants_right_to_partner'
      : 'partner_grants_right_to_current';
  }

  return edgeDirection === 'forward'
    ? 'partner_grants_right_to_current'
    : 'current_grants_right_to_partner';
}
