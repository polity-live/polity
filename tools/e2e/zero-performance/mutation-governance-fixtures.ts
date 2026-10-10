import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import type { MutationCaseContext } from './mutation-case-types';
import assert from 'node:assert/strict';

/** Notifications have polymorphic scope IDs instead of foreign keys. Remove only this fresh scope. */
export async function cleanupGovernanceNotifications(ctx: MutationCaseContext, ids: string[]) {
  const { sql } = ctx;
  for (const id of ids)
    await sql`delete from notification where
    related_group_id = ${id} or related_event_id = ${id} or related_amendment_id = ${id}
    or on_behalf_of_entity_id = ${id} or recipient_entity_id = ${id}`;
}
export async function verifyGovernanceNotificationsRestored(
  ctx: MutationCaseContext,
  ids: string[]
) {
  const { sql } = ctx;
  for (const id of ids)
    assert.equal(
      (
        await sql`select id from notification where
    related_group_id = ${id} or related_event_id = ${id} or related_amendment_id = ${id}
    or on_behalf_of_entity_id = ${id} or recipient_entity_id = ${id}`
      ).length,
      0
    );
}

/** SQL-only isolated permission scopes. Ownership is a real group authorization path. */
export async function groupAdminFixture(
  f: MutationFixtures,
  ctx: MutationCaseContext,
  label = 'group'
) {
  const id = mutationFixtureID(ctx.id, label);
  await f.insert('group', {
    id,
    name: 'Mutation governance fixture',
    owner_id: ctx.ownerID,
    visibility: 'public',
    group_type: 'base',
  });
  return id;
}

/** Event rights require an active participant, a scoped role and scoped action rights. */
export async function eventAdminFixture(
  f: MutationFixtures,
  ctx: MutationCaseContext,
  label = 'event'
) {
  const id = mutationFixtureID(ctx.id, label);
  const participantID = mutationFixtureID(ctx.id, `${label}:participant`);
  const roleID = mutationFixtureID(ctx.id, `${label}:role`);
  await f.insert('event', {
    id,
    title: 'Mutation governance fixture',
    creator_id: ctx.ownerID,
    visibility: 'public',
    status: 'planned',
    event_type: 'meeting',
    attendance_mode: 'online',
  });
  await f.insert('role', { id: roleID, scope: 'event', event_id: id, name: 'Governance manager' });
  await f.insert('event_participant', {
    id: participantID,
    event_id: id,
    user_id: ctx.ownerID,
    status: 'active',
  });
  await f.insert('event_participant_role', {
    id: mutationFixtureID(ctx.id, `${label}:role-link`),
    event_participant_id: participantID,
    role_id: roleID,
    assigned_by_id: ctx.ownerID,
  });
  for (const resource of ['events', 'elections', 'votes', 'agendaItems', 'accreditations']) {
    await f.insert('action_right', {
      id: mutationFixtureID(ctx.id, `${label}:right:${resource}`),
      role_id: roleID,
      event_id: id,
      resource,
      action: 'manage',
    });
  }
  for (const action of [
    'manage_participants',
    'manage_roles',
    'manage_speakers',
    'manage_votes',
    'active_voting',
    'passive_voting',
    'speak',
  ]) {
    await f.insert('action_right', {
      id: mutationFixtureID(ctx.id, `${label}:event-right:${action}`),
      role_id: roleID,
      event_id: id,
      resource: 'events',
      action,
    });
  }
  return { id, participantID, roleID };
}
