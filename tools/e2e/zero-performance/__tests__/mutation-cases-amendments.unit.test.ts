import type { Sql } from 'postgres';
import fs from 'node:fs';
import { MutationFixtures } from '../mutation-fixtures';
import { describe, expect, it, vi } from 'vitest';
import { amendmentMutationCases, verifyRevokedAmendmentWriter } from '../mutation-cases-amendments';
import { amendmentSharedMutators } from '../../../../src/zero/amendments/shared-mutators';

describe('reviewed amendment catalog', () => {
  const cases = amendmentMutationCases();
  it('accepts legitimate post-revocation eviction but rejects phantom votes and changed retained fields', async () => {
    const row = {
      id: 'vote',
      change_request_id: 'cr',
      user_id: 'outsider',
      vote: 'accept',
      created_at: 1000,
    };
    let records: Record<string, unknown>[] = [{ ...row, created_at: new Date(1000) }];
    const sql = ((first: unknown) =>
      typeof first === 'string'
        ? { identifier: first }
        : Promise.resolve(
            Array.isArray(first) && first.join('').includes('extract(epoch from')
              ? [
                  {
                    microseconds: (
                      BigInt((records[0].created_at as Date).getTime()) * 1000n -
                      946684800000000n
                    ).toString(),
                  },
                ]
              : records
          )) as unknown as Sql;
    const ctx = {
      sql,
      id: 'rollback',
      ownerID: 'owner',
      outsiderID: 'outsider',
      actorID: 'outsider',
      actor: 'outsider',
    };
    const inspector = (rows: Map<string, unknown>) => ({
      inspector: { client: { map: async () => rows } },
    });
    const vote = new Map<string, unknown>([['e/change_request_vote/vote', row]]);
    await expect(verifyRevokedAmendmentWriter(ctx, inspector(vote))).resolves.toBeUndefined();
    await expect(verifyRevokedAmendmentWriter(ctx, inspector(new Map()))).resolves.toBeUndefined();
    records = [];
    await expect(verifyRevokedAmendmentWriter(ctx, inspector(vote))).rejects.toThrow(
      'Rollback row proof:change_request_vote'
    );
    records = [{ ...row, vote: 'reject', created_at: new Date(1000) }];
    await expect(verifyRevokedAmendmentWriter(ctx, inspector(vote))).rejects.toThrow(
      'Rollback field proof:change_request_vote'
    );
    await expect(verifyRevokedAmendmentWriter(ctx, {})).rejects.toThrow(
      'Missing public writer inspector'
    );
  });
  it('compares PostgreSQL microseconds exactly rather than truncated JS Date milliseconds', async () => {
    const cached = { id: 'vote', created_at: 1000.125 };
    let exact = 1000125n;
    const queries: string[] = [];
    const sql = ((first: unknown) => {
      if (typeof first === 'string') return { identifier: first };
      const query = Array.isArray(first) ? first.join('') : '';
      queries.push(query);
      return Promise.resolve(
        query.includes('extract(epoch from')
          ? [{ microseconds: (exact - 946684800000000n).toString() }]
          : [{ id: 'vote', created_at: new Date(1000) }]
      );
    }) as unknown as Sql;
    const ctx = {
      sql,
      id: 'precision',
      ownerID: 'owner',
      outsiderID: 'outsider',
      actorID: 'outsider',
      actor: 'outsider',
    };
    const writer = {
      inspector: { client: { map: async () => new Map([['e/change_request_vote/vote', cached]]) } },
    };
    await expect(verifyRevokedAmendmentWriter(ctx, writer)).resolves.toBeUndefined();
    expect(
      queries.some(
        query =>
          query.includes('extract(epoch from') &&
          query.replace(/\s/g, '').includes('*1000000') &&
          query.includes('::bigint::text as microseconds')
      )
    ).toBe(true);
    exact = 1000126n;
    await expect(verifyRevokedAmendmentWriter(ctx, writer)).rejects.toThrow(
      'Rollback field proof:change_request_vote'
    );
    exact = 1000000n;
    await expect(verifyRevokedAmendmentWriter(ctx, writer)).rejects.toThrow(
      'Rollback field proof:change_request_vote'
    );
    exact = 1791684800000006n;
    const pgMicroseconds = exact - 946684800000000n;
    const binary = Number(pgMicroseconds) / 1000 + 946684800000;
    const text = Number(exact / 1000n) + Number(exact % 1000n) / 1000;
    expect(binary).not.toBe(text);
    for (const decoded of [binary, text]) {
      cached.created_at = decoded;
      await expect(verifyRevokedAmendmentWriter(ctx, writer)).resolves.toBeUndefined();
    }
    cached.created_at = text + 0.001;
    await expect(verifyRevokedAmendmentWriter(ctx, writer)).rejects.toThrow(
      'Rollback field proof:change_request_vote'
    );
  });
  it('matches actual CR FK parents and distinguishes the UUID-only polymorphic source', () => {
    const sql = fs.readFileSync('supabase/schemas/14_change_request.sql', 'utf8');
    expect(sql).toMatch(/amendment_id UUID NOT NULL REFERENCES public\.amendment/);
    expect(sql).toMatch(/user_id UUID NOT NULL REFERENCES public\."user"/);
    expect(sql).toMatch(/process_branch_id UUID REFERENCES public\.amendment_process_branch/);
    expect(sql).toMatch(/source_id UUID,/);
    expect(sql).not.toMatch(/source_id UUID[^,]*REFERENCES/);
  });
  it('grants a scoped active role before writer preload and revokes it before subject invocation', async () => {
    const url = 'postgres://postgres:fixture@127.0.0.1:15625/postgres';
    for (const name of [
      'ZERO_UPSTREAM_DB',
      'E2E_DATABASE_URL',
      'DATABASE_URL',
      'SUPABASE_DB_URL',
      'STUDIO_DATABASE_URL',
      'STUDIO_TEST_DATABASE_URL',
    ])
      vi.stubEnv(name, url);
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:15624');
    vi.stubEnv('ZERO_PERFORMANCE_LAYER', 'mutations');
    const insert = vi.spyOn(MutationFixtures.prototype, 'insert').mockResolvedValue(undefined);
    const update = vi.spyOn(MutationFixtures.prototype, 'update').mockResolvedValue(undefined);
    const seal = vi.spyOn(MutationFixtures.prototype, 'sealScopes').mockResolvedValue(undefined);
    vi.spyOn(MutationFixtures.prototype, 'rows').mockResolvedValue([
      { id: 'fixture', content: [] },
    ]);
    const oracle = vi.spyOn(MutationFixtures.prototype, 'expect').mockResolvedValue(undefined);
    for (const method of ['track', 'trackScope', 'verifyScopesUnchanged'] as const)
      vi.spyOn(MutationFixtures.prototype, method).mockResolvedValue(undefined);
    try {
      const entry = cases.find(
        item => item.name === 'amendments.update' && item.variant === 'revoked-denied'
      );
      if (!entry) throw new Error('Missing reviewed revocation');
      const prepared = await entry.prepare({
        sql: (() => undefined) as unknown as Sql,
        id: 'revocation-contract',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'outsider',
        actor: 'outsider',
      });
      expect(
        insert.mock.calls.some(
          ([table, fields]) =>
            table === 'amendment_collaborator' &&
            fields.status === 'active' &&
            fields.user_id === 'outsider'
        )
      ).toBe(true);
      expect(update).not.toHaveBeenCalled();
      expect(prepared.requireWriterBefore).toBe(true);
      expect(typeof prepared.verifyRollback).toBe('function');
      await prepared.beforeInvoke?.();
      expect(update).toHaveBeenCalledWith('amendment_collaborator', expect.any(String), {
        status: 'revoked',
      });
      expect(seal).toHaveBeenCalledTimes(2);
      await prepared.verify();
      expect(oracle).toHaveBeenCalledWith(
        'amendment',
        expect.any(String),
        expect.objectContaining({ title: 'Before', created_by_id: 'owner' })
      );
      const voting = cases.find(
        item => item.name === 'amendments.voteOnChangeRequest' && item.actor === 'anonymous'
      );
      if (!voting) throw new Error('Missing anonymous vote case');
      await voting.prepare({
        sql: (() => undefined) as unknown as Sql,
        id: 'vote-schema-contract',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'anon',
        actor: 'anonymous',
      });
      const request = insert.mock.calls.find(([table]) => table === 'change_request');
      const amendment = insert.mock.calls.find(
        ([table, fields]) => table === 'amendment' && fields.id === request?.[1].amendment_id
      );
      expect(amendment?.[1].created_by_id).toBe('owner');
      expect(request?.[1].user_id).toBe('owner');
      const document = insert.mock.calls.find(
        ([table, fields]) => table === 'document' && fields.amendment_id === amendment?.[1].id
      );
      expect(update).toHaveBeenCalledWith(
        'amendment',
        amendment?.[1].id,
        expect.objectContaining({ document_id: document?.[1].id })
      );
      expect(request?.[1].source_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      // Native runs exercised these independent setup paths before the shared UUID fix.
      // Check each persisted CR, rather than inferring correctness from voting alone.
      for (const operation of [
        'updateChangeRequest',
        'deleteChangeRequest',
        'finalizeExpiredInternalChangeRequestVotes',
        'finalizeInternalChangeRequestVote',
        'repairInternalChangeRequestResolution',
      ]) {
        insert.mockClear();
        const denied = cases.find(
          item => item.name === `amendments.${operation}` && item.actor === 'anonymous'
        );
        if (!denied) throw new Error('Missing reviewed CR denial');
        await denied.prepare({
          sql: (() => undefined) as unknown as Sql,
          id: `native-cr-setup-${operation}`,
          ownerID: 'owner',
          outsiderID: 'outsider',
          actorID: 'anon',
          actor: 'anonymous',
        });
        const persisted = insert.mock.calls.filter(([table]) => table === 'change_request');
        expect(persisted).toHaveLength(1);
        const fields = persisted[0][1];
        expect(fields.source_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        expect(fields.user_id).toBe('owner');
        const parentIndex = insert.mock.calls.findIndex(
          ([table, parent]) => table === 'amendment' && parent.id === fields.amendment_id
        );
        const requestIndex = insert.mock.calls.findIndex(([table]) => table === 'change_request');
        expect(parentIndex).toBeGreaterThanOrEqual(0);
        expect(parentIndex).toBeLessThan(requestIndex);
      }
      // Actual SQL column is UUID, even though the mutator input schema accepts a string.
      for (const operation of [
        'createChangeRequest',
        'createCityDesignChangeRequests',
        'createDocumentChangeRequest',
      ]) {
        const creator = cases.find(
          item => item.name === `amendments.${operation}` && item.actor === 'owner'
        );
        if (!creator) throw new Error('Missing reviewed CR creation');
        const creation = await creator.prepare({
          sql: (() => undefined) as unknown as Sql,
          id: `source-argument-${operation}`,
          ownerID: 'owner',
          outsiderID: 'outsider',
          actorID: 'owner',
          actor: 'owner',
        });
        const args = creation.args as {
          source_id?: string | null;
          requests?: { source_id: string | null }[];
        };
        const sourceID = args.requests?.[0].source_id ?? args.source_id;
        if (operation === 'createDocumentChangeRequest') expect(sourceID).toBeNull();
        else
          expect(sourceID).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          );
      }
      const replan = cases.find(
        item => item.name === 'amendments.replanProcessBranchEvents' && item.actor === 'owner'
      );
      if (!replan) throw new Error('Missing replan case');
      const replanned = await replan.prepare({
        sql: (() => undefined) as unknown as Sql,
        id: 'replan-query-contract',
        ownerID: 'owner',
        outsiderID: 'outsider',
        actorID: 'owner',
        actor: 'owner',
      });
      const replanningArgs = replanned.args as { event_updates: { step_run_id: string }[] };
      const stepID = replanningArgs.event_updates[0].step_run_id;
      const pendingStep = {
        id: stepID,
        event_id: null,
        status: 'pending_event',
        decision_status: 'forward_confirmed',
      };
      expect(replanned.observe?.after({ branches: [{ step_runs: [pendingStep] }] })).toBe(true);
      expect(
        replanned.observe?.after({
          branches: [
            { step_runs: [{ ...pendingStep, decision_status: 'previous_decision_outstanding' }] },
          ],
        })
      ).toBe(false);
      for (const revoked of cases.filter(item => item.variant === 'revoked-denied')) {
        const preparedRevocation = await revoked.prepare({
          sql: (() => undefined) as unknown as Sql,
          id: `rollback-${revoked.name}`,
          ownerID: 'owner',
          outsiderID: 'outsider',
          actorID: 'outsider',
          actor: 'outsider',
        });
        expect(typeof preparedRevocation.verifyRollback).toBe('function');
        expect(preparedRevocation.requireWriterBefore).toBe(true);
      }
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });
  it('covers revocation of amendment-scoped delegated authority without inventing owner revocation', () => {
    const revocations = amendmentMutationCases().filter(
      entry => entry.variant === 'revoked-denied'
    );
    expect(revocations.map(entry => entry.name).sort()).toEqual(
      [
        'addCollaborator',
        'createCityDesign',
        'delete',
        'deleteCityDesign',
        'removeCollaborator',
        'update',
        'updateCityDesign',
        'updateCollaborator',
        'updateProcessBranch',
        'createChangeRequest',
        'createDocumentChangeRequest',
        'createCityDesignChangeRequests',
        'updateChangeRequest',
        'deleteChangeRequest',
        'finalizeInternalChangeRequestVote',
        'repairInternalChangeRequestResolution',
        'voteOnChangeRequest',
        'initializeProcessPath',
        'resolveProcessVote',
        'completeProcessTaskWithEvent',
        'replanProcessBranchEvents',
      ]
        .map(name => `amendments.${name}`)
        .sort()
    );
    expect(
      revocations.every(entry => entry.actor === 'outsider' && entry.error === 'permission_denied')
    ).toBe(true);
  });
  it('covers the exact runtime registry; public orchestrators have substantive success cases', () => {
    expect([...new Set(cases.map(item => item.name))].sort()).toEqual(
      Object.keys(amendmentSharedMutators)
        .map(name => `amendments.${name}`)
        .sort()
    );
    for (const operation of [
      'initializeProcessPath',
      'resolveProcessVote',
      'completeProcessTaskWithEvent',
      'replanProcessBranchEvents',
      'updateProcessBranch',
      'createDocumentChangeRequest',
      'repairInternalChangeRequestResolution',
      'initializeProcessPath',
      'resolveProcessVote',
      'completeProcessTaskWithEvent',
      'replanProcessBranchEvents',
    ])
      expect(
        cases.some(item => item.name === `amendments.${operation}` && item.outcome === 'success')
      ).toBe(true);
  });
  it('uses permission_denied only for reviewed explicit denials and unique actor variants', () => {
    expect(new Set(cases.map(item => `${item.name}/${item.actor}/${item.variant}`)).size).toBe(
      cases.length
    );
    for (const item of cases) {
      expect(JSON.parse(JSON.stringify(item.specification))).toEqual(item.specification);
      if (item.outcome !== 'success') expect(item.error).toBe('permission_denied');
      expect('query' in item.observer).toBe(true);
    }
  });
});
