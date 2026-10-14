import { expect, it } from 'vitest';
import { zql } from '../../schema';
import { applyEventQueryAccess, applyEventStudioManagerQueryAccess } from '../../rbac/query-access';
import { studioProjectCollaborativeAccess, studioProjectReadAccess } from '../access';
import { studioQueries } from '../queries';
import {
  applyVoteQueryAccess,
  applyElectionQueryAccess,
  applyAmendmentQueryAccess,
  applyUserQueryAccess,
  applyGroupQueryAccess,
} from '../../rbac/query-access';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import {
  amendmentChatAccess,
  projectConversationAccess,
  studioChatAccess,
} from '../../project-chat/access';

it.each(['owner', 'outsider', 'anon', undefined])(
  'bounds workspace and proposal authorization to their exact project without changing access rules for %s',
  userID => {
    const projectId = '00000000-0000-4000-8000-000000000001';
    const workspaceId = '00000000-0000-4000-8000-000000000002';
    const actor = userID && userID !== 'anon' ? userID : '00000000-0000-0000-0000-000000000000';
    const workspaceAccess = queryAST(
      zql.canvas_proposal.where(({ or, cmp, exists }) =>
        or(
          cmp('checksum', 'IS NOT', null),
          cmp('owner_id', actor),
          exists('readers', reader => reader.where('user_id', actor))
        )
      )
    ).where;
    for (const [query, args] of [
      [studioQueries.workspace, { projectId, workspaceId }],
      [studioQueries.proposals, { projectId }],
    ] as const) {
      const ast = queryAST(query.fn({ args, ctx: { userID } } as never));
      const parent = ast.where.conditions.find(
        (condition: any) =>
          condition.type === 'correlatedSubquery' &&
          condition.related.subquery.table === 'studio_project'
      );
      expect(parent.flip).toBe(true);
      expect(parent.related.correlation).toEqual({
        parentField: ['project_id'],
        childField: ['id'],
      });
      expect(parent.related.subquery.where.conditions[0]).toMatchObject({
        type: 'simple',
        left: { name: 'id' },
        op: '=',
        right: { value: projectId },
      });
      // Retain the full event audience/manager predicate and every legacy
      // owner, collaborator and group-right branch after the identity bound.
      expect(parent.related.subquery.where.conditions.slice(1)).toEqual(
        queryAST(
          studioProjectCollaborativeAccess(
            zql.studio_project.where('document_schema_version', 6),
            actor
          )
        ).where.conditions
      );
      expect(ast.where.conditions).toContainEqual(workspaceAccess);
      expect(ast.where.conditions).toContainEqual({
        type: 'simple',
        left: { type: 'column', name: 'project_id' },
        op: '=',
        right: { type: 'literal', value: projectId },
      });
      expect(ast.related).toContainEqual(
        queryAST(zql.canvas_proposal.related('readers')).related![0]
      );
    }
  }
);

it.each([
  ['event', 'event', applyEventQueryAccess],
  ['agenda_item', 'event', applyEventQueryAccess],
  ['vote', 'vote', applyVoteQueryAccess],
  ['election', 'election', applyElectionQueryAccess],
  ['amendment', 'amendment', applyAmendmentQueryAccess],
  ['user', 'user', applyUserQueryAccess],
  ['group', 'group', applyGroupQueryAccess],
] as const)(
  'plans only the selected %s source parent with the complete existing audience predicates',
  (type, relation, access) => {
    for (const userID of ['00000000-0000-4000-8000-000000000001', 'anon']) {
      const ast = queryAST(
        studioQueries.liveSources.fn({ args: { refs: [], type }, ctx: { userID } } as never)
      );
      const parentConditions: any[] = [];
      const sourceConditions: any[] = [];
      const visit = (condition: any) => {
        if (condition.type === 'correlatedSubquery') parentConditions.push(condition);
        else {
          if (condition.type === 'simple' && condition.left.name === 'source_type')
            sourceConditions.push(condition);
          for (const child of condition.conditions ?? []) visit(child);
        }
      };
      visit(ast.where);
      expect(sourceConditions.length).toBeGreaterThan(0);
      expect(
        sourceConditions.every(condition => condition.op === '=' && condition.right.value === type)
      ).toBe(true);
      expect(parentConditions).toHaveLength(1);
      expect(parentConditions[0].flip).toBe(false);
      expect(parentConditions[0].related.subquery.table).toBe(relation);
      expect(parentConditions[0].related.subquery.where).toEqual(
        queryAST(access((zql as any)[relation], userID)).where
      );
    }
  }
);

it.each(['owner', 'outsider'])(
  'plans the selected Studio event per project while preserving audience and manager access for %s',
  actor => {
    for (const [access, eventAccess] of [
      [studioProjectReadAccess, applyEventQueryAccess],
      [studioProjectCollaborativeAccess, applyEventStudioManagerQueryAccess],
    ] as const) {
      const ast = queryAST(access(zql.studio_project.where('id', 'selected-project'), actor));
      const conditions = ast.where.conditions;
      const event = conditions.find((condition: any) => condition.type === 'or').conditions[0];
      expect(event.type).toBe('correlatedSubquery');
      expect(event.related.subquery.table).toBe('event');
      expect(event.flip).toBe(false);
      expect(event.related.subquery.where).toEqual(queryAST(eventAccess(zql.event, actor)).where);
      if (access === studioProjectReadAccess) {
        const rootEventParents: any[] = [];
        const visit = (condition: any) => {
          if (condition.type === 'correlatedSubquery') {
            if (condition.related.subquery.table === 'event') rootEventParents.push(condition);
          } else for (const child of condition.conditions ?? []) visit(child);
        };
        visit(ast.where);
        expect(rootEventParents).toHaveLength(1);
        const nonEvent = conditions.find((condition: any) => condition.type === 'or').conditions[1];
        expect(nonEvent.conditions[0]).toMatchObject({
          type: 'simple',
          left: { name: 'event_id' },
          op: 'IS',
          right: { value: null },
        });
        const collaborative = queryAST(studioProjectCollaborativeAccess(zql.studio_project, actor));
        expect(nonEvent.conditions[1].conditions.slice(2)).toEqual(
          collaborative.where.conditions[1].conditions[1].conditions
        );
      }
    }
  }
);

it.each(['owner', 'outsider'])(
  'skips absent chat scopes while retaining every authorization predicate for %s',
  actor => {
    const actual = queryAST(projectConversationAccess(zql.conversation, actor, true));
    const previous = queryAST(
      zql.conversation.where('type', 'project_ai').where(({ or, exists }) =>
        or(
          exists('studio_project', p => studioChatAccess(p, actor), { flip: false }),
          exists('amendment', a => amendmentChatAccess(a, actor, true), { flip: false })
        )
      )
    );
    const removeImpliedScopeChecks = (value: any): any => {
      if (Array.isArray(value)) return value.map(removeImpliedScopeChecks).filter(Boolean);
      if (!value || typeof value !== 'object') return value;
      if (
        value.type === 'simple' &&
        value.op === 'IS NOT' &&
        value.right.value === null &&
        ['studio_project_id', 'amendment_id'].includes(value.left.name)
      )
        return undefined;
      const result = Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, removeImpliedScopeChecks(child)])
      );
      if (result.type === 'and' && result.conditions.length === 1) return result.conditions[0];
      return result;
    };
    expect(removeImpliedScopeChecks(actual)).toEqual(previous);
    expect(JSON.stringify(actual)).toContain('"name":"studio_project_id"');
    expect(JSON.stringify(actual)).toContain('"name":"amendment_id"');
  }
);

it.each(['owner', 'outsider', 'anon'])(
  'checks comment project access through the requested identity with every existing right for %s',
  userID => {
    const projectId = '00000000-0000-4000-8000-000000000001';
    const ast = queryAST(
      studioQueries.comments.fn({ args: { projectId }, ctx: { userID } } as never)
    );
    const actor = userID === 'anon' ? '00000000-0000-0000-0000-000000000000' : userID;
    const parent = ast.where.conditions.find(
      (condition: any) =>
        condition.type === 'correlatedSubquery' &&
        condition.related.subquery.table === 'studio_project'
    );
    expect(parent.flip).toBe(true);
    const conditions = parent.related.subquery.where.conditions;
    expect(conditions[0]).toMatchObject({
      type: 'simple',
      left: { name: 'id' },
      op: '=',
      right: { value: projectId },
    });
    // Identity bounds the existing foreign-key relation; audience, membership,
    // collaborator and Event manager predicates remain exactly intact.
    expect(conditions.slice(1)).toEqual(
      queryAST(
        studioProjectCollaborativeAccess(
          zql.studio_project.where('document_schema_version', 6),
          actor
        )
      ).where.conditions
    );
    expect(ast.where.conditions.find((condition: any) => condition.type === 'or')).toEqual(
      queryAST(
        zql.canvas_comment.where(({ or, cmp, exists }) =>
          or(
            cmp('proposal_id', 'IS', null),
            exists('proposal', p =>
              p.where(({ or, cmp, exists }) =>
                or(
                  cmp('checksum', 'IS NOT', null),
                  cmp('owner_id', actor),
                  exists('readers', reader => reader.where('user_id', actor))
                )
              )
            )
          )
        )
      ).where
    );
  }
);

it.each(['owner', 'outsider', 'anon', undefined])(
  'authorizes only the requested asset parent while retaining audience and workspace rights for %s',
  userID => {
    const projectId = '00000000-0000-4000-8000-000000000001';
    const actor = userID && userID !== 'anon' ? userID : '00000000-0000-0000-0000-000000000000';
    for (const workspaceId of [undefined, '00000000-0000-4000-8000-000000000002']) {
      const ast = queryAST(
        studioQueries.assets.fn({ args: { projectId, workspaceId }, ctx: { userID } } as never)
      );
      const previous = queryAST(
        zql.studio_asset
          .where('project_id', projectId)
          .where('ready', true)
          .where(({ or, cmp }) =>
            or(
              cmp('workspace_id', 'IS', null),
              cmp('workspace_id', '=', workspaceId ?? '00000000-0000-0000-0000-000000000000')
            )
          )
          .whereExists('project', project =>
            workspaceId
              ? studioProjectCollaborativeAccess(project.where('document_schema_version', 6), actor)
              : studioProjectReadAccess(
                  project.where('document_schema_version', 6),
                  userID && userID !== 'anon' ? userID : null
                )
          )
          .where(({ or, cmp, exists }) =>
            or(
              cmp('workspace_id', 'IS', null),
              exists('workspace', workspace =>
                workspace.where(({ or, cmp, exists }) =>
                  or(
                    cmp('checksum', 'IS NOT', null),
                    cmp('owner_id', actor),
                    exists('readers', reader => reader.where('user_id', actor))
                  )
                )
              )
            )
          )
      );
      const isProject = (condition: any) =>
        condition.type === 'correlatedSubquery' &&
        condition.related.subquery.table === 'studio_project';
      const parent = ast.where.conditions.find(isProject);
      const oldParent = previous.where.conditions.find(isProject);
      expect(parent.flip).toBe(true);
      expect(parent.related.correlation).toEqual(oldParent.related.correlation);
      expect(parent.related.subquery.where.conditions[0]).toMatchObject({
        type: 'simple',
        left: { name: 'id' },
        op: '=',
        right: { value: projectId },
      });
      expect(parent.related.subquery.where.conditions.slice(1)).toEqual(
        oldParent.related.subquery.where.conditions
      );
      expect(ast.where.conditions.filter((condition: any) => !isProject(condition))).toEqual(
        previous.where.conditions.filter((condition: any) => !isProject(condition))
      );
    }
  }
);
