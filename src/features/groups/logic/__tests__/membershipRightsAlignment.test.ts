import { describe, expect, it } from 'vitest';
import {
  buildMembershipRightsAlignmentRows,
  buildMembershipRightsAlignmentRowsFromRelationships,
  GROUP_RIGHT_ACTION_RIGHT_MAPPING,
} from '../membershipRightsAlignment';

function membership(
  id: string,
  overrides: Partial<{
    source_group_id: string | null;
    baseGroup: { id: string; name: string };
    actionRights: readonly { resource: string; action: string }[];
  }> = {}
) {
  const actionRights = overrides.actionRights ?? [];

  return {
    id,
    user_id: `user-${id}`,
    user: { id: `user-${id}`, first_name: id, last_name: 'Member' },
    status: 'active',
    source: 'derived',
    source_group_id: overrides.source_group_id ?? 'B1',
    baseGroup: overrides.baseGroup ?? { id: overrides.source_group_id ?? 'B1', name: 'Base 1' },
    roles:
      actionRights.length > 0
        ? [
            {
              id: `role-${id}`,
              name: `Role ${id}`,
              action_rights: actionRights,
            },
          ]
        : [],
    role: null,
  };
}

function grant(
  id: string,
  rightKey: string,
  holderGroupId: string,
  scopeGroupId: string,
  status = 'active'
) {
  return {
    id,
    connection_id: `connection-${holderGroupId}-${scopeGroupId}`,
    right_key: rightKey,
    holder_group_id: holderGroupId,
    scope_group_id: scopeGroupId,
    status,
  };
}

describe('GROUP_RIGHT_ACTION_RIGHT_MAPPING', () => {
  it('maps connected group rights to least-power action rights', () => {
    expect(GROUP_RIGHT_ACTION_RIGHT_MAPPING).toMatchObject({
      informationRight: [
        { resource: 'groups', action: 'view' },
        { resource: 'groupDocuments', action: 'view' },
        { resource: 'groupLinks', action: 'view' },
      ],
      amendmentRight: [{ resource: 'amendments', action: 'create' }],
      rightToSpeak: [],
      activeVotingRight: [],
      passiveVotingRight: [],
    });
  });
});

describe('buildMembershipRightsAlignmentRows', () => {
  it('marks a member as aligned when role rights match connected rights', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        membership('aligned', {
          actionRights: [
            { resource: 'groups', action: 'view' },
            { resource: 'groupDocuments', action: 'view' },
            { resource: 'groupLinks', action: 'view' },
          ],
        }),
      ],
      grants: [grant('grant-b1-h1', 'informationRight', 'B1', 'H1')],
    });

    expect(row.status).toBe('aligned');
    expect(row.missingRights).toEqual([]);
    expect(row.extraRights).toEqual([]);
    expect(row.connectedRights.map(right => right.rightKey)).toEqual(['informationRight']);
  });

  it('walks multi-step active right paths from base group to hierarchy target', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H2',
      memberships: [
        membership('nested', {
          actionRights: [{ resource: 'amendments', action: 'create' }],
        }),
      ],
      grants: [
        grant('grant-b1-h1', 'amendmentRight', 'B1', 'H1'),
        grant('grant-h1-h2', 'amendmentRight', 'H1', 'H2'),
      ],
    });

    expect(row.status).toBe('aligned');
    expect(row.connectedRights[0]?.paths[0]?.groupPath).toEqual(['B1', 'H1', 'H2']);
  });

  it('includes implied action rights in actual rights summaries', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        membership('operator', {
          actionRights: [{ resource: 'groupLinks', action: 'manage' }],
        }),
      ],
      grants: [],
    });

    expect(row.status).toBe('extra');
    expect(new Set(row.actualRights.map(right => right.key))).toEqual(
      new Set(['groupLinks:manage', 'groupLinks:view'])
    );
  });

  it('marks missing rights when a role does not cover expected connected rights', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [membership('missing')],
      grants: [grant('grant-b1-h1', 'amendmentRight', 'B1', 'H1')],
    });

    expect(row.status).toBe('missing');
    expect(row.missingRights.map(right => `${right.resource}:${right.action}`)).toEqual([
      'amendments:create',
    ]);
    expect(row.extraRights).toEqual([]);
  });

  it('marks extra rights when a role exceeds expected connected rights', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        membership('extra', {
          actionRights: [{ resource: 'groups', action: 'view' }],
        }),
      ],
      grants: [],
    });

    expect(row.status).toBe('extra');
    expect(row.missingRights).toEqual([]);
    expect(row.extraRights.map(right => right.key)).toEqual(['groups:view']);
  });

  it('marks mixed rows when rights are both missing and extra', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        membership('mixed', {
          actionRights: [
            { resource: 'groups', action: 'view' },
            { resource: 'messages', action: 'manage' },
          ],
        }),
      ],
      grants: [grant('grant-b1-h1', 'informationRight', 'B1', 'H1')],
    });

    expect(row.status).toBe('mixed');
    expect(row.missingRights.map(right => `${right.resource}:${right.action}`)).toEqual([
      'groupDocuments:view',
      'groupLinks:view',
    ]);
    expect(row.extraRights.map(right => right.key)).toEqual(['messages:manage']);
  });

  it('keeps no-path members aligned when they also have no role rights', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [membership('no-path', { actionRights: [] })],
      grants: [grant('grant-other-h1', 'informationRight', 'Other', 'H1')],
    });

    expect(row.status).toBe('aligned');
    expect(row.connectedRights).toEqual([]);
    expect(row.expectedRights).toEqual([]);
    expect(row.actualRights).toEqual([]);
  });

  it('uses resolved base groups for offline-style memberships', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        {
          ...membership('offline', {
            source_group_id: null,
            baseGroup: { id: 'B2', name: 'Base 2' },
            actionRights: [
              { resource: 'groups', action: 'view' },
              { resource: 'groupDocuments', action: 'view' },
              { resource: 'groupLinks', action: 'view' },
            ],
          }),
          user_id: 'offline:member-1',
        },
      ],
      grants: [grant('grant-b2-h1', 'informationRight', 'B2', 'H1')],
    });

    expect(row.sourceGroupId).toBe('B2');
    expect(row.status).toBe('aligned');
  });

  it('normalizes derived relationship rows and ignores incomplete or unknown rights', () => {
    const [row] = buildMembershipRightsAlignmentRowsFromRelationships({
      targetGroupId: 'H1',
      memberships: [
        membership('relationship', {
          actionRights: [{ resource: 'amendments', action: 'create' }],
        }),
      ],
      relationships: [
        {
          id: 'valid',
          connection_id: null,
          grant_id: null,
          with_right: 'amendmentRight',
          group_id: 'B1',
          related_group_id: 'H1',
          status: 'active',
        },
        {
          id: 'no-right',
          with_right: null,
          group_id: 'B1',
          related_group_id: 'H1',
          status: 'active',
        },
        {
          id: 'no-holder',
          with_right: 'amendmentRight',
          group_id: null,
          related_group_id: 'H1',
          status: 'active',
        },
        {
          id: 'no-scope',
          with_right: 'amendmentRight',
          group_id: 'B1',
          related_group_id: null,
          status: 'active',
        },
        {
          id: 'unknown-right',
          with_right: 'unknownRight',
          group_id: 'B1',
          related_group_id: 'H1',
          status: 'active',
        },
      ],
    });

    expect(row.status).toBe('aligned');
    expect(row.connectedRights).toHaveLength(1);
    expect(row.connectedRights[0]?.paths[0]?.groupPath).toEqual(['B1', 'H1']);
  });

  it('ignores inactive, incomplete, and unknown raw grants', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [membership('invalid-grants')],
      grants: [
        grant('inactive', 'informationRight', 'B1', 'H1', 'requested'),
        { ...grant('no-key', 'informationRight', 'B1', 'H1'), right_key: null },
        { ...grant('no-holder', 'informationRight', 'B1', 'H1'), holder_group_id: null },
        { ...grant('no-scope', 'informationRight', 'B1', 'H1'), scope_group_id: null },
        grant('unknown', 'unknownRight', 'B1', 'H1'),
      ],
    });

    expect(row.connectedRights).toEqual([]);
    expect(row.status).toBe('aligned');
  });

  it('uses source-group and no-source fallbacks when no base group is projected', () => {
    const [sourceRow, noSourceRow] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        {
          ...membership('source-fallback'),
          baseGroup: undefined,
          source_group_id: 'B1',
        },
        {
          ...membership('no-source'),
          baseGroup: undefined,
          source_group_id: null,
        },
      ],
      grants: [],
    });

    expect(sourceRow.sourceGroupId).toBe('B1');
    expect(noSourceRow.sourceGroupId).toBeNull();
    expect(noSourceRow.connectedRights).toEqual([]);
  });

  it('keeps forward-compatible group-right mappings ordered with fallback labels', () => {
    const original = GROUP_RIGHT_ACTION_RIGHT_MAPPING.rightToSpeak;
    GROUP_RIGHT_ACTION_RIGHT_MAPPING.rightToSpeak = [
      { resource: 'zCustomResource' as never, action: 'customAction' as never },
      { resource: 'aCustomResource' as never, action: 'customAction' as never },
    ];

    try {
      const [row] = buildMembershipRightsAlignmentRows({
        targetGroupId: 'H1',
        memberships: [membership('forward-compatible')],
        grants: [grant('custom', 'rightToSpeak', 'B1', 'H1')],
      });

      expect(row.expectedRights).toEqual([
        {
          resource: 'aCustomResource',
          action: 'customAction',
          label: 'aCustomResource / customAction',
        },
        {
          resource: 'zCustomResource',
          action: 'customAction',
          label: 'zCustomResource / customAction',
        },
      ]);
    } finally {
      GROUP_RIGHT_ACTION_RIGHT_MAPPING.rightToSpeak = original;
    }
  });

  it('expands implied actions from a connected-right mapping', () => {
    const original = GROUP_RIGHT_ACTION_RIGHT_MAPPING.rightToSpeak;
    GROUP_RIGHT_ACTION_RIGHT_MAPPING.rightToSpeak = [{ resource: 'groups', action: 'manage' }];

    try {
      const [row] = buildMembershipRightsAlignmentRows({
        targetGroupId: 'H1',
        memberships: [membership('implied-actions')],
        grants: [grant('manage', 'rightToSpeak', 'B1', 'H1')],
      });

      expect(row.expectedRights.map(right => `${right.resource}:${right.action}`)).toEqual(
        expect.arrayContaining([
          'groups:manage',
          'groups:view',
          'groups:create',
          'groups:update',
          'groups:delete',
        ])
      );
    } finally {
      GROUP_RIGHT_ACTION_RIGHT_MAPPING.rightToSpeak = original;
    }
  });
});
