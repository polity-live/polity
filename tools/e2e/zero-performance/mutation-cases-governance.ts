import assert from 'node:assert/strict';
import {
  governanceRevocationCases,
  groupedEventCreationCases,
} from './mutation-cases-governance-revocation';
import { pbkdf2Sync } from 'node:crypto';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { queries } from '../../../src/zero/queries';
import type { MutationCase, MutationCaseContext } from './mutation-case-types';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import {
  eventAdminFixture,
  groupAdminFixture,
  cleanupGovernanceNotifications,
  verifyGovernanceNotificationsRestored,
} from './mutation-governance-fixtures';

const PIN = '4826';
const salt = Buffer.from('governance-fixtur');
const fixtureHash = `${salt.toString('base64')}:${pbkdf2Sync(PIN, salt, 100_000, 32, 'sha256').toString('base64')}`;
function validHash(value: unknown, pin: string) {
  assert.equal(typeof value, 'string');
  const [salt64, hash64] = String(value).split(':');
  assert.equal(Buffer.from(salt64, 'base64').length, 16);
  assert.equal(Buffer.from(hash64, 'base64').length, 32);
  assert.equal(
    pbkdf2Sync(pin, Buffer.from(salt64, 'base64'), 100_000, 32, 'sha256').toString('base64'),
    hash64
  );
}
const object = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
const rows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value : value ? [value as Record<string, unknown>] : [];

/** Reviewed SQL timestamptz columns store parsed epoch values as Dates, while Zero exposes numbers. */
export function governanceSQLExpected(table: string, fields: Record<string, unknown> | null) {
  if (!fields) return null;
  const columns: Record<string, readonly string[]> = {
    agenda_item: ['start_time', 'end_time', 'activated_at', 'completed_at'],
    speaker_list: ['start_time', 'end_time'],
    vote: ['closing_end_time'],
    election: ['closing_end_time'],
  };
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [
      field,
      columns[table]?.includes(field) && typeof value === 'number' ? new Date(value) : value,
    ])
  );
}

async function passwordFixture(ctx: MutationCaseContext, present: boolean) {
  const { sql } = ctx;
  const original = await sql`select * from voting_password where user_id = ${ctx.ownerID}`;
  await sql`delete from voting_password where user_id = ${ctx.ownerID}`;
  const id = mutationFixtureID(ctx.id, 'password');
  if (present)
    await sql`insert into voting_password (id,user_id,password_hash) values (${id},${ctx.ownerID},${fixtureHash})`;
  const baseline = await sql`select * from voting_password where user_id = ${ctx.ownerID}`;
  return {
    id,
    baseline,
    restore: async () => {
      await sql`delete from voting_password where user_id = ${ctx.ownerID}`;
      for (const row of original) await sql`insert into voting_password ${sql(row)}`;
    },
    verifyRestored: async () =>
      assert.deepEqual(
        await sql`select * from voting_password where user_id = ${ctx.ownerID}`,
        original
      ),
  };
}

function passwordCases(): MutationCase[] {
  const definitions = [
    { name: 'setVotingPassword', variant: 'create-real-pbkdf2', present: false, success: true },
    { name: 'setVotingPassword', variant: 'replace-real-pbkdf2', present: true, success: true },
    { name: 'verifyVotingPassword', variant: 'verify-and-stamp', present: true, success: true },
    {
      name: 'verifyVotingPassword',
      variant: 'wrong-pin',
      present: true,
      success: false,
      error: 'voting_password_invalid',
    },
    {
      name: 'verifyVotingPassword',
      variant: 'missing-password',
      present: false,
      success: false,
      error: 'voting_password_missing',
    },
    {
      name: 'setVotingPassword',
      variant: 'anonymous',
      present: false,
      success: false,
      error: 'permission_denied',
      actor: 'anonymous',
    },
    {
      name: 'verifyVotingPassword',
      variant: 'anonymous',
      present: true,
      success: false,
      error: 'permission_denied',
      actor: 'anonymous',
    },
  ];
  return definitions.map(d => ({
    name: `votingPassword.${d.name}`,
    variant: d.variant,
    actor: d.actor ?? 'owner',
    outcome: d.success ? 'success' : 'server-error',
    ...(!d.success ? { error: d.error } : {}),
    observer: { query: 'votingPassword.userHasVotingPassword' },
    specification: {
      fixture: d.present
        ? 'Known independent PBKDF2 hash with no verification stamp'
        : 'No password row',
      oracle:
        d.name === 'setVotingPassword'
          ? '100000-iteration PBKDF2 SHA256, 16-byte random salt, 32-byte hash'
          : 'Successful verification stamps last_verified_at; rejection preserves exact baseline',
      rollback: 'Password state restored from independent SQL snapshot',
    },
    prepare: async ctx => {
      const f = await passwordFixture(ctx, d.present);
      const started = Date.now();
      return {
        args: { password: d.variant === 'wrong-pin' ? '9999' : PIN },
        observe: {
          request: queries.votingPassword.userHasVotingPassword({ user_id: ctx.ownerID }),
          before: (data: unknown) =>
            d.present ? object(data)?.password_hash === fixtureHash : !data,
          after: (data: unknown) =>
            !d.success
              ? d.present
                ? object(data)?.password_hash === fixtureHash
                : !data
              : d.name === 'setVotingPassword'
                ? typeof object(data)?.password_hash === 'string' &&
                  object(data)?.password_hash !== fixtureHash &&
                  object(data)?.password_hash !== '***'
                : typeof object(data)?.last_verified_at === 'number' &&
                  Number(object(data)?.last_verified_at) >= started,
        },
        verify: async () => {
          const records =
            await ctx.sql`select * from voting_password where user_id = ${ctx.ownerID}`;
          if (!d.success) {
            assert.deepEqual(records, f.baseline);
            return;
          }
          assert.equal(records.length, 1);
          if (d.name === 'setVotingPassword') {
            validHash(records[0].password_hash, PIN);
            assert.notEqual(records[0].password_hash, fixtureHash);
          } else {
            assert.equal(records[0].password_hash, fixtureHash);
            assert.ok(new Date(records[0].last_verified_at).getTime() >= started);
          }
        },
        restore: f.restore,
        verifyRestored: f.verifyRestored,
      };
    },
  }));
}

const agendaData = (id: string, eventID: string) => ({
  id,
  event_id: eventID,
  amendment_id: null,
  title: 'Reviewed agenda item',
  description: null,
  type: 'discussion',
  status: 'pending',
  forwarding_status: null,
  order_index: 0,
  duration: 5,
  scheduled_time: null,
  start_time: null,
  end_time: null,
  activated_at: null,
  completed_at: null,
  majority_type: null,
  time_limit: null,
  voting_phase: null,
});

function agendaCases(): MutationCase[] {
  const names = [
    'createAgendaItem',
    'createFull',
    'updateAgendaItem',
    'deleteAgendaItem',
    'reorderAgendaItems',
    'addSpeaker',
    'updateSpeaker',
    'removeSpeaker',
    'createAgendaItemChangeRequest',
    'updateAgendaItemChangeRequest',
    'deleteAgendaItemChangeRequest',
    'reorderAgendaItemChangeRequests',
  ];
  return names.flatMap(name =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: `agendas.${name}`,
      variant: actor === 'owner' ? 'authorized-business-transition' : 'permission-denied',
      actor,
      outcome: actor === 'owner' ? ('success' as const) : ('server-error' as const),
      ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
      observer: {
        query: name.includes('Speaker')
          ? 'agendas.speakerById'
          : name.includes('ChangeRequest')
            ? 'agendas.changeRequestById'
            : 'agendas.byId',
      },
      specification: {
        fixture:
          'Isolated online event; active manager participant with explicitly scoped event and agendaItems rights',
        transition: name,
        oracle:
          'Explicit agenda/speaker/timeline row fields, parent event identity and permission-denial no-write baseline',
        restoration:
          'Delete isolated child rows and event, including cascading activity and scoped rights; independently prove absence',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const event = await eventAdminFixture(f, ctx);
        const agendaID = mutationFixtureID(ctx.id, 'agenda');
        const subjectID = mutationFixtureID(ctx.id, 'agenda-subject');
        const isSpeaker = name.includes('Speaker');
        const isCR = name.includes('ChangeRequest');
        const isCreate = [
          'createAgendaItem',
          'createFull',
          'addSpeaker',
          'createAgendaItemChangeRequest',
        ].includes(name);
        const isDelete = [
          'deleteAgendaItem',
          'removeSpeaker',
          'deleteAgendaItemChangeRequest',
        ].includes(name);
        const isReorder = name.startsWith('reorder');
        const table = isSpeaker
          ? 'speaker_list'
          : isCR
            ? 'agenda_item_change_request'
            : 'agenda_item';
        const id = isSpeaker || isCR ? subjectID : agendaID;
        if (isSpeaker || isCR || !isCreate)
          await f.insert('agenda_item', {
            ...agendaData(agendaID, event.id),
            creator_id: ctx.ownerID,
          });
        else await f.track('agenda_item', agendaID);
        const speaker = {
          id,
          agenda_item_id: agendaID,
          user_id: ctx.ownerID,
          title: null,
          order_index: 0,
          time: 30,
          completed: false,
          start_time: null,
          end_time: null,
        };
        const cr = {
          id,
          agenda_item_id: agendaID,
          change_request_id: null,
          vote_id: null,
          order_index: 0,
          is_closing_vote: true,
          step_kind: 'closing',
          status: 'pending',
        };
        if (isSpeaker || isCR) {
          if (isCreate) await f.track(table, id);
          else await f.insert(table, isSpeaker ? speaker : cr);
        }
        const baseline = await f.rows(table, id);
        const changed = isSpeaker
          ? { completed: true, time: 60 }
          : isCR
            ? { order_index: 7 }
            : { title: 'Updated agenda title' };
        const args = isCreate
          ? name === 'createFull'
            ? { agenda_items: [agendaData(agendaID, event.id)] }
            : isSpeaker
              ? speaker
              : isCR
                ? cr
                : agendaData(agendaID, event.id)
          : isDelete
            ? { id }
            : isReorder
              ? { items: [{ id, order_index: 7 }] }
              : { id, ...changed };
        const expected =
          actor !== 'owner'
            ? (baseline[0] ?? null)
            : isDelete
              ? null
              : isCreate
                ? isSpeaker
                  ? { ...speaker, start_time: 0, end_time: 0 }
                  : isCR
                    ? cr
                    : {
                        ...agendaData(agendaID, event.id),
                        creator_id: ctx.ownerID,
                        start_time: 0,
                        end_time: 0,
                        activated_at: 0,
                        completed_at: 0,
                      }
                : {
                    ...(isReorder ? { order_index: 7 } : changed),
                    ...(isSpeaker || isCR ? { agenda_item_id: agendaID } : { event_id: event.id }),
                  };
        const predicate = (data: unknown, before: boolean) => {
          const row = object(data);
          if (before || actor !== 'owner')
            return isCreate ? !row : row?.id === id && row?.order_index === 0;
          if (isDelete) return !row;
          return (
            row?.id === id &&
            Object.entries(expected ?? {}).every(([key, value]) => row[key] === value)
          );
        };
        return {
          args: args as ReadonlyJSONValue,
          observe: {
            request: isSpeaker
              ? queries.agendas.speakerById({ id })
              : isCR
                ? queries.agendas.changeRequestById({ id })
                : queries.agendas.byId({ id }),
            before: (data: unknown) => predicate(data, true),
            after: (data: unknown) => predicate(data, false),
          },
          verify: async () => {
            if (actor === 'owner')
              await f.expect(table, id, governanceSQLExpected(table, expected));
            else assert.deepEqual(await f.rows(table, id), baseline);
            assert.equal((await f.rows('event', event.id)).length, 1);
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [event.id]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [event.id]);
          },
        };
      },
    }))
  );
}

function accreditationCases(): MutationCase[] {
  const definitions = [
    ...['requestAccreditation', 'confirmAccreditation'].flatMap(name => [
      { name, variant: 'request-new', actor: 'owner', from: null, to: 'pending' },
      { name, variant: 'rerequest-rejected', actor: 'owner', from: 'rejected', to: 'pending' },
      {
        name,
        variant: 'wrong-pin',
        actor: 'owner',
        from: null,
        to: null,
        error: 'voting_password_invalid',
      },
      {
        name,
        variant: 'anonymous',
        actor: 'anonymous',
        from: null,
        to: null,
        error: 'permission_denied',
      },
      { name, variant: 'already-approved', actor: 'owner', from: 'approved', to: null },
    ]),
    ...[
      ['approveAccreditation', 'pending', 'approved'],
      ['rejectAccreditation', 'pending', 'rejected'],
      ['revokeAccreditation', 'approved', 'revoked'],
    ].flatMap(([name, from, to]) => [
      { name, variant: 'append-audit-transition', actor: 'owner', from, to },
      { name, variant: 'outsider', actor: 'outsider', from, to: null, error: 'permission_denied' },
      {
        name,
        variant: 'anonymous',
        actor: 'anonymous',
        from,
        to: null,
        error: 'permission_denied',
      },
      { name, variant: 'invalid-prior-status', actor: 'owner', from: 'revoked', to: null },
    ]),
    {
      name: 'deleteAccreditation',
      variant: 'append-only-retention',
      actor: 'owner',
      from: 'approved',
      to: null,
    },
  ];
  return definitions.map(d => ({
    name: `accreditation.${d.name}`,
    variant: d.variant,
    actor: d.actor,
    outcome: d.to ? ('success' as const) : ('server-error' as const),
    ...(!d.to ? { error: 'error' in d ? d.error : 'mutation_server_failed' } : {}),
    observer: { query: 'accreditation.userAccreditation' },
    specification: {
      from: d.from,
      to: d.to,
      audit:
        'Exactly one append-only audit with prior/next status, owner actor and reason; rejection creates no audit',
      fixture:
        'Isolated event manager participant, accreditation agenda item, independent 100000-iteration PBKDF2 PIN',
      restoration:
        'Parent cascades remove all accreditation/audit rows; original password restored and checked',
    },
    prepare: async (ctx: MutationCaseContext) => {
      const f = new MutationFixtures(ctx.sql);
      const event = await eventAdminFixture(f, ctx);
      const agendaID = mutationFixtureID(ctx.id, 'accreditation-agenda');
      const accreditationID = mutationFixtureID(ctx.id, 'accreditation');
      await f.insert('agenda_item', {
        ...agendaData(agendaID, event.id),
        type: 'accreditation',
        creator_id: ctx.ownerID,
      });
      if (d.from)
        await f.insert('accreditation', {
          id: accreditationID,
          event_id: event.id,
          agenda_item_id: agendaID,
          user_id: ctx.ownerID,
          status: d.from,
        });
      const baseline = await ctx.sql`select * from accreditation where event_id = ${event.id}`;
      const password = await passwordFixture(ctx, true);
      const isRequest = d.name === 'requestAccreditation' || d.name === 'confirmAccreditation';
      const started = Date.now();
      return {
        args: isRequest
          ? {
              event_id: event.id,
              agenda_item_id: agendaID,
              password: d.variant === 'wrong-pin' ? '9999' : PIN,
            }
          : d.name === 'deleteAccreditation'
            ? { id: accreditationID }
            : { accreditation_id: accreditationID, reason: 'Reviewed governance decision' },
        observe: {
          request: queries.accreditation.userAccreditation({
            event_id: event.id,
            user_id: ctx.ownerID,
          }),
          before: (data: unknown) => (d.from ? object(data)?.status === d.from : !data),
          after: (data: unknown) =>
            d.to ? object(data)?.status === d.to : d.from ? object(data)?.status === d.from : !data,
        },
        verify: async () => {
          const records = await ctx.sql`select * from accreditation where event_id = ${event.id}`;
          const audit =
            await ctx.sql`select * from accreditation_audit where event_id = ${event.id}`;
          if (!d.to) {
            assert.deepEqual(records, baseline);
            assert.equal(audit.length, 0);
            return;
          }
          assert.equal(records.length, 1);
          assert.equal(records[0].status, d.to);
          assert.equal(records[0].agenda_item_id, agendaID);
          assert.equal(records[0].user_id, ctx.ownerID);
          assert.equal(audit.length, 1);
          assert.equal(audit[0].accreditation_id, records[0].id);
          assert.equal(audit[0].from_status, d.from);
          assert.equal(audit[0].to_status, d.to);
          assert.equal(audit[0].actor_id, ctx.ownerID);
          assert.equal(
            audit[0].reason,
            isRequest ? 'self_request' : 'Reviewed governance decision'
          );
          if (!isRequest) {
            assert.equal(records[0].decided_by, ctx.ownerID);
            assert.ok(new Date(records[0].decided_at).getTime() >= started);
            if (d.to === 'approved')
              assert.ok(new Date(records[0].confirmed_at).getTime() >= started);
            else assert.equal(records[0].confirmed_at, null);
          }
        },
        restore: async () => {
          await f.restore();
          await password.restore();
        },
        verifyRestored: async () => {
          await f.verifyRestored();
          await password.verifyRestored();
          assert.equal(
            (await ctx.sql`select id from accreditation where event_id = ${event.id}`).length,
            0
          );
          assert.equal(
            (await ctx.sql`select id from accreditation_audit where event_id = ${event.id}`).length,
            0
          );
        },
      };
    },
  }));
}

function scopeManagementCases(): MutationCase[] {
  const definitions = [
    ...['createRole', 'updateRole', 'deleteRole'].flatMap(name =>
      ['groups', 'events'].map(domain => ({ domain, name, table: 'role' }))
    ),
    { domain: 'groups', name: 'assignActionRight', table: 'action_right' },
    { domain: 'groups', name: 'removeActionRight', table: 'action_right' },
    { domain: 'groups', name: 'createRoleHolderHistory', table: 'role_holder_history' },
    { domain: 'groups', name: 'updateRoleHolderHistory', table: 'role_holder_history' },
    { domain: 'groups', name: 'update', table: 'group' },
    { domain: 'groups', name: 'delete', table: 'group' },
    { domain: 'events', name: 'update', table: 'event' },
    { domain: 'events', name: 'cancel', table: 'event' },
  ];
  return definitions.flatMap(d =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: `${d.domain}.${d.name}`,
      variant: actor === 'owner' ? 'authorized-scope-management' : 'permission-denied',
      actor,
      outcome: actor === 'owner' ? ('success' as const) : ('server-error' as const),
      ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
      observer: {
        query:
          d.table === 'group'
            ? 'groups.byId'
            : d.table === 'event'
              ? 'events.byId'
              : d.domain === 'groups'
                ? 'groups.rolesFull'
                : 'events.rolesWithHolders',
      },
      specification: {
        fixture:
          'Fresh public base-group owner or event participant with explicit scoped manager rights',
        subject: d.table,
        transition: d.name,
        oracle:
          'Hand-authored row identity and business fields; permission denial preserves complete baseline',
        restoration:
          'Remove scoped notifications and all fresh fixture rows; independent SQL absence proof',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const scopeID =
          d.domain === 'groups'
            ? await groupAdminFixture(f, ctx)
            : (await eventAdminFixture(f, ctx)).id;
        const roleID = mutationFixtureID(ctx.id, 'managed-role');
        const rowID = mutationFixtureID(ctx.id, 'managed-record');
        const isCreate = ['createRole', 'assignActionRight', 'createRoleHolderHistory'].includes(
          d.name
        );
        const isDelete = ['delete', 'deleteRole', 'removeActionRight'].includes(d.name);
        const isScope = d.table === 'group' || d.table === 'event';
        const id = isScope ? scopeID : d.table === 'role' ? roleID : rowID;
        const role = {
          id: roleID,
          name: 'Reviewed role',
          scope: d.domain === 'groups' ? 'group' : 'event',
          ...(d.domain === 'groups' ? { group_id: scopeID } : { event_id: scopeID }),
          assignment_mode: 'assigned',
          visibility: 'public',
        };
        if (!isScope) {
          if (d.table !== 'role' || !isCreate) await f.insert('role', role);
          else await f.track('role', roleID);
        }
        const right = {
          id: rowID,
          role_id: roleID,
          group_id: scopeID,
          resource: 'groups',
          action: 'view',
          event_id: null,
          amendment_id: null,
          blog_id: null,
        };
        const history = {
          id: rowID,
          role_id: roleID,
          user_id: ctx.ownerID,
          start_date: 1_700_000_000_000,
          end_date: null,
          reason: 'Reviewed appointment',
        };
        if (d.table === 'action_right' || d.table === 'role_holder_history') {
          if (isCreate) await f.track(d.table, rowID);
          else
            await f.insert(
              d.table,
              d.table === 'action_right'
                ? right
                : { ...history, start_date: new Date(history.start_date) }
            );
        }
        const baseline = await f.rows(d.table, id);
        const changed =
          d.name === 'cancel'
            ? {
                status: 'cancelled',
                cancel_reason: 'Reviewed cancellation',
                cancelled_by_id: ctx.ownerID,
              }
            : d.table === 'group'
              ? { name: 'Updated governance group' }
              : d.table === 'event'
                ? { title: 'Updated governance event' }
                : d.table === 'role_holder_history'
                  ? { reason: 'Reviewed appointment correction' }
                  : { name: 'Updated governance role' };
        const args = isCreate
          ? d.table === 'role'
            ? role
            : d.table === 'action_right'
              ? right
              : history
          : isDelete
            ? { id }
            : d.name === 'cancel'
              ? { id, cancel_reason: 'Reviewed cancellation' }
              : { id, ...changed };
        const expected =
          actor !== 'owner'
            ? (baseline[0] ?? null)
            : isDelete
              ? null
              : isCreate
                ? d.table === 'role'
                  ? role
                  : d.table === 'action_right'
                    ? right
                    : { role_id: roleID, user_id: ctx.ownerID, reason: history.reason }
                : changed;
        const query =
          d.table === 'group'
            ? queries.groups.byId({ id })
            : d.table === 'event'
              ? queries.events.byId({ id })
              : d.domain === 'groups'
                ? queries.groups.rolesFull({ groupId: scopeID })
                : queries.events.rolesWithHolders({ eventId: scopeID });
        const project = (data: unknown) => {
          if (isScope) return object(data);
          const record = rows(data).find(row => row.id === roleID);
          return d.table === 'role'
            ? record
            : rows(record?.[d.table === 'action_right' ? 'action_rights' : 'holder_history']).find(
                row => row.id === rowID
              );
        };
        const before = (data: unknown) => {
          const record = project(data);
          return isCreate ? !record : record?.id === id;
        };
        return {
          args: args as ReadonlyJSONValue,
          observe: {
            request: query,
            before,
            after: (data: unknown) => {
              if (actor !== 'owner') return before(data);
              const record = project(data);
              if (isDelete) return !record;
              return (
                record?.id === id &&
                Object.entries(expected ?? {}).every(([key, value]) => record[key] === value)
              );
            },
          },
          verify: async () => {
            if (actor === 'owner')
              await f.expect(d.table, id, governanceSQLExpected(d.table, expected));
            else assert.deepEqual(await f.rows(d.table, id), baseline);
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [scopeID]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [scopeID]);
          },
        };
      },
    }))
  );
}

function scopeCreationCases(): MutationCase[] {
  return ['groups', 'events'].flatMap(domain =>
    ['create', 'createFull'].flatMap(name =>
      ['owner', 'anonymous'].map(actor => ({
        name: `${domain}.${name}`,
        variant: actor === 'owner' ? 'creator-bootstrap' : 'anonymous',
        actor,
        outcome: actor === 'owner' ? ('success' as const) : ('server-error' as const),
        ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
        observer: { query: `${domain}.byId` },
        specification: {
          fixture: 'Fresh supplied UUID with no preexisting scope',
          oracle:
            'Persisted caller-owned entity, one active caller membership/participation, scoped roles/rights; group conversation and user counter recomputation',
          restoration:
            'User snapshot updated in place; generated conversation and RBAC scope deleted; independent absence checks',
        },
        prepare: async (ctx: MutationCaseContext) => {
          const f = new MutationFixtures(ctx.sql);
          const id = mutationFixtureID(ctx.id, 'created-scope');
          const table = domain === 'groups' ? 'group' : 'event';
          await f.track('user', ctx.ownerID);
          await f.track(table, id);
          await f.trackScope('conversation', domain === 'groups' ? 'group_id' : 'event_id', id);
          await f.trackScope('role', domain === 'groups' ? 'group_id' : 'event_id', id);
          const group = {
            id,
            name: 'Reviewed created group',
            description: null,
            email: null,
            country: null,
            region: null,
            post_code: null,
            city: null,
            street: null,
            house_number: null,
            latitude: null,
            longitude: null,
            image_url: null,
            video_url: null,
            x: null,
            youtube: null,
            linkedin: null,
            website: null,
            whatsapp: null,
            instagram: null,
            twitter: null,
            facebook: null,
            snapchat: null,
            tiktok: null,
            visibility: 'public',
            owner_id: null,
            group_type: 'base',
          };
          const event = {
            id,
            title: 'Reviewed created event',
            group_id: null,
            event_type: 'meeting',
            attendance_mode: 'online',
            status: 'planned',
            visibility: 'public',
            start_date: 1_900_000_000_000,
            end_date: 1_900_000_600_000,
          };
          const entity = domain === 'groups' ? group : event;
          const args =
            name === 'createFull'
              ? domain === 'groups'
                ? { group: entity }
                : { event: entity }
              : entity;
          const ownerField = domain === 'groups' ? 'owner_id' : 'creator_id';
          return {
            args: args as ReadonlyJSONValue,
            observe: {
              request:
                domain === 'groups' ? queries.groups.byId({ id }) : queries.events.byId({ id }),
              before: (data: unknown) => !data,
              after: (data: unknown) =>
                actor === 'owner'
                  ? object(data)?.id === id && object(data)?.[ownerField] === ctx.ownerID
                  : !data,
            },
            verify: async () => {
              if (actor !== 'owner') {
                await f.expect(table, id, null);
                return;
              }
              await f.expect(table, id, {
                [ownerField]: ctx.ownerID,
                visibility: 'public',
                [domain === 'groups' ? 'name' : 'title']:
                  domain === 'groups' ? group.name : event.title,
              });
              const memberships =
                domain === 'groups'
                  ? await ctx.sql`select * from group_membership where group_id = ${id} and user_id = ${ctx.ownerID}`
                  : await ctx.sql`select * from event_participant where event_id = ${id} and user_id = ${ctx.ownerID}`;
              assert.equal(memberships.length, 1);
              assert.equal(memberships[0].status, 'active');
              const roleRows =
                domain === 'groups'
                  ? await ctx.sql`select id from role where group_id = ${id} and scope = 'group'`
                  : await ctx.sql`select id from role where event_id = ${id} and scope = 'event'`;
              assert.ok(roleRows.length >= 1);
              const rights =
                domain === 'groups'
                  ? await ctx.sql`select id from action_right where group_id = ${id}`
                  : await ctx.sql`select id from action_right where event_id = ${id}`;
              assert.ok(rights.length > 0);
              if (domain === 'groups')
                assert.equal(
                  (await ctx.sql`select id from conversation where group_id = ${id}`).length,
                  1
                );
            },
            restore: async () => {
              await cleanupGovernanceNotifications(ctx, [id]);
              await f.restore();
            },
            verifyRestored: async () => {
              await f.verifyRestored();
              await verifyGovernanceNotificationsRestored(ctx, [id]);
            },
          };
        },
      }))
    )
  );
}

function ballotManagementCases(): MutationCase[] {
  const definitions = [
    ...['createElection', 'updateElection', 'deleteElection'].map(name => ({
      domain: 'elections',
      name,
      table: 'election',
    })),
    ...['addCandidate', 'updateCandidate', 'deleteCandidate'].map(name => ({
      domain: 'elections',
      name,
      table: 'election_candidate',
    })),
    ...['createVote', 'updateVote', 'deleteVote'].map(name => ({
      domain: 'votes',
      name,
      table: 'vote',
    })),
    ...['createVoteChoice', 'updateVoteChoice', 'deleteVoteChoice'].map(name => ({
      domain: 'votes',
      name,
      table: 'vote_choice',
    })),
  ];
  return definitions.flatMap(d =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: `${d.domain}.${d.name}`,
      variant: actor === 'owner' ? 'authorized-ballot-management' : 'permission-denied',
      actor,
      outcome: actor === 'owner' ? ('success' as const) : ('server-error' as const),
      ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
      observer: {
        query:
          d.table === 'election_candidate'
            ? 'elections.candidatesByElection'
            : d.table === 'vote_choice'
              ? 'votes.choicesByVote'
              : `${d.domain}.byId`,
      },
      specification: {
        fixture:
          'Isolated event with explicit elections/votes manager and active/passive voting rights, pending agenda ballot, recent independently prepared PIN verification',
        transition: d.name,
        oracle:
          'Explicit row relation, title/choice/candidate fields; denied actor leaves exact SQL baseline',
        restoration: 'Delete fresh agenda and scoped rows/notifications; restore original PIN row',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const event = await eventAdminFixture(f, ctx);
        const agendaID = mutationFixtureID(ctx.id, 'ballot-agenda');
        const ballotID = mutationFixtureID(ctx.id, 'ballot');
        const childID = mutationFixtureID(ctx.id, 'ballot-child');
        await f.insert('agenda_item', {
          ...agendaData(agendaID, event.id),
          type: d.domain === 'elections' ? 'election' : 'vote',
          creator_id: ctx.ownerID,
        });
        const election = {
          id: ballotID,
          agenda_item_id: agendaID,
          role_id: null,
          title: 'Reviewed election',
          description: null,
          status: 'pending',
          majority_type: 'relative',
          closing_type: 'moderator',
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          ballot_visibility: 'named',
          election_mode: 'single',
          seat_count: 1,
          max_votes: 1,
        };
        const vote = {
          id: ballotID,
          agenda_item_id: agendaID,
          amendment_id: null,
          title: 'Reviewed vote',
          description: null,
          status: 'pending',
          purpose: 'closing',
          majority_type: 'relative',
          closing_type: 'moderator',
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          ballot_visibility: 'named',
        };
        const candidate = {
          id: childID,
          election_id: ballotID,
          user_id: ctx.ownerID,
          name: 'Reviewed candidate',
          description: null,
          image_url: null,
          status: 'pending',
          order_index: 0,
        };
        const choice = {
          id: childID,
          vote_id: ballotID,
          label: 'Approve',
          semantic_key: 'yes',
          order_index: 0,
        };
        const isChild = d.table === 'election_candidate' || d.table === 'vote_choice';
        const isCreate = d.name.startsWith('create') || d.name === 'addCandidate';
        const isDelete = d.name.startsWith('delete');
        const ballotTable = d.domain === 'elections' ? 'election' : 'vote';
        if (isChild || !isCreate)
          await f.insert(ballotTable, d.domain === 'elections' ? election : vote);
        else await f.track(ballotTable, ballotID);
        if (isChild) {
          if (isCreate) await f.track(d.table, childID);
          else await f.insert(d.table, d.table === 'election_candidate' ? candidate : choice);
        }
        const id = isChild ? childID : ballotID;
        const baseline = await f.rows(d.table, id);
        const originalPassword =
          d.domain === 'elections' ? await passwordFixture(ctx, true) : undefined;
        if (originalPassword)
          await ctx.sql`update voting_password set last_verified_at = now() where user_id = ${ctx.ownerID}`;
        const createFields =
          d.table === 'election'
            ? election
            : d.table === 'vote'
              ? vote
              : d.table === 'election_candidate'
                ? candidate
                : choice;
        const changed =
          d.table === 'election_candidate'
            ? { name: 'Updated candidate', status: 'confirmed' }
            : d.table === 'vote_choice'
              ? { label: 'Updated choice' }
              : { title: 'Updated ballot' };
        const args = isCreate ? createFields : isDelete ? { id } : { id, ...changed };
        const expected =
          actor !== 'owner'
            ? (baseline[0] ?? null)
            : isDelete
              ? null
              : isCreate
                ? {
                    ...createFields,
                    ...('closing_end_time' in createFields ? { closing_end_time: 0 } : {}),
                  }
                : changed;
        const query =
          d.table === 'election_candidate'
            ? queries.elections.candidatesByElection({ election_id: ballotID })
            : d.table === 'vote_choice'
              ? queries.votes.choicesByVote({ vote_id: ballotID })
              : d.domain === 'elections'
                ? queries.elections.byId({ id })
                : queries.votes.byId({ id });
        const project = (data: unknown) =>
          isChild ? rows(data).find(row => row.id === id) : object(data);
        const before = (data: unknown) => (isCreate ? !project(data) : project(data)?.id === id);
        return {
          args: args as ReadonlyJSONValue,
          observe: {
            request: query,
            before,
            after: (data: unknown) => {
              if (actor !== 'owner') return before(data);
              const record = project(data);
              if (isDelete) return !record;
              return (
                record?.id === id &&
                Object.entries(expected ?? {}).every(([key, value]) => record[key] === value)
              );
            },
          },
          verify: async () => {
            if (actor === 'owner')
              await f.expect(d.table, id, governanceSQLExpected(d.table, expected));
            else assert.deepEqual(await f.rows(d.table, id), baseline);
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [event.id]);
            await f.restore();
            await originalPassword?.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await originalPassword?.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [event.id]);
          },
        };
      },
    }))
  );
}

function workflowCases(): MutationCase[] {
  const names = [
    'createWorkflow',
    'updateWorkflow',
    'deleteWorkflow',
    'createWorkflowStep',
    'updateWorkflowStep',
    'deleteWorkflowStep',
    'approveWorkflowApproval',
    'rejectWorkflowApproval',
    'saveWorkflowDefinition',
  ];
  return names.flatMap(name =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: `network.${name}`,
      variant: actor === 'owner' ? 'authorized-workflow-transition' : 'permission-denied',
      actor,
      outcome:
        actor === 'owner'
          ? ('success' as const)
          : name === 'saveWorkflowDefinition'
            ? ('client-error' as const)
            : ('server-error' as const),
      ...(actor !== 'owner'
        ? {
            error:
              name === 'saveWorkflowDefinition' ? 'mutation_server_failed' : 'permission_denied',
          }
        : {}),
      observer: { query: 'network.workflowById' },
      specification: {
        fixture:
          'Caller-owned group and explicit workflow/step/pending approval; save uses independent direct active amendmentRight grant between two groups',
        transition: name,
        oracle:
          'Workflow and nested business row fields; approval changes both approval state and aggregate workflow state; denied actor preserves SQL baseline',
        restoration:
          'Tracked whole generated workflow steps and approvals, scoped notification cleanup and independent parent absence proof',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const groupID = await groupAdminFixture(f, ctx);
        const workflowID = mutationFixtureID(ctx.id, 'workflow');
        const stepID = mutationFixtureID(ctx.id, 'workflow-step');
        const approvalID = mutationFixtureID(ctx.id, 'workflow-approval');
        const isSave = name === 'saveWorkflowDefinition';
        const isStep = name.includes('WorkflowStep');
        const isApproval = name.includes('WorkflowApproval');
        const isCreate = name.startsWith('create') || isSave;
        const isDelete = name.startsWith('delete');
        const workflow = {
          id: workflowID,
          group_id: groupID,
          start_group_id: groupID,
          name: 'Reviewed workflow',
          description: 'Reviewed workflow definition',
          created_by_id: ctx.ownerID,
          status: 'pending_approval',
          is_default_entry: false,
        };
        if (!isStep && !isApproval && isCreate) await f.track('group_workflow', workflowID);
        else await f.insert('group_workflow', workflow);
        const step = {
          id: stepID,
          workflow_id: workflowID,
          group_id: groupID,
          order_index: 0,
          label: 'Reviewed step',
          step_kind: 'group_vote',
          selection_mode: 'default_target_workflow',
          merge_strategy: null,
          event_rule: null,
          auto_task_on_missing_event: false,
          target_workflow_id: null,
        };
        const approval = {
          id: approvalID,
          workflow_id: workflowID,
          group_id: groupID,
          requested_by_group_id: groupID,
          status: 'pending',
        };
        if (isStep) {
          if (isCreate) await f.track('group_workflow_step', stepID);
          else await f.insert('group_workflow_step', step);
        }
        if (isApproval) await f.insert('group_workflow_approval', approval);
        await f.trackScope('group_workflow_step', 'workflow_id', workflowID);
        await f.trackScope('group_workflow_approval', 'workflow_id', workflowID);
        const table = isStep
          ? 'group_workflow_step'
          : isApproval
            ? 'group_workflow_approval'
            : 'group_workflow';
        const id = isStep ? stepID : isApproval ? approvalID : workflowID;
        const baseline = await f.rows(table, id);
        const workflowBaseline = await f.rows('group_workflow', workflowID);
        let targetID = groupID;
        if (isSave) {
          targetID = await groupAdminFixture(f, ctx, 'workflow-target');
          const connectionID = mutationFixtureID(ctx.id, 'workflow-connection');
          const [groupA, groupB] = [groupID, targetID].sort();
          await f.insert('group_connection', {
            id: connectionID,
            group_a_id: groupA,
            group_b_id: groupB,
            connection_type: 'peer',
            from_group_id: groupID,
            to_group_id: targetID,
            connection_kind: 'sibling',
            status: 'active',
          });
          await f.insert('group_right_grant', {
            id: mutationFixtureID(ctx.id, 'workflow-amendment-right'),
            connection_id: connectionID,
            right_key: 'amendmentRight',
            holder_group_id: groupID,
            scope_group_id: targetID,
            status: 'active',
            initiator_group_id: groupID,
          });
        }
        const nextStatus = name === 'approveWorkflowApproval' ? 'accepted' : 'rejected';
        const changed = isStep
          ? { label: 'Updated workflow step', order_index: 3 }
          : isApproval
            ? { status: nextStatus }
            : { name: 'Updated workflow title' };
        const args = isSave
          ? {
              id: workflowID,
              editing_group_id: groupID,
              start_group_id: groupID,
              name: 'Reviewed saved workflow',
              description: 'Reviewed complete definition',
              is_default_entry: false,
              created_by_id: ctx.ownerID,
              steps: [{ ...step, group_id: targetID }],
            }
          : isCreate
            ? isStep
              ? step
              : workflow
            : isDelete
              ? { id }
              : isApproval
                ? { approval_id: approvalID }
                : { id, ...changed };
        const expected =
          actor !== 'owner'
            ? (baseline[0] ?? null)
            : isDelete
              ? null
              : isSave
                ? {
                    name: 'Reviewed saved workflow',
                    group_id: targetID,
                    start_group_id: groupID,
                    status: 'pending_approval',
                  }
                : isCreate
                  ? isStep
                    ? step
                    : workflow
                  : changed;
        const project = (data: unknown) =>
          isStep || isApproval
            ? rows(object(data)?.[isStep ? 'steps' : 'approvals']).find(row => row.id === id)
            : object(data);
        const before = (data: unknown) => (isCreate ? !project(data) : project(data)?.id === id);
        return {
          args: args as ReadonlyJSONValue,
          ...(isSave && (actor === 'owner' || 'delegatedWriterID' in ctx)
            ? {
                writerPreloads: [
                  {
                    request: queries.network.groupConnectionsByGroup({ groupId: groupID }),
                    before: (data: unknown) =>
                      rows(data).some(
                        row =>
                          row.id === mutationFixtureID(ctx.id, 'workflow-connection') &&
                          rows(row.grants).some(
                            grant =>
                              grant.right_key === 'amendmentRight' && grant.status === 'active'
                          )
                      ),
                  },
                ],
              }
            : {}),
          observe: {
            request: queries.network.workflowById({ id: workflowID }),
            before,
            after: (data: unknown) => {
              if (actor !== 'owner') return before(data);
              const row = project(data);
              if (isDelete) return !row;
              return (
                row?.id === id &&
                Object.entries(expected ?? {}).every(([key, value]) => row[key] === value)
              );
            },
          },
          verify: async () => {
            if (actor !== 'owner') {
              assert.deepEqual(await f.rows(table, id), baseline);
              assert.deepEqual(await f.rows('group_workflow', workflowID), workflowBaseline);
              return;
            }
            await f.expect(table, id, expected);
            if (isApproval)
              await f.expect('group_workflow', workflowID, {
                status: nextStatus === 'accepted' ? 'active' : 'rejected',
              });
            if (isSave) {
              const steps =
                await ctx.sql`select * from group_workflow_step where workflow_id = ${workflowID}`;
              assert.equal(steps.length, 1);
              assert.equal(steps[0].group_id, targetID);
              assert.equal(steps[0].step_kind, 'group_vote');
              const approvals =
                await ctx.sql`select * from group_workflow_approval where workflow_id = ${workflowID}`;
              assert.equal(approvals.length, 2);
              assert.equal(approvals.find(row => row.group_id === groupID)?.status, 'accepted');
              assert.equal(approvals.find(row => row.group_id === targetID)?.status, 'pending');
            }
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [groupID, targetID]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [groupID, targetID]);
          },
        };
      },
    }))
  );
}

function connectionCases(): MutationCase[] {
  const names = [
    'createGroupConnection',
    'updateGroupConnection',
    'deleteGroupConnection',
    'proposeGroupConnectionChange',
    'approveGroupConnectionRequest',
    'rejectGroupConnectionRequest',
  ];
  return names.flatMap(name =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: `network.${name}`,
      variant: actor === 'owner' ? 'authorized-structure-transition' : 'permission-denied',
      actor,
      outcome: actor === 'owner' ? ('success' as const) : ('server-error' as const),
      ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
      observer: {
        query:
          name.includes('Request') || name === 'proposeGroupConnectionChange'
            ? 'network.groupConnectionRequestById'
            : 'network.groupConnectionById',
      },
      specification: {
        fixture:
          'Two independently created caller-owned groups and canonical UUID-sorted endpoints; hierarchy with explicit parent and child',
        transition: name,
        oracle:
          'Direct connection/request status, exact endpoints and relation; denied actor changes neither connection nor request',
        restoration:
          'Generated connection scopes tracked; all fresh groups, scoped roles, conversation and notification effects removed with independent SQL proof',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const parentID = await groupAdminFixture(f, ctx, 'connection-parent');
        const childID = await groupAdminFixture(f, ctx, 'connection-child');
        await f.update('group', { id: parentID, group_type: 'hierarchical' });
        await f.track('user', ctx.ownerID);
        for (const groupID of [parentID, childID]) {
          await f.trackScope('role', 'group_id', groupID);
          await f.trackScope('conversation', 'group_id', groupID);
        }
        const [groupA, groupB] = [parentID, childID].sort();
        const connectionID = mutationFixtureID(ctx.id, 'connection');
        const requestID = mutationFixtureID(ctx.id, 'connection-request');
        const connection = {
          id: connectionID,
          group_a_id: groupA,
          group_b_id: groupB,
          connection_type: 'hierarchy',
          parent_group_id: parentID,
          child_group_id: childID,
          status: 'active',
        };
        const request = {
          id: requestID,
          active_connection_id: null,
          proposed_connection_id: connectionID,
          group_a_id: groupA,
          group_b_id: groupB,
          desired_connection_type: 'hierarchy',
          desired_parent_group_id: parentID,
          desired_child_group_id: childID,
          initiator_group_id: parentID,
          structure_status: 'pending',
          status: 'pending',
        };
        const isRequest = name.includes('Request') || name === 'proposeGroupConnectionChange';
        const isCreate =
          name === 'createGroupConnection' || name === 'proposeGroupConnectionChange';
        const isDelete = name === 'deleteGroupConnection';
        if (!isRequest && !isCreate) await f.insert('group_connection', connection);
        else await f.track('group_connection', connectionID);
        if (isRequest && !isCreate) await f.insert('group_connection_request', request);
        else await f.track('group_connection_request', requestID);
        const table = isRequest ? 'group_connection_request' : 'group_connection';
        const id = isRequest ? requestID : connectionID;
        const baseline = await f.rows(table, id);
        const connectionBaseline = await f.rows('group_connection', connectionID);
        const args =
          name === 'createGroupConnection'
            ? { ...connection, grants: [], membership_rule: null }
            : name === 'proposeGroupConnectionChange'
              ? { ...request, grants: [], membership_rule: null }
              : isDelete
                ? { id, acting_group_id: parentID }
                : name === 'updateGroupConnection'
                  ? { id, status: 'pending' }
                  : { id };
        const expected =
          actor !== 'owner'
            ? (baseline[0] ?? null)
            : isDelete
              ? null
              : name === 'createGroupConnection'
                ? connection
                : name === 'proposeGroupConnectionChange'
                  ? {
                      group_a_id: groupA,
                      group_b_id: groupB,
                      initiator_group_id: parentID,
                      status: 'pending',
                    }
                  : name === 'approveGroupConnectionRequest'
                    ? null
                    : name === 'rejectGroupConnectionRequest'
                      ? { status: 'rejected', structure_status: 'rejected' }
                      : { status: 'pending' };
        const before = (data: unknown) => (isCreate ? !data : object(data)?.id === id);
        return {
          args: args as ReadonlyJSONValue,
          observe: {
            request: isRequest
              ? queries.network.groupConnectionRequestById({ id })
              : queries.network.groupConnectionById({ id }),
            before,
            after: (data: unknown) => {
              if (actor !== 'owner') return before(data);
              const row = object(data);
              if (name === 'approveGroupConnectionRequest') return !row;
              if (isDelete) return !row;
              return (
                row?.id === id &&
                Object.entries(expected ?? {}).every(([key, value]) => row[key] === value)
              );
            },
          },
          verify: async () => {
            if (actor !== 'owner') {
              assert.deepEqual(await f.rows(table, id), baseline);
              assert.deepEqual(await f.rows('group_connection', connectionID), connectionBaseline);
              return;
            }
            await f.expect(table, id, expected);
            if (name === 'approveGroupConnectionRequest')
              await f.expect('group_connection', connectionID, connection);
            if (name === 'rejectGroupConnectionRequest')
              await f.expect('group_connection', connectionID, null);
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [parentID, childID]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [parentID, childID]);
          },
        };
      },
    }))
  );
}

function ballotCastingCases(): MutationCase[] {
  const paired = [
    ['startVote', 'startElection', 'start'],
    ['submitVote', 'submitElectionVote', 'submit'],
    ['castIndicativeVote', 'castIndicativeElectionVote', 'participation-indicative'],
    ['createIndicativeChoiceDecision', 'createIndicativeCandidateSelection', 'decision-indicative'],
    ['replaceIndicativeVote', 'replaceIndicativeElectionVote', 'full-indicative'],
    ['castFinalVote', 'castFinalElectionVote', 'participation-final'],
    ['createFinalChoiceDecision', 'createFinalCandidateSelection', 'decision-final'],
    ['castFinalVoteFull', 'castFinalElectionVoteFull', 'full-final'],
    ['upsertOfflineTally', 'upsertOfflineTally', 'tally'],
    ['deleteOfflineTally', 'deleteOfflineTally', 'tally-delete'],
    ['createVoter', 'createElector', 'snapshot-create'],
    ['deleteVoter', 'deleteElector', 'snapshot-delete'],
  ];
  const definitions = paired.flatMap(([voteName, electionName, kind]) =>
    ['votes', 'elections'].map(domain => ({
      domain,
      name: domain === 'votes' ? voteName : electionName,
      kind,
      scenario: '',
    }))
  );
  for (const domain of ['votes', 'elections'])
    for (const scenario of [
      'same-id-replay',
      'secret-indicative-duplicate',
      'final-duplicate',
      'stale-pin',
    ]) {
      definitions.push({
        domain,
        name: domain === 'votes' ? 'submitVote' : 'submitElectionVote',
        kind: 'submit',
        scenario,
      });
    }
  return definitions.flatMap(d => {
    const internal = d.kind.startsWith('snapshot');
    const actors = internal || d.scenario ? ['owner'] : ['owner', 'outsider', 'anonymous'];
    const deniedScenario = !!d.scenario && d.scenario !== 'same-id-replay';
    return actors.map(actor => ({
      name: `${d.domain}.${d.name}`,
      variant:
        d.scenario ||
        (internal
          ? 'server-maintained-electorate-rejects-public-write'
          : actor === 'owner'
            ? 'authorized-ballot-transition'
            : 'actor-denied'),
      actor,
      outcome:
        actor === 'owner' && !internal && !deniedScenario
          ? ('success' as const)
          : ('server-error' as const),
      ...(internal || actor !== 'owner' || deniedScenario
        ? {
            error:
              internal ||
              d.kind === 'decision-indicative' ||
              (d.kind === 'submit' && actor !== 'anonymous')
                ? 'mutation_server_failed'
                : 'permission_denied',
          }
        : {}),
      observer: { query: `${d.domain}.byId` },
      specification: {
        fixture:
          'Fresh online event with scoped manager/voting rights, named ballot, two independently inserted snapshot electors, real PBKDF2 PIN verified now',
        transition: d.scenario || d.kind,
        oracle: d.scenario
          ? 'Independently inserted prior ballot rows: same-ID replay is an exact no-op; duplicate secret/final ballot or stale PIN rejects without changing ballot, participation, decision or elector snapshots'
          : internal
            ? 'Electorate snapshot legacy write API intentionally throws and leaves exact snapshot unchanged'
            : 'Exact ballot phase, caller participation, one related chosen option and offline tally fields; denied actor creates no ballot side effects',
        restoration:
          'Generated participation/decision scope tracked before subject; all fresh ballot/agenda/event removed; original actor PIN restored',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const event = await eventAdminFixture(f, ctx);
        const agendaID = mutationFixtureID(ctx.id, 'casting-agenda');
        const ballotID = mutationFixtureID(ctx.id, 'casting-ballot');
        const optionID = mutationFixtureID(ctx.id, 'casting-option');
        const electorID = mutationFixtureID(ctx.id, 'casting-elector');
        const participationID = mutationFixtureID(ctx.id, 'casting-participation');
        const decisionID = mutationFixtureID(ctx.id, 'casting-decision');
        const tallyID = mutationFixtureID(ctx.id, 'casting-tally');
        const isElection = d.domain === 'elections';
        const secretManagerDecision =
          'governanceSecretDecision' in ctx && ctx.governanceSecretDecision === true;
        const ballotTable = isElection ? 'election' : 'vote';
        const ballotField = isElection ? 'election_id' : 'vote_id';
        const electorTable = isElection ? 'elector' : 'voter';
        const electorField = isElection ? 'elector_id' : 'voter_id';
        const phase =
          d.kind.endsWith('final') || d.scenario === 'final-duplicate' ? 'final' : 'indicative';
        const participationTable = `${phase}_${isElection ? 'elector' : 'voter'}_participation`;
        const decisionTable = `${phase}_${isElection ? 'candidate_selection' : 'choice_decision'}`;
        const decisionField = isElection ? 'elector_participation_id' : 'voter_participation_id';
        const optionField = isElection ? 'candidate_id' : 'choice_id';
        const tallyTable = isElection ? 'election_offline_tally' : 'vote_offline_tally';
        await f.insert('agenda_item', {
          ...agendaData(agendaID, event.id),
          type: isElection ? 'election' : 'vote',
          creator_id: ctx.ownerID,
        });
        await f.insert(ballotTable, {
          id: ballotID,
          agenda_item_id: agendaID,
          title: 'Reviewed cast ballot',
          status: d.kind === 'start' ? 'pending' : phase,
          ballot_visibility:
            d.scenario === 'secret-indicative-duplicate' || secretManagerDecision
              ? 'secret'
              : 'named',
          visibility: 'public',
          electorate_snapshotted_at: new Date(),
          offline_electorate_size: 10,
          ...(isElection
            ? { election_mode: 'single', max_votes: 1, seat_count: 1 }
            : { purpose: 'closing' }),
        });
        await f.insert(
          isElection ? 'election_candidate' : 'vote_choice',
          isElection
            ? {
                id: optionID,
                election_id: ballotID,
                user_id: ctx.ownerID,
                name: 'Reviewed candidate',
                status: 'confirmed',
                order_index: 0,
              }
            : {
                id: optionID,
                vote_id: ballotID,
                label: 'Approve',
                semantic_key: 'yes',
                order_index: 0,
              }
        );
        await f.insert(electorTable, {
          id: electorID,
          [ballotField]: ballotID,
          user_id: ctx.ownerID,
          participation_channel: 'online',
        });
        await f.insert(electorTable, {
          id: mutationFixtureID(ctx.id, 'second-elector'),
          [ballotField]: ballotID,
          user_id: ctx.outsiderID,
          participation_channel: 'online',
        });
        const participation = {
          id: participationID,
          [ballotField]: ballotID,
          [electorField]: electorID,
          ...(phase === 'indicative' ? { user_id: ctx.ownerID } : {}),
        };
        const decision = {
          id: decisionID,
          [ballotField]: ballotID,
          [optionField]: optionID,
          [decisionField]: secretManagerDecision ? null : participationID,
        };
        if (d.kind.startsWith('decision')) await f.insert(participationTable, participation);
        if (
          ['same-id-replay', 'secret-indicative-duplicate', 'final-duplicate'].includes(d.scenario)
        ) {
          await f.insert(participationTable, participation);
          await f.insert(decisionTable, {
            ...decision,
            ...(d.scenario === 'secret-indicative-duplicate' ? { [decisionField]: null } : {}),
          });
        }
        await f.trackScope(participationTable, ballotField, ballotID);
        await f.trackScope(decisionTable, ballotField, ballotID);
        const baselineParticipation =
          await ctx.sql`select * from ${ctx.sql(participationTable)} where ${ctx.sql(ballotField)} = ${ballotID} order by id`;
        const baselineDecisions =
          await ctx.sql`select * from ${ctx.sql(decisionTable)} where ${ctx.sql(ballotField)} = ${ballotID} order by id`;
        const baselineBallot = await f.rows(ballotTable, ballotID);
        const baselineElectors =
          await ctx.sql`select * from ${ctx.sql(electorTable)} where ${ctx.sql(ballotField)} = ${ballotID} order by id`;
        if (d.kind === 'tally-delete')
          await f.insert(tallyTable, {
            id: tallyID,
            [ballotField]: ballotID,
            [optionField]: optionID,
            phase: 'indicative',
            count: 3,
            updated_by_id: ctx.ownerID,
          });
        else await f.track(tallyTable, tallyID);
        const baselineTally = await f.rows(tallyTable, tallyID);
        const originalPassword =
          actor === 'anonymous'
            ? undefined
            : await passwordFixture({ ...ctx, ownerID: ctx.actorID }, true);
        if (originalPassword)
          await ctx.sql`update voting_password set last_verified_at = ${new Date(Date.now() - (d.scenario === 'stale-pin' ? 86_400_000 : 0))} where user_id = ${ctx.actorID}`;
        const args =
          d.kind === 'start'
            ? { [ballotField]: ballotID, phase: 'indicative' }
            : d.kind === 'submit'
              ? {
                  [ballotField]: ballotID,
                  phase,
                  [isElection ? 'candidate_ids' : 'choice_ids']: [optionID],
                  idempotency_id: ['secret-indicative-duplicate', 'final-duplicate'].includes(
                    d.scenario
                  )
                    ? mutationFixtureID(ctx.id, 'duplicate-attempt')
                    : participationID,
                }
              : d.kind.startsWith('participation')
                ? participation
                : d.kind.startsWith('decision')
                  ? decision
                  : d.kind.startsWith('full')
                    ? { participation, [isElection ? 'selections' : 'decisions']: [decision] }
                    : d.kind === 'tally'
                      ? {
                          id: tallyID,
                          [ballotField]: ballotID,
                          [optionField]: optionID,
                          phase: 'indicative',
                          count: 3,
                        }
                      : d.kind === 'snapshot-create'
                        ? {
                            id: mutationFixtureID(ctx.id, 'forbidden-elector'),
                            [ballotField]: ballotID,
                            user_id: ctx.ownerID,
                          }
                        : { id: d.kind === 'snapshot-delete' ? electorID : tallyID };
        const before = (data: unknown) =>
          object(data)?.id === ballotID &&
          object(data)?.status === (d.kind === 'start' ? 'pending' : phase);
        return {
          args: args as ReadonlyJSONValue,
          observe: {
            request: isElection
              ? queries.elections.byId({ id: ballotID })
              : queries.votes.byId({ id: ballotID }),
            before,
            after: (data: unknown) => {
              if (actor !== 'owner' || internal || d.scenario) return before(data);
              const row = object(data);
              if (d.kind === 'start') return row?.status === 'indicative';
              if (d.kind === 'tally' || d.kind === 'tally-delete') {
                const tally = rows(row?.offline_tallies).find(r => r.id === tallyID);
                return d.kind === 'tally-delete'
                  ? !tally
                  : tally?.count === 3 && tally?.updated_by_id === ctx.ownerID;
              }
              if (d.kind.startsWith('participation'))
                return rows(row?.[`${phase}_participations`]).some(r => r.id === participationID);
              return rows(row?.[`${phase}_${isElection ? 'selections' : 'decisions'}`]).some(
                r => r[optionField] === optionID && r[decisionField] === participationID
              );
            },
          },
          verify: async () => {
            const participations =
              await ctx.sql`select * from ${ctx.sql(participationTable)} where ${ctx.sql(ballotField)} = ${ballotID} order by id`;
            const decisions =
              await ctx.sql`select * from ${ctx.sql(decisionTable)} where ${ctx.sql(ballotField)} = ${ballotID} order by id`;
            if (actor !== 'owner' || internal || d.scenario) {
              assert.deepEqual(participations, baselineParticipation);
              assert.deepEqual(decisions, baselineDecisions);
              assert.deepEqual(await f.rows(ballotTable, ballotID), baselineBallot);
              assert.deepEqual(await f.rows(tallyTable, tallyID), baselineTally);
              assert.deepEqual(
                await ctx.sql`select * from ${ctx.sql(electorTable)} where ${ctx.sql(ballotField)} = ${ballotID} order by id`,
                baselineElectors
              );
              return;
            }
            if (d.kind === 'start') {
              await f.expect(ballotTable, ballotID, { status: 'indicative' });
              return;
            }
            if (d.kind === 'tally') {
              await f.expect(tallyTable, tallyID, {
                count: 3,
                updated_by_id: ctx.ownerID,
                phase: 'indicative',
                [optionField]: optionID,
              });
              return;
            }
            if (d.kind === 'tally-delete') {
              await f.expect(tallyTable, tallyID, null);
              return;
            }
            assert.equal(participations.length, 1);
            assert.equal(participations[0].id, participationID);
            if (phase === 'indicative') assert.equal(participations[0].user_id, ctx.ownerID);
            else assert.equal(participations[0][electorField], electorID);
            if (d.kind.startsWith('participation')) {
              assert.equal(decisions.length, 0);
              return;
            }
            assert.equal(decisions.length, 1);
            assert.equal(decisions[0][optionField], optionID);
            assert.equal(decisions[0][decisionField], participationID);
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [event.id]);
            await f.restore();
            await originalPassword?.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await originalPassword?.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [event.id]);
          },
        };
      },
    }));
  });
}

function groupAccessCases(): MutationCase[] {
  const names = [
    'joinGroup',
    'inviteMember',
    'acceptInvitation',
    'updateMembership',
    'leaveGroup',
    'requestGuestAccess',
    'inviteGuest',
    'acceptGuestInvitation',
    'revokeGuestAccess',
    'addMembershipRole',
    'removeMembershipRole',
    'syncMembershipRoles',
    'addGuestRole',
    'removeGuestRole',
    'syncGuestRoles',
    'addOfflineMembershipRole',
    'removeOfflineMembershipRole',
    'syncOfflineMembershipRoles',
  ];
  return names.flatMap(name =>
    (name === 'joinGroup' || name === 'requestGuestAccess'
      ? ['owner', 'anonymous']
      : ['owner', 'outsider', 'anonymous']
    ).map(actor => ({
      name: `groups.${name}`,
      variant: actor === 'owner' ? 'authorized-access-transition' : 'permission-denied',
      actor,
      outcome:
        actor === 'owner'
          ? ('success' as const)
          : [
                'joinGroup',
                'acceptGuestInvitation',
                'acceptInvitation',
                'syncMembershipRoles',
                'addOfflineMembershipRole',
                'addGuestRole',
                'removeGuestRole',
                'syncGuestRoles',
                'inviteGuest',
                'updateMembership',
                'syncOfflineMembershipRoles',
                'addMembershipRole',
                'removeMembershipRole',
                'revokeGuestAccess',
                'removeOfflineMembershipRole',
              ].includes(name)
            ? ('client-error' as const)
            : ('server-error' as const),
      ...(actor !== 'owner'
        ? {
            error: [
              'joinGroup',
              'acceptGuestInvitation',
              'acceptInvitation',
              'syncMembershipRoles',
              'addOfflineMembershipRole',
              'addGuestRole',
              'removeGuestRole',
              'syncGuestRoles',
              'inviteGuest',
              'updateMembership',
              'syncOfflineMembershipRoles',
              'addMembershipRole',
              'removeMembershipRole',
              'revokeGuestAccess',
              'removeOfflineMembershipRole',
            ].includes(name)
              ? 'mutation_server_failed'
              : 'permission_denied',
          }
        : {}),
      observer: {
        query:
          name === 'inviteMember'
            ? 'groups.byIdFull'
            : name.includes('Offline')
              ? 'groups.offlineMembershipsWithRolesAndRights'
              : name.includes('Guest')
                ? 'groups.guestAccessById'
                : 'groups.membershipById',
      },
      specification: {
        fixture:
          'Isolated caller-owned base group, direct membership or guest access, correctly scoped member/guest roles; offline roster independently inserted',
        transition: name,
        oracle:
          'Exact user/scope/status and role-set business predicates; denial preserves complete parent and relation baseline',
        restoration:
          'User snapshots restored in place, generated role-link/conversation scopes removed, polymorphic notifications deleted, independent absence proof',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const groupID = await groupAdminFixture(f, ctx);
        await f.track('user', ctx.ownerID);
        await f.trackScope('conversation', 'group_id', groupID);
        const isOffline = name.includes('Offline');
        const isGuest = name.includes('Guest');
        const isRole = /Role/.test(name);
        const isCreate = [
          'joinGroup',
          'inviteMember',
          'requestGuestAccess',
          'inviteGuest',
        ].includes(name);
        const isDelete = name === 'leaveGroup';
        const isRemoveRole = name.startsWith('remove');
        const parentTable = isOffline
          ? 'group_offline_membership'
          : isGuest
            ? 'group_guest_access'
            : 'group_membership';
        const linkTable = isOffline
          ? 'group_offline_membership_role'
          : isGuest
            ? 'group_guest_role'
            : 'group_membership_role';
        const parentField = isOffline
          ? 'group_offline_membership_id'
          : isGuest
            ? 'group_guest_access_id'
            : 'group_membership_id';
        const parentID = mutationFixtureID(ctx.id, 'group-access');
        const roleID = mutationFixtureID(ctx.id, 'access-role');
        const oldRoleID = mutationFixtureID(ctx.id, 'old-access-role');
        const role = {
          name: 'Reviewed access role',
          scope: 'group',
          group_id: groupID,
          assignee_kind: isGuest ? 'guest' : 'member',
        };
        await f.insert('role', { id: roleID, ...role });
        await f.insert('role', { id: oldRoleID, ...role });
        if (name === 'requestGuestAccess')
          await f.update('group', {
            id: groupID,
            group_type: 'sibling',
            primary_sibling_membership_mode: 'all_members',
          });
        let offlineMemberID: string | undefined;
        if (isOffline) {
          offlineMemberID = mutationFixtureID(ctx.id, 'offline-access-person');
          await f.insert('group_offline_member', {
            id: offlineMemberID,
            group_id: groupID,
            first_name: 'Reviewed',
            last_name: 'Person',
            created_by_id: ctx.ownerID,
          });
        }
        const initialStatus =
          name === 'acceptInvitation' || name === 'acceptGuestInvitation' ? 'invited' : 'active';
        const parent = {
          id: parentID,
          group_id: groupID,
          status: initialStatus,
          ...(isOffline
            ? { group_offline_member_id: offlineMemberID, source: 'direct', visibility: 'public' }
            : isGuest
              ? { user_id: ctx.ownerID }
              : { user_id: ctx.ownerID, source: 'direct', visibility: 'public' }),
        };
        if (isCreate) await f.track(parentTable, parentID);
        else await f.insert(parentTable, parent);
        if (isRemoveRole || name.startsWith('sync'))
          await f.insert(linkTable, {
            id: mutationFixtureID(ctx.id, 'old-role-link'),
            [parentField]: parentID,
            role_id: isRemoveRole ? roleID : oldRoleID,
            assigned_by_id: ctx.ownerID,
          });
        await f.trackScope(linkTable, parentField, parentID);
        const baseline = await f.rows(parentTable, parentID);
        const baselineLinks =
          await ctx.sql`select * from ${ctx.sql(linkTable)} where ${ctx.sql(parentField)} = ${parentID} order by id`;
        const args = isCreate
          ? isGuest
            ? {
                id: parentID,
                group_id: groupID,
                user_id: ctx.ownerID,
                status: 'invited',
                ...(name === 'requestGuestAccess' && actor === 'anonymous'
                  ? {}
                  : { role_ids: [roleID] }),
              }
            : {
                id: parentID,
                group_id: groupID,
                user_id: ctx.ownerID,
                status: name === 'joinGroup' ? 'requested' : 'invited',
                visibility: 'public',
                ...((name === 'inviteMember' && actor !== 'owner') ||
                (name === 'joinGroup' && actor === 'anonymous')
                  ? {}
                  : { initial_role_id: roleID }),
              }
          : isRole
            ? name.startsWith('sync')
              ? { [parentField]: parentID, role_ids: [roleID] }
              : { [parentField]: parentID, role_id: roleID }
            : name === 'updateMembership'
              ? { id: parentID, visibility: 'private' }
              : { id: parentID };
        const status =
          name === 'joinGroup' || name === 'requestGuestAccess'
            ? 'requested'
            : name === 'inviteMember' || name === 'inviteGuest'
              ? 'invited'
              : name === 'revokeGuestAccess'
                ? 'revoked'
                : 'active';
        const query =
          name === 'inviteMember'
            ? queries.groups.byIdFull({ id: groupID })
            : isOffline
              ? queries.groups.offlineMembershipsWithRolesAndRights({ groupId: groupID })
              : isGuest
                ? queries.groups.guestAccessById({ id: parentID })
                : queries.groups.membershipById({ id: parentID });
        const project = (data: unknown) =>
          name === 'inviteMember'
            ? rows(rows(data).find(row => row.id === groupID)?.memberships).find(
                row => row.id === parentID
              )
            : isOffline
              ? rows(data).find(row => row.id === parentID)
              : object(data);
        const before = (data: unknown) =>
          isCreate
            ? !project(data)
            : project(data)?.id === parentID && project(data)?.status === initialStatus;
        return {
          args: args as ReadonlyJSONValue,
          ...(name === 'requestGuestAccess' ||
          (name === 'inviteGuest' && (actor === 'owner' || 'delegatedWriterID' in ctx)) ||
          (name === 'joinGroup' && actor === 'owner') ||
          (isRole &&
            (name.startsWith('add') || name.startsWith('sync')) &&
            (actor === 'owner' || 'delegatedWriterID' in ctx))
            ? {
                writerPreloads:
                  actor === 'owner' || 'delegatedWriterID' in ctx
                    ? [
                        {
                          request: queries.groups.byIdFull({ id: groupID }),
                          before: (data: unknown) =>
                            rows(data).some(
                              row =>
                                row.id === groupID &&
                                rows(row.roles).some(role => role.id === roleID)
                            ),
                        },
                      ]
                    : [
                        {
                          request: queries.groups.byId({ id: groupID }),
                          before: (data: unknown) => object(data)?.id === groupID,
                        },
                      ],
              }
            : {}),
          observe: {
            request: query,
            before,
            after: (data: unknown) => {
              if (actor !== 'owner') return before(data);
              const row = project(data);
              if (isDelete) return !row;
              if (!row || row.id !== parentID) return false;
              if (name === 'updateMembership') return row.visibility === 'private';
              if (isRole || isCreate) {
                const roleIDs = rows(row[isGuest ? 'guest_roles' : 'membership_roles']).map(
                  link => link.role_id
                );
                return isRemoveRole
                  ? !roleIDs.includes(roleID)
                  : roleIDs.length === 1 &&
                      roleIDs[0] === roleID &&
                      (isRole || row.status === status);
              }
              return row.status === status;
            },
          },
          verify: async () => {
            const links =
              await ctx.sql`select * from ${ctx.sql(linkTable)} where ${ctx.sql(parentField)} = ${parentID} order by id`;
            if (actor !== 'owner') {
              assert.deepEqual(await f.rows(parentTable, parentID), baseline);
              assert.deepEqual(links, baselineLinks);
              return;
            }
            if (isDelete) {
              await f.expect(parentTable, parentID, null);
              assert.equal(links.length, 0);
              return;
            }
            await f.expect(parentTable, parentID, {
              group_id: groupID,
              ...(isRole
                ? {}
                : name === 'updateMembership'
                  ? { visibility: 'private' }
                  : { status }),
              ...(isOffline
                ? { group_offline_member_id: offlineMemberID }
                : { user_id: ctx.ownerID }),
            });
            if (isRole || isCreate) {
              assert.deepEqual(
                Array.from(links, row => row.role_id).sort(),
                isRemoveRole ? [] : [roleID]
              );
            }
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [groupID]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [groupID]);
          },
        };
      },
    }))
  );
}

function rosterCases(): MutationCase[] {
  return ['groups', 'events'].flatMap(domain =>
    ['create', 'update', 'delete', 'import'].flatMap(operation =>
      ['owner', 'outsider', 'anonymous'].map(actor => {
        const isGroup = domain === 'groups';
        const name = `${operation}Offline${isGroup ? (operation === 'import' ? 'Members' : 'Member') : operation === 'import' ? 'Participants' : 'Participant'}`;
        return {
          name: `${domain}.${name}`,
          variant:
            actor === 'owner'
              ? operation === 'import'
                ? 'normalized-deduplicated-import'
                : 'authorized-roster-transition'
              : 'permission-denied',
          actor,
          outcome:
            actor === 'owner'
              ? ('success' as const)
              : operation === 'update' || operation === 'delete'
                ? ('client-error' as const)
                : ('server-error' as const),
          ...(actor !== 'owner'
            ? {
                error:
                  operation === 'update' || operation === 'delete'
                    ? 'mutation_server_failed'
                    : 'permission_denied',
              }
            : {}),
          observer: {
            query: isGroup ? 'groups.offlineMembersByGroup' : 'events.offlineParticipants',
          },
          specification: {
            fixture:
              'Caller-owned base group or scoped event manager, unconnected manually managed offline person',
            transition: operation,
            oracle:
              'Trimmed names/reason; import suppresses duplicate normalized name/reason; group creates direct offline membership; rejected actor preserves exact scoped roster',
            restoration:
              'Whole generated roster and offline membership scopes tracked before request; isolated parent and notifications removed with independent absence proof',
          },
          prepare: async (ctx: MutationCaseContext) => {
            const f = new MutationFixtures(ctx.sql);
            const scopeID = isGroup
              ? await groupAdminFixture(f, ctx)
              : (await eventAdminFixture(f, ctx)).id;
            if (!isGroup) await f.update('event', { id: scopeID, attendance_mode: 'hybrid' });
            const id = mutationFixtureID(ctx.id, 'roster-person');
            const table = isGroup ? 'group_offline_member' : 'event_offline_participant';
            const scopeField = isGroup ? 'group_id' : 'event_id';
            const fields = {
              id,
              [scopeField]: scopeID,
              first_name: 'Reviewed',
              last_name: 'Person',
              reason_not_signed_up: 'No account',
              connected_user_id: null,
              ...(isGroup
                ? { created_by_id: ctx.ownerID }
                : {
                    source_type: 'event_extra',
                    group_offline_member_id: null,
                    attendance_status: 'listed',
                    participation_channel: 'offline',
                  }),
            };
            if (operation === 'update' || operation === 'delete') await f.insert(table, fields);
            else await f.track(table, id);
            await f.trackScope(table, scopeField, scopeID);
            if (isGroup) await f.trackScope('group_offline_membership', 'group_id', scopeID);
            const baseline =
              await ctx.sql`select * from ${ctx.sql(table)} where ${ctx.sql(scopeField)} = ${scopeID} order by id`;
            const args =
              operation === 'create'
                ? {
                    ...fields,
                    first_name: ' Reviewed ',
                    last_name: ' Person ',
                    reason_not_signed_up: ' No account ',
                  }
                : operation === 'delete'
                  ? { id }
                  : operation === 'update'
                    ? { id, first_name: ' Updated ', reason_not_signed_up: '  ' }
                    : {
                        [scopeField]: scopeID,
                        entries: [
                          {
                            first_name: ' Reviewed ',
                            last_name: ' Person ',
                            reason_not_signed_up: ' No account ',
                          },
                          {
                            first_name: 'reviewed',
                            last_name: 'person',
                            reason_not_signed_up: 'no account',
                          },
                          { first_name: 'Second', last_name: 'Person', reason_not_signed_up: null },
                        ],
                      };
            const before = (data: unknown) =>
              rows(data).length === baseline.length &&
              (baseline.length === 0 ||
                rows(data).some(row => row.id === id && row.first_name === 'Reviewed'));
            return {
              args: args as ReadonlyJSONValue,
              ...(isGroup && (operation === 'create' || operation === 'import')
                ? {
                    writerPreloads: [
                      {
                        request: queries.groups.byId({ id: scopeID }),
                        before: (data: unknown) =>
                          object(data)?.id === scopeID && object(data)?.group_type === 'base',
                      },
                    ],
                  }
                : !isGroup
                  ? {
                      writerPreloads: [
                        {
                          request: queries.events.byId({ id: scopeID }),
                          before: (data: unknown) =>
                            object(data)?.id === scopeID &&
                            object(data)?.attendance_mode === 'hybrid',
                        },
                      ],
                    }
                  : {}),
              observe: {
                request: isGroup
                  ? queries.groups.offlineMembersByGroup({ groupId: scopeID })
                  : queries.events.offlineParticipants({ eventId: scopeID }),
                before,
                after: (data: unknown) => {
                  if (actor !== 'owner') return before(data);
                  const records = rows(data);
                  if (operation === 'delete') return records.length === 0;
                  if (operation === 'import')
                    return (
                      records.length === 2 &&
                      records.some(row => row.first_name === 'Reviewed') &&
                      records.some(row => row.first_name === 'Second')
                    );
                  return records.some(
                    row =>
                      row.id === id &&
                      row.first_name === (operation === 'update' ? 'Updated' : 'Reviewed') &&
                      row.reason_not_signed_up === (operation === 'update' ? null : 'No account')
                  );
                },
              },
              verify: async () => {
                const records =
                  await ctx.sql`select * from ${ctx.sql(table)} where ${ctx.sql(scopeField)} = ${scopeID} order by id`;
                if (actor !== 'owner') {
                  assert.deepEqual(records, baseline);
                  return;
                }
                if (operation === 'delete') {
                  assert.equal(records.length, 0);
                  return;
                }
                if (operation === 'import') {
                  assert.equal(records.length, 2);
                  assert.deepEqual(Array.from(records, row => row.first_name).sort(), [
                    'Reviewed',
                    'Second',
                  ]);
                } else
                  await f.expect(table, id, {
                    first_name: operation === 'update' ? 'Updated' : 'Reviewed',
                    last_name: 'Person',
                    reason_not_signed_up: operation === 'update' ? null : 'No account',
                    connected_user_id: null,
                  });
                if (isGroup && (operation === 'create' || operation === 'import')) {
                  const memberships =
                    await ctx.sql`select * from group_offline_membership where group_id = ${scopeID}`;
                  assert.equal(memberships.length, records.length);
                  for (const row of memberships) {
                    assert.equal(row.source, 'direct');
                    assert.equal(row.status, 'active');
                    assert.ok(records.some(person => person.id === row.group_offline_member_id));
                  }
                }
              },
              restore: async () => {
                await cleanupGovernanceNotifications(ctx, [scopeID]);
                await f.restore();
              },
              verifyRestored: async () => {
                await f.verifyRestored();
                await verifyGovernanceNotificationsRestored(ctx, [scopeID]);
              },
            };
          },
        };
      })
    )
  );
}

function eventParticipationCases(): MutationCase[] {
  const names = [
    'joinEvent',
    'inviteParticipant',
    'leaveEvent',
    'updateParticipant',
    'addParticipantRole',
    'removeParticipantRole',
    'syncParticipantRoles',
    'bookMeeting',
    'cancelMeetingBooking',
    'finalizeDelegates',
  ];
  return names.flatMap(name =>
    (['joinEvent', 'bookMeeting', 'cancelMeetingBooking'].includes(name)
      ? ['outsider', 'anonymous']
      : ['owner', 'outsider', 'anonymous']
    ).map(actor => {
      const selfService = ['joinEvent', 'bookMeeting', 'cancelMeetingBooking'].includes(name);
      const success = actor === (selfService ? 'outsider' : 'owner');
      return {
        name: `events.${name}`,
        variant: success ? 'authorized-participation-transition' : 'actor-denied',
        actor,
        outcome: success
          ? ('success' as const)
          : actor === 'anonymous' &&
              ['addParticipantRole', 'removeParticipantRole', 'syncParticipantRoles'].includes(name)
            ? ('client-error' as const)
            : ('server-error' as const),
        ...(!success
          ? {
              error:
                name === 'joinEvent' ||
                (actor === 'anonymous' &&
                  ['addParticipantRole', 'removeParticipantRole', 'syncParticipantRoles'].includes(
                    name
                  ))
                  ? 'mutation_server_failed'
                  : 'permission_denied',
            }
          : {}),
        observer: {
          query: name === 'finalizeDelegates' ? 'events.byId' : 'events.allParticipantsByEvent',
        },
        specification: {
          fixture:
            'Fresh public online event, active owner manager participant; managed outsider role assignment or self booking/join',
          transition: name,
          oracle:
            'Exact user/event/status and participant role set, self booking occurrence or finalized delegate timestamp; rejected actor no-write predicate',
          restoration:
            'Tracked generated participants/conversations and user state; fresh event/roles/notifications fully removed and proven absent',
        },
        prepare: async (ctx: MutationCaseContext) => {
          const f = new MutationFixtures(ctx.sql);
          const event = await eventAdminFixture(f, ctx);
          await f.track('user', ctx.ownerID);
          await f.track('user', ctx.outsiderID);
          await f.trackScope('conversation', 'event_id', event.id);
          const id = mutationFixtureID(ctx.id, 'managed-participant');
          const roleID = mutationFixtureID(ctx.id, 'participant-role');
          const oldRoleID = mutationFixtureID(ctx.id, 'previous-participant-role');
          const isRole = name.includes('ParticipantRole');
          const isCreate = ['joinEvent', 'inviteParticipant', 'bookMeeting'].includes(name);
          const isDelete = ['leaveEvent', 'cancelMeetingBooking'].includes(name);
          const targetUserID =
            selfService || name === 'inviteParticipant' || isRole ? ctx.outsiderID : ctx.ownerID;
          const instanceDate =
            name === 'bookMeeting' || name === 'cancelMeetingBooking' ? 1_900_000_000_000 : null;
          if (name === 'bookMeeting' || name === 'cancelMeetingBooking')
            await f.update('event', { id: event.id, is_bookable: true, max_bookings: 2 });
          if (!isCreate && name !== 'finalizeDelegates') {
            // Self-owned operations reuse the real manager participant rather than duplicate event/user identity.
            if (targetUserID === ctx.ownerID) {
              await f.update('event_participant', {
                id: event.participantID,
                visibility: 'public',
              });
            } else
              await f.insert('event_participant', {
                id,
                event_id: event.id,
                user_id: targetUserID,
                status: 'active',
                visibility: 'public',
                instance_date: instanceDate === null ? null : new Date(instanceDate),
              });
          }
          const existingInviteRecipient =
            name === 'inviteParticipant' && targetUserID === ctx.ownerID;
          const subjectID =
            targetUserID === ctx.ownerID && (!isCreate || existingInviteRecipient)
              ? event.participantID
              : id;
          if (isRole || name === 'inviteParticipant' || name === 'joinEvent') {
            await f.insert('role', {
              id: roleID,
              scope: 'event',
              event_id: event.id,
              name: 'Participant',
              assignee_kind: 'member',
            });
            await f.insert('role', {
              id: oldRoleID,
              scope: 'event',
              event_id: event.id,
              name: 'Previous participant role',
              assignee_kind: 'member',
            });
            if (name === 'removeParticipantRole' || name === 'syncParticipantRoles')
              await f.insert('event_participant_role', {
                id: mutationFixtureID(ctx.id, 'previous-participant-role-link'),
                event_participant_id: subjectID,
                role_id: name === 'removeParticipantRole' ? roleID : oldRoleID,
                assigned_by_id: ctx.ownerID,
              });
          }
          await f.trackScope('event_participant', 'event_id', event.id);
          await f.trackScope('event_participant_role', 'event_participant_id', subjectID);
          const baseline =
            await ctx.sql`select * from event_participant where event_id = ${event.id} order by id`;
          const baselineLinks =
            await ctx.sql`select * from event_participant_role where event_participant_id = ${subjectID} order by id`;
          const baselineEvent = await f.rows('event', event.id);
          const args =
            name === 'finalizeDelegates'
              ? { eventId: event.id }
              : name === 'bookMeeting' || name === 'cancelMeetingBooking'
                ? { event_id: event.id, instance_date: instanceDate }
                : isCreate
                  ? {
                      id: subjectID,
                      event_id: event.id,
                      user_id: targetUserID,
                      group_id: null,
                      status: name === 'joinEvent' ? 'requested' : 'invited',
                      visibility: 'public',
                      initial_role_id: roleID,
                    }
                  : isRole
                    ? name === 'syncParticipantRoles'
                      ? { event_participant_id: subjectID, role_ids: [roleID] }
                      : { event_participant_id: subjectID, role_id: roleID }
                    : name === 'updateParticipant'
                      ? { id: subjectID, visibility: 'private' }
                      : { id: subjectID };
          const target = (data: unknown) =>
            rows(data).find(
              row =>
                row.user_id === targetUserID &&
                (instanceDate === null
                  ? row.instance_date == null
                  : row.instance_date === instanceDate)
            );
          const before = (data: unknown) =>
            name === 'finalizeDelegates'
              ? object(data)?.delegate_distribution_status !== 'finalized'
              : existingInviteRecipient
                ? target(data)?.id === event.participantID && target(data)?.status === 'active'
                : isCreate
                  ? !target(data)
                  : target(data)?.id === subjectID;
          const started = Date.now();
          return {
            args: args as ReadonlyJSONValue,
            ...((isRole || name === 'inviteParticipant' || name === 'joinEvent') &&
            (actor === 'owner' || 'delegatedWriterID' in ctx)
              ? {
                  writerPreloads: [
                    {
                      request: queries.events.roles({ eventId: event.id }),
                      before: (data: unknown) => rows(data).some(row => row.id === roleID),
                    },
                  ],
                }
              : {}),
            observe: {
              request:
                name === 'finalizeDelegates'
                  ? queries.events.byId({ id: event.id })
                  : queries.events.allParticipantsByEvent({ eventId: event.id }),
              before,
              after: (data: unknown) => {
                if (!success) return before(data);
                if (name === 'finalizeDelegates')
                  return object(data)?.delegate_distribution_status === 'finalized';
                const row = target(data);
                if (isDelete) return !row;
                if (!row) return false;
                if (isRole) {
                  const roleIDs = rows(row.participant_roles).map(link => link.role_id);
                  return name === 'removeParticipantRole'
                    ? roleIDs.length === 0
                    : roleIDs.length === 1 && roleIDs[0] === roleID;
                }
                return name === 'updateParticipant'
                  ? row.visibility === 'private'
                  : row.status ===
                      (name === 'joinEvent'
                        ? 'requested'
                        : name === 'inviteParticipant'
                          ? 'invited'
                          : 'active');
              },
            },
            verify: async () => {
              if (!success) {
                assert.deepEqual(
                  await ctx.sql`select * from event_participant where event_id = ${event.id} order by id`,
                  baseline
                );
                assert.deepEqual(
                  await ctx.sql`select * from event_participant_role where event_participant_id = ${subjectID} order by id`,
                  baselineLinks
                );
                assert.deepEqual(await f.rows('event', event.id), baselineEvent);
                return;
              }
              if (name === 'finalizeDelegates') {
                const [record] = await f.rows('event', event.id);
                assert.equal(record.delegate_distribution_status, 'finalized');
                assert.ok(new Date(record.delegate_finalized_at as string).getTime() >= started);
                return;
              }
              const records =
                await ctx.sql`select * from event_participant where event_id = ${event.id} and user_id = ${targetUserID}`;
              if (isDelete) {
                assert.equal(records.length, 0);
                return;
              }
              assert.equal(records.length, 1);
              assert.equal(
                records[0].visibility,
                name === 'updateParticipant' ? 'private' : 'public'
              );
              if (isRole) {
                const links =
                  await ctx.sql`select role_id from event_participant_role where event_participant_id = ${subjectID}`;
                assert.deepEqual(
                  links.map(row => row.role_id),
                  name === 'removeParticipantRole' ? [] : [roleID]
                );
              } else
                assert.equal(
                  records[0].status,
                  name === 'joinEvent'
                    ? 'requested'
                    : name === 'inviteParticipant'
                      ? 'invited'
                      : 'active'
                );
            },
            restore: async () => {
              await cleanupGovernanceNotifications(ctx, [event.id]);
              await f.restore();
            },
            verifyRestored: async () => {
              await f.verifyRestored();
              await verifyGovernanceNotificationsRestored(ctx, [event.id]);
            },
          };
        },
      };
    })
  );
}

function eventExceptionCases(): MutationCase[] {
  return ['createException', 'updateException', 'deleteException'].flatMap(name =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: `events.${name}`,
      variant: actor === 'owner' ? 'authorized-occurrence-change' : 'permission-denied',
      actor,
      outcome: actor === 'owner' ? ('success' as const) : ('server-error' as const),
      ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
      observer: { query: 'events.exceptionsByEvent' },
      specification: {
        fixture:
          'Isolated event with owner update right and one independent occurrence exception for update/delete',
        oracle:
          'Exception retains parent event and occurrence; exact new title/action fields or row deletion; rejected actor complete baseline preserved',
        restoration:
          'Fresh parent and exception/activity/notification effects removed with independent absence proof',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const event = await eventAdminFixture(f, ctx);
        const id = mutationFixtureID(ctx.id, 'event-exception');
        const fields = {
          id,
          parent_event_id: event.id,
          original_date: 1_900_000_000_000,
          action: 'modify',
          new_title: 'Reviewed occurrence title',
          new_description: null,
          new_start_date: null,
          new_end_date: null,
          new_location_name: null,
          new_country: null,
          new_region: null,
          new_post_code: null,
          new_city: null,
          new_street: null,
          new_house_number: null,
        };
        if (name === 'createException') await f.track('event_exception', id);
        else
          await f.insert('event_exception', {
            ...fields,
            original_date: new Date(fields.original_date),
          });
        const baseline = await f.rows('event_exception', id);
        const expected =
          name === 'deleteException'
            ? null
            : {
                parent_event_id: event.id,
                action: 'modify',
                new_title:
                  name === 'updateException' ? 'Updated occurrence title' : fields.new_title,
              };
        const before = (data: unknown) =>
          name === 'createException'
            ? rows(data).length === 0
            : rows(data).some(row => row.id === id && row.new_title === fields.new_title);
        return {
          args:
            name === 'createException'
              ? fields
              : name === 'deleteException'
                ? { id }
                : { id, new_title: 'Updated occurrence title' },
          observe: {
            request: queries.events.exceptionsByEvent({ eventId: event.id }),
            before,
            after: (data: unknown) =>
              actor !== 'owner'
                ? before(data)
                : name === 'deleteException'
                  ? rows(data).length === 0
                  : rows(data).some(row => row.id === id && row.new_title === expected?.new_title),
          },
          verify: async () => {
            if (actor === 'owner') await f.expect('event_exception', id, expected);
            else assert.deepEqual(await f.rows('event_exception', id), baseline);
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [event.id]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [event.id]);
          },
        };
      },
    }))
  );
}

function agendaVoteFlowCases(): MutationCase[] {
  return [
    'initializeChangeRequestVoting',
    'ensureEventSuggestionChangeRequestVotes',
    'processCRVoteResult',
  ].flatMap(name =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: `agendas.${name}`,
      variant:
        actor === 'owner'
          ? name === 'processCRVoteResult'
            ? 'tie-blocks-timeline'
            : 'materialize-voting-timeline'
          : 'permission-denied',
      actor,
      outcome: actor === 'owner' ? ('success' as const) : ('server-error' as const),
      ...(actor !== 'owner' ? { error: 'permission_denied' } : {}),
      observer: { query: 'agendas.changeRequestTimeline' },
      specification: {
        fixture:
          'Fresh event vote manager, author-owned amendment and related agenda; ensure has one open CR; process has one active CR timeline entry',
        transition: name,
        oracle:
          'Initialize creates one closing vote/link; ensure creates one CR vote/link with yes/no/abstain choices; process tie writes blocked_tie/result tie without resolving CR',
        restoration:
          'Whole generated vote and timeline scopes tracked before subject; fresh amendment/event/agenda and notifications removed with independent SQL proof',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const event = await eventAdminFixture(f, ctx);
        const amendmentID = mutationFixtureID(ctx.id, 'agenda-flow-amendment');
        const agendaID = mutationFixtureID(ctx.id, 'agenda-flow-item');
        const changeRequestID = mutationFixtureID(ctx.id, 'agenda-flow-cr');
        const linkID = mutationFixtureID(ctx.id, 'agenda-flow-link');
        await f.insert('amendment', {
          id: amendmentID,
          created_by_id: ctx.ownerID,
          title: 'Reviewed flow amendment',
          visibility: 'public',
        });
        await f.insert('agenda_item', {
          ...agendaData(agendaID, event.id),
          amendment_id: amendmentID,
          creator_id: ctx.ownerID,
          type: 'amendment',
        });
        if (name !== 'initializeChangeRequestVoting')
          await f.insert('change_request', {
            id: changeRequestID,
            amendment_id: amendmentID,
            user_id: ctx.ownerID,
            title: 'Reviewed event suggestion',
            status: 'open',
            created_in_mode: 'suggest_event',
          });
        if (name === 'processCRVoteResult')
          await f.insert('agenda_item_change_request', {
            id: linkID,
            agenda_item_id: agendaID,
            change_request_id: changeRequestID,
            order_index: 0,
            is_closing_vote: false,
            status: 'voting',
          });
        await f.trackScope('vote', 'agenda_item_id', agendaID);
        await f.trackScope('agenda_item_change_request', 'agenda_item_id', agendaID);
        const baselineLinks =
          await ctx.sql`select * from agenda_item_change_request where agenda_item_id = ${agendaID} order by id`;
        const baselineVotes =
          await ctx.sql`select * from vote where agenda_item_id = ${agendaID} order by id`;
        const args =
          name === 'processCRVoteResult'
            ? { agenda_item_change_request_id: linkID, vote_result: 'tie' }
            : {
                amendment_id: amendmentID,
                agenda_item_id: agendaID,
                ...(name === 'initializeChangeRequestVoting' ? { voting_context: 'event' } : {}),
              };
        const before = (data: unknown) =>
          name === 'processCRVoteResult'
            ? rows(data).some(row => row.id === linkID && row.status === 'voting')
            : rows(data).length === 0;
        return {
          args: args as ReadonlyJSONValue,
          observe: {
            request: queries.agendas.changeRequestTimeline({ agenda_item_id: agendaID }),
            before,
            after: (data: unknown) =>
              actor !== 'owner'
                ? before(data)
                : name === 'processCRVoteResult'
                  ? rows(data).some(
                      row =>
                        row.id === linkID &&
                        row.status === 'blocked_tie' &&
                        row.result_status === 'tie'
                    )
                  : rows(data).length === 1 &&
                    rows(data).every(
                      row =>
                        row.vote_id &&
                        (name === 'initializeChangeRequestVoting'
                          ? row.is_closing_vote === true
                          : row.change_request_id === changeRequestID)
                    ),
          },
          verify: async () => {
            const links =
              await ctx.sql`select * from agenda_item_change_request where agenda_item_id = ${agendaID} order by id`;
            const votes =
              await ctx.sql`select * from vote where agenda_item_id = ${agendaID} order by id`;
            if (actor !== 'owner') {
              assert.deepEqual(links, baselineLinks);
              assert.deepEqual(votes, baselineVotes);
              return;
            }
            if (name === 'processCRVoteResult') {
              await f.expect('agenda_item_change_request', linkID, {
                status: 'blocked_tie',
                blocked_reason: 'tie',
                result_status: 'tie',
              });
              await f.expect('change_request', changeRequestID, { status: 'open' });
              return;
            }
            assert.equal(links.length, 1);
            assert.equal(votes.length, 1);
            assert.equal(links[0].vote_id, votes[0].id);
            assert.equal(votes[0].amendment_id, amendmentID);
            assert.equal(votes[0].status, 'indicative');
            assert.equal(
              votes[0].purpose,
              name === 'initializeChangeRequestVoting' ? 'closing' : 'change_request'
            );
            assert.equal(links[0].is_closing_vote, name === 'initializeChangeRequestVoting');
            assert.equal(
              links[0].status,
              name === 'initializeChangeRequestVoting' ? 'pending' : 'voting'
            );
            if (name === 'ensureEventSuggestionChangeRequestVotes')
              assert.equal(links[0].change_request_id, changeRequestID);
            const choices =
              await ctx.sql`select semantic_key from vote_choice where vote_id = ${votes[0].id} order by order_index`;
            assert.deepEqual(
              choices.map(row => row.semantic_key),
              ['yes', 'no', 'abstain']
            );
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [event.id, amendmentID]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [event.id, amendmentID]);
          },
        };
      },
    }))
  );
}

function expiredVoteCases(): MutationCase[] {
  return [true, false].flatMap(expired =>
    ['owner', 'outsider', 'anonymous'].map(actor => ({
      name: 'votes.closeExpiredFinalVotesForEvent',
      actor,
      variant: expired ? 'close-expired-final-vote' : 'future-final-vote-unchanged',
      outcome: 'success',
      observer: { query: 'votes.byId' },
      specification: {
        authorization:
          'Public polling trigger has no actor authority gate; server derives closing from actual final-phase deadline',
        fixture:
          'Fresh event/agenda with named final vote and explicit past or future closing deadline',
        oracle: expired
          ? 'Closed status/time_elapsed reason and server close timestamp; no remaining open phase'
          : 'Exact unchanged SQL final-vote baseline',
        restoration:
          'Fresh ballot/agenda/event and notification scopes removed with independent SQL proof',
      },
      prepare: async (ctx: MutationCaseContext) => {
        const f = new MutationFixtures(ctx.sql);
        const event = await eventAdminFixture(f, ctx);
        const agendaID = mutationFixtureID(ctx.id, 'expired-vote-agenda');
        const voteID = mutationFixtureID(ctx.id, 'expired-vote');
        await f.insert('agenda_item', {
          ...agendaData(agendaID, event.id),
          creator_id: ctx.ownerID,
        });
        await f.insert('vote', {
          id: voteID,
          agenda_item_id: agendaID,
          title: 'Reviewed timed vote',
          status: 'final',
          purpose: 'change_request',
          ballot_visibility: 'named',
          closing_end_time: new Date(Date.now() + (expired ? -60_000 : 3_600_000)),
        });
        const baseline = await f.rows('vote', voteID);
        const started = Date.now();
        return {
          args: { event_id: event.id },
          observe: {
            request: queries.votes.byId({ id: voteID }),
            before: (data: unknown) => object(data)?.status === 'final',
            after: (data: unknown) => object(data)?.status === (expired ? 'closed' : 'final'),
          },
          verify: async () => {
            if (!expired) {
              assert.deepEqual(await f.rows('vote', voteID), baseline);
              return;
            }
            await f.expect('vote', voteID, {
              status: 'closed',
              closed_reason: 'time_elapsed',
              closed_by_id: null,
            });
            const [record] = await f.rows('vote', voteID);
            assert.ok(new Date(record.closed_at as string).getTime() >= started);
          },
          restore: async () => {
            await cleanupGovernanceNotifications(ctx, [event.id]);
            await f.restore();
          },
          verifyRestored: async () => {
            await f.verifyRestored();
            await verifyGovernanceNotificationsRestored(ctx, [event.id]);
          },
        };
      },
    }))
  );
}

export function governanceMutationCases(): MutationCase[] {
  const base = [
    ...passwordCases(),
    ...agendaCases(),
    ...accreditationCases(),
    ...scopeManagementCases(),
    ...scopeCreationCases(),
    ...ballotManagementCases(),
    ...workflowCases(),
    ...connectionCases(),
    ...ballotCastingCases(),
    ...groupAccessCases(),
    ...rosterCases(),
    ...eventParticipationCases(),
    ...eventExceptionCases(),
    ...agendaVoteFlowCases(),
    ...expiredVoteCases(),
  ];
  return [...base, ...governanceRevocationCases(base), ...groupedEventCreationCases()];
}
