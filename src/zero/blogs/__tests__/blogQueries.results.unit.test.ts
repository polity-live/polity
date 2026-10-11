import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

// Evaluate the query callbacks and real access helpers against related fixture rows.
// Planner hints do not affect predicates, so expectations describe visible results.
const fixtures = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};

  class FixtureQuery {
    rows: Row[];
    ordering: [string, string][] = [];
    singular = false;

    constructor(rows: Row[]) {
      this.rows = [...rows];
    }

    where(...args: any[]) {
      const compare = (field: string, op: string, value: any) => (row: Row) => {
        if (op === 'IS') return (row[field] ?? null) === value;
        if (row[field] == null) return false;
        if (op === '=') return row[field] === value;
        if (op === 'IN') return value.includes(row[field]);
        if (op === 'ILIKE') {
          const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i').test(
            row[field]
          );
        }
        throw new Error(`Unsupported fixture comparison: ${op}`);
      };
      const exists =
        (relation: string, callback: (query: FixtureQuery) => FixtureQuery) => (row: Row) =>
          callback(new FixtureQuery(this.relationRows(row[relation]))).rows.length > 0;
      const predicate =
        typeof args[0] === 'function'
          ? args[0]({
              cmp: (...values: [string, string, any] | [string, any]) =>
                values.length === 2
                  ? compare(values[0], '=', values[1])
                  : compare(values[0], values[1], values[2]),
              exists,
              or:
                (...terms: ((row: Row) => boolean)[]) =>
                (row: Row) =>
                  terms.some(term => term(row)),
              and:
                (...terms: ((row: Row) => boolean)[]) =>
                (row: Row) =>
                  terms.every(term => term(row)),
            })
          : args.length === 2
            ? compare(args[0], '=', args[1])
            : compare(args[0], args[1], args[2]);
      this.rows = this.rows.filter(predicate);
      return this;
    }

    relationRows(value: Row | Row[] | null | undefined): Row[] {
      return Array.isArray(value) ? value : value ? [value] : [];
    }

    whereExists(relation: string, callback: (query: FixtureQuery) => FixtureQuery) {
      return this.where(({ exists }: any) => exists(relation, callback));
    }

    related(relation: string, callback = (query: FixtureQuery) => query) {
      this.rows = this.rows.map(row => {
        const result = callback(new FixtureQuery(this.relationRows(row[relation]))).rows;
        return { ...row, [relation]: Array.isArray(row[relation]) ? result : result[0] };
      });
      return this;
    }

    orderBy(field: string, direction: string) {
      this.ordering.push([field, direction]);
      this.rows.sort((left, right) => this.compareRows(left, right));
      return this;
    }

    compareRows(left: Row, right: Row) {
      for (const [field, direction] of this.ordering) {
        if (left[field] === right[field]) continue;
        const comparison = left[field] < right[field] ? -1 : 1;
        return direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    }

    start(cursor: Row, { inclusive }: { inclusive: boolean }) {
      this.rows = this.rows.filter(row => {
        const comparison = this.compareRows(row, cursor);
        return inclusive ? comparison >= 0 : comparison > 0;
      });
      return this;
    }

    limit(count: number) {
      this.rows = this.rows.slice(0, count);
      return this;
    }

    one() {
      this.singular = true;
      return this;
    }

    get data() {
      return this.singular ? this.rows[0] : this.rows;
    }
  }

  return { tables, createQuery: (table: string) => new FixtureQuery(tables[table] ?? []) };
});

vi.mock('@rocicorp/zero', () => ({ defineQuery: (_schema: unknown, fn: unknown) => ({ fn }) }));
vi.mock('../../schema', () => ({
  zql: new Proxy({}, { get: (_target, table) => fixtures.createQuery(String(table)) }),
}));

import { blogQueries } from '../queries';
import { searchQueries } from '../../shared/queries';

function blog(id: string, overrides: Row = {}): Row {
  return {
    id,
    title: 'Climate',
    description: '',
    visibility: 'public',
    created_at: 10,
    tutorial_run_id: null,
    bloggers: [],
    roles: [],
    group: undefined,
    subscribers: [],
    support_votes: [],
    blog_hashtags: [],
    ...overrides,
  };
}

function user(id: string): Row {
  return { id, visibility: 'public', tutorial_run_id: null };
}

function invoke(query: any, args: Row, userID = 'viewer'): any {
  return query.fn({ args, ctx: { userID, email: '' } }).data;
}

beforeEach(() => {
  for (const table of Object.keys(fixtures.tables)) Reflect.deleteProperty(fixtures.tables, table);
});

describe('blog query visible results with bounded planning', () => {
  it.each([
    ['public', {}, 'anon', true],
    ['authenticated', { visibility: 'authenticated' }, 'anon', false],
    ['signed in', { visibility: 'authenticated' }, 'viewer', true],
    ['unrelated private', { visibility: 'private' }, 'viewer', false],
    [
      'owner',
      { visibility: 'private', bloggers: [{ user_id: 'viewer', status: 'owner' }] },
      'viewer',
      true,
    ],
    [
      'writer without rights',
      { visibility: 'private', bloggers: [{ user_id: 'viewer', status: 'writer' }] },
      'viewer',
      false,
    ],
    [
      'invited role with view',
      {
        visibility: 'private',
        roles: [
          {
            scope: 'blog',
            bloggers: [{ user_id: 'viewer', status: 'invited' }],
            blog_action_rights: [{ resource: 'blogs', action: 'view' }],
          },
        ],
      },
      'viewer',
      true,
    ],
    [
      'removed role with view',
      {
        visibility: 'private',
        roles: [
          {
            scope: 'blog',
            bloggers: [{ user_id: 'viewer', status: 'removed' }],
            blog_action_rights: [{ resource: 'blogs', action: 'view' }],
          },
        ],
      },
      'viewer',
      false,
    ],
    [
      'wrong resource',
      {
        visibility: 'private',
        roles: [
          {
            scope: 'blog',
            bloggers: [{ user_id: 'viewer', status: 'member' }],
            blog_action_rights: [{ resource: 'groups', action: 'view' }],
          },
        ],
      },
      'viewer',
      false,
    ],
    [
      'active group member',
      {
        visibility: 'private',
        group: { memberships: [{ user_id: 'viewer', status: 'active' }], guest_accesses: [] },
      },
      'viewer',
      true,
    ],
    [
      'invited group member',
      {
        visibility: 'private',
        group: { memberships: [{ user_id: 'viewer', status: 'invited' }], guest_accesses: [] },
      },
      'viewer',
      false,
    ],
    [
      'active group guest',
      {
        visibility: 'private',
        group: { memberships: [], guest_accesses: [{ user_id: 'viewer', status: 'active' }] },
      },
      'viewer',
      true,
    ],
  ] as const)('preserves %s discovery', (_label, overrides, viewer, visible) => {
    fixtures.tables.blog = [blog('target', overrides)];
    expect(invoke(blogQueries.byId, { id: 'target' }, viewer)?.id).toBe(
      visible ? 'target' : undefined
    );
  });

  it.each([
    ['active', 'viewer', true],
    ['paused', 'viewer', true],
    ['completed', 'viewer', false],
    ['active', 'other', false],
    ['active', 'anon', false],
  ] as const)('isolates %s tutorial blogs for %s', (status, viewer, visible) => {
    fixtures.tables.blog = [
      blog('tutorial', {
        tutorial_run_id: 'run',
        tutorial_run: { user_id: 'viewer', status },
      }),
    ];
    expect(invoke(blogQueries.byId, { id: 'tutorial' }, viewer)?.id).toBe(
      visible ? 'tutorial' : undefined
    );
  });

  it('retains the self-or-manager boundary for detail subscribers and support votes', () => {
    const parent = blog('target', {
      bloggers: [{ user_id: 'manager', status: 'admin' }],
    });
    parent.subscribers = ['viewer', 'other'].map(id => ({ id, subscriber_id: id, blog: parent }));
    parent.support_votes = ['viewer', 'other'].map(id => ({
      id,
      user_id: id,
      user: user(id),
      blog: parent,
    }));
    fixtures.tables.blog = [parent];

    for (const [viewer, expected] of [
      ['viewer', ['viewer']],
      ['manager', ['viewer', 'other']],
      ['anon', []],
    ] as const) {
      const result = invoke(blogQueries.byIdWithDetails, { id: 'target' }, viewer);
      expect(result.subscribers.map((row: Row) => row.id)).toEqual(expected);
      expect(result.support_votes.map((row: Row) => row.id)).toEqual(expected);
    }
  });

  it('retains manager access and private votes on both comments and replies', () => {
    const parent = blog('target', { bloggers: [{ user_id: 'manager', status: 'admin' }] });
    const thread: Row = { id: 'thread', blog_id: parent.id, blog: parent };
    const comment: Row = { id: 'comment', thread, user: user('author') };
    const reply: Row = { id: 'reply', thread, user: user('author') };
    for (const row of [comment, reply]) {
      row.votes = ['viewer', 'other'].map(id => ({
        id,
        user_id: id,
        user: user(id),
        comment: row,
      }));
    }
    comment.replies = [reply];
    thread.comments = [comment];
    fixtures.tables.thread = [thread];
    fixtures.tables.blog = [parent];

    expect(invoke(blogQueries.byIdForEditor, { id: parent.id }, 'viewer')).toBeUndefined();
    expect(invoke(blogQueries.byIdForEditor, { id: parent.id }, 'manager').id).toBe(parent.id);
    for (const [viewer, expected] of [
      ['viewer', ['viewer']],
      ['manager', ['viewer', 'other']],
      ['anon', []],
    ] as const) {
      const result = invoke(blogQueries.blogThread, { blog_id: parent.id }, viewer);
      expect(result.comments[0].votes.map((row: Row) => row.id)).toEqual(expected);
      expect(result.comments[0].replies[0].votes.map((row: Row) => row.id)).toEqual(expected);
    }
  });

  it.each([
    ['writer', 'manage', true],
    ['writer', 'view', false],
    ['invited', 'manage', false],
  ] as const)('preserves editor access for a %s role with %s', (status, action, visible) => {
    fixtures.tables.blog = [
      blog('target', {
        roles: [
          {
            scope: 'blog',
            bloggers: [{ user_id: 'viewer', status }],
            blog_action_rights: [{ resource: 'blogBloggers', action }],
          },
        ],
      }),
    ];
    expect(invoke(blogQueries.byIdForEditor, { id: 'target' })?.id).toBe(
      visible ? 'target' : undefined
    );
  });

  it('does not return another viewer’s blogger memberships', () => {
    fixtures.tables.blog_blogger = [
      {
        id: 'membership',
        user_id: 'viewer',
        status: 'writer',
        created_at: 10,
        blog: blog('target'),
        user: user('viewer'),
        role: { id: 'writer-role' },
      },
    ];
    const args = { userId: 'viewer', query: '', limit: 10, start: null, dir: 'forward' };
    expect(invoke(blogQueries.bloggerMembershipPageByUser, args).map((row: Row) => row.id)).toEqual(
      ['membership']
    );
    expect(invoke(blogQueries.bloggerMembershipPageByUser, args, 'other')).toEqual([]);
    expect(invoke(blogQueries.bloggerMembershipPageByUser, args, 'anon')).toEqual([]);
  });

  it.each(['first_name', 'last_name', 'handle'])(
    'preserves blogger search by %s with access, status, role, and cursor filters',
    field => {
      const parent = blog('target');
      const entry = (id: string, overrides: Row = {}): Row => ({
        id,
        blog_id: parent.id,
        blog: parent,
        user: {
          ...user(id),
          first_name: 'Grace',
          last_name: 'Hopper',
          handle: 'grace',
          [field]: 'Ada',
        },
        status: 'writer',
        role_id: 'writer-role',
        role: { id: 'writer-role' },
        created_at: 10,
        ...overrides,
      });
      fixtures.tables.blog_blogger = [
        ...['a', 'b', 'c'].map(id => entry(id)),
        entry('wrong-search', {
          user: { ...user('unrelated'), first_name: 'Grace', last_name: 'Hopper', handle: 'grace' },
        }),
        entry('wrong-status', { status: 'invited' }),
        entry('wrong-role', { role_id: 'reader-role' }),
        entry('wrong-blog', { blog_id: 'another', blog: blog('another') }),
      ];
      const args = {
        blogId: parent.id,
        query: ' aDa ',
        status: 'writer',
        statuses: ['writer'],
        roleId: 'writer-role',
        roleIds: ['writer-role'],
        limit: 2,
        start: null,
        dir: 'forward',
      };
      const result = invoke(blogQueries.bloggerPage, args);
      expect(result.map((row: Row) => row.id)).toEqual(['c', 'b']);
      expect(result[0].user[field]).toBe('Ada');
      expect(result[0].role.id).toBe('writer-role');
      expect(
        invoke(blogQueries.bloggerPage, {
          ...args,
          start: { created_at: 10, id: 'c' },
        }).map((row: Row) => row.id)
      ).toEqual(['b', 'a']);
      expect(
        invoke(blogQueries.bloggerPage, {
          ...args,
          dir: 'backward',
          start: { created_at: 10, id: 'a' },
        }).map((row: Row) => row.id)
      ).toEqual(['b', 'c']);

      fixtures.tables.blog_blogger = [
        entry('private-entry', {
          blog: blog(parent.id, { visibility: 'private' }),
        }),
      ];
      expect(invoke(blogQueries.bloggerPage, args)).toEqual([]);
      expect(invoke(blogQueries.bloggerPage, args, 'anon')).toEqual([]);
    }
  );

  it('preserves filtered forward and backward pages including tied timestamps', () => {
    fixtures.tables.blog = [
      ...['a', 'b', 'c'].map(id => blog(id, { bloggers: [{ user_id: 'author' }] })),
      blog('other-author', { bloggers: [{ user_id: 'other' }], created_at: 20 }),
      blog('wrong-search', {
        title: 'Unrelated',
        bloggers: [{ user_id: 'author' }],
        created_at: 20,
      }),
      blog('private', { visibility: 'private', bloggers: [{ user_id: 'author' }], created_at: 30 }),
    ];
    const args = { userId: 'author', query: ' climate ', limit: 1, start: null, dir: 'forward' };
    expect(invoke(blogQueries.pageByUser, args).map((row: Row) => row.id)).toEqual(['c']);
    expect(
      invoke(blogQueries.pageByUser, { ...args, start: { created_at: 10, id: 'c' } }).map(
        (row: Row) => row.id
      )
    ).toEqual(['b']);
    expect(
      invoke(blogQueries.pageByUser, {
        ...args,
        dir: 'backward',
        start: { created_at: 10, id: 'a' },
      }).map((row: Row) => row.id)
    ).toEqual(['b']);
  });

  it.each(['', '  climate  '])(
    'preserves blog search results and private related data for %j',
    query => {
      const publicBlog = blog('public', {
        created_at: 20,
        group: {
          id: 'private-group',
          visibility: 'private',
          tutorial_run_id: null,
          memberships: [],
          guest_accesses: [],
          roles: [],
        },
        bloggers: ['viewer', 'other'].map(id => ({
          user_id: id,
          user: user(id),
          role: { id: 'role' },
        })),
        support_votes: ['viewer', 'other'].map(id => ({ user_id: id, user: user(id) })),
        blog_hashtags: [{ id: 'tag-link', hashtag: { id: 'tag', tag: 'Climate' } }],
      });
      fixtures.tables.blog = [
        publicBlog,
        blog('own-private', {
          visibility: 'private',
          bloggers: [{ user_id: 'viewer', status: 'owner', user: user('viewer') }],
        }),
        blog('hidden', { visibility: 'private', created_at: 30 }),
      ];
      const results = invoke(searchQueries.searchableBlogs, { query, limit: 2 });
      expect(results.map((row: Row) => row.id)).toEqual(['public', 'own-private']);
      expect(results[0].group).toBeUndefined();
      expect(results[0].bloggers.map((row: Row) => row.user_id)).toEqual(['viewer']);
      expect(results[0].support_votes.map((row: Row) => row.user_id)).toEqual(['viewer']);
      expect(results[0].blog_hashtags[0].hashtag.tag).toBe('Climate');
      const anonymousResults = invoke(searchQueries.searchableBlogs, { query, limit: 2 }, 'anon');
      expect(anonymousResults.map((row: Row) => row.id)).toEqual(['public']);
      expect(anonymousResults[0].bloggers).toEqual([]);
      expect(anonymousResults[0].support_votes).toEqual([]);
    }
  );

  it('matches trimmed text against either title or description and keeps the search limit', () => {
    fixtures.tables.blog = [
      blog('unrelated', { title: 'Transport', created_at: 40 }),
      blog('description', { title: 'Energy', description: 'A CLIMATE proposal', created_at: 30 }),
      blog('title', { title: 'Climate action', created_at: 20 }),
      blog('older', { title: 'Climate adaptation', created_at: 10 }),
    ];
    expect(
      invoke(searchQueries.searchableBlogs, { query: ' climate ', limit: 2 }).map(
        (row: Row) => row.id
      )
    ).toEqual(['description', 'title']);
    expect(
      invoke(searchQueries.searchableBlogs, { query: '   ', limit: 2 }).map((row: Row) => row.id)
    ).toEqual(['unrelated', 'description']);
  });
});
