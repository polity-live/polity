import { beforeEach, describe, expect, it, vi } from 'vitest';

import { amendmentSharedMutators } from '../../amendments/shared-mutators';
import { blogSharedMutators } from '../../blogs/shared-mutators';
import { eventSharedMutators } from '../../events/shared-mutators';
import { groupSharedMutators } from '../../groups/shared-mutators';
import {
  DEFAULT_AMENDMENT_ROLES,
  DEFAULT_BLOG_ROLES,
  DEFAULT_EVENT_ROLES,
  DEFAULT_GROUP_ROLES,
} from '../constants';
import { creatorActionRightId, creatorRbacId, creatorRoleId } from '../creator-bootstrap';

type Row = Record<string, unknown>;

function createRecordingTx(location: 'client' | 'server' = 'client') {
  const rows = new Map<string, Row[]>();
  const table = (name: string) => ({
    insert: vi.fn(async (row: Row) => {
      rows.set(name, [...(rows.get(name) ?? []), row]);
    }),
    update: vi.fn(),
    delete: vi.fn(),
  });
  const mutate = new Proxy<Record<string, ReturnType<typeof table>>>(
    {},
    {
      get(target, property: string) {
        return (target[property] ??= table(property));
      },
    }
  );

  return {
    tx: {
      clientID: 'client',
      mutationID: 1,
      reason: 'test',
      location,
      run: vi.fn().mockResolvedValue(undefined),
      mutate,
    } as never,
    rows: (name: string) => rows.get(name) ?? [],
  };
}

const ctx = { userID: 'creator-1', email: 'creator@example.test' } as never;

function rolePermissions(
  roles: readonly { name: string; permissions: readonly { resource: string; action: string }[] }[],
  roleName: string
) {
  return roles.find(role => role.name === roleName)?.permissions ?? [];
}

function expectCreatorRoleRights(
  rows: (name: string) => Row[],
  roleName: string,
  expectedPermissions: readonly { resource: string; action: string }[]
) {
  const role = rows('role').find(row => row.name === roleName);
  expect(role).toBeDefined();
  expect(
    rows('action_right')
      .filter(row => row.role_id === role?.id)
      .map(row => `${row.resource}:${row.action}`)
      .sort()
  ).toEqual(expectedPermissions.map(right => `${right.resource}:${right.action}`).sort());
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(1234);
});

describe('optimistic creator RBAC bootstrap', () => {
  it('derives stable, scoped UUIDs on client and server', async () => {
    const clientId = await creatorRoleId('group', 'entity-1', 'Admin');
    const serverId = await creatorRoleId('group', 'entity-1', 'Admin');

    expect(clientId).toBe(serverId);
    expect(clientId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    await expect(creatorRoleId('event', 'entity-1', 'Admin')).resolves.not.toBe(clientId);
    await expect(
      creatorActionRightId('group', 'entity-1', 'Admin', 'groups', 'manage')
    ).resolves.not.toBe(clientId);
    await expect(
      creatorRbacId('group', 'entity-1', 'creator-membership', 'creator-1')
    ).resolves.not.toBe(clientId);
  });

  it('writes identical bootstrap IDs during client and server execution', async () => {
    const client = createRecordingTx('client');
    const server = createRecordingTx('server');
    const input = {
      ctx,
      args: { id: 'group-stable', name: 'Group', visibility: 'private' } as never,
    };

    await groupSharedMutators.create.fn({ tx: client.tx, ...input });
    await groupSharedMutators.create.fn({ tx: server.tx, ...input });

    for (const table of ['role', 'action_right', 'group_membership', 'group_membership_role']) {
      expect(
        client
          .rows(table)
          .map(row => row.id)
          .sort()
      ).toEqual(
        server
          .rows(table)
          .map(row => row.id)
          .sort()
      );
    }
  });

  it('projects group membership, Admin role, and Admin rights immediately', async () => {
    const recording = createRecordingTx();
    await groupSharedMutators.create.fn({
      tx: recording.tx,
      ctx,
      args: { id: 'group-1', name: 'Group', visibility: 'private', group_type: 'base' } as never,
    });

    const adminRole = recording.rows('role').find(row => row.name === 'Admin');
    expect(recording.rows('group')).toHaveLength(1);
    expect(recording.rows('role')).toHaveLength(DEFAULT_GROUP_ROLES.length);
    expect(recording.rows('action_right')).toHaveLength(
      DEFAULT_GROUP_ROLES.flatMap(role => role.permissions).length
    );
    expect(recording.rows('group_membership')).toContainEqual(
      expect.objectContaining({ user_id: 'creator-1', status: 'active' })
    );
    expect(recording.rows('group_membership_role')).toContainEqual(
      expect.objectContaining({ role_id: adminRole?.id })
    );
    expectCreatorRoleRights(recording.rows, 'Admin', rolePermissions(DEFAULT_GROUP_ROLES, 'Admin'));
  });

  it('projects event participation, Organizer role, and Organizer rights immediately', async () => {
    const recording = createRecordingTx();
    await eventSharedMutators.create.fn({
      tx: recording.tx,
      ctx,
      args: {
        id: 'event-1',
        title: 'Event',
        visibility: 'private',
        status: 'scheduled',
        event_type: 'meeting',
        location_type: 'physical',
      } as never,
    });

    expect(recording.rows('event_participant')).toContainEqual(
      expect.objectContaining({ user_id: 'creator-1', status: 'active' })
    );
    expect(recording.rows('role')).toHaveLength(DEFAULT_EVENT_ROLES.length);
    expect(recording.rows('action_right')).toHaveLength(
      DEFAULT_EVENT_ROLES.flatMap(role => role.permissions).length
    );
    const organizer = recording.rows('role').find(row => row.name === 'Organizer');
    expect(recording.rows('event_participant_role')).toContainEqual(
      expect.objectContaining({ role_id: organizer?.id })
    );
    expectCreatorRoleRights(
      recording.rows,
      'Organizer',
      rolePermissions(DEFAULT_EVENT_ROLES, 'Organizer')
    );
  });

  it('projects amendment collaborator, Author role, and Author rights immediately', async () => {
    const recording = createRecordingTx();
    await amendmentSharedMutators.create.fn({
      tx: recording.tx,
      ctx,
      args: { id: 'amendment-1', title: 'Amendment', visibility: 'private' } as never,
    });

    const author = recording.rows('role').find(row => row.name === 'Author');
    expect(recording.rows('amendment_collaborator')).toContainEqual(
      expect.objectContaining({ user_id: 'creator-1', status: 'admin', role_id: author?.id })
    );
    expect(recording.rows('role')).toHaveLength(DEFAULT_AMENDMENT_ROLES.length);
    expect(recording.rows('action_right')).toHaveLength(
      DEFAULT_AMENDMENT_ROLES.flatMap(role => role.permissions).length
    );
    expectCreatorRoleRights(
      recording.rows,
      'Author',
      rolePermissions(DEFAULT_AMENDMENT_ROLES, 'Author')
    );
  });

  it('projects blog owner, Owner role, and Owner rights immediately', async () => {
    const recording = createRecordingTx();
    await blogSharedMutators.create.fn({
      tx: recording.tx,
      ctx,
      args: { id: 'blog-1', title: 'Blog', visibility: 'private' } as never,
    });

    const owner = recording.rows('role').find(row => row.name === 'Owner');
    expect(recording.rows('blog_blogger')).toContainEqual(
      expect.objectContaining({ user_id: 'creator-1', status: 'owner', role_id: owner?.id })
    );
    expect(recording.rows('role')).toHaveLength(DEFAULT_BLOG_ROLES.length);
    expect(recording.rows('action_right')).toHaveLength(
      DEFAULT_BLOG_ROLES.flatMap(role => role.permissions).length
    );
    expectCreatorRoleRights(recording.rows, 'Owner', rolePermissions(DEFAULT_BLOG_ROLES, 'Owner'));
  });
});
