import { expect, it } from 'vitest';
import { zql } from '../../schema';
import { applyEventQueryAccess, applyEventStudioManagerQueryAccess } from '../../rbac/query-access';
import { studioProjectCollaborativeAccess, studioProjectReadAccess } from '../access';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import {
  amendmentChatAccess,
  projectConversationAccess,
  studioChatAccess,
} from '../../project-chat/access';

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
