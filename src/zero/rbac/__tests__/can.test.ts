import { afterEach, describe, expect, it, vi } from 'vitest';

const { checkPermissionMock } = vi.hoisted(() => ({
  checkPermissionMock: vi.fn(),
}));

vi.mock('../check', () => ({ checkPermission: checkPermissionMock }));

import { can, type PermissionCheck } from '../can';
import { PermissionError } from '../errors';

function transaction(
  location: 'client' | 'server',
  results: unknown[] = []
): Parameters<typeof can>[0] & { run: ReturnType<typeof vi.fn> } {
  const queued = [...results];
  return {
    location,
    run: vi.fn(async () => queued.shift()),
  } as unknown as Parameters<typeof can>[0] & { run: ReturnType<typeof vi.fn> };
}

interface QueryAst {
  readonly table: string;
  readonly alias?: string;
  readonly where?: unknown;
  readonly related?: readonly { readonly subquery: QueryAst }[];
}

interface WhereCondition {
  readonly column: string;
  readonly value: unknown;
  readonly operator?: string;
}

function whereAst(conditions: readonly WhereCondition[]) {
  const mapped = conditions.map(({ column, value, operator = '=' }) => ({
    type: 'simple',
    left: { type: 'column', name: column },
    right: { type: 'literal', value },
    op: operator,
  }));
  return mapped.length === 1 ? mapped[0] : { type: 'and', conditions: mapped };
}

function queryAst(tx: ReturnType<typeof transaction>, callIndex: number): QueryAst {
  const query = tx.run.mock.calls[callIndex]?.[0] as { ast?: QueryAst } | undefined;
  expect(query?.ast).toBeDefined();
  return query!.ast!;
}

function expectQueryWhere(
  tx: ReturnType<typeof transaction>,
  callIndex: number,
  table: string,
  conditions: readonly WhereCondition[]
) {
  const ast = queryAst(tx, callIndex);
  expect(ast.table).toBe(table);
  expect(ast.where).toEqual(whereAst(conditions));
}

function expectAmendmentQuery(
  tx: ReturnType<typeof transaction>,
  callIndex: number,
  amendmentId: string
) {
  const ast = queryAst(tx, callIndex);
  expect(ast.table).toBe('amendment');
  expect(ast.where).toEqual(whereAst([{ column: 'id', value: amendmentId }]));
  const collaborators = ast.related?.find(relation => relation.subquery.alias === 'collaborators');
  expect(collaborators?.subquery.where).toEqual(
    whereAst([
      {
        column: 'status',
        operator: 'IN',
        value: ['active', 'collaborator', 'member', 'admin'],
      },
    ])
  );
}

afterEach(() => {
  checkPermissionMock.mockReset();
});

describe('can', () => {
  it('leaves optimistic client permission enforcement to the server', async () => {
    const tx = transaction('client');

    await expect(
      can(tx, { userID: 'anon' }, { action: 'delete', resource: 'groups' })
    ).resolves.toBeUndefined();
    expect(tx.run).not.toHaveBeenCalled();
    expect(checkPermissionMock).not.toHaveBeenCalled();
  });

  it.each(['', 'anon'])('requires an authenticated server actor (%j)', async userID => {
    const tx = transaction('server');

    const promise = can(tx, { userID }, { action: 'manage', resource: 'groups' });
    await expect(promise).rejects.toMatchObject({
      name: 'PermissionError',
      action: 'manage',
      resource: 'groups',
      scope: 'authentication required',
    });
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('loads and normalizes every supported permission scope', async () => {
    checkPermissionMock.mockReturnValue(true);
    const tx = transaction('server', [
      [
        {
          id: 'membership-without-relations',
          group: null,
          membership_roles: undefined,
          status: null,
        },
        {
          id: 'membership',
          group: { id: 'group' },
          status: 'admin',
          membership_roles: [
            { role: null },
            {
              role: {
                id: 'group-role',
                name: null,
                description: 'Group administrator',
                scope: null,
                action_rights: [
                  {
                    id: 'default-right',
                    resource: null,
                    action: null,
                    group_id: null,
                    event_id: null,
                    amendment_id: null,
                    blog_id: null,
                  },
                  {
                    id: 'scoped-right',
                    resource: 'groups',
                    action: 'manage',
                    group_id: 'group',
                    event_id: 'event',
                    amendment_id: 'amendment',
                    blog_id: 'blog',
                  },
                ],
              },
            },
          ],
        },
      ],
      [
        {
          id: 'guest-without-group',
          group: null,
          status: 'active',
          guest_roles: undefined,
        },
        {
          id: 'guest',
          group: { id: 'group' },
          status: null,
          guest_roles: [
            {
              role: {
                id: 'guest-role',
                name: 'Guest',
                description: null,
                scope: null,
                action_rights: undefined,
              },
            },
          ],
        },
      ],
      [{ id: 'group' }],
      [
        {
          id: 'participant-without-event',
          event: null,
          participant_roles: undefined,
          status: null,
        },
        {
          id: 'participant',
          event: { id: 'event' },
          participant_roles: [
            {
              role: {
                id: 'event-role',
                name: null,
                description: null,
                scope: null,
                action_rights: undefined,
              },
            },
          ],
          status: 'confirmed',
        },
      ],
      [
        { id: 'blogger-without-role', blog: null, role: null },
        {
          id: 'blogger',
          blog: { id: 'blog' },
          role: {
            id: 'blog-role',
            name: null,
            description: null,
            scope: null,
            action_rights: undefined,
          },
        },
      ],
      {
        id: 'amendment',
        created_by_id: 'owner',
        group_id: 'group',
        collaborators: [
          { id: 'collaborator-without-role', user_id: null, status: null, role: null },
          {
            id: 'collaborator',
            user_id: 'actor',
            status: 'active',
            role: {
              id: 'amendment-role',
              name: null,
              description: null,
              scope: null,
              action_rights: undefined,
            },
          },
        ],
      },
    ]);
    const check: PermissionCheck = {
      action: 'update',
      resource: 'amendments',
      groupId: 'group',
      eventId: 'event',
      blogId: 'blog',
      amendmentId: 'amendment',
    };

    await expect(can(tx, { userID: 'actor' }, check)).resolves.toBeUndefined();
    expect(tx.run).toHaveBeenCalledTimes(6);
    expect(checkPermissionMock).toHaveBeenCalledTimes(1);

    expectQueryWhere(tx, 0, 'group_membership', [
      { column: 'user_id', value: 'actor' },
      { column: 'group_id', value: 'group' },
      { column: 'status', operator: 'IN', value: ['active', 'member', 'admin'] },
    ]);
    expectQueryWhere(tx, 1, 'group_guest_access', [
      { column: 'user_id', value: 'actor' },
      { column: 'group_id', value: 'group' },
      { column: 'status', value: 'active' },
    ]);
    expectQueryWhere(tx, 2, 'group', [
      { column: 'id', value: 'group' },
      { column: 'owner_id', value: 'actor' },
    ]);
    expectQueryWhere(tx, 3, 'event_participant', [
      { column: 'user_id', value: 'actor' },
      { column: 'event_id', value: 'event' },
      {
        column: 'status',
        operator: 'IN',
        value: ['active', 'confirmed', 'member', 'admin'],
      },
    ]);
    expectQueryWhere(tx, 4, 'blog_blogger', [
      { column: 'user_id', value: 'actor' },
      { column: 'blog_id', value: 'blog' },
    ]);
    expectAmendmentQuery(tx, 5, 'amendment');

    const [data, scope, action, resource] = checkPermissionMock.mock.calls[0];
    expect({ action, resource, scope }).toEqual({
      action: 'update',
      resource: 'amendments',
      scope: {
        groupId: 'group',
        eventId: 'event',
        blogId: 'blog',
        amendment: data.amendment,
      },
    });
    expect(data).toEqual({
      userId: 'actor',
      memberships: [
        {
          id: 'membership-without-relations',
          group: undefined,
          roles: [],
          status: undefined,
        },
        {
          id: 'membership',
          group: { id: 'group' },
          roles: [
            {
              id: 'group-role',
              name: '',
              description: 'Group administrator',
              scope: 'group',
              actionRights: [
                {
                  id: 'default-right',
                  resource: 'groups',
                  action: 'view',
                  group: undefined,
                  event: undefined,
                  amendment: undefined,
                  blog: undefined,
                },
                {
                  id: 'scoped-right',
                  resource: 'groups',
                  action: 'manage',
                  group: { id: 'group' },
                  event: { id: 'event' },
                  amendment: { id: 'amendment' },
                  blog: { id: 'blog' },
                },
              ],
            },
          ],
          status: 'admin',
        },
      ],
      guestAccesses: [
        {
          id: 'guest-without-group',
          group: undefined,
          roles: [],
          status: 'active',
        },
        {
          id: 'guest',
          group: { id: 'group' },
          roles: [
            {
              id: 'guest-role',
              name: 'Guest',
              description: undefined,
              scope: 'group',
              actionRights: [],
            },
          ],
          status: undefined,
        },
      ],
      ownedGroupIds: ['group'],
      participations: [
        {
          id: 'participant-without-event',
          event: undefined,
          roles: [],
          status: undefined,
        },
        {
          id: 'participant',
          event: { id: 'event' },
          roles: [
            {
              id: 'event-role',
              name: '',
              description: undefined,
              scope: 'event',
              actionRights: [],
            },
          ],
          status: 'confirmed',
        },
      ],
      bloggerRelations: [
        { id: 'blogger-without-role', blog: undefined, role: undefined },
        {
          id: 'blogger',
          blog: { id: 'blog' },
          role: {
            id: 'blog-role',
            name: '',
            description: undefined,
            scope: 'blog',
            actionRights: [],
          },
        },
      ],
      amendment: {
        id: 'amendment',
        owner: { id: 'owner' },
        user: { id: 'owner' },
        group: { id: 'group' },
        amendmentRoleCollaborators: [
          {
            id: 'collaborator-without-role',
            user: undefined,
            status: undefined,
            role: undefined,
          },
          {
            id: 'collaborator',
            user: { id: 'actor' },
            status: 'active',
            role: {
              id: 'amendment-role',
              name: '',
              description: undefined,
              scope: 'amendment',
              actionRights: [],
            },
          },
        ],
      },
    });
  });

  it('normalizes a missing amendment and absent scope values', async () => {
    checkPermissionMock.mockReturnValue(true);
    const tx = transaction('server', [undefined]);

    await can(
      tx,
      { userID: 'actor' },
      {
        action: 'view',
        resource: 'amendments',
        groupId: null,
        eventId: null,
        blogId: null,
        amendmentId: 'missing-amendment',
      }
    );

    expect(checkPermissionMock).toHaveBeenCalledWith(
      { userId: 'actor', amendment: undefined },
      {
        groupId: undefined,
        eventId: undefined,
        blogId: undefined,
        amendment: undefined,
      },
      'view',
      'amendments'
    );
  });

  it('normalizes an amendment whose optional relations are absent', async () => {
    checkPermissionMock.mockReturnValue(true);
    const tx = transaction('server', [
      {
        id: 'amendment-without-relations',
        created_by_id: null,
        group_id: null,
        collaborators: undefined,
      },
    ]);

    await can(
      tx,
      { userID: 'actor' },
      {
        action: 'view',
        resource: 'amendments',
        amendmentId: 'amendment-without-relations',
      }
    );

    expect(checkPermissionMock.mock.calls[0][0].amendment).toEqual({
      id: 'amendment-without-relations',
      owner: undefined,
      user: undefined,
      group: undefined,
      amendmentRoleCollaborators: undefined,
    });
  });

  it('initializes canonical active-status query boundaries in an isolated module', async () => {
    vi.resetModules();
    const isolatedCan = await import('../can');
    checkPermissionMock.mockReturnValue(true);
    const tx = transaction('server', [[], undefined]);

    await isolatedCan.can(
      tx,
      { userID: 'actor' },
      {
        action: 'view',
        resource: 'amendments',
        eventId: 'event',
        amendmentId: 'amendment',
      }
    );

    expectQueryWhere(tx, 0, 'event_participant', [
      { column: 'user_id', value: 'actor' },
      { column: 'event_id', value: 'event' },
      {
        column: 'status',
        operator: 'IN',
        value: ['active', 'confirmed', 'member', 'admin'],
      },
    ]);
    expectAmendmentQuery(tx, 1, 'amendment');
  });

  it.each([
    {
      name: 'group',
      check: { action: 'manage', resource: 'groups', groupId: 'group' } as PermissionCheck,
      results: [[], [], []],
      scope: 'group:group',
    },
    {
      name: 'event',
      check: { action: 'manage', resource: 'events', eventId: 'event' } as PermissionCheck,
      results: [[]],
      scope: 'event:event',
    },
    {
      name: 'blog',
      check: { action: 'manage', resource: 'blogs', blogId: 'blog' } as PermissionCheck,
      results: [[]],
      scope: 'blog:blog',
    },
    {
      name: 'amendment',
      check: {
        action: 'manage',
        resource: 'amendments',
        amendmentId: 'amendment',
      } as PermissionCheck,
      results: [undefined],
      scope: 'amendment:amendment',
    },
    {
      name: 'unscoped',
      check: { action: 'manage', resource: 'preferences' } as PermissionCheck,
      results: [],
      scope: undefined,
    },
  ])('reports a denied $name permission with its semantic scope', async scenario => {
    checkPermissionMock.mockReturnValue(false);
    const tx = transaction('server', scenario.results);

    const promise = can(tx, { userID: 'actor' }, scenario.check);
    await expect(promise).rejects.toBeInstanceOf(PermissionError);
    await expect(promise).rejects.toMatchObject({ scope: scenario.scope });
    expect(tx.run).toHaveBeenCalledTimes(scenario.results.length);
  });

  it('propagates permission data loading failures', async () => {
    const failure = new Error('database unavailable');
    const tx = {
      location: 'server',
      run: vi.fn().mockRejectedValue(failure),
    } as unknown as Parameters<typeof can>[0];

    await expect(
      can(tx, { userID: 'actor' }, { action: 'view', resource: 'groups', groupId: 'group' })
    ).rejects.toBe(failure);
    expect(checkPermissionMock).not.toHaveBeenCalled();
  });
});
