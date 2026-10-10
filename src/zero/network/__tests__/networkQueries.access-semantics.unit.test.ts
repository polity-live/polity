import { describe, expect, it } from 'vitest';
import { networkQueries } from '../queries';

type Row = Record<string, any>;
type Rows = Record<string, Row[]>;
interface AST {
  table: string;
  alias?: string;
  where?: any;
  related?: Related[];
  orderBy?: readonly (readonly [string, string])[];
  limit?: number;
  start?: { row: Row; exclusive: boolean; basis?: string };
}
interface Related {
  correlation: { parentField: readonly string[]; childField: readonly string[] };
  subquery: AST;
}

// Evaluate the real Zero AST and real access functions against an independent
// fixture. Planning hints never participate in permission or result evaluation.
// This checks predicate semantics, not Zero's incremental execution/revocation.
function predicate(condition: any, row: Row, data: Rows): boolean {
  if (!condition) return true;
  if (condition.type === 'and')
    return condition.conditions.every((child: any) => predicate(child, row, data));
  if (condition.type === 'or')
    return condition.conditions.some((child: any) => predicate(child, row, data));
  if (condition.type === 'correlatedSubquery') {
    const found = correlated(condition.related, row, data).length > 0;
    if (condition.op === 'EXISTS') return found;
    if (condition.op === 'NOT EXISTS') return !found;
    throw new Error(`Unsupported subquery operator ${condition.op}`);
  }
  if (condition.type !== 'simple') throw new Error(`Unsupported predicate ${condition.type}`);
  const value = (operand: any) => {
    if (operand.type === 'column') return row[operand.name] ?? null;
    if (operand.type === 'literal') return operand.value ?? null;
    throw new Error(`Unsupported operand ${operand.type}`);
  };
  const left = value(condition.left);
  const right = value(condition.right);
  if (condition.op === 'IS') return left === right;
  if (condition.op === 'IS NOT') return left !== right;
  if (left === null || right === null) return false;
  switch (condition.op) {
    case '=':
      return left === right;
    case '!=':
      return left !== right;
    case 'IN':
      return right.includes(left);
    case 'NOT IN':
      return !right.includes(left);
    case 'ILIKE': {
      const expression = String(right)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replaceAll('%', '.*')
        .replaceAll('_', '.');
      return new RegExp(`^${expression}$`, 'i').test(String(left));
    }
    default:
      throw new Error(`Unsupported operator ${condition.op}`);
  }
}

function correlated(related: Related, parent: Row, data: Rows): Row[] {
  const matching = (data[related.subquery.table] ?? []).filter(child =>
    related.correlation.parentField.every((field, index) => {
      const value = parent[field];
      return (
        value !== undefined &&
        value !== null &&
        value === child[related.correlation.childField[index]]
      );
    })
  );
  return select(related.subquery, { ...data, [related.subquery.table]: matching });
}

function select(ast: AST, data: Rows): Row[] {
  const ordering = [...(ast.orderBy ?? [])];
  if (!ordering.some(([field]) => field === 'id')) ordering.push(['id', 'asc']);
  const compare = (left: Row, right: Row) => {
    for (const [field, direction] of ordering) {
      if (left[field] === right[field]) continue;
      const result = left[field] < right[field] ? -1 : 1;
      return direction === 'desc' ? -result : result;
    }
    return 0;
  };
  return (data[ast.table] ?? [])
    .filter(row => predicate(ast.where, row, data))
    .sort(compare)
    .filter(
      row =>
        !ast.start ||
        (ast.start.exclusive ? compare(row, ast.start.row) > 0 : compare(row, ast.start.row) >= 0)
    )
    .slice(0, ast.limit);
}

function query(name: keyof typeof networkQueries, args: Row, userID?: string): AST {
  const built = networkQueries[name].fn({ args, ctx: { userID } } as never);
  const ast = (built as unknown as { ast: AST }).ast;
  if (!ast?.table) throw new Error('The installed Zero version no longer exposes a compatible AST');
  return ast;
}

function relation(ast: AST, alias: string): Related {
  const found = ast.related?.find(related => related.subquery.alias === alias);
  if (!found) throw new Error(`Missing relation ${alias}`);
  return found;
}

function fixture(): Rows {
  return {
    group: [
      {
        id: 'private',
        visibility: 'private',
        owner_id: 'owner',
        name: 'Secret council',
        tutorial_run_id: null,
      },
      {
        id: 'hidden',
        visibility: 'private',
        owner_id: 'other',
        name: 'Hidden',
        tutorial_run_id: null,
      },
      {
        id: 'public',
        visibility: 'public',
        owner_id: 'other',
        name: 'Public',
        tutorial_run_id: null,
      },
      {
        id: 'tutorial',
        visibility: 'public',
        owner_id: 'owner',
        name: 'Tutorial',
        tutorial_run_id: 'run',
      },
    ],
    group_membership: [
      { id: 'membership', group_id: 'private', user_id: 'member', status: 'active' },
    ],
    group_guest_access: [
      { id: 'guest', group_id: 'private', user_id: 'guest-user', status: 'active' },
    ],
    group_membership_role: [
      { id: 'membership-role', group_membership_id: 'membership', role_id: 'role' },
    ],
    group_guest_role: [{ id: 'guest-role', group_guest_access_id: 'guest', role_id: 'role' }],
    role: [{ id: 'role', group_id: 'private', scope: 'group' }],
    action_right: [{ id: 'right', role_id: 'role', resource: 'groups', action: 'view' }],
    app_tutorial_run: [{ id: 'run', user_id: 'owner', status: 'active' }],
  };
}

const derived = [
  ['hierarchyPathsByGroup', 'group_hierarchy_path', 'ancestor_group_id', 'descendant_group_id'],
  ['effectiveRightsByGroup', 'group_effective_right', 'holder_group_id', 'scope_group_id'],
  [
    'membershipExclusivityLocksByGroup',
    'group_membership_exclusivity_lock',
    'hierarchy_group_id',
    'source_group_id',
  ],
  ['siblingSourceLocksByGroup', 'group_sibling_source_lock', 'sibling_group_id', 'source_group_id'],
] as const;

describe('network query access semantics with real Zero predicates', () => {
  it('bounds EXISTS planning in all network roots and nested relations', () => {
    const args = {
      groupId: 'private',
      groupAId: 'private',
      groupBId: 'public',
      id: 'row',
      status: 'active',
      relationshipType: 'sibling',
      rights: ['informationRight'],
      direction: 'incoming',
      query: 'council',
      limit: 10,
      start: null,
      dir: 'forward',
    };
    let checks = 0;
    const inspect = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'correlatedSubquery') {
        expect(node.flip).toBe(false);
        checks++;
      }
      for (const child of Object.values(node)) inspect(child);
    };
    for (const name of Object.keys(networkQueries) as (keyof typeof networkQueries)[])
      inspect(query(name, args, 'member'));
    expect(checks).toBeGreaterThan(0);
  });

  it.each(derived)(
    '%s retains both endpoint access paths and active-only results',
    (name, table, first, second) => {
      const data = fixture();
      data[table] = [
        {
          id: 'first',
          [first]: 'private',
          [second]: 'hidden',
          status: 'active',
          depth: 1,
          right_key: 'view',
          created_at: 1,
        },
        {
          id: 'second',
          [first]: 'hidden',
          [second]: 'private',
          status: 'active',
          depth: 1,
          right_key: 'view',
          created_at: 1,
        },
        {
          id: 'inactive',
          [first]: 'private',
          [second]: 'hidden',
          status: 'revoked',
          depth: 1,
          right_key: 'view',
          created_at: 1,
        },
        {
          id: 'unrelated',
          [first]: 'public',
          [second]: 'hidden',
          status: 'active',
          depth: 1,
          right_key: 'view',
          created_at: 1,
        },
      ];
      for (const actor of ['owner', 'member', 'guest-user']) {
        expect(select(query(name, { groupId: 'private' }, actor), data).map(row => row.id)).toEqual(
          ['first', 'second']
        );
      }
      for (const actor of ['outsider', undefined]) {
        expect(select(query(name, { groupId: 'private' }, actor), data)).toEqual([]);
      }
      data.group_membership[0].status = 'invited';
      data.group_guest_access[0].status = 'revoked';
      expect(select(query(name, { groupId: 'private' }, 'member'), data)).toEqual([]);
      expect(select(query(name, { groupId: 'private' }, 'guest-user'), data)).toEqual([]);
    }
  );

  it('keeps tutorial data restricted to the owner of an open run', () => {
    const data = fixture();
    data.group_effective_right = [
      {
        id: 'tutorial-right',
        holder_group_id: 'tutorial',
        scope_group_id: 'hidden',
        status: 'active',
        right_key: 'view',
      },
    ];
    const args = { groupId: 'tutorial' };
    expect(select(query('effectiveRightsByGroup', args, 'owner'), data)).toHaveLength(1);
    for (const actor of ['member', 'outsider', undefined])
      expect(select(query('effectiveRightsByGroup', args, actor), data)).toEqual([]);
    data.app_tutorial_run[0].status = 'paused';
    expect(select(query('effectiveRightsByGroup', args, 'owner'), data)).toHaveLength(1);
    data.app_tutorial_run[0].status = 'completed';
    expect(select(query('effectiveRightsByGroup', args, 'owner'), data)).toEqual([]);
  });

  it('retains public endpoint access while hiding the private related group', () => {
    const data = fixture();
    const right = {
      id: 'public-edge',
      holder_group_id: 'private',
      scope_group_id: 'public',
      status: 'active',
      right_key: 'informationRight',
    };
    data.group_effective_right = [right];
    for (const actor of ['outsider', undefined]) {
      const ast = query('effectiveRightsByGroup', { groupId: 'private' }, actor);
      expect(select(ast, data).map(row => row.id)).toEqual(['public-edge']);
      expect(correlated(relation(ast, 'holder_group'), right, data)).toEqual([]);
      expect(correlated(relation(ast, 'scope_group'), right, data).map(row => row.id)).toEqual([
        'public',
      ]);
    }
  });

  it('retains authenticated visibility without granting anonymous access', () => {
    const data = fixture();
    data.group[0].visibility = 'authenticated';
    data.group_effective_right = [
      {
        id: 'right',
        holder_group_id: 'private',
        scope_group_id: 'hidden',
        status: 'active',
        right_key: 'informationRight',
      },
    ];
    expect(
      select(query('effectiveRightsByGroup', { groupId: 'private' }, 'outsider'), data).map(
        row => row.id
      )
    ).toEqual(['right']);
    expect(select(query('effectiveRightsByGroup', { groupId: 'private' }), data)).toEqual([]);
  });

  it.each(['workflowsByGroup', 'workflowById', 'allWorkflows'] as const)(
    '%s retains workflow access and excludes an inaccessible nested target',
    name => {
      const data = fixture();
      data.group_workflow = [
        { id: 'visible', group_id: 'private', start_group_id: 'hidden', created_at: 2 },
        { id: 'hidden-target', group_id: 'hidden', start_group_id: 'hidden', created_at: 1 },
      ];
      data.group_workflow_step = [
        {
          id: 'step',
          workflow_id: 'visible',
          group_id: 'private',
          target_workflow_id: 'hidden-target',
          order_index: 0,
        },
      ];
      const ast = query(name, { groupId: 'private', id: 'visible' }, 'member');
      expect(select(ast, data).map(row => row.id)).toEqual(['visible']);
      const steps = relation(ast, 'steps');
      expect(correlated(steps, data.group_workflow[0], data)).toHaveLength(1);
      expect(
        correlated(relation(steps.subquery, 'target_workflow'), data.group_workflow_step[0], data)
      ).toEqual([]);
      data.group_membership[0].status = 'revoked';
      expect(select(ast, data)).toEqual([]);
    }
  );

  it.each(['group', 'requested_by_group', 'workflow'] as const)(
    'retains the %s approval access path and revocation',
    path => {
      const data = fixture();
      data.group_workflow = [
        { id: 'workflow', group_id: 'hidden', start_group_id: 'private', created_at: 1 },
      ];
      data.group_workflow_approval = [
        {
          id: 'approval',
          workflow_id: path === 'workflow' ? 'workflow' : null,
          group_id: path === 'group' ? 'private' : 'hidden',
          requested_by_group_id: path === 'requested_by_group' ? 'private' : 'hidden',
          created_at: 1,
        },
      ];
      expect(
        select(query('workflowById', { id: 'workflow' }, 'member'), data).map(row => row.id)
      ).toEqual(['workflow']);
      const args = { groupId: path === 'group' ? 'private' : 'hidden' };
      const ast = query('workflowApprovalsByGroup', args, 'member');
      expect(select(ast, data).map(row => row.id)).toEqual(['approval']);
      expect(select(query('workflowApprovalsByGroup', args, 'outsider'), data)).toEqual([]);
      data.group_membership[0].status = 'revoked';
      expect(select(ast, data)).toEqual([]);
    }
  );

  it('requires group discovery rights for request search and the required source role', () => {
    const data = fixture();
    data.group_connection_request = [
      {
        id: 'request',
        group_a_id: 'private',
        group_b_id: 'public',
        initiator_group_id: 'private',
        status: 'pending',
        updated_at: 2,
      },
    ];
    data.group_membership_rule_request = [
      {
        id: 'rule-request',
        connection_request_id: 'request',
        required_source_role_id: 'role',
        updated_at: 1,
      },
    ];
    const args = {
      groupId: 'public',
      direction: 'incoming',
      query: ' council ',
      limit: 10,
      start: null,
      dir: 'forward',
    };
    const ast = query('groupConnectionRequestPage', args, 'member');
    expect(select(ast, data).map(row => row.id)).toEqual(['request']);
    const rules = relation(ast, 'membership_rule_requests');
    const sourceRole = relation(rules.subquery, 'required_source_role');
    expect(correlated(sourceRole, data.group_membership_rule_request[0], data)).toHaveLength(1);
    expect(select(query('groupConnectionRequestPage', args, 'outsider'), data)).toEqual([]);
    expect(select(query('groupConnectionRequestPage', args), data)).toEqual([]);
    data.action_right = [];
    expect(select(ast, data)).toEqual([]);
    expect(correlated(sourceRole, data.group_membership_rule_request[0], data)).toEqual([]);
    // Child content access remains broader than group discovery: an active
    // membership without a group view right still permits the request root.
    expect(
      select(query('groupConnectionRequestById', { id: 'request' }, 'member'), data)
    ).toHaveLength(1);
  });

  it('retains incoming/outgoing selection and an exclusive cursor on timestamp ties', () => {
    const data = fixture();
    data.group_connection_request = [
      {
        id: 'a',
        group_a_id: 'private',
        group_b_id: 'public',
        initiator_group_id: 'private',
        status: 'pending',
        updated_at: 2,
      },
      {
        id: 'b',
        group_a_id: 'private',
        group_b_id: 'public',
        initiator_group_id: 'private',
        status: 'pending',
        updated_at: 2,
      },
      {
        id: 'outgoing',
        group_a_id: 'private',
        group_b_id: 'public',
        initiator_group_id: 'public',
        status: 'pending',
        updated_at: 3,
      },
      {
        id: 'approved',
        group_a_id: 'private',
        group_b_id: 'public',
        initiator_group_id: 'private',
        status: 'approved',
        updated_at: 4,
      },
    ];
    const args = {
      groupId: 'public',
      direction: 'incoming',
      query: '',
      limit: 1,
      start: null,
      dir: 'forward',
    };
    expect(select(query('groupConnectionRequestPage', args), data).map(row => row.id)).toEqual([
      'b',
    ]);
    expect(
      select(
        query('groupConnectionRequestPage', { ...args, start: { id: 'b', updated_at: 2 } }),
        data
      ).map(row => row.id)
    ).toEqual(['a']);
    expect(
      select(query('groupConnectionRequestPage', { ...args, direction: 'outgoing' }), data).map(
        row => row.id
      )
    ).toEqual(['outgoing']);
    expect(
      select(
        query('groupConnectionRequestPage', {
          ...args,
          dir: 'backward',
          start: { id: 'a', updated_at: 2 },
        }),
        data
      ).map(row => row.id)
    ).toEqual(['b']);
  });
});
