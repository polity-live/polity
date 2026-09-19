import { describe, expect, it, vi } from 'vitest';
import { inheritGroupedDecision } from '../governance';

function transaction(target: Record<string, unknown> = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('select *'))
      return [
        {
          change_request_id: 'primary',
          document_id: 'doc',
          checksum: 'same',
          decision_result: 'passed',
          application_revision_id: 'revision-2',
          conflict_reason: null,
        },
        {
          change_request_id: 'duplicate',
          document_id: 'doc',
          checksum: 'same',
          decision_result: null,
          ...target,
        },
      ];
    if (sql.includes('select phase')) return [{ phase: 'active' }];
    return [];
  });
  return { tx: { location: 'server', dbTransaction: { query } } as never, query };
}

describe('duplicate proposal decision proofs', () => {
  it('references the same applied revision without applying content twice', async () => {
    const { tx, query } = transaction();
    await inheritGroupedDecision(tx, 'primary', 'duplicate');
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('update collaboration_proposal'),
      ['passed', 'applied', 'revision-2', null, 'duplicate']
    );
  });
  it('retains the decision but marks differing submitted content as a conflict', async () => {
    const { tx, query } = transaction({ checksum: 'different' });
    await inheritGroupedDecision(tx, 'primary', 'duplicate');
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('update collaboration_proposal'),
      ['passed', 'conflict', null, 'grouped_proposal_content_differs', 'duplicate']
    );
  });
  it('does not silently reinterpret an existing decision', async () => {
    const { tx, query } = transaction({ decision_result: 'rejected' });
    await expect(inheritGroupedDecision(tx, 'primary', 'duplicate')).rejects.toThrow(
      'decision_already_recorded'
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});
