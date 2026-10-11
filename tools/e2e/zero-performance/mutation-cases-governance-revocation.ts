import assert from 'node:assert/strict';
import type { MutationCase, MutationCaseContext } from './mutation-case-types';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import type { DelegatedGovernanceContext } from './mutation-governance-fixtures';
import { schema } from '../../../src/zero/schema';
import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { can } from '../../../src/zero/rbac/can';
import { replicatedTimestampValues } from './mutation-timestamp';
import { queries } from '../../../src/zero/queries';
import {
  groupAdminFixture,
  cleanupGovernanceNotifications,
  verifyGovernanceNotificationsRestored,
} from './mutation-governance-fixtures';

/** The group_id branch checks scoped events/create, including delegated rights revoked after preload. */
export function groupedEventCreationCases(): MutationCase[] {
  return ['create', 'createFull'].flatMap(command =>
    (
      [
        'owned-success',
        'delegated-success',
        'outsider-denied',
        'anonymous-denied',
        'delegated-revoked-after-preload',
      ] as const
    ).map(variant => {
      const success = variant.endsWith('success');
      const delegated = variant.startsWith('delegated');
      const revoked = variant === 'delegated-revoked-after-preload';
      const actor =
        variant === 'owned-success'
          ? 'owner'
          : variant === 'anonymous-denied'
            ? 'anonymous'
            : 'outsider';
      return {
        name: `events.${command}`,
        variant: `grouped-${variant}`,
        actor,
        outcome: success ? 'success' : 'server-error',
        ...(success ? {} : { error: 'permission_denied' }),
        observer: { query: 'events.byId' },
        specification: {
          branch: 'Non-null group_id requires create/events permission on the actual parent group',
          authority: variant,
          oracle:
            'SQL event parent and caller creator, active creator participation, scoped bootstrap rights and created activity; denied event and side effects absent',
          restoration:
            'Fresh parent group and child event, scoped generated records and polymorphic notifications restored independently',
        },
        prepare: async ctx => {
          const f = new MutationFixtures(ctx.sql);
          await f.track('user', ctx.ownerID);
          await f.track('user', ctx.outsiderID);
          const groupID = await groupAdminFixture(f, {
            ...ctx,
            ...(delegated ? { delegatedWriterID: ctx.outsiderID } : {}),
          });
          const id = mutationFixtureID(ctx.id, 'created-group-event');
          await f.track('event', id);
          for (const table of ['role', 'event_participant', 'action_right', 'event_activity'])
            await f.trackScope(table, 'event_id', id);
          const event = {
            id,
            group_id: groupID,
            title: 'Reviewed grouped event',
            event_type: 'meeting',
            attendance_mode: 'online',
            status: 'planned',
            visibility: 'public',
            start_date: 1_900_000_000_000,
            end_date: 1_900_000_600_000,
          };
          const roleID = mutationFixtureID(ctx.id, `delegate:${groupID}:role`);
          await f.sealScopes();
          return {
            args: command === 'createFull' ? { event } : event,
            requireWriterBefore: revoked,
            observe: {
              request: queries.events.byId({ id }),
              before: data => !data,
              after: data =>
                success
                  ? !!data && typeof data === 'object' && 'id' in data && data.id === id
                  : !data,
            },
            ...(revoked
              ? {
                  beforeInvoke: async () => {
                    const provider = zeroPostgresJS<typeof schema, Record<string, unknown>>(
                      schema,
                      ctx.sql as unknown as Exclude<Parameters<typeof zeroPostgresJS>[1], string>
                    );
                    await provider.transaction(async tx => {
                      await can(
                        tx,
                        { userID: ctx.outsiderID },
                        { action: 'create', resource: 'events', groupId: groupID }
                      );
                    });
                    await ctx.sql`delete from action_right where role_id = ${roleID} and resource = 'events' and action <> 'view'`;
                  },
                }
              : {}),
            verify: async () => {
              if (!success) {
                await f.expect('event', id, null);
                await f.verifyScopesUnchanged();
                return;
              }
              const creatorID = actor === 'owner' ? ctx.ownerID : ctx.outsiderID;
              await f.expect('event', id, {
                group_id: groupID,
                creator_id: creatorID,
                title: event.title,
                participant_count: 1,
              });
              assert.equal(
                (
                  await ctx.sql`select id from event_participant where event_id = ${id} and user_id = ${creatorID} and status = 'active'`
                ).length,
                1
              );
              assert.ok(
                (await ctx.sql`select id from role where event_id = ${id} and scope = 'event'`)
                  .length > 0
              );
              assert.ok(
                (await ctx.sql`select id from action_right where event_id = ${id}`).length > 0
              );
              assert.equal(
                (
                  await ctx.sql`select id from event_activity where event_id = ${id} and action = 'created'`
                ).length,
                1
              );
            },
            restore: async () => {
              await cleanupGovernanceNotifications(ctx, [id, groupID]);
              await f.restore();
            },
            verifyRestored: async () => {
              await f.verifyRestored();
              await verifyGovernanceNotificationsRestored(ctx, [id, groupID]);
            },
          };
        },
      } satisfies MutationCase;
    })
  );
}

const personalOrPublic = new Set([
  'groups.joinGroup',
  'groups.requestGuestAccess',
  'groups.acceptInvitation',
  'events.joinEvent',
  'events.bookMeeting',
  'events.cancelMeetingBooking',
  'votes.castIndicativeVote',
  'votes.createIndicativeChoiceDecision',
  'votes.replaceIndicativeVote',
  'votes.castFinalVote',
  'votes.createFinalChoiceDecision',
  'votes.castFinalVoteFull',
  'elections.castIndicativeElectionVote',
  'elections.createIndicativeCandidateSelection',
  'elections.replaceIndicativeElectionVote',
  'elections.castFinalElectionVote',
  'elections.createFinalCandidateSelection',
  'elections.castFinalElectionVoteFull',
]);
const groupLabels = ['group', 'workflow-target', 'connection-parent', 'connection-child'];
const secretManagerCommands = new Set([
  'votes.createIndicativeChoiceDecision',
  'votes.createFinalChoiceDecision',
  'elections.createIndicativeCandidateSelection',
  'elections.createFinalCandidateSelection',
]);
const protectedLookupCommands = new Set([
  'groups.acceptGuestInvitation',
  'groups.acceptInvitation',
  'groups.syncMembershipRoles',
  'groups.addOfflineMembershipRole',
  'groups.addGuestRole',
  'groups.removeGuestRole',
  'groups.syncGuestRoles',
  'groups.inviteGuest',
  'groups.updateMembership',
  'groups.syncOfflineMembershipRoles',
  'groups.updateOfflineMember',
  'groups.deleteOfflineMember',
  'groups.addMembershipRole',
  'groups.removeMembershipRole',
  'groups.revokeGuestAccess',
  'network.saveWorkflowDefinition',
  'groups.removeOfflineMembershipRole',
  'events.updateOfflineParticipant',
  'events.deleteOfflineParticipant',
]);

/** Reuses reviewed SQL-only fixtures/oracles, never subject implementations or their outputs. */
export async function verifyRevokedGovernanceWriter(ctx: MutationCaseContext, writer: unknown) {
  const local = writer as { inspector: { client: { map(): Promise<Map<string, unknown>> } } };
  assert.equal(typeof local?.inspector?.client?.map, 'function', 'Missing public writer inspector');
  for (const [key, value] of await local.inspector.client.map()) {
    if (!key.startsWith('e/')) continue;
    assert.ok(value && typeof value === 'object', 'Invalid cached application row');
    const tableName = key.split('/')[1];
    const definition = (
      schema.tables as Record<
        string,
        {
          serverName?: string;
          columns: Record<string, { serverName?: string }>;
        }
      >
    )[tableName];
    assert.ok(definition, 'Unknown cached application table');
    const row = value as Record<string, unknown>;
    assert.equal(typeof row.id, 'string', 'Cached application row has no identity');
    const table = definition.serverName ?? tableName;
    const records = await ctx.sql`select * from ${ctx.sql(table)} where id = ${String(row.id)}`;
    assert.equal(records.length, 1, `Rollback row proof: ${tableName}`);
    for (const [field, column] of Object.entries(definition.columns)) {
      if (!(field in row)) continue;
      const columnName = column.serverName ?? field;
      const expected = records[0][columnName];
      if (expected instanceof Date) {
        const values = await replicatedTimestampValues(ctx.sql, table, columnName, String(row.id));
        assert.ok(
          typeof row[field] === 'number' && values.includes(row[field]),
          `Rollback field proof: ${tableName}.${field}`
        );
        continue;
      }
      assert.deepEqual(row[field], expected, `Rollback field proof: ${tableName}.${field}`);
    }
  }
}

export function governanceRevocationCases(base: MutationCase[]): MutationCase[] {
  const reviewed = new Map<string, MutationCase>();
  for (const entry of base) {
    if (
      (personalOrPublic.has(entry.name) && !secretManagerCommands.has(entry.name)) ||
      entry.actor !== 'outsider' ||
      (entry.error !== 'permission_denied' &&
        !secretManagerCommands.has(entry.name) &&
        !protectedLookupCommands.has(entry.name) &&
        !['votes.submitVote', 'elections.submitElectionVote'].includes(entry.name))
    )
      continue;
    if (!reviewed.has(entry.name)) reviewed.set(entry.name, entry);
  }
  return [...reviewed.values()].map(entry => {
    const accreditation = entry.name.startsWith('accreditation.');
    const eligibility =
      entry.name === 'votes.submitVote' || entry.name === 'elections.submitElectionVote';
    const secretManager = secretManagerCommands.has(entry.name);
    return {
      ...entry,
      outcome: 'server-error',
      error: eligibility ? 'mutation_server_failed' : 'permission_denied',
      actor: accreditation ? 'owner' : 'outsider',
      variant: secretManager
        ? 'secret-manager-authority-revoked-after-preload'
        : 'delegated-authority-revoked-after-preload',
      specification: {
        base: entry.specification,
        authority: accreditation
          ? 'Existing active scoped event manager; revoke manage_participants right after own accreditation query preload'
          : 'Initially active delegated member/participant with explicit scoped rights; separate view rights remain readable',
        revocation: eligibility
          ? 'Active event participant becomes invited after writer preload, before submit'
          : 'Delete delegated write rights after writer preload',
        branch: secretManager
          ? 'Secret ballot with null participation foreign key: writer has no own prior participation, so initial delegated manager fallback is required'
          : 'Managed scoped command; personal ownership and public polling branches excluded',
        oracle:
          'Existing hand-authored denial SQL oracle plus independent revoked-authority predicate; exact subject baseline and complete cleanup',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const participantCommand =
          /^events\.(inviteParticipant|leaveEvent|updateParticipant|addParticipantRole|removeParticipantRole|syncParticipantRoles)$/.test(
            entry.name
          );
        const delegatedContext: DelegatedGovernanceContext & {
          governanceSecretDecision?: boolean;
        } = {
          ...ctx,
          ...(accreditation ? {} : { delegatedWriterID: ctx.outsiderID }),
          ...(secretManager ? { governanceSecretDecision: true } : {}),
          // These commands target the other actor's relation, avoiding personal/self bypasses.
          ...(participantCommand ? { outsiderID: ctx.ownerID } : {}),
        };
        const prepared = await entry.prepare(delegatedContext);
        const f = new MutationFixtures(ctx.sql);
        const writerID = accreditation ? ctx.ownerID : ctx.outsiderID;
        const delegateRoles: string[] = [];
        const groupScopes: string[] = [];
        const eventID = mutationFixtureID(ctx.id, 'event');
        const delegatedParticipant = mutationFixtureID(ctx.id, `delegate:${eventID}:member`);
        if (!accreditation) {
          for (const label of groupLabels) {
            const groupID = mutationFixtureID(ctx.id, label);
            if (!(await f.rows('group', groupID)).length) continue;
            const roleID = mutationFixtureID(ctx.id, `delegate:${groupID}:role`);
            await f.expect(
              'group_membership',
              mutationFixtureID(ctx.id, `delegate:${groupID}:member`),
              { group_id: groupID, user_id: writerID, status: 'active' }
            );
            delegateRoles.push(roleID);
            groupScopes.push(groupID);
          }
          if ((await f.rows('event', eventID)).length) {
            await f.expect('event_participant', delegatedParticipant, {
              event_id: eventID,
              user_id: writerID,
              status: 'active',
            });
            delegateRoles.push(mutationFixtureID(ctx.id, `delegate:${eventID}:role`));
          }
          assert.ok(
            delegateRoles.length,
            'Reviewed delegated mutation has no isolated authority scope'
          );
          for (const roleID of delegateRoles)
            assert.ok(
              (
                await ctx.sql`select id from action_right where role_id = ${roleID} and action = 'manage'`
              ).length,
              'Missing initially delegated write rights'
            );
        }
        const revokedRole = mutationFixtureID(ctx.id, 'event:role');
        return {
          ...prepared,
          requireWriterBefore: true,
          beforeInvoke: async () => {
            // This is a read-only permission audit on the isolated fixture SQL connection.
            // No subject mutator or application write runs to establish initial authority.
            // postgres is installed both at the harness and SDK package boundaries.
            const provider = zeroPostgresJS<typeof schema, Record<string, unknown>>(
              schema,
              ctx.sql as unknown as Exclude<Parameters<typeof zeroPostgresJS>[1], string>
            );
            await provider.transaction(async tx => {
              for (const groupID of groupScopes)
                for (const resource of [
                  'groups',
                  'groupMemberships',
                  'groupAccessRoles',
                  'groupRelationships',
                ] as const)
                  await can(
                    tx,
                    { userID: writerID },
                    { action: 'manage', resource, groupId: groupID }
                  );
              if (accreditation || (await f.rows('event', eventID)).length) {
                for (const resource of ['events', 'elections', 'agendaItems'] as const)
                  await can(
                    tx,
                    { userID: writerID },
                    { action: 'manage', resource, eventId: eventID }
                  );
                await can(
                  tx,
                  { userID: writerID },
                  { action: 'manage_participants', resource: 'events', eventId: eventID }
                );
                await can(
                  tx,
                  { userID: writerID },
                  { action: 'manage_votes', resource: 'events', eventId: eventID }
                );
              }
            });
            if (accreditation)
              await ctx.sql`delete from action_right where role_id = ${revokedRole} and action = 'manage_participants'`;
            else if (eligibility) {
              assert.ok(delegatedParticipant, 'Missing eligible event participant');
              await ctx.sql`update event_participant set status = 'invited' where id = ${delegatedParticipant}`;
            } else
              for (const roleID of delegateRoles)
                await ctx.sql`delete from action_right where role_id = ${roleID} and action <> 'view'`;
          },
          verify: async () => {
            await prepared.verify();
            if (accreditation)
              assert.equal(
                (
                  await ctx.sql`select id from action_right where role_id = ${revokedRole} and action = 'manage_participants'`
                ).length,
                0
              );
            else if (eligibility)
              await f.expect('event_participant', String(delegatedParticipant), {
                status: 'invited',
              });
            else
              for (const roleID of delegateRoles)
                assert.equal(
                  (
                    await ctx.sql`select id from action_right where role_id = ${roleID} and action <> 'view'`
                  ).length,
                  0
                );
          },
          // Query eviction after revocation is legitimate; retained rows still need
          // exact independent SQL equality, including fractional timestamp precision.
          verifyRollback: writer => verifyRevokedGovernanceWriter(ctx, writer),
          restore: prepared.restore,
          verifyRestored: prepared.verifyRestored,
        };
      },
    };
  });
}
