import { describe, expect, it } from 'vitest';
import {
  buildEventParticipantCompositionBuckets,
  buildEventParticipantCompositionSources,
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
});
