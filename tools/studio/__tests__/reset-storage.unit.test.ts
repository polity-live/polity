import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  status: vi.fn(),
  sql: vi.fn(),
  end: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
  client: vi.fn(),
}));
vi.mock('node:child_process', () => ({ execFileSync: io.status }));
vi.mock('postgres', () => ({ default: () => Object.assign(io.sql, { end: io.end }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: io.client }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  io.status.mockReturnValue(
    JSON.stringify({
      API_URL: 'http://127.0.0.1:54321',
      DB_URL: 'postgresql://local/test',
      SERVICE_ROLE_KEY: 'test',
    })
  );
  io.client.mockReturnValue({ storage: { from: io.from } });
  io.from.mockReturnValue({ remove: io.remove });
  io.remove.mockResolvedValue({ error: null });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());
it('rejects remote storage before creating a client', async () => {
  io.status.mockReturnValue(JSON.stringify({ API_URL: 'https://www.polity.live' }));
  await expect(import('../reset-storage')).rejects.toThrow('Local Supabase required');
  expect(io.client).not.toHaveBeenCalled();
});
it('marks reset objects only after removal and reports the removed count', async () => {
  io.sql
    .mockResolvedValueOnce([{ bucket_id: 'studio', storage_path: 'reset/object' }])
    .mockResolvedValueOnce([]);
  await import('../reset-storage');
  expect(io.remove).toHaveBeenCalledWith(['reset/object']);
  expect(io.sql.mock.calls[1][0].join('?')).toContain('set removed_at=');
  expect(console.log).toHaveBeenCalledWith('{"removed":1}');
  expect(io.end).toHaveBeenCalledOnce();
});
it('keeps failed cleanup retryable and always closes its connection', async () => {
  io.sql.mockResolvedValueOnce([{ bucket_id: 'studio', storage_path: 'failed' }]);
  io.remove.mockResolvedValueOnce({ error: new Error('storage unavailable') });
  await expect(import('../reset-storage')).rejects.toThrow('storage unavailable');
  expect(io.sql).toHaveBeenCalledOnce();
  expect(io.end).toHaveBeenCalledOnce();
});
