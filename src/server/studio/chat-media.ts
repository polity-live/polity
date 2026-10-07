import type { ZeroTransaction } from '@/server/zero-mutate';
import { rows, sqlTransaction } from '@/server/transaction';
import { createClient } from '@/lib/supabase/server';
import { detectMime } from './service';

/** Copies only server-approved uploads from the current run into project-owned media. */
export async function importChatMedia(
  tx: ZeroTransaction,
  actor: string,
  runId: string,
  projectId: string,
  path: string,
  assetId: string
) {
  const sql = sqlTransaction(tx);
  const [run] = await rows<{
    configuration: { sharedAttachments?: { entityType: string; entityId: string }[] };
  }>(sql, 'select configuration from ai_run where id=$1 and actor_id=$2', [runId, actor]);
  if (
    !path.startsWith('editor-uploads/') ||
    path.includes('..') ||
    !run?.configuration.sharedAttachments?.some(
      a => a.entityType === 'document' && a.entityId === path
    )
  )
    throw new Error('Attachment was not shared with this project run');
  const [access] = await rows<{ allowed: boolean }>(
    sql,
    'select studio_access($1::uuid,$2::uuid,true) as allowed',
    [actor, projectId]
  );
  if (!access?.allowed) throw new Error('Studio access denied');
  await sql.query('select id from studio_project where id=$1 for update', [projectId]);
  const [prior] = await rows<{ id: string; mime_type: string }>(
    sql,
    'select id,mime_type from studio_asset where id=$1 and project_id=$2 and workspace_id is null and ready=true',
    [assetId, projectId]
  );
  if (prior) return { assetId: prior.id, mime: prior.mime_type, status: 'ready' };
  const [object] = await rows<{ metadata: { size: number; mimetype: string }; owner_id: string }>(
    sql,
    "select metadata,owner_id::text from storage.objects where bucket_id='uploads' and name=$1",
    [path]
  );
  if (!object || object.owner_id !== actor) throw new Error('Upload no longer accessible');
  const size = Number(object.metadata.size),
    mime = object.metadata.mimetype;
  if (
    !['image/png', 'image/jpeg', 'image/webp', 'video/mp4'].includes(mime) ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > 100 * 1024 * 1024
  )
    throw new Error('Unsupported media or file size');
  const [usage] = await rows<{ count: number; bytes: number }>(
    sql,
    'select count(*)::int as count,coalesce(sum(byte_size),0)::bigint as bytes from studio_asset where project_id=$1',
    [projectId]
  );
  if (usage.count >= 100 || Number(usage.bytes) + size > 500 * 1024 * 1024)
    throw new Error('Project media quota exceeded');
  const storage = createClient().storage,
    source = storage.from('uploads');
  const signed = await source.createSignedUrl(path, 30);
  if (signed.error) throw new Error('Cannot verify media');
  const response = await fetch(signed.data.signedUrl, { headers: { Range: 'bytes=0-15' } });
  if (!response.ok || detectMime(Buffer.from(await response.arrayBuffer())) !== mime)
    throw new Error('Media signature does not match its type');
  const destination = `${projectId}/assets/${assetId}`;
  const copied = await source.copy(path, destination, { destinationBucket: 'studio' });
  if (copied.error) {
    const existing = await storage.from('studio').info(destination);
    if (existing.error || Number(existing.data.size) !== size)
      throw new Error('Cannot copy shared media');
  }
  await sql.query(
    'insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,ready,created_at) values($1,$2,$3,$4,$5,$6,true,$7)',
    [
      assetId,
      projectId,
      path.substring(path.lastIndexOf('/') + 1).slice(0, 200),
      mime,
      size,
      destination,
      Date.now(),
    ]
  );
  return { assetId, mime, status: 'ready' };
}
