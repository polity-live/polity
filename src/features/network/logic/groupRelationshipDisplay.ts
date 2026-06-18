import type {
  GroupRelationshipDirection,
  GroupRelationshipType,
  NetworkGroupEntity,
  NormalizedGroupRelationship,
} from '../types/network.types';
import { getRelationshipTypeForGroup } from './groupRelationshipOrientation';

export interface CurrentGroupRelationshipDisplay {
  partnerGroup: NetworkGroupEntity;
  relationshipType: GroupRelationshipType;
  rightDirection: Exclude<GroupRelationshipDirection, 'none' | 'mutual'>;
}

export function getRelationshipPartnerGroup(
  relationship: NormalizedGroupRelationship,
  currentGroupId: string
): NetworkGroupEntity | null {
  if (relationship.group?.id === currentGroupId) {
    return relationship.related_group ?? null;
  }

  if (relationship.related_group?.id === currentGroupId) {
    return relationship.group ?? null;
  }

  return null;
}

export function getRequestRightDirectionForCurrentGroup(
  relationship: Pick<NormalizedGroupRelationship, 'group_id' | 'related_group_id'>,
  currentGroupId: string
): Exclude<GroupRelationshipDirection, 'none' | 'mutual'> | null {
  if (relationship.related_group_id === currentGroupId) {
    return 'current_grants_right_to_partner';
  }

  if (relationship.group_id === currentGroupId) {
    return 'partner_grants_right_to_current';
  }

  return null;
}

export function getCurrentGroupRelationshipDisplay(
  relationship: NormalizedGroupRelationship,
  currentGroupId: string
): CurrentGroupRelationshipDisplay | null {
  const partnerGroup = getRelationshipPartnerGroup(relationship, currentGroupId);
  const relationshipType = getRelationshipTypeForGroup(relationship, currentGroupId);
  const rightDirection = getRequestRightDirectionForCurrentGroup(relationship, currentGroupId);

  if (!partnerGroup || !relationshipType || !rightDirection) {
    return null;
  }

  return {
    partnerGroup,
    relationshipType,
    rightDirection,
  };
}
