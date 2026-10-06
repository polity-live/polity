import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { createStudioProjectSchema, exportStudioSchema } from '@/zero/communication-studio/schema';
import {
  studioTransaction,
  StudioError,
  studioEnabled,
  studioV3Enabled,
  assertStudioAccess,
  assertStudioCollaborationAccess,
  assertStudioGroup,
} from './db';
import {
  assetUrls,
  downloadExport,
  exportStatus,
  loadProject,
  queueExport,
  duplicateProject,
  beginUpload,
  finishUpload,
  createProjectFromSelection,
} from './service';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { v3DocumentToLegacy } from '@/features/communication-studio/logic/v3-adapter';
import { assertProjectAiSourceSharing } from './ai-sources';
import {
  archiveElementSet,
  createElementSet,
  instantiateElementSetForProject,
  listElementSets,
  publishElementSetRevision,
  renameElementSet,
} from './elements';
import {
  inviteStudioCollaborators,
  listMyStudioInvitations,
  listStudioCollaborators,
  removeStudioCollaborator,
  respondStudioInvitation,
} from './collaborators';
const uuid = z.string().uuid();
export async function handleStudio(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new StudioError('Invalid request origin', 403);
    const session = await getSession(request);
    if (!session) throw new StudioError('Authentication required', 401);
    const userId = session.user.id;
    if (!studioEnabled(userId) || !studioV3Enabled(userId))
      throw new StudioError('Studio V4 is not enabled', 404);
    const body = await request.json().catch(() => {
      throw new StudioError('Invalid studio input');
    });
    if (!body || typeof body.operation !== 'string') throw new StudioError('Invalid studio input');
    let result: unknown;
    switch (body.operation) {
      case 'collaborators':
        result = await listStudioCollaborators(userId, uuid.parse(body.projectId));
        break;
      case 'myInvitations':
        result = await listMyStudioInvitations(userId);
        break;
      case 'inviteCollaborators':
        result = await inviteStudioCollaborators(
          userId,
          uuid.parse(body.projectId),
          z.array(uuid).min(1).max(20).parse(body.userIds)
        );
        break;
      case 'respondInvitation':
        result = await respondStudioInvitation(
          userId,
          uuid.parse(body.invitationId),
          z.boolean().parse(body.accept)
        );
        break;
      case 'removeCollaborator':
        result = await removeStudioCollaborator(
          userId,
          uuid.parse(body.projectId),
          uuid.parse(body.userId)
        );
        break;
      case 'canvasPresence':
        result = await (await import('./presence')).canvasPresence(userId, body);
        break;
      case 'canvas':
        result = await (await import('./governance')).canvasCommand(userId, body);
        break;
      case 'editorActions':
        result = await studioTransaction(async sql => {
          await assertStudioCollaborationAccess(userId, uuid.parse(body.projectId), sql);
          const clientId = uuid.parse(body.clientId);
          return sql`update studio_editor_action set claimed_by=${clientId} where id in (select id from studio_editor_action where project_id=${body.projectId} and actor_id=${userId} and result is null and (claimed_by is null or claimed_by=${clientId}) and created_at>${Date.now() - 120000} order by created_at limit 20 for update skip locked) returning id,name,input`;
        });
        break;
      case 'editorResult':
        result = await studioTransaction(async sql => {
          await assertStudioCollaborationAccess(userId, uuid.parse(body.projectId), sql);
          const response = z
            .object({
              status: z.enum(['completed', 'failed']),
              error: z.string().max(1000).optional(),
              revision: z.number().optional(),
              projectId: uuid.optional(),
            })
            .parse(body.result);
          await sql`update studio_editor_action set result=${sql.json(response)} where id=${uuid.parse(body.id)} and project_id=${body.projectId} and actor_id=${userId} and claimed_by=${uuid.parse(body.clientId)} and result is null`;
          return { status: 'acknowledged' };
        });
        break;
      case 'config':
        result = { enabled: true };
        break;
      case 'beginUpload':
        result = await beginUpload(
          userId,
          uuid.parse(body.projectId),
          z.string().min(1).max(200).parse(body.name),
          z.enum(['image/png', 'image/jpeg', 'image/webp', 'video/mp4']).parse(body.mime),
          z
            .number()
            .int()
            .min(1)
            .max(100 * 1024 * 1024)
            .parse(body.size),
          uuid.optional().parse(body.workspaceId)
        );
        break;
      case 'finishUpload':
      case 'cancelUpload':
        result = await finishUpload(userId, uuid.parse(body.id), body.operation === 'cancelUpload');
        break;
      case 'create': {
        const input = createStudioProjectSchema.parse(body);
        result = await createProjectFromSelection(userId, input);
        break;
      }
      case 'load':
        result = await loadProject(userId, uuid.parse(body.id));
        break;
      case 'receipt':
        result = await studioTransaction(async sql => {
          await assertStudioCollaborationAccess(userId, uuid.parse(body.projectId), sql);
          const [row] =
            await sql`select result from studio_operation where id=${uuid.parse(body.id)} and project_id=${body.projectId} and actor_id=${userId}`;
          if (!row) throw new StudioError('Operation not found', 404);
          return row.result;
        });
        break;
      case 'assets':
        result = await assetUrls(
          userId,
          uuid.parse(body.id),
          uuid.optional().parse(body.workspaceId)
        );
        break;
      case 'duplicate':
        result = await duplicateProject(
          userId,
          uuid.parse(body.id),
          z.union([uuid, z.null()]).parse(body.groupId ?? null),
          z.enum(['public', 'authenticated', 'private']).parse(body.visibility ?? 'private')
        );
        break;
      case 'visibility': {
        const targetId = uuid.parse(body.id);
        const targetVisibility = z
          .enum(['public', 'authenticated', 'private'])
          .parse(body.visibility);
        result = await studioTransaction(async sql => {
          const id = targetId;
          const visibility = targetVisibility;
          await assertStudioAccess(userId, id, true, sql);
          const [project] =
            await sql`select owner_id,group_id from studio_project where id=${id} for update`;
          if (!project || (project.group_id === null && project.owner_id !== userId))
            throw new StudioError('Only the project owner can change visibility', 403);
          await assertProjectAiSourceSharing(id, [], visibility, sql);
          await sql`update studio_project set visibility=${visibility},updated_at=${Date.now()} where id=${id}`;
          return { ok: true };
        });
        break;
      }
      case 'handoff': {
        result = await studioTransaction(async sql => {
          const [job] =
            await sql`select * from studio_export where id=${uuid.parse(body.id)} and status='completed'`;
          if (!job) throw new StudioError('Export is not ready');
          await assertStudioAccess(userId, job.project_id, true, sql);
          if (!job.file_name.endsWith('.png') && !job.file_name.endsWith('.mp4'))
            throw new StudioError('Select a single page or video for a Polity post');
          const [revision] =
            await sql`select document from studio_revision where id=${job.revision_id}`;
          const document = studioDocumentV3Schema.parse(revision.document);
          const legacy = v3DocumentToLegacy(document);
          const pageIds = job.page_ids.length
            ? job.page_ids
            : document.nodes
                .filter(node => node.type === 'frame' && node.parentFrameId === null)
                .map(node => node.id);
          return {
            imageUrl: job.file_name.endsWith('.png') ? '/api/studio/published-media/' + job.id : '',
            videoUrl: job.file_name.endsWith('.mp4') ? '/api/studio/published-media/' + job.id : '',
            isStory: legacy.posts.some(
              post =>
                post.kind === 'story' && pageIds.every((id: string) => post.pageIds.includes(id))
            ),
          };
        });
        break;
      }
      case 'export': {
        const input = exportStudioSchema.parse(body);
        result = await queueExport(
          userId,
          input.projectId,
          input.format,
          input.pageIds,
          input.revision
        );
        break;
      }
      case 'download':
        result = await downloadExport(userId, uuid.parse(body.id));
        break;
      case 'exportStatus':
        result = await exportStatus(userId, uuid.parse(body.id));
        break;
      case 'cancel': {
        result = await studioTransaction(async sql => {
          const [job] =
            await sql`select project_id from studio_export where id=${uuid.parse(body.id)}`;
          if (!job) throw new StudioError('Export not found', 404);
          await assertStudioAccess(userId, job.project_id, true, sql);
          await sql`update studio_export set status='cancelled',updated_at=${Date.now()} where id=${body.id} and status in ('queued','running')`;
          return { ok: true };
        });
        break;
      }
      case 'template': {
        result = await studioTransaction(async sql => {
          const id = uuid.parse(body.id);
          await assertStudioAccess(userId, id, true, sql);
          const [project] =
            await sql`select owner_id,group_id from studio_project where id=${id} for update`;
          if (!project || (project.group_id === null && project.owner_id !== userId))
            throw new StudioError('Only the project owner can change templates', 403);
          await sql`update studio_project set is_template=${z.boolean().parse(body.value)} where id=${id}`;
          return { ok: true };
        });
        break;
      }
      case 'delete': {
        result = await studioTransaction(async sql => {
          const id = uuid.parse(body.id);
          await assertStudioAccess(userId, id, true, sql);
          const [project] =
            await sql`select owner_id,group_id from studio_project where id=${id} for update`;
          if (!project || (project.group_id === null && project.owner_id !== userId))
            throw new StudioError('Only the project owner can delete it', 403);
          const [used] =
            await sql`select s.id from statement s join studio_export e on (s.image_url='/api/studio/published-media/' || e.id::text or s.video_url='/api/studio/published-media/' || e.id::text) where e.project_id=${id} limit 1`;
          if (used) throw new StudioError('This project contains media used by a Polity post');
          const [pending] =
            await sql`select id from studio_export where project_id=${id} and status in ('queued','running') limit 1`;
          if (pending) throw new StudioError('Cancel pending exports before deleting the project');
          await sql`delete from studio_project where id=${id}`;
          return { ok: true };
        });
        break;
      }
      case 'themes': {
        result = await studioTransaction(async sql => {
          const gid = z.union([uuid, z.null()]).parse(body.groupId ?? null);
          if (gid) await assertStudioGroup(userId, gid, sql);
          return await sql`
            select t.id,t.slug,t.name,t.description,t.kind,t.group_id,t.created_by_id,
              r.id as revision_id,r.version,r.light_palette,r.dark_palette,r.fonts,r.text_styles
            from appearance_theme t
            join appearance_theme_revision r on r.id=t.current_revision_id and r.status='published'
            where (t.kind='personal' and t.created_by_id=${userId})
              or (t.kind='group' and t.group_id=${gid})
            order by t.kind,t.name`;
        });
        break;
      }
      case 'elementSets':
        result = await listElementSets(
          userId,
          z.union([uuid, z.null()]).parse(body.groupId ?? null)
        );
        break;
      case 'elementSetCreate':
        result = await createElementSet(userId, {
          projectId: uuid.parse(body.projectId),
          groupId: z.union([uuid, z.null()]).parse(body.groupId ?? null),
          selectedIds: z.array(uuid).min(1).max(5000).parse(body.selectedIds),
          name: z.string().trim().min(1).max(120).optional().parse(body.name),
        });
        break;
      case 'elementSetInstantiate':
        result = await instantiateElementSetForProject(userId, {
          setId: uuid.parse(body.setId),
          projectId: uuid.parse(body.projectId),
        });
        break;
      case 'elementSetRename':
        result = await renameElementSet(
          userId,
          uuid.parse(body.setId),
          z.string().trim().min(1).max(120).parse(body.name)
        );
        break;
      case 'elementSetArchive':
        result = await archiveElementSet(userId, uuid.parse(body.setId));
        break;
      case 'elementSetPublish':
        result = await publishElementSetRevision(userId, {
          projectId: uuid.parse(body.projectId),
          instanceId: uuid.parse(body.instanceId),
        });
        break;
      default:
        throw new StudioError('Unknown operation');
    }
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof StudioError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError)
      return Response.json(
        { error: 'Invalid studio input', details: error.issues.map(i => i.message) },
        { status: 400 }
      );
    console.error('studio.request', error instanceof Error ? error.message : 'failure');
    return Response.json({ error: 'Studio request failed. Please try again.' }, { status: 500 });
  }
}
