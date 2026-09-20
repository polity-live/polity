import { describe, expect, it, vi } from 'vitest';
import {
  assertActive,
  documentBranch,
  AUTHORITY_LOCK,
  lockAuthority,
  migrationState,
  rows,
  sqlTransaction,
} from '../transaction';
describe('authoritative transaction boundary', () => {
  it('resolves unique text branches and rejects mismatched or ambiguous decision and access scope', async () => {
    const query = vi.fn().mockResolvedValue([]),
      sql = { query };
    expect(await documentBranch(sql, 'text')).toBeNull();
    await expect(documentBranch(sql, 'text', 'foreign')).rejects.toThrow('invalid_branch');
    query.mockResolvedValue([{ id: 'branch' }]);
    expect(await documentBranch(sql, 'text', 'branch')).toBe('branch');
    expect(await documentBranch(sql, 'text')).toBe('branch');
    await expect(documentBranch(sql, 'text', 'foreign')).rejects.toThrow('invalid_branch');
    query.mockResolvedValue([{ id: 'first' }, { id: 'second' }]);
    await expect(documentBranch(sql, 'text', 'first')).rejects.toThrow(
      'ambiguous_document_branches'
    );
  });
  it('requires a server transaction and acquires the shared authority lock on that transaction', async () => {
    const query = vi.fn().mockResolvedValue([]),
      sql = { query };
    expect(sqlTransaction({ location: 'server', dbTransaction: sql } as never)).toBe(sql);
    expect(() => sqlTransaction({ location: 'client' } as never)).toThrow('server_required');
    await lockAuthority(sql);
    expect(query).toHaveBeenLastCalledWith('select pg_advisory_xact_lock($1)', [AUTHORITY_LOCK]);
  });
  it('fails closed before schema initialization or during maintenance and normalizes driver iterables', async () => {
    const query = vi.fn().mockResolvedValue([]),
      sql = { query };
    await expect(migrationState(sql)).rejects.toThrow('collaboration_not_initialized');
    query.mockResolvedValue([{ phase: 'maintenance' }]);
    await expect(assertActive(sql)).rejects.toThrow('collaboration_unavailable');
    query.mockResolvedValue([{ phase: 'active' }]);
    await expect(assertActive(sql)).resolves.toBeUndefined();
    query.mockResolvedValue(new Set([{ id: 'row' }]));
    expect(await rows(sql, 'select id')).toEqual([{ id: 'row' }]);
  });
});
