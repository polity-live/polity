import { describe, expect, it } from 'vitest';
import {
  loadMutationCases,
  registeredMutationNames,
  validateMutationCases,
  mutationExpectation,
} from '../mutation-catalog';
import { groupAdminFixture, eventAdminFixture } from '../mutation-governance-fixtures';
import type { MutationFixtures } from '../mutation-fixtures';
import type { MutationCaseContext } from '../mutation-case-types';
describe('mutation catalog boundary', () => {
  it('builds SQL-only owned group and event rights scoped to fresh fixture identities', async () => {
    const inserted: Record<string, unknown>[] = [];
    const f = {
      insert: async (table: string, values: Record<string, unknown>) => {
        inserted.push({ table, ...values });
      },
    } as unknown as MutationFixtures;
    const ctx = {
      id: 'fixture-namespace',
      ownerID: 'owner',
      outsiderID: 'outsider',
      actorID: 'owner',
      actor: 'owner',
    } as MutationCaseContext;
    const groupID = await groupAdminFixture(f, ctx);
    const event = await eventAdminFixture(f, ctx);
    expect(inserted.find(row => row.table === 'group')).toMatchObject({
      id: groupID,
      owner_id: 'owner',
      visibility: 'public',
      group_type: 'base',
    });
    expect(inserted.find(row => row.table === 'event_participant')).toMatchObject({
      event_id: event.id,
      user_id: 'owner',
      status: 'active',
    });
    expect(inserted.find(row => row.table === 'event_participant_role')).toMatchObject({
      event_participant_id: event.participantID,
      role_id: event.roleID,
      assigned_by_id: 'owner',
    });
    const rights = inserted.filter(row => row.table === 'action_right');
    expect(rights.length).toBeGreaterThan(0);
    expect(rights.every(row => row.event_id === event.id && row.role_id === event.roleID)).toBe(
      true
    );
    expect(rights.some(row => row.resource === 'events' && row.action === 'manage_votes')).toBe(
      true
    );
  });
  it('loads the exact public mutation registry and fails closed on missing duplicate or unknown cases', () => {
    const cases = loadMutationCases();
    expect(validateMutationCases(cases)).toEqual([]);
    expect([...new Set(cases.map(row => row.name))].sort()).toEqual(registeredMutationNames());
    const missing = cases.filter(row => row.name !== cases[0].name);
    expect(validateMutationCases(missing)).toContain(`Missing mutation cases: ${cases[0].name}`);
    expect(validateMutationCases([...cases, cases[0]])).toContain('Duplicate mutation cases');
    expect(validateMutationCases([{ ...cases[0], name: 'fictional.action' }], [])).toContain(
      'Unregistered mutation case: fictional.action'
    );
  });
  it('binds the oracle digest to reviewed mutation arguments and actor expectations', () => {
    const entry = loadMutationCases()[0];
    const original = mutationExpectation(entry);
    expect(mutationExpectation({ ...entry })).toEqual(original);
    expect(
      mutationExpectation({ ...entry, specification: { changed: 'oracle' } }).oracleDigest
    ).not.toBe(original.oracleDigest);
    expect(
      mutationExpectation({ ...entry, actor: entry.actor === 'owner' ? 'anonymous' : 'owner' })
        .oracleDigest
    ).not.toBe(original.oracleDigest);
  });
});
