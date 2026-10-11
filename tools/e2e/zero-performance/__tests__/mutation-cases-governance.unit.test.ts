import { describe, expect, it, vi } from 'vitest';
import { governanceMutationCases, governanceSQLExpected } from '../mutation-cases-governance';
import { verifyRevokedGovernanceWriter } from '../mutation-cases-governance-revocation';
import { groupSharedMutators } from '../../../../src/zero/groups/shared-mutators';
import { eventSharedMutators } from '../../../../src/zero/events/shared-mutators';
import { agendaSharedMutators } from '../../../../src/zero/agendas/shared-mutators';
import { networkSharedMutators } from '../../../../src/zero/network/shared-mutators';
import { accreditationSharedMutators } from '../../../../src/zero/accreditation/shared-mutators';
import { electionSharedMutators } from '../../../../src/zero/elections/shared-mutators';
import { voteSharedMutators } from '../../../../src/zero/votes/shared-mutators';
import { votingPasswordSharedMutators } from '../../../../src/zero/voting-password/shared-mutators';
import {
  delegatedGovernanceFixture,
  verifyGovernanceNotificationsRestored,
} from '../mutation-governance-fixtures';
import { MutationFixtures, mutationFixtureID } from '../mutation-fixtures';
import type { MutationCaseContext } from '../mutation-case-types';
import { groupGuestAccessCreateSchema } from '../../../../src/zero/groups/schema';
import {
  createAgendaItemSchema,
  createSpeakerListSchema,
} from '../../../../src/zero/agendas/schema';

describe('reviewed governance mutation catalog', () => {
  it('preloads public group import parents and verifies SQL result subclasses as plain name collections', async () => {
    const address = 'postgres://postgres:fixture@127.0.0.1:15625/postgres';
    for (const name of [
      'ZERO_UPSTREAM_DB',
      'E2E_DATABASE_URL',
      'DATABASE_URL',
      'SUPABASE_DB_URL',
      'STUDIO_DATABASE_URL',
      'STUDIO_TEST_DATABASE_URL',
    ])
      vi.stubEnv(name, address);
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:15624');
    class SQLRows extends Array<Record<string, unknown>> {}
    let persisted = false;
    const sql = ((input: string | TemplateStringsArray) => {
      if (typeof input === 'string') return input;
      if (!persisted) return Promise.resolve(new SQLRows());
      if (input.join('').includes('group_offline_membership'))
        return Promise.resolve(
          new SQLRows(
            { group_offline_member_id: 'first', source: 'direct', status: 'active' },
            { group_offline_member_id: 'second', source: 'direct', status: 'active' }
          )
        );
      return Promise.resolve(
        new SQLRows({ id: 'first', first_name: 'Reviewed' }, { id: 'second', first_name: 'Second' })
      );
    }) as unknown as MutationCaseContext['sql'];
    try {
      for (const method of ['insert', 'track', 'trackScope', 'update'] as const)
        vi.spyOn(MutationFixtures.prototype, method).mockResolvedValue(undefined);
      for (const actor of ['owner', 'outsider', 'anonymous'] as const) {
        persisted = false;
        const entry = governanceMutationCases().find(
          c =>
            c.name === 'groups.importOfflineMembers' &&
            c.actor === actor &&
            !c.variant.includes('revoked')
        );
        if (!entry) throw new Error('Missing reviewed import case');
        const prepared = await entry.prepare({
          id: 'prepared-import',
          ownerID: 'owner',
          outsiderID: 'outsider',
          actorID: actor === 'anonymous' ? 'anon' : actor,
          actor,
          sql,
        });
        expect(prepared.writerPreloads).toHaveLength(1);
        expect(
          prepared.writerPreloads?.[0]?.before({
            id: mutationFixtureID('prepared-import', 'group'),
            group_type: 'base',
          })
        ).toBe(true);
        if (actor === 'owner') {
          persisted = true;
          await expect(prepared.verify()).resolves.toBeUndefined();
        }
      }
      persisted = false;
      const anonymousGuest = governanceMutationCases().find(
        c => c.name === 'groups.requestGuestAccess' && c.actor === 'anonymous'
      );
      if (!anonymousGuest) throw new Error('Missing reviewed guest request');
      const preparedGuest = await anonymousGuest.prepare({
        id: 'prepared-guest',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'anon',
        actor: 'anonymous',
        sql,
      });
      expect(groupGuestAccessCreateSchema.safeParse(preparedGuest.args).success).toBe(true);
      expect(preparedGuest.args).not.toHaveProperty('role_ids');
      expect(anonymousGuest).toMatchObject({ outcome: 'server-error', error: 'permission_denied' });
      const ownerWorkflow = governanceMutationCases().find(
        c => c.name === 'network.saveWorkflowDefinition' && c.actor === 'owner'
      );
      if (!ownerWorkflow) throw new Error('Missing reviewed workflow save');
      const preparedWorkflow = await ownerWorkflow.prepare({
        id: 'prepared-workflow',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'owner',
        actor: 'owner',
        sql,
      });
      expect(preparedWorkflow.writerPreloads).toHaveLength(1);
      expect(
        preparedWorkflow.writerPreloads?.[0]?.before([
          {
            id: mutationFixtureID('prepared-workflow', 'workflow-connection'),
            grants: [{ right_key: 'amendmentRight', status: 'active' }],
          },
        ])
      ).toBe(true);
      expect(
        preparedWorkflow.writerPreloads?.[0]?.before([
          { id: mutationFixtureID('prepared-workflow', 'workflow-connection'), grants: [] },
        ])
      ).toBe(false);
      const approval = governanceMutationCases().find(
        c => c.name === 'network.approveGroupConnectionRequest' && c.actor === 'owner'
      );
      if (!approval) throw new Error('Missing reviewed connection approval');
      const preparedApproval = await approval.prepare({
        id: 'prepared-approval',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'owner',
        actor: 'owner',
        sql,
      });
      expect(preparedApproval.observe?.after(undefined)).toBe(true);
      expect(
        preparedApproval.observe?.after({
          id: mutationFixtureID('prepared-approval', 'connection-request'),
          status: 'approved',
        })
      ).toBe(false);
      const proof = vi.spyOn(MutationFixtures.prototype, 'expect').mockResolvedValue(undefined);
      await preparedApproval.verify();
      expect(proof).toHaveBeenCalledWith(
        'group_connection_request',
        mutationFixtureID('prepared-approval', 'connection-request'),
        null
      );
      expect(proof).toHaveBeenCalledWith(
        'group_connection',
        mutationFixtureID('prepared-approval', 'connection'),
        expect.objectContaining({ status: 'active', connection_type: 'hierarchy' })
      );
      const invitation = governanceMutationCases().find(
        c =>
          c.name === 'events.inviteParticipant' &&
          c.actor === 'outsider' &&
          !c.variant.includes('revoked')
      );
      if (!invitation) throw new Error('Missing reviewed event invitation');
      const preparedInvitation = await invitation.prepare({
        id: 'prepared-invite',
        ownerID: 'owner',
        outsiderID: 'owner',
        actorID: 'writer',
        actor: 'outsider',
        sql,
      });
      const recipient = {
        id: mutationFixtureID('prepared-invite', 'event:participant'),
        user_id: 'owner',
        instance_date: null,
        status: 'active',
      };
      expect(preparedInvitation.observe?.before([recipient])).toBe(true);
      expect(preparedInvitation.observe?.before([{ ...recipient, status: 'invited' }])).toBe(false);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });
  it('verifies the prepared authorized createVote against SQL timestamp storage through its actual callback', async () => {
    const address = 'postgres://postgres:fixture@127.0.0.1:15625/postgres';
    for (const name of [
      'ZERO_UPSTREAM_DB',
      'E2E_DATABASE_URL',
      'DATABASE_URL',
      'SUPABASE_DB_URL',
      'STUDIO_DATABASE_URL',
      'STUDIO_TEST_DATABASE_URL',
    ])
      vi.stubEnv(name, address);
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:15624');
    let persisted = false;
    const id = mutationFixtureID('prepared-vote', 'ballot');
    const stored = {
      id,
      agenda_item_id: mutationFixtureID('prepared-vote', 'ballot-agenda'),
      amendment_id: null,
      title: 'Reviewed vote',
      description: null,
      status: 'pending',
      purpose: 'closing',
      majority_type: 'relative',
      closing_type: 'moderator',
      closing_duration_seconds: null,
      closing_end_time: new Date(0),
      visibility: 'public',
      ballot_visibility: 'named',
    };
    try {
      vi.spyOn(MutationFixtures.prototype, 'insert').mockResolvedValue(undefined);
      vi.spyOn(MutationFixtures.prototype, 'track').mockResolvedValue(undefined);
      vi.spyOn(MutationFixtures.prototype, 'rows').mockImplementation(async table =>
        table === 'vote' && persisted ? [stored] : []
      );
      const verification = vi.spyOn(MutationFixtures.prototype, 'expect');
      const entry = governanceMutationCases().find(
        c =>
          c.name === 'votes.createVote' &&
          c.actor === 'owner' &&
          c.variant === 'authorized-ballot-management'
      );
      expect(entry).toBeDefined();
      if (!entry) throw new Error('Missing reviewed createVote case');
      const prepared = await entry.prepare({
        id: 'prepared-vote',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'owner',
        actor: 'owner',
        sql: (() => {
          throw new Error('Unexpected SQL in fixture double');
        }) as unknown as MutationCaseContext['sql'],
      });
      persisted = true;
      await expect(prepared.verify()).resolves.toBeUndefined();
      expect(verification).toHaveBeenCalledWith(
        'vote',
        id,
        expect.objectContaining({ closing_end_time: new Date(0) })
      );
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });
  it('keeps observed epoch zero distinct from the SQL timestamptz business expectation', () => {
    const observed = { closing_end_time: 0, closing_duration_seconds: 0, title: 'Reviewed vote' };
    expect(governanceSQLExpected('vote', observed)).toEqual({
      ...observed,
      closing_end_time: new Date(0),
    });
    expect(observed.closing_end_time).toBe(0);
    expect(
      governanceSQLExpected('agenda_item', {
        start_time: 0,
        end_time: 0,
        activated_at: 0,
        completed_at: 0,
        duration: 5,
      })
    ).toEqual({
      start_time: new Date(0),
      end_time: new Date(0),
      activated_at: new Date(0),
      completed_at: new Date(0),
      duration: 5,
    });
    expect(governanceSQLExpected('speaker_list', { start_time: 0, end_time: 0, time: 30 })).toEqual(
      { start_time: new Date(0), end_time: new Date(0), time: 30 }
    );
    expect(governanceSQLExpected('vote', null)).toBeNull();
    expect(governanceSQLExpected('vote_choice', { order_index: 0 })).toEqual({ order_index: 0 });
  });
  it('proves retained revoked writer rows with exact SQL microseconds and rejects phantom or changed fields', async () => {
    const exact = 1_900_000_000_000.123;
    let records: Record<string, unknown>[] = [
      { id: 'scope', name: 'Original', created_at: new Date(Math.trunc(exact)) },
    ];
    const calls: string[] = [];
    const sql = ((input: string | TemplateStringsArray) => {
      if (typeof input === 'string') return input;
      const statement = input.join('?');
      calls.push(statement);
      return Promise.resolve(
        statement.includes('extract(epoch') ? [{ microseconds: '953315200000123' }] : records
      );
    }) as unknown as MutationCaseContext['sql'];
    const ctx = { sql } as MutationCaseContext;
    const writer = (row: unknown) => ({
      inspector: { client: { map: async () => new Map([['e/group/scope', row]]) } },
    });
    await expect(
      verifyRevokedGovernanceWriter(
        ctx,
        writer({ id: 'scope', name: 'Original', created_at: exact })
      )
    ).resolves.toBeUndefined();
    expect(
      calls.some(
        statement => statement.includes('extract(epoch') && statement.includes('bigint::text')
      )
    ).toBe(true);
    await expect(
      verifyRevokedGovernanceWriter(
        ctx,
        writer({ id: 'scope', name: 'Original', created_at: Math.trunc(exact) })
      )
    ).rejects.toThrow('Rollback field proof: group.created_at');
    await expect(
      verifyRevokedGovernanceWriter(ctx, writer({ id: 'scope', name: 'Changed' }))
    ).rejects.toThrow('Rollback field proof: group.name');
    records = [];
    await expect(verifyRevokedGovernanceWriter(ctx, writer({ id: 'scope' }))).rejects.toThrow(
      'Rollback row proof: group'
    );
    await expect(
      verifyRevokedGovernanceWriter(ctx, { inspector: { client: { map: async () => new Map() } } })
    ).resolves.toBeUndefined();
  });
  it('labels notification restoration failures without exposing notification identities', async () => {
    const ctx = {
      sql: async () => [{ id: 'private-notification-identity' }],
    } as unknown as MutationCaseContext;
    let message = '';
    try {
      await verifyGovernanceNotificationsRestored(ctx, ['scope']);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message.split('\n')[0]).toBe('Restoration proof: notification');
    expect(message).not.toContain('private-notification-identity');
    await expect(
      verifyGovernanceNotificationsRestored(
        { sql: async () => [] } as unknown as MutationCaseContext,
        ['scope']
      )
    ).resolves.toBeUndefined();
  });
  it('retains protected lookup client guards separately from revoked server permission denials', () => {
    const cases = governanceMutationCases();
    for (const name of [
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
      'groups.removeOfflineMembershipRole',
      'events.updateOfflineParticipant',
      'events.deleteOfflineParticipant',
    ]) {
      for (const actor of ['outsider', 'anonymous']) {
        expect(
          cases.find(c => c.name === name && c.actor === actor && !c.variant.includes('revoked'))
        ).toMatchObject({ outcome: 'client-error', error: 'mutation_server_failed' });
      }
      if (name === 'groups.acceptInvitation') continue; // Personal ownership is immutable authority.
      expect(
        cases.find(
          c => c.name === name && c.variant === 'delegated-authority-revoked-after-preload'
        )
      ).toMatchObject({ outcome: 'server-error', error: 'permission_denied' });
    }
    for (const name of [
      'events.addParticipantRole',
      'events.removeParticipantRole',
      'events.syncParticipantRoles',
    ])
      expect(cases.find(c => c.name === name && c.actor === 'anonymous')).toMatchObject({
        outcome: 'client-error',
        error: 'mutation_server_failed',
      });
    for (const name of [
      'elections.castFinalElectionVote',
      'elections.castFinalElectionVoteFull',
      'votes.castFinalVoteFull',
      'votes.replaceIndicativeVote',
      'elections.replaceIndicativeElectionVote',
      'votes.submitVote',
      'elections.submitElectionVote',
    ])
      expect(cases.find(c => c.name === name && c.actor === 'anonymous')).toMatchObject({
        outcome: 'server-error',
        error: 'permission_denied',
      });
  });
  it('retains hidden workflow traversal as a client rejection while preserving revoked server authorization checks', () => {
    const cases = governanceMutationCases();
    for (const actor of ['outsider', 'anonymous'])
      expect(
        cases.find(
          c =>
            c.name === 'network.saveWorkflowDefinition' &&
            c.actor === actor &&
            c.variant === 'permission-denied'
        )
      ).toMatchObject({ outcome: 'client-error', error: 'mutation_server_failed' });
    expect(
      cases.find(
        c =>
          c.name === 'network.saveWorkflowDefinition' &&
          c.variant === 'delegated-authority-revoked-after-preload'
      )
    ).toMatchObject({ outcome: 'server-error', error: 'permission_denied' });
  });
  it('uses the actual public creation schema zero timestamps for agenda and speaker observation', () => {
    const agenda = createAgendaItemSchema.parse({
      id: 'agenda',
      event_id: 'event',
      amendment_id: null,
      title: 'Agenda',
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
    expect(agenda).toMatchObject({ start_time: 0, end_time: 0, activated_at: 0, completed_at: 0 });
    const speaker = createSpeakerListSchema.parse({
      id: 'speaker',
      agenda_item_id: 'agenda',
      user_id: 'user',
      title: null,
      order_index: 0,
      time: 30,
      completed: false,
      start_time: null,
      end_time: null,
    });
    expect(speaker).toMatchObject({ start_time: 0, end_time: 0 });
  });
  it('initializes actual scoped delegated membership and separate read/write rights before subject snapshots', async () => {
    const inserted: { table: string; row: Record<string, unknown> }[] = [];
    const fixture = {
      insert: async (table: string, row: Record<string, unknown>) => {
        inserted.push({ table, row });
      },
    } as unknown as MutationFixtures;
    const ctx = {
      id: 'fixture',
      ownerID: 'owner',
      outsiderID: 'outsider',
      delegatedWriterID: 'outsider',
    } as MutationCaseContext & { delegatedWriterID: string };
    for (const kind of ['group', 'event'] as const) {
      inserted.length = 0;
      await delegatedGovernanceFixture(fixture, ctx, { id: 'scope', kind });
      expect(
        inserted.find(
          record => record.table === (kind === 'group' ? 'group_membership' : 'event_participant')
        )?.row
      ).toMatchObject({ [`${kind}_id`]: 'scope', user_id: 'outsider', status: 'active' });
      for (const action of ['view', 'manage'])
        expect(
          inserted.some(
            record =>
              record.table === 'action_right' &&
              record.row.action === action &&
              record.row.resource === (kind === 'group' ? 'groupMemberships' : 'events')
          )
        ).toBe(true);
      expect(
        inserted
          .filter(record => record.table === 'action_right')
          .every(record => record.row[`${kind}_id`] === 'scope')
      ).toBe(true);
    }
    inserted.length = 0;
    await delegatedGovernanceFixture(
      fixture,
      { ...ctx, delegatedWriterID: undefined },
      { id: 'scope', kind: 'group' }
    );
    expect(inserted).toEqual([]);
  });
  it('covers public expired-vote polling for owner outsider and anonymous callers', () => {
    const polling = governanceMutationCases().filter(
      entry => entry.name === 'votes.closeExpiredFinalVotesForEvent'
    );
    expect(polling).toHaveLength(6);
    for (const actor of ['owner', 'outsider', 'anonymous']) {
      expect(
        polling.filter(entry => entry.actor === actor && entry.outcome === 'success')
      ).toHaveLength(2);
    }
  });
  it('covers delegated managed commands with real authority revocation after authorized preload', () => {
    const cases = governanceMutationCases();
    for (const name of [
      'groups.update',
      'groups.inviteMember',
      'groups.addMembershipRole',
      'events.update',
      'events.updateParticipant',
      'events.finalizeDelegates',
      'agendas.updateAgendaItem',
      'agendas.addSpeaker',
      'network.saveWorkflowDefinition',
      'network.approveGroupConnectionRequest',
      'elections.updateElection',
      'elections.addCandidate',
      'votes.updateVote',
      'votes.submitVote',
      'elections.submitElectionVote',
      'accreditation.approveAccreditation',
    ]) {
      const entry = cases.find(
        c => c.name === name && c.variant === 'delegated-authority-revoked-after-preload'
      );
      expect(entry, name).toBeDefined();
      expect(entry?.outcome, name).toBe('server-error');
      expect(JSON.stringify(entry?.specification), name).toContain('after writer preload');
    }
    for (const name of [
      'groups.joinGroup',
      'groups.acceptInvitation',
      'events.bookMeeting',
      'votes.castFinalVote',
      'elections.castFinalElectionVote',
    ]) {
      expect(
        cases.some(
          c => c.name === name && c.variant === 'delegated-authority-revoked-after-preload'
        ),
        name
      ).toBe(false);
    }
    for (const name of [
      'votes.createIndicativeChoiceDecision',
      'votes.createFinalChoiceDecision',
      'elections.createIndicativeCandidateSelection',
      'elections.createFinalCandidateSelection',
    ]) {
      expect(
        cases.find(
          c => c.name === name && c.variant === 'secret-manager-authority-revoked-after-preload'
        )?.error,
        name
      ).toBe('permission_denied');
    }
  });
  it('covers every registered governance entry point with authorized behavior or an explicit immutable/server-only rejection', () => {
    const cases = governanceMutationCases();
    const serverOnly = new Set([
      'accreditation.deleteAccreditation',
      'votes.createVoter',
      'votes.deleteVoter',
      'elections.createElector',
      'elections.deleteElector',
    ]);
    const registries = {
      groups: groupSharedMutators,
      events: eventSharedMutators,
      agendas: agendaSharedMutators,
      network: networkSharedMutators,
      accreditation: accreditationSharedMutators,
      elections: electionSharedMutators,
      votes: voteSharedMutators,
      votingPassword: votingPasswordSharedMutators,
    };
    for (const [domain, registry] of Object.entries(registries)) {
      for (const key of Object.keys(registry)) {
        const name = `${domain}.${key}`;
        const reviewed = cases.filter(c => c.name === name);
        expect(reviewed.length, name).toBeGreaterThan(0);
        if (serverOnly.has(name))
          expect(
            reviewed.some(c => c.actor === 'owner' && c.error === 'mutation_server_failed'),
            name
          ).toBe(true);
        else
          expect(
            reviewed.some(c => c.outcome === 'success'),
            name
          ).toBe(true);
      }
    }
  });
  it('covers grouped event creation ownership, delegation, denial and authority revoked after preload', () => {
    const cases = governanceMutationCases();
    for (const name of ['events.create', 'events.createFull']) {
      const grouped = cases.filter(c => c.name === name && c.variant.startsWith('grouped-'));
      expect(grouped).toHaveLength(5);
      expect(grouped.filter(c => c.outcome === 'success').map(c => c.actor)).toEqual([
        'owner',
        'outsider',
      ]);
      expect(
        grouped
          .filter(c => c.outcome === 'server-error')
          .every(c => c.error === 'permission_denied')
      ).toBe(true);
      expect(grouped.some(c => c.variant === 'grouped-delegated-revoked-after-preload')).toBe(true);
      expect(
        cases.some(
          c => c.name === name && !c.variant.startsWith('grouped-') && c.outcome === 'success'
        )
      ).toBe(true);
    }
  });
  it('has unique explicit actor/variant cases with independent specifications', () => {
    const cases = governanceMutationCases();
    const keys = cases.map(c => `${c.name}/${c.variant}/${c.actor}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of cases) {
      expect(JSON.stringify(c.specification).length).toBeGreaterThan(60);
      expect('query' in c.observer && c.observer.query.length > 0).toBe(true);
      expect(c.prepare).toBeTypeOf('function');
      if (c.outcome !== 'success') expect(c.error).toBeTruthy();
    }
  });
  it('measures real password create/replace and verify, plus missing/wrong PIN and authentication denial', () => {
    const cases = governanceMutationCases();
    expect(
      cases.filter(c => c.name === 'votingPassword.setVotingPassword' && c.outcome === 'success')
    ).toHaveLength(2);
    expect(
      cases.some(c => c.name === 'votingPassword.verifyVotingPassword' && c.outcome === 'success')
    ).toBe(true);
    expect(cases.some(c => c.error === 'voting_password_invalid')).toBe(true);
    expect(cases.some(c => c.error === 'voting_password_missing')).toBe(true);
  });
  it('specifies supported submit replay, secret/final duplicates and expired PIN guards from SQL baselines', () => {
    const cases = governanceMutationCases();
    for (const name of ['votes.submitVote', 'elections.submitElectionVote']) {
      expect(cases.find(c => c.name === name && c.variant === 'same-id-replay')?.outcome).toBe(
        'success'
      );
      for (const variant of ['secret-indicative-duplicate', 'final-duplicate', 'stale-pin']) {
        expect(cases.find(c => c.name === name && c.variant === variant)?.error).toBe(
          'mutation_server_failed'
        );
      }
    }
  });
  it('covers authorized accreditation requests and append-only approval/rejection/revocation transitions', () => {
    const cases = governanceMutationCases();
    for (const name of [
      'requestAccreditation',
      'confirmAccreditation',
      'approveAccreditation',
      'rejectAccreditation',
      'revokeAccreditation',
    ]) {
      expect(cases.some(c => c.name === `accreditation.${name}` && c.outcome === 'success')).toBe(
        true
      );
    }
    expect(cases.find(c => c.name === 'accreditation.deleteAccreditation')?.outcome).toBe(
      'server-error'
    );
  });
  it('covers real success and permission checks for reviewed agenda management entry points', () => {
    const cases = governanceMutationCases();
    for (const name of [
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
    ]) {
      expect(cases.some(c => c.name === `agendas.${name}` && c.outcome === 'success')).toBe(true);
      expect(
        cases.some(
          c =>
            c.name === `agendas.${name}` &&
            c.actor === 'outsider' &&
            c.error === 'permission_denied'
        )
      ).toBe(true);
    }
  });
});
