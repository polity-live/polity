import { createClient } from '@/lib/supabase/server';
import {
  createElementSetSnapshot,
  elementSetSnapshotSchema,
  mergeElementSetRevision,
  type ElementSetSnapshot,
} from '@/features/communication-studio/logic/element-library';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { assertStudioAccess, studioSql, studioTransaction, StudioError } from './db';
const bucket = 'studio';

async function requireSet(userId: string, setId: string, edit: boolean) {
  const sql = studioSql();
  const [set] = await sql`
    select s.*,r.id as revision_id,r.version,r.snapshot,r.width,r.height
    from studio_element_set s
    join studio_element_set_revision r on r.id=s.current_revision_id
    where s.id=${setId} and s.archived_at is null
      and ((s.owner_id=${userId})
        or (s.group_id is not null and studio_group_access(${userId}::uuid,s.group_id,${edit})))`;
  if (!set) throw new StudioError('Elements entry not found', 404);
  return set;
}

export async function listElementSets(userId: string, groupId: string | null) {
  const sql = studioSql();
  const rows = groupId
    ? await sql`
        select s.id,s.name,'group' as scope,r.id as revision_id,r.version,r.width,r.height,
          extract(epoch from s.updated_at)*1000 as updated_at
        from studio_element_set s join studio_element_set_revision r on r.id=s.current_revision_id
        where s.group_id=${groupId} and s.archived_at is null
          and studio_group_access(${userId}::uuid,s.group_id,false)
        order by s.updated_at desc`
    : await sql`
        select s.id,s.name,'personal' as scope,r.id as revision_id,r.version,r.width,r.height,
          extract(epoch from s.updated_at)*1000 as updated_at
        from studio_element_set s join studio_element_set_revision r on r.id=s.current_revision_id
        where s.owner_id=${userId} and s.archived_at is null
        order by s.updated_at desc`;
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    scope: row.scope,
    revisionId: row.revision_id,
    version: Number(row.version),
    width: Number(row.width),
    height: Number(row.height),
    updatedAt: Number(row.updated_at),
  }));
}

async function copyProjectAssetsToRevision(
  projectId: string,
  scopePath: string,
  revisionId: string,
  snapshot: ElementSetSnapshot
) {
  const sql = studioSql();
  const storage = createClient().storage.from(bucket);
  const copied: {
    id: string;
    source: string;
    name: string;
    mime: string;
    size: number;
    path: string;
  }[] = [];
  try {
    for (const asset of snapshot.assets) {
      const [source] = await sql`
        select id,name,mime_type,byte_size,storage_path from studio_asset
        where id=${asset.sourceAssetId} and project_id=${projectId} and ready=true`;
      if (!source) throw new StudioError('An element media file is unavailable', 422);
      const id = crypto.randomUUID();
      const path = `${scopePath}/${revisionId}/${id}`;
      const result = await storage.copy(source.storage_path, path);
      if (result.error) throw new StudioError('Cannot copy element media', 502);
      copied.push({
        id,
        source: asset.sourceAssetId,
        name: source.name,
        mime: source.mime_type,
        size: Number(source.byte_size),
        path,
      });
    }
    return copied;
  } catch (error) {
    if (copied.length) await storage.remove(copied.map(asset => asset.path));
    throw error;
  }
}

export async function createElementSet(
  userId: string,
  input: { projectId: string; groupId: string | null; selectedIds: string[]; name?: string }
) {
  await assertStudioAccess(userId, input.projectId, true);
  const sql = studioSql();
  const [project] = await sql`
    select p.group_id,s.document from studio_project p join studio_state s on s.project_id=p.id
    where p.id=${input.projectId} and p.document_schema_version=5`;
  if (!project || project.group_id !== input.groupId)
    throw new StudioError('Elements library scope does not match the project', 403);
  if (input.groupId) {
    const [allowed] = await sql`
      select studio_group_access(${userId}::uuid,${input.groupId}::uuid,true) as allowed`;
    if (!allowed?.allowed) throw new StudioError('No permission to update group elements', 403);
  }
  const document = studioDocumentV3Schema.parse(project.document);
  const assets = await sql`
    select id,name,mime_type from studio_asset
    where project_id=${input.projectId} and ready=true and workspace_id is null`;
  const snapshot = createElementSetSnapshot(
    document,
    input.selectedIds,
    assets.map(asset => ({ id: asset.id, name: asset.name, mime: asset.mime_type }))
  );
  const setId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const scopePath = input.groupId
    ? `libraries/groups/${input.groupId}/sets/${setId}`
    : `libraries/users/${userId}/sets/${setId}`;
  const copied = await copyProjectAssetsToRevision(
    input.projectId,
    scopePath,
    revisionId,
    snapshot
  );
  try {
    const now = new Date();
    const name = (input.name?.trim() || snapshot.nodes[0].name || 'Element').slice(0, 120);
    await studioTransaction(async tx => {
      await assertStudioAccess(userId, input.projectId, true, tx);
      await tx`
        insert into studio_element_set(id,owner_id,group_id,name,created_at,updated_at)
        values(${setId},${input.groupId ? null : userId},${input.groupId},${name},${now},${now})`;
      await tx`
        insert into studio_element_set_revision(id,set_id,version,snapshot,width,height,created_by_id,created_at)
        values(${revisionId},${setId},1,${tx.json(JSON.parse(JSON.stringify(snapshot)))},${snapshot.width},${snapshot.height},${userId},${now})`;
      for (const asset of copied)
        await tx`
          insert into studio_element_set_asset(id,revision_id,source_asset_id,name,mime_type,byte_size,storage_path,created_at)
          values(${asset.id},${revisionId},${asset.source},${asset.name},${asset.mime},${asset.size},${asset.path},${now})`;
      await tx`update studio_element_set set current_revision_id=${revisionId} where id=${setId}`;
    });
    return { id: setId, revisionId, name, version: 1 };
  } catch (error) {
    if (copied.length)
      await createClient()
        .storage.from(bucket)
        .remove(copied.map(a => a.path));
    throw error;
  }
}

export async function instantiateElementSetForProject(
  userId: string,
  input: { setId: string; projectId: string }
) {
  await assertStudioAccess(userId, input.projectId, true);
  const set = await requireSet(userId, input.setId, false);
  const snapshot = elementSetSnapshotSchema.parse(set.snapshot);
  const sql = studioSql();
  const libraryAssets = await sql`
    select * from studio_element_set_asset where revision_id=${set.revision_id}`;
  const storage = createClient().storage.from(bucket);
  const copied: {
    id: string;
    source: string;
    name: string;
    mime: string;
    size: number;
    path: string;
  }[] = [];
  try {
    const [usage] = await sql`
      select count(*)::int as count,coalesce(sum(byte_size),0)::bigint as bytes
      from studio_asset where project_id=${input.projectId}`;
    const incomingBytes = libraryAssets.reduce((sum, asset) => sum + Number(asset.byte_size), 0);
    if (
      Number(usage.count) + libraryAssets.length > 100 ||
      Number(usage.bytes) + incomingBytes > 500 * 1024 * 1024
    )
      throw new StudioError('Project media limit: 100 files / 500 MB');
    for (const source of libraryAssets) {
      const id = crypto.randomUUID();
      const path = `${input.projectId}/assets/${id}`;
      const result = await storage.copy(source.storage_path, path);
      if (result.error) throw new StudioError('Cannot copy element media', 502);
      copied.push({
        id,
        source: source.source_asset_id,
        name: source.name,
        mime: source.mime_type,
        size: Number(source.byte_size),
        path,
      });
    }
    await studioTransaction(async tx => {
      await assertStudioAccess(userId, input.projectId, true, tx);
      for (const asset of copied)
        await tx`
          insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,ready,created_at)
          values(${asset.id},${input.projectId},${asset.name},${asset.mime},${asset.size},${asset.path},true,${Date.now()})`;
    });
    return {
      setId: set.id,
      revisionId: set.revision_id,
      snapshot,
      assetIds: Object.fromEntries(copied.map(asset => [asset.source, asset.id])),
    };
  } catch (error) {
    if (copied.length) {
      await storage.remove(copied.map(asset => asset.path));
      await sql`delete from studio_asset where id in ${sql(copied.map(asset => asset.id))}`;
    }
    throw error;
  }
}

export async function renameElementSet(userId: string, setId: string, name: string) {
  await requireSet(userId, setId, true);
  await studioSql()`update studio_element_set set name=${name.trim().slice(0, 120)},updated_at=now() where id=${setId}`;
  return { ok: true };
}

export async function archiveElementSet(userId: string, setId: string) {
  await requireSet(userId, setId, true);
  await studioSql()`update studio_element_set set archived_at=now(),updated_at=now() where id=${setId}`;
  return { ok: true };
}

export async function publishElementSetRevision(
  userId: string,
  input: { projectId: string; instanceId: string }
) {
  await assertStudioAccess(userId, input.projectId, true);
  const sql = studioSql();
  const [project] = await sql`
    select s.document from studio_project p join studio_state s on s.project_id=p.id
    where p.id=${input.projectId} and p.document_schema_version=5`;
  if (!project) throw new StudioError('Studio project not found', 404);
  const document = studioDocumentV3Schema.parse(project.document);
  const instance = document.componentInstances.find(item => item.id === input.instanceId);
  if (!instance) throw new StudioError('Linked Elements instance not found', 404);
  const set = await requireSet(userId, instance.setId, true);
  const selectedIds = Object.values(instance.sourceToInstance).filter(
    id => !instance.detachedNodes.includes(id)
  );
  const assets = await sql`
    select id,name,mime_type from studio_asset
    where project_id=${input.projectId} and ready=true and workspace_id is null`;
  const snapshot = createElementSetSnapshot(
    document,
    selectedIds,
    assets.map(asset => ({ id: asset.id, name: asset.name, mime: asset.mime_type }))
  );
  const sourceByInstance = new Map(
    Object.entries(instance.sourceToInstance).map(([sourceId, instanceId]) => [
      instanceId,
      sourceId,
    ])
  );
  snapshot.nodes = snapshot.nodes.map(node => {
    const next = structuredClone(node);
    next.id = sourceByInstance.get(node.id) ?? node.id;
    next.parentFrameId = next.parentFrameId
      ? (sourceByInstance.get(next.parentFrameId) ?? null)
      : null;
    if (next.type === 'shape') {
      next.startBindingId = next.startBindingId
        ? (sourceByInstance.get(next.startBindingId) ?? null)
        : null;
      next.endBindingId = next.endBindingId
        ? (sourceByInstance.get(next.endBindingId) ?? null)
        : null;
    }
    next.componentRef = null;
    return next;
  });
  const revisionId = crypto.randomUUID();
  const scopePath = set.group_id
    ? `libraries/groups/${set.group_id}/sets/${set.id}`
    : `libraries/users/${set.owner_id}/sets/${set.id}`;
  const copied = await copyProjectAssetsToRevision(
    input.projectId,
    scopePath,
    revisionId,
    snapshot
  );
  try {
    const version = Number(set.version) + 1;
    await studioTransaction(async tx => {
      await tx`
        insert into studio_element_set_revision(id,set_id,version,snapshot,width,height,created_by_id,created_at)
        values(${revisionId},${set.id},${version},${tx.json(JSON.parse(JSON.stringify(snapshot)))},${snapshot.width},${snapshot.height},${userId},now())`;
      for (const asset of copied)
        await tx`
          insert into studio_element_set_asset(id,revision_id,source_asset_id,name,mime_type,byte_size,storage_path,created_at)
          values(${asset.id},${revisionId},${asset.source},${asset.name},${asset.mime},${asset.size},${asset.path},now())`;
      await tx`update studio_element_set set current_revision_id=${revisionId},updated_at=now() where id=${set.id}`;
    });
    return { revisionId, version };
  } catch (error) {
    if (copied.length)
      await createClient()
        .storage.from(bucket)
        .remove(copied.map(a => a.path));
    throw error;
  }
}

export async function synchronizeProjectElementInstances(userId: string, projectId: string) {
  const storage = createClient().storage.from(bucket);
  const copiedPaths: string[] = [];
  try {
    return await studioTransaction(async tx => {
      await assertStudioAccess(userId, projectId, false, tx);
      await tx`select id from studio_project where id=${projectId} for update`;
      const [row] = await tx`
        select s.document,s.content_revision
        from studio_state s join studio_project p on p.id=s.project_id
        where s.project_id=${projectId} and p.document_schema_version=5 for update`;
      if (!row) throw new StudioError('Studio project not found', 404);
      const document = studioDocumentV3Schema.parse(row.document);
      if (!document.componentInstances.length) return null;
      const [usage] = await tx`
        select count(*)::int as count,coalesce(sum(byte_size),0)::bigint as bytes
        from studio_asset where project_id=${projectId}`;
      let assetCount = Number(usage.count);
      let assetBytes = Number(usage.bytes);
      let changed = false;
      for (const instance of [...document.componentInstances]) {
        const [set] = await tx`
          select s.archived_at,s.current_revision_id,r.snapshot
          from studio_element_set s
          left join studio_element_set_revision r on r.id=s.current_revision_id
          where s.id=${instance.setId}`;
        if (!set || set.archived_at || !set.current_revision_id || !set.snapshot) {
          const instanceNodeIds = new Set(Object.values(instance.sourceToInstance));
          document.nodes.forEach(node => {
            if (instanceNodeIds.has(node.id)) node.componentRef = null;
          });
          document.componentInstances = document.componentInstances.filter(
            item => item.id !== instance.id
          );
          changed = true;
          continue;
        }
        if (set.current_revision_id === instance.revisionId) continue;
        const [previousRow] = await tx`
          select snapshot from studio_element_set_revision where id=${instance.revisionId}`;
        if (!previousRow?.snapshot) continue;
        const previous = elementSetSnapshotSchema.parse(previousRow.snapshot);
        const next = elementSetSnapshotSchema.parse(set.snapshot);
        const libraryAssets = await tx`
          select source_asset_id,name,mime_type,byte_size,storage_path
          from studio_element_set_asset where revision_id=${set.current_revision_id}`;
        const libraryAssetBySource = new Map(
          libraryAssets.map(asset => [String(asset.source_asset_id), asset])
        );
        const instanceNodes = new Map(document.nodes.map(node => [node.id, node]));
        const assetRemap = new Map<string, string>();
        for (const node of next.nodes) {
          if (node.type !== 'media') continue;
          const localId = instance.sourceToInstance[node.id];
          const local = localId ? instanceNodes.get(localId) : undefined;
          if (local?.type === 'media') assetRemap.set(node.assetId, local.assetId);
        }
        for (const node of next.nodes) {
          if (node.type !== 'media') continue;
          const existingAssetId = assetRemap.get(node.assetId);
          if (existingAssetId) {
            node.assetId = existingAssetId;
            continue;
          }
          const sourceAssetId = node.assetId;
          const source = libraryAssetBySource.get(sourceAssetId);
          if (!source) throw new StudioError('An element media file is unavailable', 422);
          const size = Number(source.byte_size);
          if (assetCount + 1 > 100 || assetBytes + size > 500 * 1024 * 1024)
            throw new StudioError('Project media limit: 100 files / 500 MB');
          const assetId = crypto.randomUUID();
          const path = `${projectId}/assets/${assetId}`;
          const result = await storage.copy(source.storage_path, path);
          if (result.error) throw new StudioError('Cannot copy element media', 502);
          copiedPaths.push(path);
          await tx`
            insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,ready,created_at)
            values(${assetId},${projectId},${source.name},${source.mime_type},${size},${path},true,${Date.now()})`;
          assetRemap.set(sourceAssetId, assetId);
          node.assetId = assetId;
          assetCount += 1;
          assetBytes += size;
        }
        mergeElementSetRevision(document, instance.id, previous, next, set.current_revision_id);
        changed = true;
      }
      if (!changed) return null;
      const nextRevision = Number(row.content_revision) + 1;
      await tx`select set_config('polity.canvas_command',${projectId},true)`;
      await tx`
        update studio_state
        set document=${tx.json(JSON.parse(JSON.stringify(document)))},content_revision=${nextRevision},updated_at=${Date.now()}
        where project_id=${projectId}`;
      return { document, revision: nextRevision };
    });
  } catch (error) {
    if (copiedPaths.length) await storage.remove(copiedPaths);
    throw error;
  }
}
