import { describe, expect, it } from 'vitest';
import { resolveOfflineRosterProvenance } from '../offlineRosterProvenance';

function group(
  id: string,
  groupType: 'base' | 'hierarchical' | 'sibling',
  overrides: Partial<{
    name: string;
    sibling_membership_mode: 'parliament' | 'elected' | null;
    connected_group_id: string | null;
  }> = {}
) {
  return {
    id,
    name: overrides.name ?? id,
    group_type: groupType,
    sibling_membership_mode: overrides.sibling_membership_mode ?? null,
    connected_group_id: overrides.connected_group_id ?? null,
  };
}

function relationship(id: string, parentGroupId: string, childGroupId: string) {
  return {
    id,
    group_id: parentGroupId,
    related_group_id: childGroupId,
    relationship_type: null,
    with_right: 'passiveVotingRight',
    status: 'active',
  };
}

describe('resolveOfflineRosterProvenance', () => {
  it('resolves hierarchical offline members to the same part/base provenance as active members', () => {
    const rootGroup = group('root', 'hierarchical');
    const districtGroup = group('district', 'hierarchical');
    const baseGroup = group('base-a', 'base');
    const groupsById = new Map([
      [rootGroup.id, rootGroup],
      [districtGroup.id, districtGroup],
      [baseGroup.id, baseGroup],
    ]);

    const provenanceById = resolveOfflineRosterProvenance({
      group: rootGroup,
      offlineMembers: [{ id: 'offline-1', group_id: 'base-a', group: baseGroup }],
      relationships: [
        relationship('root-district', 'root', 'district'),
        relationship('district-base-a', 'district', 'base-a'),
      ],
      groupsById,
    });

    expect(provenanceById.get('offline-1')).toMatchObject({
      partGroup: { id: 'district', name: 'district' },
      baseGroup: { id: 'base-a', name: 'base-a' },
    });
  });

  it('resolves sibling offline members through their source hierarchy root', () => {
    const siblingGroup = group('assembly', 'sibling', {
      sibling_membership_mode: 'parliament',
    });
    const sourceRoot = group('source-root', 'hierarchical');
    const districtGroup = group('district', 'hierarchical');
    const baseGroup = group('base-a', 'base');
    const groupsById = new Map([
      [siblingGroup.id, siblingGroup],
      [sourceRoot.id, sourceRoot],
      [districtGroup.id, districtGroup],
      [baseGroup.id, baseGroup],
    ]);

    const provenanceById = resolveOfflineRosterProvenance({
      group: siblingGroup,
      offlineMembers: [{ id: 'offline-1', group_id: 'base-a', group: baseGroup }],
      relationships: [
        relationship('source-root-district', 'source-root', 'district'),
        relationship('district-base-a', 'district', 'base-a'),
      ],
      groupsById,
      siblingRootGroupIds: ['source-root'],
    });

    expect(provenanceById.get('offline-1')).toMatchObject({
      partGroup: { id: 'district', name: 'district' },
      baseGroup: { id: 'base-a', name: 'base-a' },
    });
  });

  it('uses the offline member group name when the lookup only has the group id', () => {
    const siblingGroup = group('assembly', 'sibling', {
      sibling_membership_mode: 'parliament',
    });
    const baseGroup = group('d6e902ed-1589-455c-93cd-483cf7e2bac8', 'base', { name: 'B1' });
    const idOnlyBaseGroup = { ...baseGroup, name: baseGroup.id };
    const groupsById = new Map([[idOnlyBaseGroup.id, idOnlyBaseGroup]]);

    const provenanceById = resolveOfflineRosterProvenance({
      group: siblingGroup,
      offlineMembers: [{ id: 'offline-1', group_id: baseGroup.id, group: baseGroup }],
      relationships: [],
      groupsById,
      siblingRootGroupIds: [baseGroup.id],
    });

    expect(provenanceById.get('offline-1')).toMatchObject({
      partGroup: { id: baseGroup.id, name: 'B1' },
      baseGroup: { id: baseGroup.id, name: 'B1' },
    });
  });
});
