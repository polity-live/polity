import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness, evaluatePredicate } from '../../__tests__/test-utils/zeroHarness';
vi.mock('@rocicorp/zero', () => ({
  defineQuery: (schema: unknown, fn: unknown) => ({ fn, schema }),
}));
const io = vi.hoisted(() => ({ zql: {} as any }));
vi.mock('../../schema', () => ({ zql: new Proxy({}, { get: (_target, key) => io.zql[key] }) }));
import { studioQueries } from '../queries';
import { studioProjectReadAccess } from '../access';
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

function rules(table: string) {
  return harness
    .lastQuery(table)
    .calls.flatMap(call =>
      call[0] === 'where' && typeof call[1] === 'function' ? evaluatePredicate(call[1]) : [call]
    );
}

describe('Studio event presentation projections', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';
  const deviceId = '00000000-0000-4000-8000-000000000002';
  const emptyId = '00000000-0000-0000-0000-000000000000';

  it.each(['alice', undefined, null, 'anon', ''])(
    'separates presentation viewing from agenda administration for identity %s',
    userID => {
      const ctx = { userID, email: '' } as any;
      studioQueries.eventProject.fn({ args: { eventId }, ctx });
      expect(harness.lastQuery('studio_project').calls).toContainEqual([
        'where',
        'event_id',
        eventId,
      ]);
      expect(harness.lastQuery('studio_project').calls).toContainEqual(['one']);
      expect(access('studio_project')).toContainEqual(['exists', 'event']);
      expect(access('studio_project')).toContainEqual(
        userID === 'alice'
          ? ['cmp', 'creator_id', userID]
          : ['where', 'event', 'visibility', 'public']
      );
      if (userID !== 'alice') {
        const projectRules = access('studio_project');
        expect(JSON.stringify(projectRules)).not.toContain('authenticated');
        expect(
          projectRules.some(call => ['owner_id', 'creator_id', 'user_id'].includes(String(call[1])))
        ).toBe(false);
        expect(projectRules).not.toContainEqual(['exists', 'collaborators']);
        expect(projectRules).not.toContainEqual(['exists', 'group']);
      }

      studioQueries.eventPresentation.fn({ args: { eventId }, ctx });
      expect(harness.lastQuery('event_presentation').calls).toEqual(
        expect.arrayContaining([['where', 'event_id', eventId], ['one']])
      );
      const viewing = rules('event_presentation.event');
      expect(viewing).toContainEqual(
        userID === 'alice' ? ['cmp', 'creator_id', userID] : ['where', 'visibility', 'public']
      );
      expect(viewing).not.toContainEqual(['where', 'id', '00000000-0000-0000-0000-000000000000']);

      studioQueries.eventManager.fn({ args: { eventId }, ctx });
      expect(harness.lastQuery('event').calls).toEqual(
        expect.arrayContaining([['where', 'id', eventId], ['one']])
      );
      const managing = rules('event');
      if (userID === 'alice') {
        expect(managing).toContainEqual(['cmp', 'creator_id', userID]);
        expect(managing).toContainEqual([
          'where',
          'roles.event_action_rights',
          'resource',
          'IN',
          ['events', 'agendaItems'],
        ]);
        expect(managing).toContainEqual([
          'where',
          'roles.event_action_rights',
          'action',
          'IN',
          ['manage'],
        ]);
      } else {
        expect(managing).toContainEqual(['where', 'id', '00000000-0000-0000-0000-000000000000']);
      }
    }
  );

  it.each(['anon', ''])(
    'normalizes direct Studio read identity %s to the same public access as null',
    actor => {
      studioProjectReadAccess(harness.createQuery('studio_project'), null);
      const anonymous = access('studio_project');
      studioProjectReadAccess(harness.createQuery('studio_project'), actor);
      expect(access('studio_project')).toEqual(anonymous);
    }
  );

  it.each(['alice', undefined, null, 'anon', ''])(
    'limits nonmanager device discovery to the requested device and its viewer %s',
    userID => {
      for (const requestedDevice of [deviceId, undefined]) {
        studioQueries.presentationDevices.fn({
          args: { eventId, deviceId: requestedDevice },
          ctx: { userID, email: '' } as any,
        });
        const query = harness.lastQuery('event_presentation_device');
        expect(query.calls).toContainEqual(['where', 'event_id', eventId]);
        expect(query.calls).toContainEqual(['orderBy', 'last_seen', 'desc']);
        const deviceRules = access('event_presentation_device');
        expect(deviceRules).toContainEqual(['cmp', 'id', requestedDevice ?? emptyId]);
        expect(deviceRules).toContainEqual(
          userID === 'alice' ? ['cmp', 'user_id', userID] : ['cmp', 'user_id', 'IS', null]
        );
        const alternatives = deviceRules.filter(call => call[0] === 'or').at(-1);
        expect(alternatives?.slice(1).map(term => (term as any[])[0])).toEqual(['exists', 'and']);
        expect(
          deviceRules.filter(call => call[0] === 'exists' && call[1] === 'event')
        ).toHaveLength(2);
        if (userID === 'alice') {
          expect(deviceRules).toContainEqual([
            'where',
            'roles.event_action_rights',
            'resource',
            'IN',
            ['events', 'agendaItems'],
          ]);
        } else {
          expect(deviceRules).toContainEqual([
            'where',
            'event',
            'id',
            '00000000-0000-0000-0000-000000000000',
          ]);
          expect(deviceRules).toContainEqual(['where', 'event', 'visibility', 'public']);
        }
      }
    }
  );

  const sourceTypes = [
    'event',
    'agenda_item',
    'vote',
    'election',
    'amendment',
    'user',
    'group',
  ] as const;
  it.each(sourceTypes)(
    'requests each %s source by its exact type and ID with parent authorization',
    type => {
      for (const userID of ['alice', 'anon']) {
        studioQueries.liveSources.fn({
          args: { refs: [{ type, id: eventId }] },
          ctx: { userID, email: '' },
        });
        const query = harness.lastQuery('studio_live_source');
        const selection = evaluatePredicate(query.calls[0][1]);
        expect(selection).toContainEqual([
          'and',
          ['cmp', 'source_type', type],
          ['cmp', 'source_id', eventId],
        ]);
        const authorization = evaluatePredicate(query.calls[1][1]);
        expect(authorization.filter(call => call[0] === 'or').at(-1)).toEqual([
          'or',
          ['and', ['cmp', 'source_type', 'IN', ['event', 'agenda_item']], ['exists', 'event']],
          ...['vote', 'election', 'amendment', 'user', 'group'].map(relation => [
            'and',
            ['cmp', 'source_type', relation],
            ['exists', relation],
          ]),
        ]);
        expect(authorization).toContainEqual(['exists', type === 'agenda_item' ? 'event' : type]);
        expect(authorization).toContainEqual([
          'cmp',
          'source_type',
          'IN',
          ['event', 'agenda_item'],
        ]);
        for (const relation of ['event', 'vote', 'election', 'amendment', 'user', 'group'])
          expect(authorization).toContainEqual(['exists', relation]);
        expect(authorization).toContainEqual(
          userID === 'alice'
            ? ['cmp', 'creator_id', userID]
            : ['where', 'event', 'visibility', 'public']
        );
        expect(query.calls.slice(-2)).toEqual([
          ['orderBy', 'source_type', 'asc'],
          ['orderBy', 'source_id', 'asc'],
        ]);
      }
    }
  );

  it('prioritizes explicit references, then source type, then event, and denies an empty selection', () => {
    const inputs = [
      { refs: [{ type: 'vote', id: deviceId }], type: 'group', eventId },
      { refs: [], type: 'group', eventId },
      { refs: [], eventId },
      { refs: [] },
    ] as const;
    const expected = [
      ['and', ['cmp', 'source_type', 'vote'], ['cmp', 'source_id', deviceId]],
      ['cmp', 'source_type', 'group'],
      ['cmp', 'event_id', eventId],
      ['cmp', 'source_id', emptyId],
    ];
    inputs.forEach((args, index) => {
      studioQueries.liveSources.fn({ args: args as any, ctx: { userID: 'alice', email: '' } });
      expect(evaluatePredicate(harness.lastQuery('studio_live_source').calls[0][1])).toContainEqual(
        expected[index]
      );
    });
  });

  it('keeps each source type paired with its ID when selecting mixed references', () => {
    studioQueries.liveSources.fn({
      args: {
        refs: [
          { type: 'event', id: eventId },
          { type: 'vote', id: deviceId },
        ],
      },
      ctx: { userID: 'alice', email: '' },
    });
    const selection = evaluatePredicate(harness.lastQuery('studio_live_source').calls[0][1]);
    expect(selection.at(-1)).toEqual([
      'or',
      ['and', ['cmp', 'source_type', 'event'], ['cmp', 'source_id', eventId]],
      ['and', ['cmp', 'source_type', 'vote'], ['cmp', 'source_id', deviceId]],
    ]);
  });

  it('validates event identifiers, optional device identifiers, source kinds and reference limits', () => {
    for (const name of [
      'eventProject',
      'eventPresentation',
      'eventManager',
      'presentationDevices',
    ] as const) {
      const schema = (studioQueries[name] as any).schema;
      expect(schema.safeParse({ eventId }).success).toBe(true);
      expect(schema.safeParse({ eventId: 'invalid' }).success).toBe(false);
    }
    const devices = (studioQueries.presentationDevices as any).schema;
    expect(devices.safeParse({ eventId, deviceId }).success).toBe(true);
    expect(devices.safeParse({ eventId, deviceId: 'invalid' }).success).toBe(false);
    const sources = (studioQueries.liveSources as any).schema;
    const refs = sourceTypes.map(type => ({ type, id: eventId }));
    expect(sources.safeParse({ refs, type: 'event', eventId }).success).toBe(true);
    expect(sources.safeParse({ refs: [] }).success).toBe(true);
    expect(sources.safeParse({ refs: Array(2000).fill(refs[0]) }).success).toBe(true);
    for (const args of [
      { refs: Array(2001).fill(refs[0]) },
      { refs: [{ type: 'unknown', id: eventId }] },
      { refs: [{ type: 'event', id: 'invalid' }] },
      { refs: [], type: 'unknown' },
      { refs: [], eventId: 'invalid' },
    ])
      expect(sources.safeParse(args).success).toBe(false);
  });
});
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
      expect(access('canvas_proposal.project')).toContainEqual(['cmp', 'group_id', 'IS', null]);
      expect(access('canvas_proposal.project')).toContainEqual([
        'where',
        'collaborators',
        'user_id',
        actor,
      ]);
      expect(access('canvas_proposal.project')).not.toContainEqual(['cmp', 'visibility', 'public']);
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
      'memberships.membership_roles.studio_project_rights',
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
      'memberships.membership_roles.studio_project_rights',
      'resource',
      'projects',
    ]);
    expect(rules).toContainEqual([
      'where',
      'memberships.membership_roles.studio_project_rights',
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
          ['where', 'document_schema_version', 6],
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
        'memberships.membership_roles.studio_project_rights',
        'resource',
        'projects',
      ]);
      expect(rules).toContainEqual([
        'where',
        'memberships.membership_roles.studio_project_rights',
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
    expect(rules).not.toContainEqual(['cmp', 'visibility', 'public']);
    expect(harness.lastQuery('studio_export.project').calls).toContainEqual([
      'where',
      'document_schema_version',
      6,
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
      6,
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

it.each(['alice', 'anon'])(
  'authorizes every durable Studio projection for %s without read side effects',
  userID => {
    for (const groupId of [null, 'group'])
      for (const workspaceId of [undefined, 'workspace']) {
        const args = {
          id: 'project',
          operationId: 'operation',
          projectId: 'project',
          workspaceId,
          groupId,
        };
        for (const name of [
          'commandReceipt',
          'canvasReceipt',
          'control',
          'sessionProject',
          'assets',
          'collaborators',
          'invitations',
          'themes',
          'elementSets',
          'editorActions',
          'comments',
          'history',
          'libraries',
          'export',
        ]) {
          (studioQueries as any)[name].fn({
            args: ['invitations'].includes(name) ? undefined : args,
            ctx: { userID, email: '' },
          });
        }
        for (const queryList of Object.values(harness.byTable))
          for (const query of queryList)
            for (const call of query.calls)
              if (call[0] === 'where' && typeof call[1] === 'function') evaluatePredicate(call[1]);
      }
    const actor = userID === 'alice' ? userID : '00000000-0000-0000-0000-000000000000';
    expect(harness.lastQuery('studio_command_receipt').calls).toContainEqual([
      'where',
      'actor_id',
      actor,
    ]);
    expect(harness.lastQuery('studio_editor_action').calls).toContainEqual([
      'where',
      'actor_id',
      actor,
    ]);
    expect(harness.lastQuery('studio_editor_action').calls).toContainEqual([
      'where',
      'pending',
      true,
    ]);
    expect(harness.lastQuery('studio_project_collaborator').calls).toContainEqual([
      'where',
      'status',
      'invited',
    ]);
    expect(access('canvas_history.project')).not.toContainEqual(['cmp', 'visibility', 'public']);
    expect(access('studio_export.project')).not.toContainEqual(['cmp', 'visibility', 'public']);
  }
);
