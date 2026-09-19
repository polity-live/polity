import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
const io = vi.hoisted(() => ({
  sql: vi.fn(),
  begin: vi.fn(),
  end: vi.fn(),
  access: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  render: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  health: vi.fn(),
  dependency: vi.fn(),
}));
vi.mock('../../../src/server/studio/db', () => ({
  studioSql: () => io.sql,
  assertStudioAccess: io.access,
}));
vi.mock('../../../src/lib/supabase/server', () => ({
  createClient: () => ({
    storage: { from: () => ({ download: io.download, upload: io.upload, remove: io.remove }) },
  }),
}));
vi.mock('../exporters', () => ({ render: io.render }));
vi.mock('node:fs/promises', () => ({ mkdtemp: io.mkdir, rm: io.rm }));
vi.mock('node:fs', () => ({ writeFileSync: io.health }));
vi.mock('node:child_process', () => ({ spawnSync: io.dependency }));
const argv = process.argv;
let signals: Record<string, () => void>,
  intervals: (() => void)[],
  job: any,
  rows: any[],
  abandoned: any[],
  status: any[],
  nextCount: number;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.argv = [process.execPath, 'worker.ts'];
  signals = {};
  intervals = [];
  nextCount = 0;
  vi.spyOn(process, 'on').mockImplementation(((event: string, callback: () => void) => {
    signals[event] = callback;
    return process;
  }) as any);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('setInterval', (callback: () => void) => {
    intervals.push(callback);
    return intervals.length;
  });
  vi.stubGlobal('clearInterval', vi.fn());
  vi.stubGlobal('setTimeout', (callback: () => void) => {
    signals.SIGTERM();
    callback();
    return 1;
  });
  job = {
    id: 'export',
    project_id: 'project',
    revision_id: 'proof',
    requested_by_id: 'actor',
    format: 'png',
    page_ids: [],
  };
  rows = [{ id: 'media', mime_type: 'image/png', name: 'photo', storage_path: 'private/image' }];
  abandoned = [{ storage_path: 'expired/upload' }];
  status = [{ status: 'running' }];
  Object.assign(io.sql, { begin: io.begin, end: io.end });
  io.begin.mockImplementation(body => body(io.sql));
  io.end.mockResolvedValue(undefined);
  io.access.mockResolvedValue(undefined);
  io.mkdir.mockResolvedValue(path.join(os.tmpdir(), 'polity-studio-unit'));
  io.rm.mockResolvedValue(undefined);
  io.dependency.mockReturnValue({ status: 0 });
  io.download.mockResolvedValue({ data: new Blob(['image']), error: null });
  io.upload.mockResolvedValue({ error: null });
  io.remove.mockResolvedValue({ error: null });
  io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
    const sql = parts.join('?');
    if (sql.startsWith('delete from studio_asset')) return abandoned;
    if (sql.startsWith('select * from studio_export')) return nextCount++ === 0 && job ? [job] : [];
    if (sql.startsWith('select document'))
      return [{ document: createDocument('single', 'Snapshot') }];
    if (sql.startsWith('select * from studio_asset')) return rows;
    if (sql.startsWith('select status')) return status;
    if (sql.includes("set status='completed'") || sql.includes("set status='failed'"))
      signals.SIGTERM();
    return [];
  });
  io.render.mockImplementation(async (_doc, _media, _format, _pages, _dir, progress, cancelled) => {
    intervals.forEach(callback => callback());
    await progress(45);
    expect(await cancelled()).toBe(false);
    return { name: 'result.png', mime: 'image/png', bytes: new Uint8Array([1]) };
  });
});
afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const calls = (text: string) =>
  io.sql.mock.calls.filter(([parts]) => parts.join('?').includes(text));
describe('Studio export worker lifecycle', () => {
  it('polls an idle queue repeatedly without running media cleanup on every poll', async () => {
    job = null;
    let polls = 0;
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      if (++polls === 2) signals.SIGTERM();
      callback();
      return 1;
    });
    await import('../worker');
    expect(calls('delete from studio_asset')).toHaveLength(1);
    expect(calls('for update skip locked')).toHaveLength(2);
    expect(io.render).not.toHaveBeenCalled();
  });
  it('claims a leased job, renders its immutable snapshot, renews the lease and publishes only the finished artifact', async () => {
    process.argv.push('--health-file=worker-health.json');
    vi.stubEnv('FFMPEG_PATH', 'configured-ffmpeg');
    await import('../worker');
    expect(io.dependency).toHaveBeenCalledWith(
      'configured-ffmpeg',
      ['-version'],
      expect.objectContaining({ windowsHide: true })
    );
    expect(io.health).toHaveBeenCalledWith(
      'worker-health.json',
      expect.stringContaining('"ready":true')
    );
    expect(calls('for update skip locked')).toHaveLength(1);
    expect(calls('attempts=attempts+1')).toHaveLength(1);
    expect(calls('set lease_at=')).toHaveLength(1);
    expect(calls('set progress=')).toHaveLength(1);
    expect(io.render.mock.calls[0][0].title).toBe('Snapshot');
    expect(io.render.mock.calls[0][1].media).toMatchObject({ mime: 'image/png', name: 'photo' });
    expect(io.upload).toHaveBeenCalledWith(
      'project/exports/export/result.png',
      new Uint8Array([1]),
      { contentType: 'image/png', upsert: true }
    );
    expect(calls("set status='completed'")).toHaveLength(1);
    expect(io.remove).toHaveBeenCalledWith(['expired/upload']);
    expect(io.rm).toHaveBeenCalledWith(path.join(os.tmpdir(), 'polity-studio-unit'), {
      recursive: true,
      force: true,
    });
    expect(io.end).toHaveBeenCalled();
  });
  it('waits when the queue is empty and shuts down without inventing jobs or temporary files', async () => {
    job = null;
    abandoned = [];
    await import('../worker');
    expect(io.render).not.toHaveBeenCalled();
    expect(io.mkdir).not.toHaveBeenCalled();
    expect(io.remove).not.toHaveBeenCalled();
    expect(io.end).toHaveBeenCalled();
  });
  it('fails closed before rendering after permission revocation or unavailable media', async () => {
    io.access.mockRejectedValueOnce(new Error('revoked'));
    await import('../worker');
    expect(io.render).not.toHaveBeenCalled();
    expect(calls("set status='failed'")[0]).toContain('revoked');
  });
  it('reports missing media and refuses to publish a partial artifact', async () => {
    io.download.mockResolvedValue({ data: null, error: true });
    await import('../worker');
    expect(calls("set status='failed'")[0]).toContain('Media unavailable');
    expect(io.upload).not.toHaveBeenCalled();
  });
  it('checks cancellation and current access during rendering and once again before publication', async () => {
    io.render.mockImplementation(
      async (_doc, _media, _format, _pages, _dir, _progress, cancelled) => {
        status = [];
        expect(await cancelled()).toBe(true);
        status = [{ status: 'cancelled' }];
        expect(await cancelled()).toBe(true);
        status = [{ status: 'running' }];
        io.access.mockRejectedValueOnce(new Error('revoked'));
        expect(await cancelled()).toBe(true);
        signals.SIGINT();
        expect(await cancelled()).toBe(true);
        return { name: 'result.png', mime: 'image/png', bytes: new Uint8Array([1]) };
      }
    );
    await import('../worker');
    expect(io.upload).not.toHaveBeenCalled();
    expect(calls("set status='failed'")[0]).toContain('Export cancelled');
  });
  it('records storage failures and always releases the rendering temporary directory', async () => {
    io.upload.mockResolvedValue({ error: true });
    await import('../worker');
    expect(calls("set status='failed'")[0]).toContain('Cannot store export');
    expect(io.rm).toHaveBeenCalledTimes(1);
  });
  it('normalizes non-Error failures and refuses unsafe temporary cleanup paths', async () => {
    io.mkdir.mockResolvedValue(path.join(os.tmpdir(), 'unrelated'));
    io.render.mockRejectedValue('unexpected rejection');
    await import('../worker');
    expect(calls("set status='failed'")[0]).toContain('Export failed');
    expect(io.rm).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Invalid temporary directory; cleanup skipped');
  });
  it('rejects a missing encoder before announcing readiness or consuming jobs', async () => {
    process.argv.push('--health-file=worker-health.json');
    vi.stubEnv('FFMPEG_PATH', '');
    io.dependency.mockReturnValue({ status: 1 });
    await expect(import('../worker')).rejects.toThrow('Studio exports require FFmpeg');
    expect(io.dependency.mock.calls[0][0]).toBe('ffmpeg');
    expect(io.health).not.toHaveBeenCalled();
    expect(io.begin).not.toHaveBeenCalled();
  });
});
