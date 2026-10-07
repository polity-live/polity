import { expect, it, vi } from 'vitest';
import { afterCommit, withAfterCommit } from '../../after-commit';
it('delivers after commit, deduplicates effects and isolates rollback and delivery failures', async () => {
  const delivered = vi.fn().mockResolvedValue('sent');
  expect(await afterCommit('outside', delivered)).toBe('sent');
  delivered.mockClear();
  const order: string[] = [];
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  expect(
    await withAfterCommit(async () => {
      afterCommit('same', async () => {
        throw new Error('superseded');
      });
      afterCommit('same', async () => {
        order.push('sent');
      });
      afterCommit('fail', async () => {
        throw new Error('delivery');
      });
      afterCommit('last', delivered);
      order.push('commit');
      return 7;
    })
  ).toBe(7);
  expect(order).toEqual(['commit', 'sent']);
  expect(delivered).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledWith('studio.post_commit_failed', { operationId: 'fail' });
  delivered.mockClear();
  await expect(
    withAfterCommit(async () => {
      afterCommit('rollback', delivered);
      throw new Error('db');
    })
  ).rejects.toThrow('db');
  expect(delivered).not.toHaveBeenCalled();
  log.mockRestore();
});
