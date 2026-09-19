import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../../src/zero/db-provider', () => ({
  dbProvider: { transaction: (body: any) => body({ dbTransaction: { query: io.query } }) },
}));
const original = process.argv;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => {
  process.argv = original;
  vi.restoreAllMocks();
});
it.each(['maintenance', 'convert', 'activate', 'abort', 'rollback', 'preflight'])(
  'refuses retired migration command %s before changing the database',
  async command => {
    process.argv = ['node', 'launch', 'migrate', command];
    await expect(import('../migrate')).rejects.toThrow('all-editor migration has been reverted');
    expect(io.query).not.toHaveBeenCalled();
  }
);
it.each([undefined, 'status'])(
  'reports Studio-only status without writing with argument %j',
  async command => {
    process.argv = ['node', 'launch', 'migrate', ...(command ? [command] : [])];
    io.query.mockResolvedValue([{ phase: 'active', compatibility: false }]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await import('../migrate');
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      phase: 'active',
      compatibility: false,
      scope: 'studio-only',
    });
    expect(io.query).toHaveBeenCalledExactlyOnceWith(
      'select phase,compatibility from collaboration_control where singleton',
      []
    );
  }
);
