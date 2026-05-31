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
  return {
    id: overrides.id,
    group_id: overrides.group_id ?? 'base',
    related_group_id: overrides.related_group_id ?? 'hier',
    relationship_type: overrides.relationship_type ?? null,
    with_right: overrides.with_right ?? 'informationRight',
    status: overrides.status ?? 'requested',
    initiator_group_id: overrides.initiator_group_id ?? null,
    created_at: overrides.created_at ?? 0,
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
  it('keeps an outgoing request anchored to the current group perspective', () => {
    const relationship = rel({
      id: 'outgoing-child-request',
      group_id: 'base',
      related_group_id: 'hier',
      relationship_type: 'parent',
    });

    expect(getRelationshipPartnerGroup(relationship, 'base')?.id).toBe('hier');
    expect(getRequestRightDirectionForCurrentGroup(relationship, 'base')).toBe('outgoing');
    expect(getCurrentGroupRelationshipDisplay(relationship, 'base')).toEqual({
      partnerGroup: relationship.related_group,
      relationshipType: 'child',
      rightDirection: 'outgoing',
    });
  });

  it('maps the same request to an incoming parent view for the recipient group', () => {
    const relationship = rel({
      id: 'incoming-parent-request',
      group_id: 'base',
      related_group_id: 'hier',
      relationship_type: 'parent',
    });

    expect(getRelationshipPartnerGroup(relationship, 'hier')?.id).toBe('base');
    expect(getRequestRightDirectionForCurrentGroup(relationship, 'hier')).toBe('incoming');
    expect(getCurrentGroupRelationshipDisplay(relationship, 'hier')).toEqual({
      partnerGroup: relationship.group,
      relationshipType: 'parent',
      rightDirection: 'incoming',
    });
  });

  it('preserves active hierarchy rows when the current group is the parent', () => {
    const relationship = rel({
      id: 'active-parent-link',
      status: 'active',
      group_id: 'hier',
      related_group_id: 'base',
      relationship_type: null,
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
      rightDirection: 'outgoing',
    });
  });

  it('returns null when the current group is not part of the relationship', () => {
    const relationship = rel({ id: 'unrelated-link' });

    expect(getRelationshipPartnerGroup(relationship, 'someone-else')).toBeNull();
    expect(getRequestRightDirectionForCurrentGroup(relationship, 'someone-else')).toBeNull();
    expect(getCurrentGroupRelationshipDisplay(relationship, 'someone-else')).toBeNull();
  });
});
