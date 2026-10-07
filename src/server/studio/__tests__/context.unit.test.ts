import { expect, it } from 'vitest';
import { currentStudioTransaction, studioId, withStudioTransaction } from '../context';
import { studioSql, studioTransaction } from '../db';
it('reuses the Zero transaction, isolates concurrent calls and derives retry-safe identifiers', async () => {
  const sql = {} as never;
  const attempt = () =>
    withStudioTransaction(sql, 'operation', async () => {
      expect(currentStudioTransaction()).toBe(sql);
      expect(studioSql()).toBe(sql);
      expect(await studioTransaction(async tx => tx)).toBe(sql);
      return [studioId(), studioId(), studioId('source')];
    });
  const first = await attempt();
  expect(await attempt()).toEqual(first);
  expect(new Set(first).size).toBe(3);
  expect(currentStudioTransaction()).toBeUndefined();
  expect(studioId()).not.toBe(studioId());
  await expect(
    withStudioTransaction(sql, 'other', async () => {
      throw new Error('rollback');
    })
  ).rejects.toThrow('rollback');
  expect(currentStudioTransaction()).toBeUndefined();
});
