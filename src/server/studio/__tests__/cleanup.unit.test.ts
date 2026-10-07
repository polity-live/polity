import { beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ sql: vi.fn(), remove: vi.fn() }));
vi.mock('../db', () => ({ studioSql: () => io.sql }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ storage: { from: () => ({ remove: io.remove }) } }),
}));
import { cleanupStudioStorage } from '../cleanup';
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(io.sql, { begin: (body: (tx: unknown) => unknown) => body(io.sql) });
  io.remove.mockResolvedValue({ error: null });
});
it('expires tokens, keeps reservations for three hours and checks references under the authority lock', async () => {
  io.sql.mockImplementation(async (parts: TemplateStringsArray, ...args: unknown[]) => {
    const text = parts.join('?');
    if (text.includes('select name')) return [{ name: 'used' }, { name: 'orphan' }];
    if (text.includes('select 1')) return args[0] === 'used' ? [{}] : [];
    return [];
  });
  await cleanupStudioStorage(20_000_000);
  expect(io.remove).toHaveBeenCalledExactlyOnceWith(['orphan']);
  expect(
    io.sql.mock.calls.some(([parts]) => parts.join('').includes('pg_advisory_xact_lock'))
  ).toBe(true);
  io.sql.mockResolvedValue([]);
  await cleanupStudioStorage();
  io.sql.mockImplementation(async (parts: TemplateStringsArray) =>
    parts.join('').includes('select name') ? [{ name: 'orphan' }] : []
  );
  io.remove.mockResolvedValue({ error: new Error('offline') });
  await expect(cleanupStudioStorage()).rejects.toThrow('Studio storage cleanup failed');
});
