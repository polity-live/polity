import { db, type E2EDatabase } from './db';
import { ensureUserDefaults } from './auth';
import { deterministicE2EUuid } from './run';

export interface SeedData {
  userId: string;
  extraUserId: string;
  groupId: string;
  groupName: string;
  linkedGroupId: string;
  linkedGroupName: string;
  hierarchicalGroupId: string;
  hierarchicalGroupName: string;
  roleId: string;
  roleName: string;
  eventRoleId: string;
  eventRoleName: string;
  eventParticipantId: string;
  eventId: string;
  eventTitle: string;
  amendmentId: string;
  amendmentTitle: string;
  agendaItemId: string;
  agendaItemTitle: string;
  electionId: string;
  electionTitle: string;
}

function fixtureId(scope: string) {
  return deterministicE2EUuid(`fixture:${scope}`);
}

function handleFromPrefix(prefix: string, suffix: string) {
  return `${prefix}-${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 58);
}

export async function seedCreatePrerequisites(prefix: string, userId: string): Promise<SeedData> {
  const sql = db();

  const seed: SeedData = {
    userId,
    extraUserId: fixtureId(`${prefix}:extra-user`),
    groupId: fixtureId(`${prefix}:group`),
    groupName: `${prefix} Base Group`,
    linkedGroupId: fixtureId(`${prefix}:linked-group`),
    linkedGroupName: `${prefix} Linked Group`,
    hierarchicalGroupId: fixtureId(`${prefix}:hierarchical-group`),
    hierarchicalGroupName: `${prefix} Hierarchical Group`,
    roleId: fixtureId(`${prefix}:candidate-role`),
    roleName: `${prefix} Candidate Role`,
    eventRoleId: fixtureId(`${prefix}:event-role`),
    eventRoleName: `${prefix} Event Organizer`,
    eventParticipantId: fixtureId(`${prefix}:event-participant`),
    eventId: fixtureId(`${prefix}:event`),
    eventTitle: `${prefix} Assembly Event`,
    amendmentId: fixtureId(`${prefix}:amendment`),
    amendmentTitle: `${prefix} Seed Amendment`,
    agendaItemId: fixtureId(`${prefix}:agenda-item`),
    agendaItemTitle: `${prefix} Seed Election Agenda`,
    electionId: fixtureId(`${prefix}:election`),
    electionTitle: `${prefix} Seed Election`,
  };

  await insertExtraUser(sql, prefix, seed.extraUserId);
  await ensureUserDefaults(sql, seed.extraUserId);
  await insertVotingPassword(sql, userId);
  await insertGroups(sql, prefix, seed);
  await insertMembership(sql, seed.groupId, userId);
  await insertMembership(sql, seed.groupId, seed.extraUserId);
  await insertMembership(sql, seed.linkedGroupId, userId);
  await insertMembership(sql, seed.hierarchicalGroupId, userId);
  await insertRole(sql, seed.roleId, seed.roleName, seed.groupId);
  await insertEvent(sql, seed.eventId, seed.eventTitle, seed.groupId, userId);
  await insertEventParticipant(sql, seed.eventParticipantId, seed.eventId, userId, seed.groupId);
  await insertEventOrganizerRole(sql, seed.eventRoleId, seed.eventRoleName, seed.eventId);
  await insertEventActionRights(sql, seed.eventRoleId, seed.eventId);
  await insertEventParticipantRole(sql, seed.eventParticipantId, seed.eventRoleId, userId);
  await insertAmendment(
    sql,
    seed.amendmentId,
    seed.amendmentTitle,
    seed.groupId,
    seed.eventId,
    userId
  );
  await insertAmendmentCollaborator(sql, seed.amendmentId, userId);
  await insertAgendaItem(sql, seed.agendaItemId, seed.agendaItemTitle, seed.eventId, userId);
  await insertElection(sql, seed.electionId, seed.electionTitle, seed.agendaItemId, seed.roleId);

  return seed;
}

async function insertExtraUser(sql: E2EDatabase, prefix: string, userId: string) {
  const handle = handleFromPrefix(prefix, 'other-user');
  const email = `${handle}@e2e.local`;

  await sql`
    insert into public."user" (
      id,
      email,
      handle,
      first_name,
      last_name,
      bio,
      visibility,
      created_at,
      updated_at
    )
    values (
      ${userId}::uuid,
      ${email},
      ${handle},
      ${prefix},
      'Fixture User',
      ${prefix},
      'public',
      now(),
      now()
    )
    on conflict (id) do update
    set email = excluded.email,
        handle = excluded.handle,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        bio = excluded.bio,
        visibility = excluded.visibility,
        updated_at = excluded.updated_at;
  `;
}

async function insertVotingPassword(sql: E2EDatabase, userId: string) {
  await sql`
    insert into public.voting_password (
      id,
      user_id,
      password_hash,
      last_verified_at,
      created_at,
      updated_at
    )
    values (
      ${fixtureId(`voting-password:${userId}`)}::uuid,
      ${userId}::uuid,
      'e2e-voting-pin-hash',
      now(),
      now(),
      now()
    )
    on conflict (user_id) do update
    set password_hash = excluded.password_hash,
        last_verified_at = excluded.last_verified_at,
        updated_at = excluded.updated_at;
  `;
}

async function insertGroups(sql: E2EDatabase, prefix: string, seed: SeedData) {
  await sql`
    insert into public."group" (
      id,
      name,
      description,
      email,
      group_type,
      has_hierarchy_children,
      visibility,
      owner_id,
      created_at,
      updated_at
    )
    values
      (
        ${seed.groupId}::uuid,
        ${seed.groupName},
        jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'p', 'children', jsonb_build_array(jsonb_build_object('text', ${prefix}::text))))),
        ${`${prefix}-base@example.test`},
        'base',
        false,
        'public',
        ${seed.userId}::uuid,
        now(),
        now()
      ),
      (
        ${seed.linkedGroupId}::uuid,
        ${seed.linkedGroupName},
        jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'p', 'children', jsonb_build_array(jsonb_build_object('text', ${prefix}::text))))),
        ${`${prefix}-linked@example.test`},
        'base',
        false,
        'public',
        ${seed.userId}::uuid,
        now(),
        now()
      ),
      (
        ${seed.hierarchicalGroupId}::uuid,
        ${seed.hierarchicalGroupName},
        jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'p', 'children', jsonb_build_array(jsonb_build_object('text', ${prefix}::text))))),
        ${`${prefix}-hierarchy@example.test`},
        'hierarchical',
        true,
        'public',
        ${seed.userId}::uuid,
        now(),
        now()
      )
    on conflict (id) do update
    set name = excluded.name,
        description = excluded.description,
        email = excluded.email,
        group_type = excluded.group_type,
        has_hierarchy_children = excluded.has_hierarchy_children,
        visibility = excluded.visibility,
        owner_id = excluded.owner_id,
        updated_at = excluded.updated_at;
  `;
}

async function insertMembership(sql: E2EDatabase, groupId: string, userId: string) {
  const membershipId = fixtureId(`group-membership:${groupId}:${userId}`);

  await sql`
    insert into public.group_membership (
      id,
      group_id,
      user_id,
      status,
      visibility,
      source,
      origin_kind,
      is_auto_managed,
      created_at
    )
    values (
      ${membershipId}::uuid,
      ${groupId}::uuid,
      ${userId}::uuid,
      'admin',
      'public',
      'direct',
      'direct',
      false,
      now()
    )
    on conflict (user_id, group_id) do update
    set status = excluded.status,
        visibility = excluded.visibility,
        source = excluded.source,
        origin_kind = excluded.origin_kind,
        is_auto_managed = excluded.is_auto_managed;
  `;
}

async function insertRole(sql: E2EDatabase, roleId: string, roleName: string, groupId: string) {
  await sql`
    insert into public.role (
      id,
      name,
      description,
      scope,
      group_id,
      assignment_mode,
      visibility,
      is_recurring,
      default_request_role,
      default_invite_role,
      assignee_kind,
      sort_order,
      created_at
    )
    values (
      ${roleId}::uuid,
      ${roleName},
      ${roleName},
      'group',
      ${groupId}::uuid,
      'elected',
      'public',
      false,
      false,
      false,
      'member',
      0,
      now()
    )
    on conflict (id) do update
    set name = excluded.name,
        description = excluded.description,
        scope = excluded.scope,
        group_id = excluded.group_id,
        assignment_mode = excluded.assignment_mode,
        visibility = excluded.visibility,
        assignee_kind = excluded.assignee_kind;
  `;
}

async function insertEvent(
  sql: E2EDatabase,
  eventId: string,
  title: string,
  groupId: string,
  creatorId: string
) {
  await sql`
    insert into public.event (
      id,
      title,
      description,
      status,
      event_type,
      attendance_mode,
      visibility,
      start_date,
      end_date,
      timezone,
      agenda_management,
      group_id,
      creator_id,
      created_at,
      updated_at
    )
    values (
      ${eventId}::uuid,
      ${title},
      jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'p', 'children', jsonb_build_array(jsonb_build_object('text', ${title}::text))))),
      'planned',
      'general_assembly',
      'offline',
      'public',
      now() + interval '30 days',
      now() + interval '30 days 2 hours',
      'Europe/Berlin',
      'manual',
      ${groupId}::uuid,
      ${creatorId}::uuid,
      now(),
      now()
    )
    on conflict (id) do update
    set title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        event_type = excluded.event_type,
        attendance_mode = excluded.attendance_mode,
        visibility = excluded.visibility,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        timezone = excluded.timezone,
        agenda_management = excluded.agenda_management,
        group_id = excluded.group_id,
        creator_id = excluded.creator_id,
        updated_at = excluded.updated_at;
  `;
}

async function insertEventParticipant(
  sql: E2EDatabase,
  participantId: string,
  eventId: string,
  userId: string,
  groupId: string
) {
  await sql`
    insert into public.event_participant (
      id,
      event_id,
      user_id,
      group_id,
      status,
      visibility,
      created_at
    )
    values (
      ${participantId}::uuid,
      ${eventId}::uuid,
      ${userId}::uuid,
      ${groupId}::uuid,
      'confirmed',
      'public',
      now()
    )
    on conflict do nothing;
  `;
}

async function insertEventOrganizerRole(
  sql: E2EDatabase,
  roleId: string,
  roleName: string,
  eventId: string
) {
  await sql`
    insert into public.role (
      id,
      name,
      description,
      scope,
      event_id,
      assignment_mode,
      visibility,
      is_recurring,
      default_request_role,
      default_invite_role,
      assignee_kind,
      sort_order,
      created_at
    )
    values (
      ${roleId}::uuid,
      ${roleName},
      ${roleName},
      'event',
      ${eventId}::uuid,
      'assigned',
      'public',
      false,
      false,
      false,
      'member',
      0,
      now()
    )
    on conflict (id) do update
    set name = excluded.name,
        description = excluded.description,
        scope = excluded.scope,
        event_id = excluded.event_id,
        assignment_mode = excluded.assignment_mode,
        visibility = excluded.visibility,
        assignee_kind = excluded.assignee_kind;
  `;
}

async function insertEventActionRights(sql: E2EDatabase, roleId: string, eventId: string) {
  const rights = [
    { resource: 'events', action: 'manage' },
    { resource: 'events', action: 'manage_votes' },
    { resource: 'events', action: 'manage_participants' },
    { resource: 'events', action: 'active_voting' },
    { resource: 'events', action: 'passive_voting' },
    { resource: 'agendaItems', action: 'create' },
    { resource: 'agendaItems', action: 'manage' },
    { resource: 'elections', action: 'manage' },
  ];

  for (const right of rights) {
    await sql`
      insert into public.action_right (
        id,
        resource,
        action,
        role_id,
        event_id,
        created_at
      )
      values (
        ${fixtureId(`action-right:${roleId}:${right.resource}:${right.action}`)}::uuid,
        ${right.resource},
        ${right.action},
        ${roleId}::uuid,
        ${eventId}::uuid,
        now()
      )
      on conflict (id) do update
      set resource = excluded.resource,
          action = excluded.action,
          role_id = excluded.role_id,
          event_id = excluded.event_id;
    `;
  }
}

async function insertEventParticipantRole(
  sql: E2EDatabase,
  participantId: string,
  roleId: string,
  userId: string
) {
  await sql`
    insert into public.event_participant_role (
      id,
      event_participant_id,
      role_id,
      assigned_at,
      assigned_by_id,
      created_at
    )
    values (
      ${fixtureId(`event-participant-role:${participantId}:${roleId}`)}::uuid,
      ${participantId}::uuid,
      ${roleId}::uuid,
      now(),
      ${userId}::uuid,
      now()
    )
    on conflict (event_participant_id, role_id) do update
    set assigned_at = excluded.assigned_at,
        assigned_by_id = excluded.assigned_by_id;
  `;
}

async function insertAmendment(
  sql: E2EDatabase,
  amendmentId: string,
  title: string,
  groupId: string,
  eventId: string,
  userId: string
) {
  await sql`
    insert into public.amendment (
      id,
      code,
      title,
      reason,
      created_by_id,
      group_id,
      event_id,
      visibility,
      created_at,
      updated_at
    )
    values (
      ${amendmentId}::uuid,
      ${title},
      ${title},
      ${title},
      ${userId}::uuid,
      ${groupId}::uuid,
      ${eventId}::uuid,
      'public',
      now(),
      now()
    )
    on conflict (id) do update
    set code = excluded.code,
        title = excluded.title,
        reason = excluded.reason,
        created_by_id = excluded.created_by_id,
        group_id = excluded.group_id,
        event_id = excluded.event_id,
        visibility = excluded.visibility,
        updated_at = excluded.updated_at;
  `;
}

async function insertAmendmentCollaborator(sql: E2EDatabase, amendmentId: string, userId: string) {
  await sql`
    insert into public.amendment_collaborator (
      id, amendment_id, user_id, status, visibility, created_at
    ) values (
      ${fixtureId(`amendment-collaborator:${amendmentId}:${userId}`)}::uuid,
      ${amendmentId}::uuid,
      ${userId}::uuid,
      'admin',
      'authenticated',
      now()
    )
    on conflict (id) do update
    set status = excluded.status,
        visibility = excluded.visibility;
  `;
}

async function insertAgendaItem(
  sql: E2EDatabase,
  agendaItemId: string,
  title: string,
  eventId: string,
  userId: string
) {
  await sql`
    insert into public.agenda_item (
      id,
      event_id,
      creator_id,
      title,
      description,
      type,
      status,
      order_index,
      majority_type,
      created_at,
      updated_at
    )
    values (
      ${agendaItemId}::uuid,
      ${eventId}::uuid,
      ${userId}::uuid,
      ${title},
      ${title},
      'election',
      'planned',
      1,
      'simple',
      now(),
      now()
    )
    on conflict (id) do update
    set event_id = excluded.event_id,
        creator_id = excluded.creator_id,
        title = excluded.title,
        description = excluded.description,
        type = excluded.type,
        status = excluded.status,
        order_index = excluded.order_index,
        majority_type = excluded.majority_type,
        updated_at = excluded.updated_at;
  `;
}

async function insertElection(
  sql: E2EDatabase,
  electionId: string,
  title: string,
  agendaItemId: string,
  roleId: string
) {
  await sql`
    insert into public.election (
      id,
      agenda_item_id,
      role_id,
      title,
      description,
      status,
      majority_type,
      visibility,
      ballot_visibility,
      election_mode,
      seat_count,
      max_votes,
      created_at,
      updated_at
    )
    values (
      ${electionId}::uuid,
      ${agendaItemId}::uuid,
      ${roleId}::uuid,
      ${title},
      ${title},
      'open',
      'simple',
      'public',
      'secret',
      'single',
      1,
      1,
      now(),
      now()
    )
    on conflict (id) do update
    set agenda_item_id = excluded.agenda_item_id,
        role_id = excluded.role_id,
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        majority_type = excluded.majority_type,
        visibility = excluded.visibility,
        ballot_visibility = excluded.ballot_visibility,
        election_mode = excluded.election_mode,
        seat_count = excluded.seat_count,
        max_votes = excluded.max_votes,
        updated_at = excluded.updated_at;
  `;
}
