import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl =
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = postgres(databaseUrl, { max: 2, prepare: false });

const ids = {
  admin: 'a2200000-0000-0000-0000-000000000001',
  member: 'a2200000-0000-0000-0000-000000000002',
  group: 'a2200000-0000-0000-0000-000000000003',
  adminMembership: 'a2200000-0000-0000-0000-000000000004',
  memberMembership: 'a2200000-0000-0000-0000-000000000005',
  managerRole: 'a2200000-0000-0000-0000-000000000006',
  managerRight: 'a2200000-0000-0000-0000-000000000007',
  managerAssignment: 'a2200000-0000-0000-0000-000000000008',
  event: 'a2200000-0000-0000-0000-000000000009',
  adminParticipant: 'a2200000-0000-0000-0000-00000000000a',
  memberParticipant: 'a2200000-0000-0000-0000-00000000000b',
} as const;

async function cleanup() {
  await sql`delete from public.event_participant where id in (${ids.adminParticipant}::uuid, ${ids.memberParticipant}::uuid)`;
  await sql`delete from public.event where id = ${ids.event}::uuid`;
  await sql`delete from public.group_membership_role where id = ${ids.managerAssignment}::uuid`;
  await sql`delete from public.action_right where id = ${ids.managerRight}::uuid`;
  await sql`delete from public.role where id = ${ids.managerRole}::uuid`;
  await sql`delete from public.group_membership where id in (${ids.adminMembership}::uuid, ${ids.memberMembership}::uuid)`;
  await sql`delete from public."group" where id = ${ids.group}::uuid`;
  await sql`delete from public."user" where id in (${ids.admin}::uuid, ${ids.member}::uuid)`;
}

async function readRolesAs(actorId: string) {
  return sql.begin(async transaction => {
    await transaction.unsafe('set local role authenticated');
    await transaction`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: actorId,
      role: 'authenticated',
    })}, true)`;
    return transaction<{ id: string }[]>`
      select id::text
      from public.role
      where group_id = ${ids.group}::uuid
    `;
  });
}

beforeAll(async () => {
  await cleanup();
  await sql`
    insert into public."user" (id, email, handle, visibility)
    values
      (${ids.admin}::uuid, 'agent2-admin@example.test', 'agent2-admin', 'private'),
      (${ids.member}::uuid, 'agent2-member@example.test', 'agent2-member', 'private')
  `;
  await sql`
    insert into public."group" (id, name, visibility, owner_id, group_type)
    values (${ids.group}::uuid, 'Agent 2 private group', 'private', ${ids.admin}::uuid, 'base')
  `;
  await sql`
    insert into public.group_membership (id, group_id, user_id, status, visibility, source)
    values
      (${ids.adminMembership}::uuid, ${ids.group}::uuid, ${ids.admin}::uuid, 'admin', 'private', 'direct'),
      (${ids.memberMembership}::uuid, ${ids.group}::uuid, ${ids.member}::uuid, 'active', 'private', 'direct')
  `;
});

afterAll(async () => {
  await cleanup();
  await sql.end({ timeout: 5 });
});

describe('membership and event database invariants', () => {
  it('keeps role rights actor-specific while direct authenticated RLS reads stay closed', async () => {
    await sql`
      insert into public.role (
        id, name, scope, group_id, assignment_mode, visibility, assignee_kind
      ) values (
        ${ids.managerRole}::uuid, 'Manager', 'group', ${ids.group}::uuid,
        'assigned', 'private', 'member'
      )
    `;
    await sql`
      insert into public.action_right (id, resource, action, role_id, group_id)
      values (${ids.managerRight}::uuid, 'groups', 'manage', ${ids.managerRole}::uuid, ${ids.group}::uuid)
    `;
    await sql`
      insert into public.group_membership_role (
        id, group_membership_id, role_id, assigned_by_id
      ) values (
        ${ids.managerAssignment}::uuid, ${ids.adminMembership}::uuid,
        ${ids.managerRole}::uuid, ${ids.admin}::uuid
      )
    `;

    const effective = await sql<{ user_id: string; action: string }[]>`
      select gm.user_id::text, ar.action
      from public.group_membership gm
      join public.group_membership_role gmr on gmr.group_membership_id = gm.id
      join public.action_right ar on ar.role_id = gmr.role_id
      where gm.group_id = ${ids.group}::uuid
      order by gm.user_id
    `;
    expect(effective).toEqual([{ user_id: ids.admin, action: 'manage' }]);
    await expect(readRolesAs(ids.admin)).rejects.toMatchObject({ code: '42501' });
    await expect(readRolesAs(ids.member)).rejects.toMatchObject({ code: '42501' });
  });

  it('persists a recurring event and both participant relations atomically', async () => {
    await sql.begin(async transaction => {
      await transaction`
        insert into public.event (
          id, title, status, event_type, attendance_mode, visibility,
          start_date, end_date, timezone, is_recurring, recurrence_pattern,
          recurrence_rule, recurrence_interval, recurrence_days,
          recurrence_end_date, group_id, creator_id
        ) values (
          ${ids.event}::uuid, 'Recurring assembly', 'planned', 'general_assembly',
          'hybrid', 'private', '2026-09-15T16:00:00Z', '2026-09-15T18:00:00Z',
          'Europe/Berlin', true, 'weekly', 'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH',
          1, array[1,3], '2026-12-31T23:59:59Z', ${ids.group}::uuid, ${ids.admin}::uuid
        )
      `;
      await transaction`
        insert into public.event_participant (
          id, event_id, user_id, group_id, status, visibility
        ) values
          (${ids.adminParticipant}::uuid, ${ids.event}::uuid, ${ids.admin}::uuid, ${ids.group}::uuid, 'confirmed', 'private'),
          (${ids.memberParticipant}::uuid, ${ids.event}::uuid, ${ids.member}::uuid, ${ids.group}::uuid, 'invited', 'private')
      `;
    });

    const rows = await sql<
      {
        recurrence_pattern: string;
        recurrence_days: number[];
        participant_count: number;
        statuses: string[];
      }[]
    >`
      select
        e.recurrence_pattern,
        e.recurrence_days,
        count(ep.id)::int as participant_count,
        array_agg(ep.status order by ep.status) as statuses
      from public.event e
      join public.event_participant ep on ep.event_id = e.id
      where e.id = ${ids.event}::uuid
      group by e.id
    `;
    expect(rows[0]).toEqual({
      recurrence_pattern: 'weekly',
      recurrence_days: [1, 3],
      participant_count: 2,
      statuses: ['confirmed', 'invited'],
    });
  });
});
