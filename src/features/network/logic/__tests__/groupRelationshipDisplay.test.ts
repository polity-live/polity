import { describe, expect, it } from 'vitest';

import {
  getCurrentGroupRelationshipDisplay,
  getRelationshipPartnerGroup,
  getRequestRightDirectionForCurrentGroup,
} from '../groupRelationshipDisplay';
import type { NormalizedGroupRelationship } from '../../types/network.types';

function rel(
  overrides: Partial<NormalizedGroupRelationship> & Pick<NormalizedGroupRelationship, 'id'>
): NormalizedGroupRelationship {
  const groupId = overrides.group_id ?? 'base';
  const relatedGroupId = overrides.related_group_id ?? 'hier';
  const relationshipType =
    overrides.relationship_type === undefined ? 'sibling' : overrides.relationship_type;
  const connectionType =
    overrides.connection_type ?? (relationshipType === 'sibling' ? 'peer' : 'hierarchy');
  const parentGroupId =
    connectionType === 'hierarchy'
      ? (overrides.parent_group_id ?? (relationshipType === 'parent' ? relatedGroupId : groupId))
      : null;
  const childGroupId =
    connectionType === 'hierarchy'
      ? (overrides.child_group_id ?? (relationshipType === 'parent' ? groupId : relatedGroupId))
      : null;
  return {
    id: overrides.id,
    connection_id: overrides.connection_id ?? `connection:${overrides.id}`,
    grant_id:
      overrides.grant_id ?? (overrides.with_right === null ? null : `grant:${overrides.id}`),
    membership_request_id: overrides.membership_request_id ?? null,
    request_item_kind: overrides.request_item_kind ?? 'right',
    group_id: groupId,
    related_group_id: relatedGroupId,
    relationship_type: relationshipType,
    connection_type: connectionType,
    parent_group_id: parentGroupId,
    child_group_id: childGroupId,
    with_right: overrides.with_right ?? 'informationRight',
    status: overrides.status ?? 'requested',
    initiator_group_id: overrides.initiator_group_id ?? null,
    created_at: overrides.created_at ?? 0,
    member_source_group_id: overrides.member_source_group_id ?? null,
    member_target_group_id: overrides.member_target_group_id ?? null,
    membership_mode: overrides.membership_mode ?? 'none',
    required_source_role_id: overrides.required_source_role_id ?? null,
    eligible_origin_group_ids: overrides.eligible_origin_group_ids ?? [],
    group: overrides.group ?? {
      id: 'base',
      name: 'Basistest99',
    },
    related_group: overrides.related_group ?? {
      id: 'hier',
      name: 'Hierarchie99',
    },
  };
}

describe('groupRelationshipDisplay', () => {
  it('shows a holder row as a right granted by the partner into the current group', () => {
    const relationship = rel({
      id: 'outgoing-child-request',
      group_id: 'base',
      related_group_id: 'hier',
      relationship_type: 'parent',
    });

    expect(getRelationshipPartnerGroup(relationship, 'base')?.id).toBe('hier');
    expect(getRequestRightDirectionForCurrentGroup(relationship, 'base')).toBe(
      'partner_grants_right_to_current'
    );
    expect(getCurrentGroupRelationshipDisplay(relationship, 'base')).toEqual({
      partnerGroup: relationship.related_group,
      relationshipType: 'child',
      rightDirection: 'partner_grants_right_to_current',
    });
  });

  it('shows a scope row as the current group granting the right to the partner', () => {
    const relationship = rel({
      id: 'incoming-parent-request',
      group_id: 'base',
      related_group_id: 'hier',
      relationship_type: 'parent',
    });

    expect(getRelationshipPartnerGroup(relationship, 'hier')?.id).toBe('base');
    expect(getRequestRightDirectionForCurrentGroup(relationship, 'hier')).toBe(
      'current_grants_right_to_partner'
    );
    expect(getCurrentGroupRelationshipDisplay(relationship, 'hier')).toEqual({
      partnerGroup: relationship.group,
      relationshipType: 'parent',
      rightDirection: 'current_grants_right_to_partner',
    });
  });

  it('preserves active hierarchy rows when the current group is the parent', () => {
    const relationship = rel({
      id: 'active-parent-link',
      status: 'active',
      group_id: 'hier',
      related_group_id: 'base',
      relationship_type: null,
      connection_type: 'hierarchy',
      with_right: 'rightToSpeak',
      group: {
        id: 'hier',
        name: 'Hierarchie99',
      },
      related_group: {
        id: 'base',
        name: 'Basistest99',
      },
    });

    expect(getCurrentGroupRelationshipDisplay(relationship, 'hier')).toEqual({
      partnerGroup: relationship.related_group,
      relationshipType: 'parent',
      rightDirection: 'partner_grants_right_to_current',
    });
  });

  it('returns null when the current group is not part of the relationship', () => {
    const relationship = rel({ id: 'unrelated-link' });

    expect(getRelationshipPartnerGroup(relationship, 'someone-else')).toBeNull();
    expect(getRequestRightDirectionForCurrentGroup(relationship, 'someone-else')).toBeNull();
    expect(getCurrentGroupRelationshipDisplay(relationship, 'someone-else')).toBeNull();
  });
});
