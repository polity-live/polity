import { copyStudioAsset, removeFailedStudioCopies } from './storage';
import { studioId } from './context';
import { rows, type SqlTransaction } from '@/server/transaction';
import { assertCanvasWorkspace } from './workspace-access';
import { createClient } from '@/lib/supabase/server';
import {
  studioDocumentV3Schema,
  type StudioDocumentV3,
} from '@/features/communication-studio/logic/document-v3';
import { createStudioTemplateDocumentV5 } from '@/features/communication-studio/logic/templates-v5';
import {
  applyThemeSnapshot,
  createThemeSnapshot,
  DEFAULT_STUDIO_THEME,
  themeToLegacyBrand,
} from '@/features/communication-studio/logic/theme';
import {
  appearanceThemeDefinitionSchema,
  getBuiltinTheme,
} from '@/features/shared/appearance-theme';
import {
  studioSql,
  studioTransaction,
  StudioError,
  assertStudioAccess,
  assertStudioGroup,
} from './db';
export const bucket = 'studio';

interface CreateProjectSelection {
  groupId: string | null;
  visibility: 'public' | 'authenticated' | 'private';
  title: string;
  kind: StudioDocumentV3['kind'];
  themeId: string;
  themeMode: 'light' | 'dark';
  template: { kind: 'builtin'; id: string } | { kind: 'project'; id: string };
  campaign: { weeks: number; core: number; stories: number };
}

export async function resolveStudioTheme(
  userId: string,
  groupId: string | null,
  themeId: string,
  mode: 'light' | 'dark'
) {
  const builtin = getBuiltinTheme(themeId);
  if (builtin) return createThemeSnapshot(builtin, mode);
  const sql = studioSql();
  const [row] = await sql`
    select t.*,r.id as revision_id,r.version,r.light_palette,r.dark_palette,r.fonts,r.text_styles
    from appearance_theme t
    join appearance_theme_revision r on r.id=t.current_revision_id and r.status='published'
    where t.id=${themeId}
      and ((t.kind='personal' and t.created_by_id=${userId})
        or (t.kind='group' and t.group_id=${groupId}))`;
  if (!row) throw new StudioError('Theme not found or not published', 404);
  const definition = appearanceThemeDefinitionSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    kind: row.kind,
    groupId: row.group_id,
    ownerId: row.created_by_id,
    version: row.version,
    light: row.light_palette,
    dark: row.dark_palette,
    fonts: row.fonts,
    textStyles: row.text_styles,
  });
  return createThemeSnapshot(definition, mode, row.revision_id);
}

export async function createProjectFromSelection(
  userId: string,
  input: CreateProjectSelection,
  id = studioId()
) {
  if (input.groupId) await assertStudioGroup(userId, input.groupId, studioSql(), true);
  const theme = await resolveStudioTheme(userId, input.groupId, input.themeId, input.themeMode);
  const projectId = id;
  let document: StudioDocumentV3;
  let templateAssets: Record<string, unknown>[] = [];
  let sourceReferences: unknown[] = [];

  if (input.template.kind === 'project') {
    await assertStudioAccess(userId, input.template.id);
    const sql = studioSql();
    const [template] = await sql`
      select s.document,p.source_references
      from studio_project p join studio_state s on s.project_id=p.id
      where p.id=${input.template.id} and p.is_template=true and p.document_schema_version=5`;
    if (!template) throw new StudioError('Studio template not found', 404);
    document = studioDocumentV3Schema.parse(structuredClone(template.document));
    sourceReferences = template.source_references ?? [];
    templateAssets = await sql`
      select * from studio_asset
      where project_id=${input.template.id} and workspace_id is null and ready=true`;
  } else {
    document = createStudioTemplateDocumentV5(
      input.kind,
      input.title,
      themeToLegacyBrand(DEFAULT_STUDIO_THEME),
      input.campaign.weeks,
      input.template.id,
      { core: input.campaign.core, stories: input.campaign.stories }
    );
  }
  document.title = input.title;
  document.kind = input.kind;
  applyThemeSnapshot(document, theme);

  const replacements = new Map<string, string>();
  const copied: { id: string; name: string; mime: string; size: number; path: string }[] = [];
  const storage = createClient().storage.from(bucket);
  try {
    for (const row of templateAssets) {
      const id = studioId(`asset:${row.id}`);
      const path = `${projectId}/assets/${id}`;
      const result = await copyStudioAsset(storage, String(row.storage_path), path);
      if (result.error) throw new StudioError('Cannot copy template media', 502);
      replacements.set(String(row.id), id);
      copied.push({
        id,
        name: String(row.name),
        mime: String(row.mime_type),
        size: Number(row.byte_size),
        path,
      });
    }
    document.nodes = document.nodes.filter(node => {
      if (node.type === 'media') {
        const replacement = replacements.get(node.assetId);
        if (!replacement) return false;
        node.assetId = replacement;
      }
      if (node.type === 'chart' && node.sourceAssetId)
        node.sourceAssetId = replacements.get(node.sourceAssetId) ?? null;
      return true;
    });
    studioDocumentV3Schema.parse(document);
    const now = Date.now();
    await studioTransaction(async tx => {
      if (input.groupId) await assertStudioGroup(userId, input.groupId, tx, true);
      if (input.template.kind === 'project') {
        const audience = input.groupId
          ? await tx`select owner_id as id from "group" where id=${input.groupId}
              union select user_id as id from group_membership where group_id=${input.groupId}
              and status in ('active','member','admin')`
          : [{ id: userId }];
        const { assertProjectAiSourceSharing } = await import('./ai-sources');
        await assertProjectAiSourceSharing(
          input.template.id,
          audience.map(reader => reader.id),
          input.visibility,
          tx
        );
      }
      await tx`insert into studio_project(id,owner_id,group_id,title,kind,visibility,document_schema_version,source_references,created_at,updated_at) values(${projectId},${userId},${input.groupId},${document.title},${document.kind},${input.visibility},5,${tx.json(JSON.parse(JSON.stringify(sourceReferences)))},${now},${now})`;
      for (const asset of copied)
        await tx`insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,ready,created_at) values(${asset.id},${projectId},${asset.name},${asset.mime},${asset.size},${asset.path},true,${now})`;
      await tx`insert into studio_state(project_id,document,updated_at) values(${projectId},${tx.json(JSON.parse(JSON.stringify(document)))},${now})`;
    });
    return { id: projectId };
  } catch (error) {
    if (copied.length)
      await removeFailedStudioCopies(
        storage,
        copied.map(asset => asset.path)
      );
    throw error;
  }
}
export async function validateAssets(projectId: string, doc: StudioDocumentV3) {
  const ids = [
    ...new Set(
      [
        ...doc.nodes.flatMap(node =>
          node.type === 'media'
            ? [node.assetId]
            : node.type === 'chart' && node.sourceAssetId
              ? [node.sourceAssetId]
              : []
        ),
      ].filter((x): x is string => !!x)
    ),
  ];
  if (!ids.length) return;
  const sql = studioSql();
  const rows =
    await sql`select id from studio_asset where project_id=${projectId} and workspace_id is null and ready=true and id in ${sql(ids)}`;
  if (rows.length !== ids.length)
    throw new StudioError('A media file is missing or belongs to another project');
}
export async function createProject(
  userId: string,
  groupId: string | null,
  document: StudioDocumentV3
) {
  if (groupId) await assertStudioGroup(userId, groupId, studioSql(), true);
  const id = studioId();
  studioDocumentV3Schema.parse(document);
  await validateAssets(id, document);
  const now = Date.now();
  await studioTransaction(async tx => {
    if (groupId) await assertStudioGroup(userId, groupId, tx, true);
    await tx`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values(${id},${userId},${groupId},${document.title},${document.kind},5,${now},${now})`;
    await tx`insert into studio_state(project_id,document,updated_at) values(${id},${tx.json(JSON.parse(JSON.stringify(document)))},${now})`;
  });
  return { id };
}

export function detectMime(bytes: Buffer) {
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
  size: number,
  workspaceId?: string,
  assetId = studioId()
) {
  await assertCanvasWorkspace(userId, projectId, workspaceId, true, studioSql());
  const id = assetId,
    storagePath = `${projectId}/assets/${id}`,
    sql = studioSql();
  await studioTransaction(async tx => {
    await assertCanvasWorkspace(userId, projectId, workspaceId, true, tx);
    await tx`select id from studio_project where id=${projectId} for update`;
    const [usage] =
      await tx`select count(*)::int as count,coalesce(sum(byte_size),0)::bigint as bytes from studio_asset where project_id=${projectId}`;
    if (usage.count >= 100 || Number(usage.bytes) + size > 500 * 1024 * 1024)
      throw new StudioError('Project media limit: 100 files / 500 MB');
    await tx`insert into studio_asset(id,project_id,workspace_id,name,mime_type,byte_size,storage_path,ready,created_at) values(${id},${projectId},${workspaceId ?? null},${name},${mime},${size},${storagePath},false,${Date.now()})`;
  });
  const { data, error } = await createClient()
    .storage.from(bucket)
    .createSignedUploadUrl(storagePath);
  if (error) {
    console.error('studio.upload.prepare', {
      bucket,
      status: 'statusCode' in error ? error.statusCode : undefined,
      error: error.message,
    });
    await sql`delete from studio_asset where id=${id}`;
    throw new StudioError('Cannot prepare upload', 502);
  }
  return { id, path: storagePath, token: data.token };
}
export async function finishUpload(userId: string, id: string, cancel = false) {
  const sql = studioSql();
  const [asset] = await sql`select * from studio_asset where id=${id}`;
  if (!asset) throw new StudioError('Upload not found', 404);
  await assertCanvasWorkspace(userId, asset.project_id, asset.workspace_id, true, sql);
  if (asset.ready) return { id, mime: asset.mime_type };
  const storage = createClient().storage.from(bucket);
  if (cancel) {
    await studioTransaction(async tx => {
      await assertCanvasWorkspace(userId, asset.project_id, asset.workspace_id, true, tx);
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
    await assertCanvasWorkspace(userId, asset.project_id, asset.workspace_id, true, tx);
    await tx`update studio_asset set ready=true where id=${id}`;
  });
  return { id, mime };
}

export async function duplicateProject(
  userId: string,
  id: string,
  destinationGroupId: string | null = null,
  visibility: 'public' | 'authenticated' | 'private' = 'private',
  destinationId = studioId()
) {
  await assertStudioAccess(userId, id);
  if (destinationGroupId) await assertStudioGroup(userId, destinationGroupId, studioSql(), true);
  const sql = studioSql();
  const { assertProjectAiSourceSharing } = await import('./ai-sources');
  const destinationReaders = destinationGroupId
    ? await sql`select owner_id as id from "group" where id=${destinationGroupId}
        union select user_id as id from group_membership
        where group_id=${destinationGroupId} and status in ('active','member','admin')`
    : [{ id: userId }];
  await assertProjectAiSourceSharing(
    id,
    destinationReaders.map(reader => reader.id),
    visibility
  );
  const [source] =
    await sql`select p.group_id,p.source_references,s.document from studio_project p join studio_state s on s.project_id=p.id where p.id=${id} and p.document_schema_version=5`;
  if (!source) throw new StudioError('Studio project not found', 404);
  const value = studioDocumentV3Schema.parse(source.document);
  const projectId = destinationId;
  value.title = value.title.slice(0, 190) + ' · Kopie';
  const rows =
    await sql`select * from studio_asset where project_id=${id} and workspace_id is null and ready=true`;
  const copies: { id: string; name: string; mime: string; size: number; path: string }[] = [];
  const replacements = new Map<string, string>();
  const storage = createClient().storage.from(bucket);
  try {
    for (const row of rows) {
      const assetId = studioId(`asset:${row.id}`),
        storagePath = `${projectId}/assets/${assetId}`;
      const uploaded = await copyStudioAsset(storage, row.storage_path, storagePath);
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
    value.nodes = value.nodes.filter(node => {
      if (node.type === 'media') {
        const replacement = replacements.get(node.assetId);
        if (!replacement) return false;
        node.assetId = replacement;
      }
      if (node.type === 'chart' && node.sourceAssetId)
        node.sourceAssetId = replacements.get(node.sourceAssetId) ?? null;
      return true;
    });
    await assertStudioAccess(userId, id);
    const now = Date.now();
    // A copy becomes visible only after every private asset and its document are ready.
    await studioTransaction(async tx => {
      await assertStudioAccess(userId, id, false, tx);
      if (destinationGroupId) await assertStudioGroup(userId, destinationGroupId, tx, true);
      const currentReaders = destinationGroupId
        ? await tx`select owner_id as id from "group" where id=${destinationGroupId}
            union select user_id as id from group_membership where group_id=${destinationGroupId}
            and status in ('active','member','admin')`
        : [{ id: userId }];
      await assertProjectAiSourceSharing(
        id,
        currentReaders.map(reader => reader.id),
        visibility,
        tx
      );
      await tx`insert into studio_project(id,owner_id,group_id,title,kind,visibility,document_schema_version,source_references,created_at,updated_at) values(${projectId},${userId},${destinationGroupId},${value.title},${value.kind},${visibility},5,${tx.json(JSON.parse(JSON.stringify(source.source_references ?? [])))},${now},${now})`;
      for (const asset of copies)
        await tx`insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,created_at) values(${asset.id},${projectId},${asset.name},${asset.mime},${asset.size},${asset.path},${now})`;
      await tx`insert into studio_state(project_id,document,updated_at) values(${projectId},${tx.json(JSON.parse(JSON.stringify(value)))},${now})`;
    });
    return { id: projectId };
  } catch (error) {
    if (copies.length)
      await removeFailedStudioCopies(
        storage,
        copies.map(a => a.path)
      );
    throw error;
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
