import * as Y from 'yjs';
import { rows, type SqlTransaction } from '@/server/collaboration/transaction';
import { createClient } from '@/lib/supabase/server';
import {
  documentSchema,
  type StudioDocument,
} from '@/features/communication-studio/logic/document';
import { initialize } from '@/features/communication-studio/logic/collaboration';
import {
  studioSql,
  studioTransaction,
  StudioError,
  assertStudioAccess,
  assertStudioGroup,
} from './db';
export const bucket = 'studio';
export async function validateAssets(projectId: string, doc: StudioDocument) {
  const ids = [
    ...new Set(
      [...doc.pages.flatMap(p => p.elements.map(e => e.assetId)), doc.brand.logoAssetId].filter(
        (x): x is string => !!x
      )
    ),
  ];
  if (!ids.length) return;
  const sql = studioSql();
  const rows =
    await sql`select id from studio_asset where project_id=${projectId} and ready=true and id in ${sql(ids)}`;
  if (rows.length !== ids.length)
    throw new StudioError('A media file is missing or belongs to another project');
}
export async function createProject(
  userId: string,
  groupId: string | null,
  document: StudioDocument
) {
  if (groupId) await assertStudioGroup(userId, groupId);
  const id = crypto.randomUUID();
  documentSchema.parse(document);
  await validateAssets(id, document);
  const doc = new Y.Doc();
  initialize(doc, document);
  const now = Date.now();
  await studioTransaction(async tx => {
    if (groupId) await assertStudioGroup(userId, groupId, tx);
    await tx`insert into studio_project(id,owner_id,group_id,title,kind,created_at,updated_at) values(${id},${userId},${groupId},${document.title},${document.kind},${now},${now})`;
    await tx`insert into studio_state(project_id,state,document,updated_at) values(${id},${Buffer.from(Y.encodeStateAsUpdate(doc))},${tx.json(document)},${now})`;
  });
  doc.destroy();
  return { id };
}
export async function loadProject(userId: string, id: string) {
  const { openSession } = await import('@/server/collaboration/service');
  const loaded = await openSession(userId, {
    kind: 'studio',
    entityId: id,
    branchId: null,
    workspaceId: null,
  });
  if (loaded.phase !== 'active' || !loaded.session)
    throw new StudioError('collaboration_unavailable', 503);
  return {
    ...loaded.session,
    id,
    collaborationId: loaded.session.id,
    canEdit: loaded.session.capabilities.edit,
  };
}
export async function queueExport(
  userId: string,
  id: string,
  format: string,
  pageIds: string[],
  state: string
) {
  return (await import('@/server/collaboration/studio-export')).queueCommittedExport(
    userId,
    id,
    format,
    pageIds,
    state
  );
}
function detectMime(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  if (bytes.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
  throw new StudioError('Supported media: PNG, JPEG, WebP and MP4');
}
export async function beginUpload(
  userId: string,
  projectId: string,
  name: string,
  mime: string,
  size: number
) {
  await assertStudioAccess(userId, projectId, true);
  const id = crypto.randomUUID(),
    storagePath = `${projectId}/assets/${id}`,
    sql = studioSql();
  await studioTransaction(async tx => {
    await assertStudioAccess(userId, projectId, true, tx);
    await tx`select id from studio_project where id=${projectId} for update`;
    const [usage] =
      await tx`select count(*)::int as count,coalesce(sum(byte_size),0)::bigint as bytes from studio_asset where project_id=${projectId}`;
    if (usage.count >= 100 || Number(usage.bytes) + size > 500 * 1024 * 1024)
      throw new StudioError('Project media limit: 100 files / 500 MB');
    await tx`insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,ready,created_at) values(${id},${projectId},${name},${mime},${size},${storagePath},false,${Date.now()})`;
  });
  const { data, error } = await createClient()
    .storage.from(bucket)
    .createSignedUploadUrl(storagePath);
  if (error) {
    await sql`delete from studio_asset where id=${id}`;
    throw new StudioError('Cannot prepare upload', 502);
  }
  return { id, path: storagePath, token: data.token };
}
export async function finishUpload(userId: string, id: string, cancel = false) {
  const sql = studioSql();
  const [asset] = await sql`select * from studio_asset where id=${id}`;
  if (!asset) throw new StudioError('Upload not found', 404);
  await assertStudioAccess(userId, asset.project_id, true);
  if (asset.ready) return { id, mime: asset.mime_type };
  const storage = createClient().storage.from(bucket);
  if (cancel) {
    await studioTransaction(async tx => {
      await assertStudioAccess(userId, asset.project_id, true, tx);
      const [current] = await tx`select ready from studio_asset where id=${id} for update`;
      if (current?.ready) throw new StudioError('Completed media cannot be cancelled');
      await storage.remove([asset.storage_path]);
    });
    // A signed upload token remains valid after cancellation. Retain the reservation
    // until expiry so a late upload is still quota-accounted and cleaned by the worker.
    return { id, mime: asset.mime_type };
  }
  const { data: object, error: infoError } = await storage.info(asset.storage_path);
  if (infoError || !object || Number(object.size) !== Number(asset.byte_size))
    throw new StudioError('Upload is incomplete or has an unexpected size');
  const signed = await storage.createSignedUrl(asset.storage_path, 30);
  if (signed.error) throw new StudioError('Cannot verify upload');
  const response = await fetch(signed.data.signedUrl, { headers: { Range: 'bytes=0-15' } });
  if (!response.ok) throw new StudioError('Cannot verify upload');
  const mime = detectMime(Buffer.from(await response.arrayBuffer()));
  if (mime !== asset.mime_type) throw new StudioError('File content does not match its media type');
  await studioTransaction(async tx => {
    await assertStudioAccess(userId, asset.project_id, true, tx);
    await tx`update studio_asset set ready=true where id=${id}`;
  });
  return { id, mime };
}
export async function assetUrls(userId: string, projectId: string) {
  await assertStudioAccess(userId, projectId);
  const sql = studioSql();
  const rows =
    await sql`select id,name,mime_type,storage_path from studio_asset where project_id=${projectId} and ready=true`;
  return Promise.all(
    rows.map(async r => {
      const { data, error } = await createClient()
        .storage.from(bucket)
        .createSignedUrl(r.storage_path, 300);
      if (error) throw new StudioError('Cannot load media', 502);
      return { id: r.id, name: r.name, mime: r.mime_type, url: data.signedUrl };
    })
  );
}
export async function downloadExport(userId: string, id: string) {
  const sql = studioSql();
  const [job] = await sql`select * from studio_export where id=${id}`;
  if (!job) throw new StudioError('Export not found', 404);
  await assertStudioAccess(userId, job.project_id);
  if (job.status !== 'completed' || !job.storage_path) throw new StudioError('Export is not ready');
  const { data, error } = await createClient()
    .storage.from(bucket)
    .createSignedUrl(job.storage_path, 60, { download: job.file_name });
  if (error) throw new StudioError('Download failed', 502);
  return { url: data.signedUrl, name: job.file_name };
}
export async function duplicateProject(userId: string, id: string) {
  await assertStudioAccess(userId, id);
  const sql = studioSql();
  const [source] =
    await sql`select p.group_id,s.document from studio_project p join studio_state s on s.project_id=p.id where p.id=${id}`;
  const value = documentSchema.parse(source.document);
  const projectId = crypto.randomUUID();
  value.title = value.title.slice(0, 190) + ' · Kopie';
  const rows = await sql`select * from studio_asset where project_id=${id} and ready=true`;
  const copies: { id: string; name: string; mime: string; size: number; path: string }[] = [];
  const replacements = new Map<string, string>();
  const storage = createClient().storage.from(bucket);
  const doc = new Y.Doc();
  try {
    for (const row of rows) {
      const assetId = crypto.randomUUID(),
        storagePath = `${projectId}/assets/${assetId}`;
      const uploaded = await storage.copy(row.storage_path, storagePath);
      if (uploaded.error) throw new StudioError('Cannot copy media');
      copies.push({
        id: assetId,
        name: row.name,
        mime: row.mime_type,
        size: Number(row.byte_size),
        path: storagePath,
      });
      replacements.set(row.id, assetId);
    }
    value.pages.forEach(p =>
      p.elements.forEach(e => {
        if (e.assetId) e.assetId = replacements.get(e.assetId) ?? null;
      })
    );
    if (value.brand.logoAssetId)
      value.brand.logoAssetId = replacements.get(value.brand.logoAssetId) ?? null;
    await assertStudioAccess(userId, id);
    if (source.group_id) await assertStudioGroup(userId, source.group_id);
    initialize(doc, value);
    const now = Date.now();
    // A copy becomes visible only after every private asset and its document are ready.
    await studioTransaction(async tx => {
      await assertStudioAccess(userId, id, false, tx);
      if (source.group_id) await assertStudioGroup(userId, source.group_id, tx);
      await tx`insert into studio_project(id,owner_id,group_id,title,kind,created_at,updated_at) values(${projectId},${userId},${source.group_id},${value.title},${value.kind},${now},${now})`;
      for (const asset of copies)
        await tx`insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,created_at) values(${asset.id},${projectId},${asset.name},${asset.mime},${asset.size},${asset.path},${now})`;
      await tx`insert into studio_state(project_id,state,document,updated_at) values(${projectId},${Buffer.from(Y.encodeStateAsUpdate(doc))},${tx.json(value)},${now})`;
    });
    return { id: projectId };
  } catch (error) {
    if (copies.length) await storage.remove(copies.map(a => a.path));
    throw error;
  } finally {
    doc.destroy();
  }
}
export async function validateStudioStatementRefs(
  userId: string,
  values: { image_url?: string | null; video_url?: string | null },
  transaction: () => SqlTransaction
) {
  for (const value of [values.image_url, values.video_url]) {
    if (!value?.startsWith('/api/studio/published-media/')) continue;
    const id = value.slice('/api/studio/published-media/'.length);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new StudioError('Invalid studio media');
    const [job] = await rows<{ allowed: boolean }>(
      transaction(),
      "select studio_access($2::uuid,project_id,true) as allowed from studio_export where id=$1 and status='completed'",
      [id, userId]
    );
    if (!job) throw new StudioError('Unknown studio export');
    if (!job.allowed) throw new StudioError('No access to this studio project', 403);
  }
}
