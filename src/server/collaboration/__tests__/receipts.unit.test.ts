import { describe, it, expect, vi } from 'vitest';
import { commandReceipt } from '../receipts';
import { checksum } from '../store';

describe('durable command identity', () => {
  const request = {
    operation: 'restore',
    generation: 'generation',
    expectedRevision: 2,
    value: { text: 'original' },
  };
  it('records the actor and complete request with the durable result', async () => {
    const query = vi.fn().mockResolvedValue([]),
      sql = { query };
    const receipt = await commandReceipt(sql, 'document', 'actor', 'operation', request);
    expect(receipt.previous).toBeUndefined();
    const result = { id: 'revision', revision: 3 };
    expect(await receipt.record(result)).toBe(result);
    expect(query.mock.calls[1][1]).toEqual([
      'document',
      'operation',
      'actor',
      checksum(request),
      result,
      expect.any(Number),
    ]);
  });
  it('replays the result without rewriting and rejects changed input or a different actor', async () => {
    const result = { id: 'revision', revision: 3 };
    const query = vi
      .fn()
      .mockResolvedValue([{ actor_id: 'actor', request_hash: checksum(request), result }]);
    expect(
      (await commandReceipt({ query }, 'document', 'actor', 'operation', request)).previous
    ).toEqual(result);
    await expect(
      commandReceipt({ query }, 'document', 'other', 'operation', request)
    ).rejects.toThrow('operation_id_reused');
    await expect(
      commandReceipt({ query }, 'document', 'actor', 'operation', {
        ...request,
        value: { text: 'substitution' },
      })
    ).rejects.toThrow('operation_id_reused');
    await expect(
      commandReceipt({ query }, 'document', 'actor', 'operation', {
        ...request,
        operation: 'rebase',
      })
    ).rejects.toThrow('operation_id_reused');
    expect(query.mock.calls.every(([statement]) => statement.startsWith('select'))).toBe(true);
  });
});
