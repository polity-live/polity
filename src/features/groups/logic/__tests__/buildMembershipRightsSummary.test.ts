import { describe, expect, it } from 'vitest';

import {
  buildMembershipRightsSummary,
  buildRightsSummaryForRoles,
} from '../buildMembershipRightsSummary';

const catalog = [
  { resource: 'groups', action: 'view', label: 'View groups' },
  { resource: 'groups', action: 'manage', label: 'Manage groups' },
  { resource: 'groups', action: 'create', label: 'Create groups' },
] as const;

function role(
  id: string,
  overrides: Partial<{
    name: string | null;
    sort_order: number | null;
    action_rights: readonly { resource?: string | null; action?: string | null }[] | null;
  }> = {}
) {
  return {
    id,
    name: overrides.name === undefined ? id : overrides.name,
    sort_order: overrides.sort_order,
    action_rights: overrides.action_rights,
  };
}

describe('buildMembershipRightsSummary', () => {
  it('uses display roles, deduplicates them, and falls back to an empty summary', () => {
    const memberRole = role('member', {
      action_rights: [{ resource: 'groups', action: 'view' }],
    });

    expect(
      buildMembershipRightsSummary(
        {
          id: 'membership',
          roles: [memberRole, memberRole],
          role: memberRole,
          elected_roles: [],
        },
        catalog
      )
    ).toHaveLength(1);
    expect(buildMembershipRightsSummary({ id: 'empty', roles: [], role: null }, catalog)).toEqual(
      []
    );
  });

  it('skips malformed rights and gives unknown rights and unnamed roles stable fallbacks', () => {
    const result = buildRightsSummaryForRoles(
      [
        role('fallback-role', {
          name: null,
          action_rights: [
            {},
            { resource: 'groups' },
            { action: 'view' },
            { resource: 'customResource', action: 'customAction' },
          ],
        }),
      ],
      catalog
    );

    expect(result).toEqual([
      {
        key: 'customResource:customAction',
        resource: 'customResource',
        action: 'customAction',
        label: 'customResource / customAction',
        sources: [
          {
            roleId: 'fallback-role',
            roleName: 'Role',
            viaLabel: 'customResource / customAction',
            isDirect: true,
          },
        ],
      },
    ]);
  });

  it('sorts catalogued rights first and unknown rights by their fallback labels', () => {
    const result = buildRightsSummaryForRoles(
      [
        role('role', {
          action_rights: [
            { resource: 'z-resource', action: 'view' },
            { resource: 'groups', action: 'view' },
            { resource: 'a-resource', action: 'view' },
          ],
        }),
      ],
      catalog
    );

    expect(result.map(right => right.key)).toEqual([
      'groups:view',
      'a-resource:view',
      'z-resource:view',
    ]);
  });

  it('sorts sources by descending role order and then by name', () => {
    const result = buildRightsSummaryForRoles(
      [
        role('beta', {
          name: 'Beta',
          sort_order: 2,
          action_rights: [{ resource: 'groups', action: 'view' }],
        }),
        role('alpha', {
          name: 'Alpha',
          sort_order: 2,
          action_rights: [{ resource: 'groups', action: 'view' }],
        }),
        role('highest', {
          name: 'Highest',
          sort_order: 5,
          action_rights: [{ resource: 'groups', action: 'view' }],
        }),
      ],
      catalog
    );

    expect(result[0]?.sources.map(source => source.roleId)).toEqual(['highest', 'alpha', 'beta']);
  });

  it('keeps a direct source when a later permission only implies the same right', () => {
    const [viewRight] = buildRightsSummaryForRoles(
      [
        role('operator', {
          action_rights: [
            { resource: 'groups', action: 'view' },
            { resource: 'groups', action: 'manage' },
          ],
        }),
      ],
      catalog
    );

    expect(viewRight?.key).toBe('groups:view');
    expect(viewRight?.sources).toMatchObject([{ isDirect: true, viaLabel: 'View groups' }]);
  });

  it('replaces an implied source when the same role later grants the right directly', () => {
    const result = buildRightsSummaryForRoles(
      [
        role('operator', {
          action_rights: [
            { resource: 'groups', action: 'manage' },
            { resource: 'groups', action: 'view' },
          ],
        }),
      ],
      catalog
    );
    const viewRight = result.find(right => right.key === 'groups:view');

    expect(viewRight?.sources).toMatchObject([{ isDirect: true, viaLabel: 'View groups' }]);
  });

  it('does not add implied rights that are absent from the supplied catalog', () => {
    const result = buildRightsSummaryForRoles(
      [
        role('operator', {
          action_rights: [{ resource: 'groups', action: 'manage' }],
        }),
      ],
      [{ resource: 'groups', action: 'manage', label: 'Manage groups' }]
    );

    expect(result.map(right => right.key)).toEqual(['groups:manage']);
  });

  it('treats an absent action-right collection as empty', () => {
    expect(
      buildRightsSummaryForRoles([role('empty-role', { action_rights: null })], catalog)
    ).toEqual([]);
  });

  it('uses the role-name fallback for implied sources', () => {
    const result = buildRightsSummaryForRoles(
      [
        role('unnamed-operator', {
          name: null,
          action_rights: [{ resource: 'groups', action: 'manage' }],
        }),
      ],
      catalog
    );

    expect(result.find(right => right.key === 'groups:view')?.sources).toMatchObject([
      { roleName: 'Role', isDirect: false },
    ]);
  });

  it('deduplicates two implied grants from the same role', () => {
    const result = buildRightsSummaryForRoles(
      [
        role('operator', {
          action_rights: [
            { resource: 'groups', action: 'manage' },
            { resource: 'groups', action: 'moderate' },
          ],
        }),
      ],
      [...catalog, { resource: 'groups', action: 'moderate', label: 'Moderate groups' }]
    );

    expect(result.find(right => right.key === 'groups:view')?.sources).toHaveLength(1);
    expect(result.find(right => right.key === 'groups:view')?.sources[0]?.isDirect).toBe(false);
  });
});
