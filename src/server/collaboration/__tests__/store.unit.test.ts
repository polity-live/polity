import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { reconcileProjection } from '@/features/collaboration/logic/reconcile';
import {
  assertStoredIntegrity,
  checksum,
  commitState,
  createStored,
  findStored,
  loadStored,
  persistProjection,
  verifiedRevision,
  type StoredDocument,
} from '../store';
const query = vi.fn();
const tx = { query };
const ref = { kind: 'document' as const, entityId: 'entity', branchId: null, workspaceId: null };
const text = (value: string) => [{ id: 'p', type: 'p', children: [{ text: value }] }];
beforeEach(() => {
  query.mockReset().mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());
async function document() {
  return createStored(tx, ref, text('Original'), 'author');
}
describe('persisted collaboration revision invariants', () => {
  it('bootstraps state, normalized projection, revision and delivery together and reuses an existing identity', async () => {
    const doc = await document();
    expect(doc).toMatchObject({
      revision: 1,
      workspace_type: 'canonical',
      owner_id: null,
      base_document_id: null,
      base_revision: null,
      shared: false,
    });
    expect(doc.checksum).toBe(checksum(doc.projection));
    expect(() => assertStoredIntegrity(doc)).not.toThrow();
    expect(
      query.mock.calls.filter(([sql]) => sql.startsWith('insert')).map(([sql]) => sql.split('(')[0])
    ).toEqual([
      'insert into collaboration_document',
      'insert into collaboration_revision',
      'insert into collaboration_outbox',
    ]);
    query.mockReset().mockResolvedValue([doc]);
    expect(await document()).toBe(doc);
    expect(query).toHaveBeenCalledOnce();
  });
  it('separates private proposal bootstrap from canonical text and records its original base revision', async () => {
    const base = await document();
    query.mockClear();
    const proposed = [
      {
        id: 'p',
        type: 'p',
        children: [
          {
            text: 'Addition',
            suggestion: true,
            suggestion_change: { id: 'change', type: 'insert', userId: 'author' },
          },
        ],
      },
    ];
    await expect(createStored(tx, ref, proposed, 'author')).rejects.toThrow(
      'proposal_requires_workspace'
    );
    const draft = await createStored(tx, { ...ref, workspaceId: 'draft' }, proposed, 'author', {
      type: 'proposal',
      base,
    });
    expect(draft).toMatchObject({
      workspace_type: 'proposal',
      owner_id: 'author',
      base_document_id: base.id,
      base_revision: 1,
    });
    query.mockClear();
    await persistProjection(tx, draft);
    expect(query).not.toHaveBeenCalled();
  });
  it('blocks missing, deleted or corrupt documents and validates historical state before readable fallback', async () => {
    await expect(loadStored(tx, 'absent')).rejects.toThrow('document_not_found');
    const doc = await document();
    query.mockResolvedValue([{ ...doc, deleted: true }]);
    await expect(loadStored(tx, doc.id)).rejects.toThrow('document_not_found');
    query.mockResolvedValue([{ ...doc, integrity_error: 'blocked' }]);
    await expect(loadStored(tx, doc.id)).rejects.toThrow('integrity_violation');
    const corrupt = { ...doc, projection: text('Unconfirmed'), revision: 3 };
    expect(() => assertStoredIntegrity(corrupt)).toThrow('integrity_violation');
    query.mockImplementation(async (sql: string) =>
      sql.startsWith('select *')
        ? [corrupt]
        : sql.includes('order by revision desc')
          ? [{ ...corrupt, revision: 2 }, doc]
          : []
    );
    const readable = await loadStored(tx, doc.id, true);
    expect(readable).toMatchObject({
      revision: 3,
      readableRevision: 1,
      projection: doc.projection,
      integrity_error: 'integrity_violation',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("integrity_error='integrity_violation'"),
      [doc.id, expect.any(Number)]
    );
    query.mockResolvedValue([]);
    await expect(verifiedRevision(tx, doc)).rejects.toThrow('verified_revision_missing');
  });
  it('honors stored integrity blocks during lookup but can serve the last verified archive read-only', async () => {
    const doc = await document();
    query.mockResolvedValue([doc]);
    expect(await findStored(tx, ref, true)).toBe(doc);
    expect(await loadStored(tx, doc.id)).toBe(doc);
    const blocked = { ...doc, integrity_error: 'blocked' };
    query.mockImplementation(async (sql: string) =>
      sql.startsWith('select *') ? [blocked] : sql.includes('order by revision') ? [doc] : []
    );
    await expect(findStored(tx, ref)).rejects.toThrow('integrity_violation');
    expect(await findStored(tx, ref, true)).toMatchObject({
      readableRevision: 1,
      integrity_error: 'integrity_violation',
    });
  });
  it('increments one authoritative revision and uses the same transaction for projection and delivery', async () => {
    const doc = await document();
    query.mockClear();
    const next = text('Confirmed update');
    const result = await commitState(
      tx,
      doc,
      reconcileProjection('document', doc.state, next),
      'author',
      'operation'
    );
    expect(result.duplicate).toBe(false);
    expect(result.document.revision).toBe(2);
    expect(result.document.projection).toEqual(next);
    expect(result.document.checksum).toBe(checksum(next));
    const statements = query.mock.calls.map(([sql]) => sql);
    expect(
      statements.findIndex(sql => sql.startsWith('update collaboration_document'))
    ).toBeLessThan(statements.findIndex(sql => sql.startsWith('insert into collaboration_outbox')));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('update document set content='), [
      next,
      expect.any(Number),
      'entity',
    ]);
    expect(doc.revision).toBe(1);
    expect(doc.projection).toEqual(text('Original'));
  });
  it('deduplicates command retries and unchanged CRDT state without inserting another revision', async () => {
    const doc = await document();
    query.mockReset().mockResolvedValue([{ id: 'saved', revision: 1 }]);
    expect(await commitState(tx, doc, doc.state, 'author', 'already-saved')).toMatchObject({
      revisionId: 'saved',
      duplicate: true,
    });
    expect(query).toHaveBeenCalledOnce();
    query
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'current' }]);
    expect(await commitState(tx, doc, doc.state, 'author', 'no-change')).toMatchObject({
      revisionId: 'current',
      duplicate: true,
    });
    expect(
      query.mock.calls.some(([sql]) => sql.startsWith('insert') || sql.startsWith('update'))
    ).toBe(false);
  });
  it('keeps invalid updates out of the current state and propagates transaction failures without an acknowledgement', async () => {
    const doc = await document();
    query.mockClear();
    await expect(commitState(tx, doc, new Uint8Array([1]), 'author', 'invalid')).rejects.toThrow();
    expect(query.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
    const update = reconcileProjection('document', doc.state, text('Next'));
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('insert into collaboration_revision'))
        throw new Error('transaction failed');
      return [];
    });
    await expect(commitState(tx, doc, update, 'author', 'failed')).rejects.toThrow(
      'transaction failed'
    );
    expect(
      query.mock.calls.some(([sql]) => sql.startsWith('insert into collaboration_outbox'))
    ).toBe(false);
    expect(doc.revision).toBe(1);
  });
  it('projects each editor type and never overwrites canonical Streetdesign from a branch', async () => {
    for (const [kind, projection] of [
      ['blog', text('Blog')],
      ['city', createEmptyCityDesignState()],
      ['studio', createDocument('single', 'Studio title')],
    ] as const) {
      query.mockReset().mockResolvedValue([]);
      const doc = await createStored(tx, { ...ref, kind }, projection, 'author');
      query.mockClear();
      await persistProjection(tx, doc);
      const sql = query.mock.calls.map(([s]) => s).join('\n');
      expect(sql).toContain(
        kind === 'blog'
          ? 'update blog set content='
          : kind === 'city'
            ? 'update amendment_city_design set design_state='
            : 'update studio_state set state='
      );
      if (kind === 'studio')
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('update studio_project set title='),
          ['Studio title', expect.any(Number), 'entity']
        );
      if (kind === 'city') {
        query.mockClear();
        await persistProjection(tx, { ...doc, branch_id: 'branch' } as StoredDocument);
        expect(query.mock.calls.every(([s]) => s.startsWith('select set_config'))).toBe(true);
      }
    }
  });
});
