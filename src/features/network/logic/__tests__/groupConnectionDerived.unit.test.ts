import { featureThemeClassName } from '@/features/shared/theme';
import { describe, expect, it } from 'vitest';

import {
  buildDerivedGroupNetworkMetaMap,
  buildRightDirectionsForConnection,
  deriveNormalizedGroupConnectionRelationships,
  deriveNormalizedGroupConnectionRequestRelationships,
  deriveNormalizedGroupConnectionRequestRows,
  deriveNormalizedGroupRelationships,
  getCanonicalMembershipModeLabel,
  getCanonicalRelationshipTypeForGroup,
  getPrimaryConnectionForPair,
  getRightDirectionFromGrantEndpoints,
  getSiblingMembershipKind,
} from '../groupConnectionDerived';
import type { GroupConnectionListRow, GroupConnectionRequestListRow } from '@/zero/network/queries';

function createConnection(overrides?: Record<string, unknown>): GroupConnectionListRow {
  return {
    id: 'connection-1',
    group_a_id: 'B1',
    group_b_id: 'H1',
    connection_type: 'hierarchy',
    parent_group_id: 'H1',
    child_group_id: 'B1',
    status: 'active',
    created_by_id: null,
    created_at: 1,
    updated_at: 1,
    grants: [
      {
        id: 'grant-amend',
        connection_id: 'connection-1',
        right_key: 'amendmentRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
        status: 'active',
        initiator_group_id: 'B1',
        created_at: 2,
        updated_at: 2,
        holder_group: { id: 'B1', name: 'B1' },
        scope_group: { id: 'H1', name: 'H1' },
        initiator_group: { id: 'B1', name: 'B1' },
      },
    ],
    membership_rule: {
      id: 'rule-1',
      connection_id: 'connection-1',
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'role_members',
      required_source_role_id: 'role-1',
      created_at: 1,
      updated_at: 1,
      member_source_group: { id: 'B1', name: 'B1' },
      member_target_group: { id: 'H1', name: 'H1' },
      required_source_role: { id: 'role-1', name: 'Delegate' },
      origins: [],
    },
    group_a: { id: 'B1', name: 'B1' },
    group_b: { id: 'H1', name: 'H1' },
    parent_group: { id: 'H1', name: 'H1' },
    child_group: { id: 'B1', name: 'B1' },
    created_by: null,
    ...overrides,
  } as unknown as GroupConnectionListRow;
}

function createRequest(overrides?: Record<string, unknown>): GroupConnectionRequestListRow {
  return {
    id: 'request-1',
    active_connection_id: null,
    proposed_connection_id: 'connection-1',
    group_a_id: 'B1',
    group_b_id: 'H1',
    desired_connection_type: 'peer',
    desired_parent_group_id: null,
    desired_child_group_id: null,
    structure_status: 'pending',
    status: 'pending',
    initiator_group_id: 'B1',
    created_at: 1,
    updated_at: 1,
    group_a: { id: 'B1', name: 'B1' },
    group_b: { id: 'H1', name: 'H1' },
    initiator_group: { id: 'B1', name: 'B1' },
    active_connection: null,
    grant_requests: [
      {
        id: 'grant-request-1',
        connection_request_id: 'request-1',
        existing_grant_id: null,
        operation: 'upsert',
        right_key: 'activeVotingRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
        status: 'pending',
        initiator_group_id: 'B1',
        created_at: 2,
        updated_at: 2,
        holder_group: { id: 'B1', name: 'B1' },
        scope_group: { id: 'H1', name: 'H1' },
        initiator_group: { id: 'B1', name: 'B1' },
      },
    ],
    membership_rule_requests: [
      {
        id: 'membership-request-1',
        connection_request_id: 'request-1',
        existing_membership_rule_id: null,
        operation: 'upsert',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
        membership_mode: 'all_members',
        required_source_role_id: null,
        status: 'pending',
        created_at: 1,
        updated_at: 1,
        required_source_role: null,
        origins: [],
      },
    ],
    ...overrides,
  } as unknown as GroupConnectionRequestListRow;
}

describe('groupConnectionDerived', () => {
  it('maps every canonical membership and relationship perspective', () => {
    expect(getSiblingMembershipKind('role_members')).toBe('elected');
    expect(getSiblingMembershipKind('selected_source_groups')).toBe('parliament');
    expect(getSiblingMembershipKind('none')).toBe('open');
    expect(getSiblingMembershipKind('all_members')).toBe('open');
    expect(getSiblingMembershipKind(null)).toBeNull();

    for (const mode of ['all_members', 'role_members', 'selected_source_groups', 'none'] as const) {
      expect(getCanonicalMembershipModeLabel(mode)).toBeTruthy();
    }
    expect(getCanonicalMembershipModeLabel(undefined)).toBeTruthy();

    const peer = createConnection({ connection_type: 'peer' });
    expect(getCanonicalRelationshipTypeForGroup(peer, 'B1')).toBe('sibling');
    expect(getCanonicalRelationshipTypeForGroup(createConnection(), 'H1')).toBe('parent');
    expect(getCanonicalRelationshipTypeForGroup(createConnection(), 'B1')).toBe('child');
    expect(getCanonicalRelationshipTypeForGroup(createConnection(), 'outside')).toBeNull();
  });

  it('maps grant endpoints only when the current group participates', () => {
    expect(
      getRightDirectionFromGrantEndpoints({
        currentGroupId: 'scope',
        grant: { holder_group_id: 'holder', scope_group_id: 'scope' },
      })
    ).toBe('current_grants_right_to_partner');
    expect(
      getRightDirectionFromGrantEndpoints({
        currentGroupId: 'holder',
        grant: { holder_group_id: 'holder', scope_group_id: 'scope' },
      })
    ).toBe('partner_grants_right_to_current');
    expect(
      getRightDirectionFromGrantEndpoints({
        currentGroupId: 'outside',
        grant: { holder_group_id: 'holder', scope_group_id: 'scope' },
      })
    ).toBeNull();
  });

  it(featureThemeClassName('networkGroupConnectionDerivedThemedGradientSurface'), () => {
    const rows = deriveNormalizedGroupConnectionRelationships(createConnection());

    expect(
      rows.map(row => ({
        id: row.id,
        group_id: row.group_id,
        related_group_id: row.related_group_id,
        relationship_type: row.relationship_type,
        with_right: row.with_right,
        member_source_group_id: row.member_source_group_id,
        member_target_group_id: row.member_target_group_id,
      }))
    ).toEqual([
      {
        id: 'connection-1:structure',
        group_id: 'H1',
        related_group_id: 'B1',
        relationship_type: 'parent',
        with_right: null,
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
      },
      {
        id: 'grant-amend',
        group_id: 'B1',
        related_group_id: 'H1',
        relationship_type: 'child',
        with_right: 'amendmentRight',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
      },
    ]);
  });

  it('keeps membership-only hierarchy connections in derived group meta', () => {
    const meta = buildDerivedGroupNetworkMetaMap([createConnection({ grants: [] })]);

    expect(meta.get('H1')?.group_type).toBe('hierarchical');
    expect(meta.get('B1')?.group_type).toBe('base');
  });

  it('creates request rows from explicit structure, grant requests, and membership request', () => {
    const rows = deriveNormalizedGroupConnectionRequestRelationships(createRequest());

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      id: 'request-1:structure',
      request_item_kind: 'structure',
      group_id: 'B1',
      related_group_id: 'H1',
      relationship_type: 'sibling',
      with_right: null,
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'all_members',
    });
    expect(rows[1]).toMatchObject({
      id: 'membership-request-1',
      request_item_kind: 'membership',
      membership_request_id: 'membership-request-1',
      grant_id: null,
      group_id: 'B1',
      related_group_id: 'H1',
      relationship_type: 'sibling',
      with_right: null,
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'all_members',
    });
    expect(rows[2]).toMatchObject({
      id: 'grant-request-1',
      request_item_kind: 'right',
      group_id: 'B1',
      related_group_id: 'H1',
      with_right: 'activeVotingRight',
    });
  });

  it('hydrates holder B1 and scope H1 as H1 granting the right to B1', () => {
    const directions = buildRightDirectionsForConnection({
      currentGroupId: 'H1',
      connection: {
        grants: [
          {
            right_key: 'amendmentRight',
            holder_group_id: 'B1',
            scope_group_id: 'H1',
            status: 'active',
          },
        ],
      },
    });

    expect(directions.amendmentRight).toBe('current_grants_right_to_partner');
  });

  it('hydrates holder H1 and scope B1 as H1 having the right in B1', () => {
    const directions = buildRightDirectionsForConnection({
      currentGroupId: 'H1',
      connection: {
        grants: [
          {
            right_key: 'amendmentRight',
            holder_group_id: 'H1',
            scope_group_id: 'B1',
            status: 'active',
          },
        ],
      },
    });

    expect(directions.amendmentRight).toBe('partner_grants_right_to_current');
  });

  it('resolves hierarchy request labels when parent and child are reversed from canonical endpoints', () => {
    const rows = deriveNormalizedGroupConnectionRequestRelationships(
      createRequest({
        desired_connection_type: 'hierarchy',
        desired_parent_group_id: 'H1',
        desired_child_group_id: 'B1',
      })
    );

    expect(rows[0]).toMatchObject({
      id: 'request-1:structure',
      group_id: 'H1',
      related_group_id: 'B1',
      relationship_type: 'parent',
      group: { id: 'H1', name: 'H1' },
      related_group: { id: 'B1', name: 'B1' },
    });
    expect(rows[1]).toMatchObject({
      id: 'membership-request-1',
      group_id: 'B1',
      related_group_id: 'H1',
      relationship_type: 'child',
      group: { id: 'B1', name: 'B1' },
      related_group: { id: 'H1', name: 'H1' },
    });
    expect(rows[2]).toMatchObject({
      id: 'grant-request-1',
      group_id: 'B1',
      related_group_id: 'H1',
      relationship_type: 'child',
      group: { id: 'B1', name: 'B1' },
      related_group: { id: 'H1', name: 'H1' },
    });
  });

  it('does not reuse group_b as a fallback for non-endpoint request group ids', () => {
    const rows = deriveNormalizedGroupConnectionRequestRelationships(
      createRequest({
        desired_connection_type: 'hierarchy',
        desired_parent_group_id: 'H1',
        desired_child_group_id: 'B2',
      } as Partial<GroupConnectionRequestListRow>)
    );

    expect(rows[0]).toMatchObject({
      group_id: 'H1',
      related_group_id: 'B2',
      group: { id: 'H1', name: 'H1' },
      related_group: null,
    });
  });

  it('keeps membership-only hierarchy request endpoints canonical', () => {
    const rows = deriveNormalizedGroupConnectionRequestRelationships(
      createRequest({
        desired_connection_type: 'hierarchy',
        desired_parent_group_id: 'H1',
        desired_child_group_id: 'B2',
        grant_requests: [],
        membership_rule_requests: [
          {
            id: 'membership-request-b2-h1',
            connection_request_id: 'request-1',
            existing_membership_rule_id: null,
            operation: 'upsert',
            member_source_group_id: 'B2',
            member_target_group_id: 'H1',
            membership_mode: 'all_members',
            required_source_role_id: null,
            status: 'pending',
            created_at: 1,
            updated_at: 1,
            required_source_role: null,
            origins: [],
          },
        ],
      } as unknown as Partial<GroupConnectionRequestListRow>)
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'request-1:structure',
      request_item_kind: 'structure',
      group_id: 'H1',
      related_group_id: 'B2',
      relationship_type: 'parent',
      with_right: null,
      membership_mode: 'all_members',
      member_source_group_id: 'B2',
      member_target_group_id: 'H1',
    });
    expect(rows[1]).toMatchObject({
      id: 'membership-request-b2-h1',
      request_item_kind: 'membership',
      membership_request_id: 'membership-request-b2-h1',
      group_id: 'B2',
      related_group_id: 'H1',
      relationship_type: 'child',
      with_right: null,
      membership_mode: 'all_members',
      member_source_group_id: 'B2',
      member_target_group_id: 'H1',
    });
  });

  it('normalizes peer fallbacks, invalid membership data, origins, and partial group hydration', () => {
    const connection = createConnection({
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
      status: null,
      group_a: undefined as never,
      group_b: undefined as never,
      grants: [
        {
          ...createConnection().grants![0],
          holder_group: null,
          scope_group: null,
          status: null,
          initiator_group_id: null,
        },
        {
          ...createConnection().grants![0],
          id: 'grant-outside',
          holder_group_id: 'outside-1',
          scope_group_id: 'outside-2',
          holder_group: null,
          scope_group: null,
        },
      ],
      membership_rule: {
        ...createConnection().membership_rule!,
        membership_mode: 'invalid' as never,
        member_source_group_id: null,
        member_target_group_id: null,
        required_source_role_id: null,
        required_source_role: null,
        origins: [
          { id: 'origin-1', membership_rule_id: 'rule-1', eligible_origin_group_id: 'B1' },
          { id: 'origin-2', membership_rule_id: 'rule-1', eligible_origin_group_id: null },
        ],
      },
    });
    const rows = deriveNormalizedGroupConnectionRelationships(connection);
    expect(rows[0]).toMatchObject({
      group_id: 'B1',
      related_group_id: 'H1',
      relationship_type: 'sibling',
      status: null,
      group: null,
      related_group: null,
      membership_mode: 'none',
      eligible_origin_group_ids: ['B1'],
    });
    expect(rows[1]).toMatchObject({ group: null, related_group: null, initiator_group_id: null });
    expect(rows[2]).toMatchObject({ group: null, related_group: null });
    expect(deriveNormalizedGroupRelationships([connection])).toEqual(rows);
  });

  it('falls back to canonical endpoints and group records for incomplete hierarchy data', () => {
    const rows = deriveNormalizedGroupConnectionRelationships(
      createConnection({
        parent_group_id: null,
        child_group_id: null,
        grants: [
          {
            ...createConnection().grants![0],
            holder_group: null,
            scope_group: null,
          },
        ],
        membership_rule: null,
      })
    );
    expect(rows[0]).toMatchObject({
      group_id: 'B1',
      related_group_id: 'H1',
      group: { id: 'B1' },
      related_group: { id: 'H1' },
      membership_mode: 'none',
    });
    expect(rows[1]).toMatchObject({ group: { id: 'B1' }, related_group: { id: 'H1' } });
    expect(
      deriveNormalizedGroupConnectionRelationships(createConnection({ grants: null }))
    ).toHaveLength(1);
  });

  it('selects the newest membership request and omits incomplete membership rows', () => {
    const older = createRequest().membership_rule_requests![0];
    const newest = {
      ...older,
      id: 'membership-newest',
      membership_mode: 'selected_source_groups' as const,
      updated_at: 9,
      created_at: null,
      origins: [
        {
          id: 'request-origin-1',
          membership_rule_request_id: 'membership-newest',
          eligible_origin_group_id: 'origin-a',
        },
        {
          id: 'request-origin-2',
          membership_rule_request_id: 'membership-newest',
          eligible_origin_group_id: null,
        },
      ],
    };
    const noTimestamp = { ...older, id: 'membership-no-time', updated_at: null, created_at: null };
    const request = createRequest({
      active_connection_id: 'active-connection',
      proposed_connection_id: null,
      membership_rule_requests: [noTimestamp, older, newest],
      grant_requests: null,
    });
    const rows = deriveNormalizedGroupConnectionRequestRelationships(request);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      connection_id: 'active-connection',
      membership_mode: 'selected_source_groups',
      eligible_origin_group_ids: ['origin-a'],
    });
    expect(rows[1]).toMatchObject({ id: 'membership-newest', created_at: request.created_at });
    expect(
      deriveNormalizedGroupConnectionRequestRelationships(
        createRequest({
          membership_rule_requests: [noTimestamp, { ...noTimestamp, id: 'membership-no-time-2' }],
          grant_requests: [],
        })
      )
    ).toHaveLength(2);

    for (const membershipRuleRequests of [
      undefined,
      [{ ...older, membership_mode: 'invalid' as never }],
      [{ ...older, member_source_group_id: null }],
      [{ ...older, member_target_group_id: null }],
    ]) {
      expect(
        deriveNormalizedGroupConnectionRequestRelationships(
          createRequest({
            membership_rule_requests: membershipRuleRequests as never,
            grant_requests: [],
          })
        )
      ).toHaveLength(1);
    }
  });

  it('normalizes request endpoint fallbacks and wrapper rows', () => {
    const request = createRequest({
      desired_connection_type: 'hierarchy',
      desired_parent_group_id: null,
      desired_child_group_id: null,
      active_connection_id: null,
      group_a: null,
      group_b: null,
      grant_requests: [
        {
          ...createRequest().grant_requests![0],
          holder_group_id: 'outside',
          scope_group_id: 'also-outside',
          holder_group: null,
          scope_group: null,
        },
      ],
    });
    const rows = deriveNormalizedGroupConnectionRequestRelationships(request);
    expect(rows[0]).toMatchObject({
      connection_id: 'connection-1',
      group_id: 'B1',
      related_group_id: 'H1',
      relationship_type: 'child',
      group: null,
      related_group: null,
    });
    expect(rows.at(-1)).toMatchObject({ group: null, related_group: null });
    expect(deriveNormalizedGroupConnectionRequestRows([request])).toEqual(rows);
  });

  it('builds explicit group meta and picks the newest matching connection', () => {
    const older = createConnection({ id: 'older', created_at: 1, updated_at: null as never });
    const newest = createConnection({ id: 'newest', created_at: 5, updated_at: 10 });
    const unrelated = createConnection({ id: 'unrelated', group_a_id: 'X', group_b_id: 'Y' });
    const meta = buildDerivedGroupNetworkMetaMap(
      [createConnection({ grants: null, membership_rule: null })],
      ['explicit']
    );
    expect(meta.has('explicit')).toBe(true);
    expect(
      getPrimaryConnectionForPair({
        currentGroupId: 'B1',
        otherGroupId: 'H1',
        connections: [older, unrelated, newest],
      })?.id
    ).toBe('newest');
    expect(
      getPrimaryConnectionForPair({
        currentGroupId: 'H1',
        otherGroupId: 'B1',
        connections: [older, newest],
        relationshipType: 'parent',
      })?.id
    ).toBe('newest');
    expect(
      getPrimaryConnectionForPair({
        currentGroupId: 'B1',
        otherGroupId: 'H1',
        connections: [older],
        relationshipType: 'parent',
      })
    ).toBeNull();
    expect(
      getPrimaryConnectionForPair({
        currentGroupId: 'B1',
        otherGroupId: 'H1',
        connections: [
          createConnection({ id: 'created-later', created_at: 8, updated_at: null as never }),
          createConnection({ id: 'created-earlier', created_at: 2, updated_at: null as never }),
        ],
      })?.id
    ).toBe('created-later');
  });

  it('filters inactive grants, includes pending requests on demand, and merges mutual rights', () => {
    const grants = [
      {
        right_key: 'informationRight',
        holder_group_id: 'B',
        scope_group_id: 'A',
        status: 'active',
      },
      {
        right_key: 'informationRight',
        holder_group_id: 'A',
        scope_group_id: 'B',
        status: 'requested',
      },
      {
        right_key: 'amendmentRight',
        holder_group_id: 'A',
        scope_group_id: 'B',
        status: 'pending',
      },
      {
        right_key: 'rightToSpeak',
        holder_group_id: 'outside-1',
        scope_group_id: 'outside-2',
        status: 'active',
      },
      {
        right_key: 'passiveVotingRight',
        holder_group_id: 'B',
        scope_group_id: 'A',
        status: 'rejected',
      },
    ];
    expect(
      buildRightDirectionsForConnection({ currentGroupId: 'A', connection: { grants: null } })
    ).toMatchObject({ informationRight: 'none' });
    expect(
      buildRightDirectionsForConnection({ currentGroupId: 'A', connection: { grants } })
    ).toMatchObject({
      informationRight: 'current_grants_right_to_partner',
      amendmentRight: 'none',
    });
    expect(
      buildRightDirectionsForConnection({
        currentGroupId: 'A',
        connection: { grants },
        includePending: true,
      })
    ).toMatchObject({
      informationRight: 'mutual',
      amendmentRight: 'partner_grants_right_to_current',
      rightToSpeak: 'none',
      passiveVotingRight: 'none',
    });
  });
});
