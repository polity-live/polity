import { describe, expect, it } from 'vitest';

import { buildActiveRelationshipSummaries } from '../relationshipSummaryHelpers';

const group = (id: string) => ({ id, name: id }) as any;

describe('buildActiveRelationshipSummaries', () => {
  it('maps parent and child perspectives and normalizes absent sibling metadata', () => {
    expect(
      buildActiveRelationshipSummaries({
        parents: [{ group: group('parent'), rights: ['view'] }],
        children: [{ group: group('child'), rights: ['manage'] }],
        siblings: [{ group: group('sibling'), rights: [] }],
      })
    ).toEqual([
      { group: group('parent'), rights: ['view'], type: 'child', membershipMode: null },
      { group: group('child'), rights: ['manage'], type: 'parent', membershipMode: null },
      {
        group: group('sibling'),
        rights: [],
        type: 'sibling',
        membershipMode: null,
        requiredSourceRoleId: null,
        requiredSourceRoleName: null,
      },
    ]);
  });

  it('preserves explicit sibling membership and role metadata', () => {
    expect(
      buildActiveRelationshipSummaries({
        parents: [],
        children: [],
        siblings: [
          {
            group: group('sibling'),
            rights: ['vote'],
            membershipMode: 'automatic' as any,
            requiredSourceRoleId: 'role-1',
            requiredSourceRoleName: 'Delegate',
          },
        ],
      })[0]
    ).toMatchObject({
      membershipMode: 'automatic',
      requiredSourceRoleId: 'role-1',
      requiredSourceRoleName: 'Delegate',
    });
  });
});
