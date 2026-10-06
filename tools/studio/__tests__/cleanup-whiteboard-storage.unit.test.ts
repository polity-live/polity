import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ sql: vi.fn(), end: vi.fn(), remove: vi.fn(), from: vi.fn() }));
vi.mock('postgres', () => ({ default: () => Object.assign(io.sql, { end: io.end }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: io.from } }) }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('STUDIO_DATABASE_URL', 'postgresql://local/test');
  vi.stubEnv('SUPABASE_URL', 'http://local');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test');
  io.from.mockReturnValue({ remove: io.remove });
  io.remove.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
it('removes only unpublished manifest objects and marks them after storage confirms removal', async () => {
  const item = { bucket_id: 'studio', storage_path: 'retired/private' };
  io.sql
    .mockResolvedValueOnce([item])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  await import('../cleanup-whiteboard-storage');
  expect(io.from).toHaveBeenCalledWith('studio');
  expect(io.remove).toHaveBeenCalledWith(['retired/private']);
  expect(io.sql.mock.calls[2][0].join('?')).toContain('set removed_at=');
  expect(io.end).toHaveBeenCalledOnce();
});
it('refuses to remove published media and closes the database on failure', async () => {
  io.sql
    .mockResolvedValueOnce([{ bucket_id: 'studio', storage_path: 'published' }])
    .mockResolvedValueOnce([{ id: 'post' }]);
  await expect(import('../cleanup-whiteboard-storage')).rejects.toThrow(
    'Published media is in the cleanup manifest'
  );
  expect(io.remove).not.toHaveBeenCalled();
  expect(io.end).toHaveBeenCalledOnce();
});
it('preserves the manifest when storage rejects removal and requires server configuration', async () => {
  io.sql
    .mockResolvedValueOnce([{ bucket_id: 'studio', storage_path: 'failed' }])
    .mockResolvedValueOnce([]);
  io.remove.mockResolvedValueOnce({ error: new Error('storage unavailable') });
  await expect(import('../cleanup-whiteboard-storage')).rejects.toThrow('storage unavailable');
  expect(io.sql).toHaveBeenCalledTimes(2);
  expect(io.end).toHaveBeenCalledOnce();
  vi.resetModules();
  vi.stubEnv('SUPABASE_URL', '');
  await expect(import('../cleanup-whiteboard-storage')).rejects.toThrow('are required');
});
