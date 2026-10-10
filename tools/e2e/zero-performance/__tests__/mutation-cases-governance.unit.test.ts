import { describe, expect, it } from 'vitest';
import { governanceMutationCases } from '../mutation-cases-governance';
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
import type { MutationFixtures } from '../mutation-fixtures';
import type { MutationCaseContext } from '../mutation-case-types';
import {
  createAgendaItemSchema,
  createSpeakerListSchema,
} from '../../../../src/zero/agendas/schema';

describe('reviewed governance mutation catalog', () => {
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
      'groups.updateMembership',
      'groups.syncOfflineMembershipRoles',
      'groups.updateOfflineMember',
      'groups.deleteOfflineMember',
      'groups.addMembershipRole',
      'groups.removeOfflineMembershipRole',
      'events.updateOfflineParticipant',
      'events.deleteOfflineParticipant',
    ]) {
      for (const actor of ['outsider', 'anonymous']) {
        expect(
          cases.find(c => c.name === name && c.actor === actor && !c.variant.includes('revoked'))
        ).toMatchObject({ outcome: 'client-error', error: 'mutation_server_failed' });
      }
      expect(
        cases.find(
          c => c.name === name && c.variant === 'delegated-authority-revoked-after-preload'
        )
      ).toMatchObject({ outcome: 'server-error', error: 'permission_denied' });
    }
    for (const name of ['events.removeParticipantRole', 'events.syncParticipantRoles'])
      expect(cases.find(c => c.name === name && c.actor === 'anonymous')).toMatchObject({
        outcome: 'client-error',
        error: 'mutation_server_failed',
      });
    for (const name of [
      'elections.castFinalElectionVote',
      'elections.castFinalElectionVoteFull',
      'votes.castFinalVoteFull',
    ])
      expect(cases.find(c => c.name === name && c.actor === 'anonymous')).toMatchObject({
        outcome: 'server-error',
        error: 'mutation_server_failed',
      });
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
