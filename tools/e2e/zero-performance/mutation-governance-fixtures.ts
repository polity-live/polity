import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import type { MutationCaseContext } from './mutation-case-types';
import assert from 'node:assert/strict';

export type DelegatedGovernanceContext = MutationCaseContext & { delegatedWriterID?: string };
export async function delegatedGovernanceFixture(
  f: MutationFixtures,
  ctx: DelegatedGovernanceContext,
  scope: { id: string; kind: 'group' | 'event' }
) {
  if (!ctx.delegatedWriterID) return;
  const roleID = mutationFixtureID(ctx.id, `delegate:${scope.id}:role`);
  const memberID = mutationFixtureID(ctx.id, `delegate:${scope.id}:member`);
  const isGroup = scope.kind === 'group';
  const scopeField = isGroup ? 'group_id' : 'event_id';
  await f.insert('role', {
    id: roleID,
    scope: scope.kind,
    [scopeField]: scope.id,
    name: 'Delegated benchmark manager',
    assignee_kind: 'member',
  });
  await f.insert(isGroup ? 'group_membership' : 'event_participant', {
    id: memberID,
    [scopeField]: scope.id,
    user_id: ctx.delegatedWriterID,
    status: 'active',
    ...(isGroup ? { source: 'direct', visibility: 'public' } : {}),
  });
  await f.insert(isGroup ? 'group_membership_role' : 'event_participant_role', {
    id: mutationFixtureID(ctx.id, `delegate:${scope.id}:link`),
    role_id: roleID,
    [isGroup ? 'group_membership_id' : 'event_participant_id']: memberID,
    assigned_by_id: ctx.ownerID,
  });
  for (const resource of [
    'groups',
    'groupRoles',
    'groupMemberships',
    'groupAccessRoles',
    'groupRelationships',
    'events',
    'agendaItems',
    'elections',
    'electionCandidates',
    'votes',
    'accreditations',
  ]) {
    for (const action of ['view', 'manage'])
      await f.insert('action_right', {
        id: mutationFixtureID(ctx.id, `delegate:${scope.id}:${resource}:${action}`),
        role_id: roleID,
        [scopeField]: scope.id,
        resource,
        action,
      });
  }
  if (!isGroup)
    for (const action of [
      'manage_participants',
      'manage_roles',
      'manage_speakers',
      'manage_votes',
      'active_voting',
      'passive_voting',
      'speak',
    ])
      await f.insert('action_right', {
        id: mutationFixtureID(ctx.id, `delegate:${scope.id}:events:${action}`),
        role_id: roleID,
        [scopeField]: scope.id,
        resource: 'events',
        action,
      });
}

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
      0,
      'Restoration proof: notification'
    );
}

/** SQL-only isolated permission scopes. Ownership is a real group authorization path. */
export async function groupAdminFixture(
  f: MutationFixtures,
  ctx: DelegatedGovernanceContext,
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
  await delegatedGovernanceFixture(f, ctx, { id, kind: 'group' });
  return id;
}

/** Event rights require an active participant, a scoped role and scoped action rights. */
export async function eventAdminFixture(
  f: MutationFixtures,
  ctx: DelegatedGovernanceContext,
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
  await delegatedGovernanceFixture(f, ctx, { id, kind: 'event' });
  return { id, participantID, roleID };
}
