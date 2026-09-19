import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '../../src/lib/supabase/server';
import { studioSql, assertStudioAccess } from '../../src/server/studio/db';
import { documentSchema } from '../../src/features/communication-studio/logic/document';
import { render, type MediaMap } from './exporters';
const sql = studioSql();
const storage = createClient().storage.from('studio');
const healthFile = process.argv
  .find(arg => arg.startsWith('--health-file='))
  ?.slice('--health-file='.length);
if (healthFile) {
  const dependency = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  if (dependency.status !== 0)
    throw new Error('Studio exports require FFmpeg. Configure FFMPEG_PATH or add FFmpeg to PATH.');
}
const reportHealth = () => {
  if (healthFile)
    writeFileSync(healthFile, JSON.stringify({ pid: process.pid, at: Date.now(), ready: true }));
};
const healthTimer = healthFile ? setInterval(reportHealth, 10_000) : null;
reportHealth();
let stop = false;
let lastCleanup = 0;
process.on('SIGTERM', () => {
  stop = true;
});
process.on('SIGINT', () => {
  stop = true;
});
while (!stop) {
  if (Date.now() - lastCleanup > 10 * 60_000) {
    const abandoned =
      await sql`delete from studio_asset where ready=false and created_at<${Date.now() - 3 * 60 * 60_000} returning storage_path`;
    if (abandoned.length) await storage.remove(abandoned.map(a => a.storage_path));
    lastCleanup = Date.now();
  }
  // A worker that disappears leaves a lease; retry twice, then expose the failure.
  await sql`update studio_export set status=case when attempts<3 then 'queued' else 'failed' end,error='Worker connection interrupted',updated_at=${Date.now()} where status='running' and lease_at<${Date.now() - 120_000}`;
  const job = await sql.begin(async tx => {
    const [next] =
      await tx`select * from studio_export where status='queued' order by created_at for update skip locked limit 1`;
    if (!next) return null;
    await tx`update studio_export set status='running',attempts=attempts+1,lease_at=${Date.now()},updated_at=${Date.now()},error=null where id=${next.id}`;
    return next;
  });
  if (!job) {
    await new Promise(r => setTimeout(r, 1500));
    continue;
  }
  const temp = await mkdtemp(path.join(os.tmpdir(), 'polity-studio-'));
  const heartbeat = setInterval(() => {
    void sql`update studio_export set lease_at=${Date.now()} where id=${job.id} and status='running'`;
  }, 15_000);
  try {
    await assertStudioAccess(job.requested_by_id, job.project_id);
    const [rev] = await sql`select document from studio_revision where id=${job.revision_id}`;
    const document = documentSchema.parse(rev.document);
    const rows =
      await sql`select * from studio_asset where project_id=${job.project_id} and ready=true`;
    const media: MediaMap = {};
    for (const row of rows) {
      const { data, error } = await storage.download(row.storage_path);
      if (error || !data) throw new Error('Media unavailable');
      media[row.id] = {
        mime: row.mime_type,
        name: row.name,
        bytes: new Uint8Array(await data.arrayBuffer()),
      };
    }
    const cancelled = async () => {
      const [row] = await sql`select status from studio_export where id=${job.id}`;
      try {
        await assertStudioAccess(job.requested_by_id, job.project_id);
      } catch {
        return true;
      }
      return !row || row.status === 'cancelled' || stop;
    };
    const result = await render(
      document,
      media,
      job.format,
      job.page_ids,
      temp,
      async n => {
        await sql`update studio_export set progress=${n},updated_at=${Date.now()} where id=${job.id} and status='running'`;
      },
      cancelled
    );
    if (await cancelled()) throw new Error('Export cancelled');
    const storagePath = `${job.project_id}/exports/${job.id}/${result.name}`;
    const { error } = await storage.upload(storagePath, result.bytes, {
      contentType: result.mime,
      upsert: true,
    });
    if (error) throw new Error('Cannot store export');
    await sql`update studio_export set status='completed',progress=100,storage_path=${storagePath},file_name=${result.name},updated_at=${Date.now()} where id=${job.id} and status='running'`;
  } catch (error) {
    console.error('studio.export.failed', {
      id: job.id,
      error: error instanceof Error ? error.message : 'Export failed',
    });
    await sql`update studio_export set status='failed',error=${error instanceof Error ? error.message.slice(0, 500) : 'Export failed'},updated_at=${Date.now()} where id=${job.id} and status='running'`;
  } finally {
    clearInterval(heartbeat);
    if (path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep + 'polity-studio-'))
      await rm(temp, { recursive: true, force: true });
    else console.error('Invalid temporary directory; cleanup skipped');
  }
}
await sql.end();
if (healthTimer) clearInterval(healthTimer);
