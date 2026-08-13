import { describe, expect, it } from 'vitest';
import {
  hydrateProvenanceGroupName,
  resolveOfflineRosterProvenance,
} from '../offlineRosterProvenance';

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

  it('returns an empty result for absent, unsupported, or empty composition inputs', () => {
    const hierarchical = group('root', 'hierarchical');
    const base = group('base', 'base');

    expect(
      resolveOfflineRosterProvenance({
        group: null,
        offlineMembers: [{ id: 'offline', group_id: 'base', group: base }],
        relationships: [],
        groupsById: new Map(),
      }).size
    ).toBe(0);
    expect(
      resolveOfflineRosterProvenance({
        group: base,
        offlineMembers: [{ id: 'offline', group_id: 'base', group: base }],
        relationships: [],
        groupsById: new Map(),
      }).size
    ).toBe(0);
    expect(
      resolveOfflineRosterProvenance({
        group: hierarchical,
        offlineMembers: [],
        relationships: [],
        groupsById: new Map(),
      }).size
    ).toBe(0);
  });

  it('ignores offline rows without a resolvable group identity', () => {
    const root = group('root', 'hierarchical');

    const result = resolveOfflineRosterProvenance({
      group: root,
      offlineMembers: [
        { id: 'missing-all', group_id: null, group: null },
        {
          id: 'missing-id',
          group_id: null,
          group: { id: '', name: 'Missing', group_type: 'base' },
        },
      ],
      relationships: [],
      groupsById: new Map(),
    });

    expect(result.size).toBe(0);
  });

  it('adds offline-only groups to the lookup and resolves group-id fallbacks', () => {
    const root = group('root', 'hierarchical');
    const base = group('base', 'base', { name: 'Offline Base' });

    const result = resolveOfflineRosterProvenance({
      group: root,
      offlineMembers: [{ id: 'offline', group_id: null, group: base }],
      relationships: [relationship('root-base', 'root', 'base')],
      groupsById: new Map([[root.id, root]]),
    });

    expect(result.get('offline')).toMatchObject({
      baseGroup: { id: 'base', name: 'Offline Base', group_type: 'base' },
    });
  });

  it('preserves a useful lookup name when an incoming row only repeats its id', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const existingBase = group('base', 'base', { name: 'Existing Base' });
    const idOnlyBase = { ...existingBase, name: existingBase.id, group_type: null };

    const result = resolveOfflineRosterProvenance({
      group: assembly,
      offlineMembers: [{ id: 'offline', group_id: 'base', group: idOnlyBase }],
      relationships: [],
      groupsById: new Map([
        [assembly.id, assembly],
        [existingBase.id, existingBase],
      ]),
      siblingRootGroupIds: ['base'],
    });

    expect(result.get('offline')).toMatchObject({
      partGroup: { id: 'base', name: 'Existing Base', group_type: 'base' },
      baseGroup: { id: 'base', name: 'Existing Base', group_type: 'base' },
    });
  });

  it('falls back to the base group when candidate sibling roots are not hierarchical', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const rootCandidate = group('candidate', 'base');
    const base = group('base', 'base');
    const result = resolveOfflineRosterProvenance({
      group: assembly,
      offlineMembers: [{ id: 'offline', group_id: 'base', group: base }],
      relationships: [],
      groupsById: new Map([
        [assembly.id, assembly],
        [rootCandidate.id, rootCandidate],
        [base.id, base],
      ]),
      siblingRootGroupIds: ['candidate'],
    });

    expect(result.get('offline')?.baseGroup?.id).toBe('base');
  });

  it('handles a hierarchical offline row whose referenced group is not hydrated', () => {
    const root = group('root', 'hierarchical');
    const result = resolveOfflineRosterProvenance({
      group: root,
      offlineMembers: [{ id: 'ghost-offline', group_id: 'ghost', group: null }],
      relationships: [],
      groupsById: new Map([[root.id, root]]),
    });

    expect(result.has('ghost-offline')).toBe(true);
  });

  it('skips missing sibling identities in both current and root membership projections', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const result = resolveOfflineRosterProvenance({
      group: assembly,
      offlineMembers: [
        { id: 'missing', group_id: null, group: null },
        { id: 'ghost', group_id: 'ghost', group: null },
      ],
      relationships: [],
      groupsById: new Map([[assembly.id, assembly]]),
      siblingRootGroupIds: ['unknown-root'],
    });

    expect(result.has('missing')).toBe(false);
    expect(result.has('ghost')).toBe(true);
  });

  it('supports a hierarchical sibling root even when the base row has no hydrated group', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const sourceRoot = group('source-root', 'hierarchical');
    const result = resolveOfflineRosterProvenance({
      group: assembly,
      offlineMembers: [{ id: 'ghost', group_id: 'ghost-base', group: null }],
      relationships: [relationship('source-ghost', 'source-root', 'ghost-base')],
      groupsById: new Map([
        [assembly.id, assembly],
        [sourceRoot.id, sourceRoot],
      ]),
      siblingRootGroupIds: ['source-root'],
    });

    expect(result.has('ghost')).toBe(true);
  });
});

describe('hydrateProvenanceGroupName', () => {
  it('resolves display names and group types through every fallback layer', () => {
    expect(hydrateProvenanceGroupName(null, new Map())).toBeNull();

    expect(
      hydrateProvenanceGroupName(
        { id: 'group', name: undefined, group_type: null } as any,
        new Map([['group', { id: 'group', name: 'group', group_type: 'base' }]]),
        { id: 'group', name: 'Fallback Display', group_type: 'hierarchical' }
      )
    ).toEqual({ id: 'group', name: 'Fallback Display', group_type: 'base' });

    expect(
      hydrateProvenanceGroupName(
        { id: 'lookup-id', name: undefined, group_type: undefined } as any,
        new Map([['lookup-id', { id: 'lookup-id', name: 'lookup-id', group_type: undefined }]])
      )
    ).toEqual({ id: 'lookup-id', name: 'lookup-id', group_type: undefined });

    expect(
      hydrateProvenanceGroupName(
        { id: 'id-only', name: undefined, group_type: undefined } as any,
        new Map()
      )
    ).toEqual({ id: 'id-only', name: 'id-only', group_type: undefined });
  });
});
