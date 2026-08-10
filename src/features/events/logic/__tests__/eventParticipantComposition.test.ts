import { describe, expect, it } from 'vitest';
import {
  buildEventParticipantCompositionBuckets,
  buildEventParticipantCompositionSources,
  maskUnmatchedEventParticipantComposition,
} from '../eventParticipantComposition';

function group(id: string, name: string, groupType: 'base' | 'hierarchical' | 'sibling') {
  return {
    id,
    name,
    group_type: groupType,
  };
}

function participant(id: string, userId: string) {
  return {
    id,
    user_id: userId,
    user: { id: userId },
    status: 'active',
    roles: [],
    role: null,
  };
}

describe('event participant composition provenance', () => {
  it('uses delegate source groups for delegate assemblies', () => {
    const sourceGroup = group('base-a', 'Base A', 'base');
    const result = buildEventParticipantCompositionSources(
      {
        event_type: 'delegate_assembly',
        group: group('assembly', 'Assembly', 'sibling'),
        delegates: [{ user_id: 'user-1', group_id: sourceGroup.id, group: sourceGroup }],
      },
      [participant('participant-1', 'user-1')]
    );

    expect(result.isDelegateAssembly).toBe(true);
    expect(result.participants[0].source_group_id).toBe('base-a');
    expect(result.participants[0].source_group?.name).toBe('Base A');
    expect(result.participants[0].__eventParticipantHasCompositionProvenance).toBe(true);
  });

  it('resolves part and base groups from matched event group memberships', () => {
    const partGroup = group('part-a', 'Part A', 'hierarchical');
    const baseGroup = group('base-a', 'Base A', 'base');
    const result = buildEventParticipantCompositionSources(
      {
        event_type: 'public_meeting',
        group: {
          ...group('root', 'Root Group', 'hierarchical'),
          memberships: [
            {
              id: 'membership-1',
              user_id: 'user-1',
              user: { id: 'user-1' },
              status: 'active',
              part_group_id: partGroup.id,
              part_group: partGroup,
              base_group_id: baseGroup.id,
              base_group: baseGroup,
              roles: [],
              role: null,
            },
          ],
        },
      },
      [participant('participant-1', 'user-1')]
    );

    expect(result.participants[0].partGroup).toEqual({
      id: 'part-a',
      name: 'Part A',
      group_type: 'hierarchical',
    });
    expect(result.participants[0].baseGroup).toEqual({
      id: 'base-a',
      name: 'Base A',
      group_type: 'base',
    });
    expect(buildEventParticipantCompositionBuckets(result.participants)).toHaveLength(1);
  });

  it('treats base-group events as direct part and base group participation', () => {
    const result = buildEventParticipantCompositionSources(
      {
        event_type: 'public_meeting',
        group: {
          ...group('base-root', 'Base Root', 'base'),
          memberships: [],
        },
      },
      [participant('participant-1', 'user-1')]
    );

    expect(result.participants[0].partGroup?.name).toBe('Base Root');
    expect(result.participants[0].baseGroup?.name).toBe('Base Root');
    expect(result.hasGroupBackedComposition).toBe(true);
  });

  it('falls back cleanly when the event has no group or matching provenance', () => {
    const noGroupResult = buildEventParticipantCompositionSources(
      { event_type: 'public_meeting', group: null },
      [participant('participant-1', 'user-1')]
    );
    const unmatchedResult = buildEventParticipantCompositionSources(
      {
        event_type: 'public_meeting',
        group: {
          ...group('root', 'Root Group', 'hierarchical'),
          memberships: [],
        },
      },
      [participant('participant-1', 'user-1')]
    );

    expect(noGroupResult.participants[0].baseGroup).toBeNull();
    expect(unmatchedResult.participants[0].baseGroup).toBeNull();
    expect(
      buildEventParticipantCompositionBuckets(noGroupResult.participants, {
        missingProvenanceLabel: 'No base group',
      })
    ).toEqual([
      {
        key: 'fallback:No base group',
        label: 'No base group',
        memberCount: 1,
        leadershipAssignmentCount: 0,
        memberPercentage: 100,
        leadershipPercentage: 0,
      },
    ]);
    expect(
      buildEventParticipantCompositionBuckets(unmatchedResult.participants, {
        missingProvenanceLabel: 'No base group',
      })
    ).toEqual([
      {
        key: 'fallback:No base group',
        label: 'No base group',
        memberCount: 1,
        leadershipAssignmentCount: 0,
        memberPercentage: 100,
        leadershipPercentage: 0,
      },
    ]);
  });

  it('counts active, offline, and no-provenance participant rows in composition buckets', () => {
    const buckets = buildEventParticipantCompositionBuckets(
      [
        {
          ...participant('active-b1', 'user-1'),
          partGroup: { id: 'b1', name: 'B1' },
          baseGroup: { id: 'b1', name: 'B1' },
        },
        {
          id: 'offline-b3',
          roles: [],
          role: null,
          partGroup: { id: 'b3', name: 'B3' },
          baseGroup: { id: 'b3', name: 'B3' },
          provenanceBucketLabel: null,
        },
        participant('active-no-group', 'user-2'),
      ],
      { missingProvenanceLabel: 'No base group' }
    );

    expect(buckets).toEqual([
      expect.objectContaining({ key: 'b1', label: 'B1', memberCount: 1 }),
      expect.objectContaining({ key: 'b3', label: 'B3', memberCount: 1 }),
      expect.objectContaining({
        key: 'fallback:No base group',
        label: 'No base group',
        memberCount: 1,
      }),
    ]);
    expect(buckets.reduce((sum, bucket) => sum + bucket.memberCount, 0)).toBe(3);
  });

  it('masks unmatched rows while preserving explicit provenance and bucket labels', () => {
    const rows = maskUnmatchedEventParticipantComposition([
      {
        ...participant('matched', 'user-1'),
        partGroup: { id: 'part', name: 'Part' },
        baseGroup: { id: 'base', name: 'Base' },
        provenanceBucketLabel: 'Matched',
        __eventParticipantHasCompositionProvenance: true,
      },
      {
        ...participant('unmatched', 'user-2'),
        partGroup: { id: 'wrong', name: 'Wrong' },
        baseGroup: { id: 'wrong', name: 'Wrong' },
        provenanceBucketLabel: 'Wrong',
        __eventParticipantHasCompositionProvenance: false,
      },
    ] as any);
    expect(rows[0].partGroup?.id).toBe('part');
    expect(rows[1]).toMatchObject({
      partGroup: null,
      baseGroup: null,
      provenanceBucketLabel: null,
    });

    const buckets = buildEventParticipantCompositionBuckets([
      { ...participant('label', 'user-3'), partGroup: null, provenanceBucketLabel: 'Manual' },
      {
        ...participant('base', 'user-4'),
        partGroup: null,
        baseGroup: { id: 'base', name: 'Base' },
      },
    ] as any);
    expect(buckets.map(bucket => bucket.label)).toEqual(['Base', 'Manual']);
  });

  it('covers sparse delegates and preserves participant-side delegate provenance', () => {
    const result = buildEventParticipantCompositionSources(
      {
        event_type: 'delegate_assembly',
        group: null,
        delegates: [
          { user_id: null, group_id: 'group' },
          { user_id: 'missing-group', group_id: null },
          { user_id: 'user-1', group_id: 'source-1', group: null },
          { user_id: 'user-5', group_id: 'source-5', group: null },
        ],
      },
      [
        {
          ...participant('participant-1', 'user-1'),
          source_group: { id: 'participant-source', name: 'Participant Source' },
          partGroup: { id: 'part', name: 'Part' },
          baseGroup: { id: 'base', name: 'Base' },
          provenanceBucketLabel: 'Manual',
        },
        { ...participant('no-user', ''), user_id: null, user: null },
        participant('null-source', 'user-5'),
      ] as any
    );
    expect(result.participants[0]).toMatchObject({
      source_group_id: 'source-1',
      source_group: { id: 'participant-source' },
      partGroup: { id: 'part' },
      baseGroup: { id: 'base' },
      provenanceBucketLabel: 'Manual',
    });
    expect(result.participants[1].__eventParticipantHasCompositionProvenance).toBe(false);
    expect(result.participants[2].source_group).toBeNull();

    const absentDelegates = buildEventParticipantCompositionSources(
      { event_type: 'delegate_assembly', delegates: null, group: null },
      [participant('participant-2', 'user-2')]
    );
    expect(absentDelegates.hasGroupBackedComposition).toBe(false);
  });

  it('covers direct base-group fallbacks and participant-side source precedence', () => {
    const base = group('base-root', '', 'base');
    const result = buildEventParticipantCompositionSources(
      { event_type: 'meeting', group: { ...base, memberships: null } },
      [
        {
          ...participant('existing', 'user-1'),
          group_id: 'existing-group',
          group: { id: 'existing-group', name: 'Existing' },
          part_group_id: 'existing-part',
          base_group_id: 'existing-base',
          part_group: { id: 'existing-part', name: 'Existing Part' },
          base_group: { id: 'existing-base', name: 'Existing Base' },
        },
      ] as any
    );
    expect(result.participants[0]).toMatchObject({
      group_id: 'existing-group',
      part_group_id: 'existing-part',
      base_group_id: 'existing-base',
      partGroup: { id: 'base-root', name: 'base-root' },
      baseGroup: { id: 'base-root', name: 'base-root' },
    });
  });

  it('selects the strongest duplicate membership and exercises direct, origin, and fallback chains', () => {
    const root = { ...group('root', 'Root', 'base') } as any;
    const memberships = [
      { id: 'no-user', user_id: null, user: null, status: 'active' },
      { id: 'weak', user_id: 'user-1', status: 'inactive' },
      {
        id: 'strong',
        user_id: 'user-1',
        status: 'active',
        source_group_id: 'source',
        source_group: { id: 'source', name: null },
        part_group_id: 'part',
        part_group: { id: 'part', name: 'Part' },
        base_group_id: 'base',
        base_group: { id: 'base', name: 'Base' },
      },
      {
        id: 'origin',
        user_id: 'user-2',
        status: 'member',
        origins: [
          {
            part_group_id: 'origin-part',
            part_group: { id: 'origin-part', name: 'Origin Part' },
            base_group_id: 'origin-base',
            base_group: { id: 'origin-base', name: 'Origin Base' },
          },
        ],
      },
      { id: 'admin', user_id: 'user-3', status: 'admin' },
      { id: 'confirmed', user_id: 'user-4', status: 'confirmed' },
      { id: 'weaker-after-strong', user_id: 'user-1', status: 'inactive' },
      {
        id: 'base-only',
        user_id: 'user-5',
        status: 'active',
        base_group_id: 'only-base',
        base_group: { id: 'only-base', name: 'Only Base' },
      },
      { id: 'no-provenance', user_id: 'user-6', status: 'active' },
    ];
    const result = buildEventParticipantCompositionSources(
      { event_type: 'meeting', group: { ...root, memberships } },
      [
        {
          ...participant('one', 'user-1'),
          group_id: 'participant-group',
          source_group_id: 'participant-source',
          partGroup: { id: 'participant-part', name: 'Participant Part' },
          baseGroup: { id: 'participant-base', name: 'Participant Base' },
          provenanceBucketLabel: 'Participant label',
        },
        participant('two', 'user-2'),
        participant('three', 'user-3'),
        participant('four', 'user-4'),
        participant('five', 'user-5'),
        participant('six', 'user-6'),
        { ...participant('no-user', ''), user_id: null, user: null },
      ] as any
    );
    expect(result.participants[0]).toMatchObject({
      group_id: 'participant-group',
      source_group_id: 'participant-source',
      partGroup: { id: 'participant-part' },
      baseGroup: { id: 'participant-base' },
      provenanceBucketLabel: 'Participant label',
    });
    expect(result.participants[1]).toMatchObject({
      part_group_id: 'origin-part',
      base_group_id: 'origin-base',
      partGroup: { id: 'origin-part' },
      baseGroup: { id: 'origin-base' },
    });
    expect(result.participants[2]).toMatchObject({
      partGroup: { id: 'root' },
      baseGroup: { id: 'root' },
    });
    expect(result.participants[3]).toMatchObject({
      partGroup: { id: 'root' },
      baseGroup: { id: 'root' },
    });
    expect(result.participants[4]).toMatchObject({
      partGroup: { id: 'root' },
      baseGroup: { id: 'only-base' },
    });
    expect(result.participants[5]).toMatchObject({
      part_group_id: 'root',
      base_group_id: 'root',
    });
  });

  it('leaves matched hierarchical memberships without any provenance explicitly ungrouped', () => {
    const result = buildEventParticipantCompositionSources(
      {
        event_type: 'meeting',
        group: {
          ...group('root', 'Root', 'hierarchical'),
          memberships: [{ id: 'membership', user_id: 'user-1', status: 'active' }],
        },
      },
      [
        participant('matched', 'user-1'),
        { ...participant('no-user', ''), user_id: null, user: null },
      ] as any
    );
    expect(result.participants[0]).toMatchObject({
      part_group_id: null,
      base_group_id: null,
      partGroup: null,
      baseGroup: null,
      __eventParticipantHasCompositionProvenance: false,
    });
    expect(result.participants[1].__eventParticipantHasCompositionProvenance).toBe(false);
  });
});
