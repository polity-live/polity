import { beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/transaction', () => ({
  sqlTransaction: (tx: any) => tx.dbTransaction,
  rows: async (tx: any, sql: string, args: unknown[]) => Array.from(await tx.query(sql, args)),
}));
import { assertContentRevision } from '../revisions';
const tx = { location: 'server', dbTransaction: io } as any;
beforeEach(() => io.query.mockReset());
it('rejects missing content and stale revisions while locking the selected row', async () => {
  io.query.mockResolvedValueOnce([]);
  await expect(assertContentRevision(tx, 'document', 'doc', 1)).rejects.toMatchObject({
    code: 'not_found',
  });
  expect(io.query).toHaveBeenCalledWith(
    'select content_revision,amendment_id from document where id=$1 for update',
    ['doc']
  );
  io.query.mockResolvedValueOnce([{ content_revision: 2, amendment_id: null }]);
  await expect(assertContentRevision(tx, 'document', 'doc', 1)).rejects.toThrow(
    'project_revision_conflict'
  );
  io.query.mockResolvedValueOnce([{ content_revision: '2', amendment_id: null }]);
  await expect(
    assertContentRevision(tx, 'amendment_city_design', 'design', 2)
  ).resolves.toBeUndefined();
});
it('requires a revision once an amendment uses project chat and permits untracked saves', async () => {
  io.query
    .mockResolvedValueOnce([{ content_revision: 2, amendment_id: 'amendment' }])
    .mockResolvedValueOnce([{ id: 'chat' }]);
  await expect(assertContentRevision(tx, 'document', 'doc', undefined)).rejects.toMatchObject({
    code: 'revision_required',
  });
  io.query
    .mockResolvedValueOnce([{ content_revision: 2, amendment_id: 'amendment' }])
    .mockResolvedValueOnce([]);
  await expect(assertContentRevision(tx, 'document', 'doc', undefined)).resolves.toBeUndefined();
  io.query.mockResolvedValueOnce([{ content_revision: 2, amendment_id: null }]);
  await expect(assertContentRevision(tx, 'document', 'doc', undefined)).resolves.toBeUndefined();
  io.query.mockClear();
  await assertContentRevision({ location: 'client' } as any, 'document', 'doc', 2);
  expect(io.query).not.toHaveBeenCalled();
});
