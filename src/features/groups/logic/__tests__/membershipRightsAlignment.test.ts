import { describe, expect, it } from 'vitest';
import {
  buildMembershipRightsAlignmentRows,
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
      amendmentRight: [
        { resource: 'amendments', action: 'view' },
        { resource: 'amendments', action: 'create' },
      ],
      rightToSpeak: [
        { resource: 'events', action: 'view' },
        { resource: 'events', action: 'speak' },
      ],
      activeVotingRight: [
        { resource: 'events', action: 'view' },
        { resource: 'events', action: 'active_voting' },
      ],
      passiveVotingRight: [
        { resource: 'events', action: 'view' },
        { resource: 'events', action: 'passive_voting' },
      ],
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
            { resource: 'events', action: 'view' },
            { resource: 'events', action: 'active_voting' },
          ],
        }),
      ],
      grants: [grant('grant-b1-h1', 'activeVotingRight', 'B1', 'H1')],
    });

    expect(row.status).toBe('aligned');
    expect(row.missingRights).toEqual([]);
    expect(row.extraRights).toEqual([]);
    expect(row.connectedRights.map(right => right.rightKey)).toEqual(['activeVotingRight']);
  });

  it('walks multi-step active right paths from base group to hierarchy target', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H2',
      memberships: [
        membership('nested', {
          actionRights: [
            { resource: 'amendments', action: 'view' },
            { resource: 'amendments', action: 'create' },
          ],
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

  it('treats implied action rights as actual rights', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        membership('speaker', {
          actionRights: [{ resource: 'events', action: 'speak' }],
        }),
      ],
      grants: [grant('grant-b1-h1', 'rightToSpeak', 'B1', 'H1')],
    });

    expect(row.status).toBe('aligned');
    expect(new Set(row.actualRights.map(right => right.key))).toEqual(
      new Set(['events:view', 'events:speak'])
    );
  });

  it('marks missing rights when a role does not cover expected connected rights', () => {
    const [row] = buildMembershipRightsAlignmentRows({
      targetGroupId: 'H1',
      memberships: [
        membership('missing', {
          actionRights: [{ resource: 'amendments', action: 'view' }],
        }),
      ],
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
            { resource: 'events', action: 'view' },
            { resource: 'groupLinks', action: 'manage' },
          ],
        }),
      ],
      grants: [grant('grant-b1-h1', 'activeVotingRight', 'B1', 'H1')],
    });

    expect(row.status).toBe('mixed');
    expect(row.missingRights.map(right => `${right.resource}:${right.action}`)).toEqual([
      'events:active_voting',
    ]);
    expect(row.extraRights.map(right => right.key)).toEqual([
      'groupLinks:manage',
      'groupLinks:view',
    ]);
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
});
