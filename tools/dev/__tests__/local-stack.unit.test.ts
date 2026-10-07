import { afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ read: vi.fn(), mkdir: vi.fn(), fetch: vi.fn() }));
vi.mock('node:fs', () => ({
  readFileSync: io.read,
  writeFileSync: vi.fn(),
  mkdirSync: io.mkdir,
  openSync: vi.fn(),
}));
const argv = process.argv;
afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('reports stopped status when the state file is absent without starting services', async () => {
  vi.resetModules();
  process.argv = [...argv.slice(0, 2), 'status'];
  io.read.mockImplementation(() => {
    throw new Error('missing');
  });
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  await import('../local-stack.mjs');
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({ running: false });
});
it('authenticates status requests and tolerates unavailable supervisors', async () => {
  process.argv = [...argv.slice(0, 2), 'status'];
  io.read.mockReturnValue(JSON.stringify({ controlPort: 12345, token: 'test-token' }));
  vi.stubGlobal('fetch', io.fetch);
  io.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ running: true }) });
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.resetModules();
  await import('../local-stack.mjs');
  expect(io.fetch).toHaveBeenCalledWith(
    'http://127.0.0.1:12345/status',
    expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
  );
  expect(JSON.parse(log.mock.calls.at(-1)![0])).toEqual({ running: true });
  for (const response of [
    () => Promise.resolve({ ok: false }),
    () => Promise.reject(new Error('offline')),
  ]) {
    io.fetch.mockImplementationOnce(response);
    vi.resetModules();
    await import('../local-stack.mjs');
    expect(JSON.parse(log.mock.calls.at(-1)![0])).toEqual({ running: false });
  }
});
