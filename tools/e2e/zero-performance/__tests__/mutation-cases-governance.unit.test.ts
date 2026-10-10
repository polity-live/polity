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

describe('reviewed governance mutation catalog', () => {
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
