import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness, evaluatePredicate } from '../../__tests__/test-utils/zeroHarness';
vi.mock('@rocicorp/zero', () => ({ defineQuery: (_schema: unknown, fn: unknown) => ({ fn }) }));
const io = vi.hoisted(() => ({ zql: {} as any }));
vi.mock('../../schema', () => ({ zql: new Proxy({}, { get: (_target, key) => io.zql[key] }) }));
import { studioQueries } from '../queries';
let harness: ReturnType<typeof createQueryHarness>;
beforeEach(() => {
  harness = createQueryHarness();
  io.zql = harness.zql;
});
function access(table: string) {
  const call = harness
    .lastQuery(table)
    .calls.find(c => c[0] === 'where' && typeof c[1] === 'function');
  return evaluatePredicate(call?.[1]);
}
describe('Studio Zero visibility projections', () => {
  it.each(['alice', undefined, null, 'anon', ''])(
    'filters owner and document projections by current identity %s',
    userID => {
      const ctx = { userID, email: '' } as any;
      studioQueries.byOwner.fn({ args: { ownerId: 'owner' }, ctx });
      expect(harness.lastQuery('studio_project').calls).toEqual(
        expect.arrayContaining([
          ['where', 'owner_id', 'owner'],
          ['orderBy', 'updated_at', 'desc'],
          ['limit', 100],
        ])
      );
      expect(access('studio_project')).toContainEqual(['cmp', 'visibility', 'public']);
      expect(JSON.stringify(access('studio_project')).includes('authenticated')).toBe(
        userID === 'alice'
      );
      studioQueries.document.fn({ args: { id: 'project' }, ctx });
      expect(harness.lastQuery('studio_state').calls).toContainEqual([
        'where',
        'project_id',
        'project',
      ]);
      expect(access('studio_state.project')).toContainEqual(['cmp', 'visibility', 'public']);
      studioQueries.list.fn({ args: { groupId: null }, ctx });
      expect(JSON.stringify(access('studio_project')).includes('authenticated')).toBe(
        userID === 'alice'
      );
      studioQueries.project.fn({ args: { id: 'project' }, ctx });
      expect(harness.lastQuery('studio_project').calls).toContainEqual(['where', 'id', 'project']);
      expect(JSON.stringify(access('studio_project')).includes('authenticated')).toBe(
        userID === 'alice'
      );
    }
  );

  it.each(['alice', undefined, null, 'anon', ''])(
    'protects shared workspaces and proposals for identity %s using collaborative project and reader rights',
    userID => {
      const actor = userID === 'alice' ? userID : '00000000-0000-0000-0000-000000000000';
      const ctx = { userID, email: '' } as any;
      studioQueries.workspace.fn({ args: { projectId: 'project', workspaceId: 'workspace' }, ctx });
      expect(harness.lastQuery('canvas_proposal').calls).toEqual(
        expect.arrayContaining([
          ['where', 'project_id', 'project'],
          ['where', 'id', 'workspace'],
          ['one'],
        ])
      );
      expect(access('canvas_proposal')).toEqual(
        expect.arrayContaining([
          ['cmp', 'checksum', 'IS NOT', null],
          ['cmp', 'owner_id', actor],
          ['where', 'readers', 'user_id', actor],
        ])
      );
      expect(harness.lastQuery('canvas_proposal.project').calls).toContainEqual([
        'where',
        'group_id',
        'IS NOT',
        null,
      ]);
      expect(access('canvas_proposal.project')).toContainEqual([
        'where',
        'collaborators',
        'user_id',
        actor,
      ]);
      expect(JSON.stringify(access('canvas_proposal.project'))).not.toContain('visibility');
      studioQueries.proposals.fn({ args: { projectId: 'project' }, ctx });
      expect(harness.lastQuery('canvas_proposal').calls).toContainEqual([
        'orderBy',
        'updated_at',
        'desc',
      ]);
      expect(access('canvas_proposal')).toContainEqual(['where', 'readers', 'user_id', actor]);
    }
  );
  it('offers only manageable groups as clone and create targets', () => {
    studioQueries.manageGroups.fn({ args: undefined, ctx: { userID: 'alice', email: '' } });
    expect(access('group')).toContainEqual([
      'where',
      'memberships.membership_roles.role.group_action_rights',
      'action',
      'IN',
      ['manage'],
    ]);
  });
  it('shows group creation only to the owner or a role with projects:manage', () => {
    studioQueries.manageGroup.fn({
      args: { groupId: 'group' },
      ctx: { userID: 'alice', email: '' },
    });
    const rules = access('group');
    expect(rules).toContainEqual([
      'where',
      'memberships.membership_roles.role.group_action_rights',
      'resource',
      'projects',
    ]);
    expect(rules).toContainEqual([
      'where',
      'memberships.membership_roles.role.group_action_rights',
      'action',
      'IN',
      ['manage'],
    ]);
  });
  it.each([null, 'group'])(
    'scopes lists to the requested workspace (%s) and requires project rights for group members',
    groupId => {
      studioQueries.list.fn({ args: { groupId }, ctx: { userID: 'alice', email: '' } });
      expect(harness.lastQuery('studio_project').calls).toEqual(
        expect.arrayContaining([
          ['where', 'document_schema_version', 5],
          ['where', 'group_id', groupId === null ? 'IS' : '=', groupId],
          ['orderBy', 'updated_at', 'desc'],
          ['limit', 100],
        ])
      );
      const rules = access('studio_project');
      expect(rules).toContainEqual(['cmp', 'group_id', 'IS', null]);
      expect(rules).toContainEqual(['cmp', 'owner_id', 'alice']);
      expect(rules).toContainEqual(['where', 'collaborators', 'user_id', 'alice']);
      expect(rules).toContainEqual(['where', 'collaborators', 'status', 'active']);
      expect(rules).toContainEqual([
        'where',
        'memberships.membership_roles.role.group_action_rights',
        'resource',
        'projects',
      ]);
      expect(rules).toContainEqual([
        'where',
        'memberships.membership_roles.role.group_action_rights',
        'action',
        'IN',
        ['view', 'manage'],
      ]);
      expect(rules).toContainEqual([
        'where',
        'memberships',
        'status',
        'IN',
        ['active', 'member', 'admin'],
      ]);
      expect(rules).toContainEqual(['where', 'memberships', 'user_id', 'alice']);
      expect(rules).toContainEqual(['cmp', 'visibility', 'public']);
      expect(rules).toContainEqual(['cmp', 'visibility', 'authenticated']);
    }
  );
  it.each([undefined, null, 'anon', ''])(
    'limits unauthenticated identity %s to public projects',
    userID => {
      const ctx = { userID, email: '' } as any;
      studioQueries.project.fn({ args: { id: 'private' }, ctx });
      expect(harness.lastQuery('studio_project').calls).toContainEqual(['where', 'id', 'private']);
      expect(harness.lastQuery('studio_project').calls).toContainEqual(['one']);
      expect(access('studio_project')).toContainEqual(['cmp', 'visibility', 'public']);
      expect(JSON.stringify(access('studio_project'))).not.toContain('authenticated');
    }
  );
  it('protects each export through its parent project and caps the recent job list', () => {
    studioQueries.exports.fn({
      args: { projectId: 'private' },
      ctx: { userID: 'alice', email: '' },
    });
    expect(harness.lastQuery('studio_export').calls).toEqual(
      expect.arrayContaining([
        ['where', 'project_id', 'private'],
        ['orderBy', 'created_at', 'desc'],
        ['limit', 25],
      ])
    );
    const rules = access('studio_export.project');
    expect(JSON.stringify(rules)).not.toContain('visibility');
    expect(harness.lastQuery('studio_export.project').calls).toContainEqual([
      'where',
      'document_schema_version',
      5,
    ]);
    expect(rules).toContainEqual(['cmp', 'group_id', 'IS', null]);
    expect(rules).toContainEqual(['cmp', 'owner_id', 'alice']);
    expect(rules).toContainEqual(['where', 'collaborators', 'user_id', 'alice']);
    expect(rules).toContainEqual(['where', 'collaborators', 'status', 'active']);
    expect(rules).toContainEqual(['where', 'memberships', 'user_id', 'alice']);
    expect(rules).toContainEqual([
      'where',
      'memberships',
      'status',
      'IN',
      ['active', 'member', 'admin'],
    ]);
  });
  it('never exposes a legacy document through a direct project lookup', () => {
    studioQueries.document.fn({
      args: { id: 'legacy-project' },
      ctx: { userID: 'alice', email: '' },
    });
    expect(harness.lastQuery('studio_state.project').calls).toContainEqual([
      'where',
      'document_schema_version',
      5,
    ]);
  });
});

it('restricts operation receipts to their actor and current project access', () => {
  studioQueries.operation.fn({
    args: { projectId: 'private', operationId: 'operation' },
    ctx: { userID: 'alice', email: '' },
  });
  expect(harness.lastQuery('studio_operation').calls).toEqual(
    expect.arrayContaining([
      ['where', 'project_id', 'private'],
      ['where', 'id', 'operation'],
      ['where', 'actor_id', 'alice'],
      ['one'],
    ])
  );
  expect(access('studio_operation.project')).toContainEqual([
    'where',
    'memberships',
    'user_id',
    'alice',
  ]);
});
