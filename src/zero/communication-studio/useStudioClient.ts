import { useMemo } from 'react';
import { useZero } from '@rocicorp/zero/react';
import type { Zero } from '@rocicorp/zero';
import type { Schema } from '../schema';
import type { ZeroContext } from '../context';
import { queries } from '../queries';
import { mutators } from '../mutators';
import { serverConfirmed } from '../mutate-with-server-check';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/features/shared/ui/ui/sonner';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { v3DocumentToLegacy } from '@/features/communication-studio/logic/v3-adapter';
import type {
  CanvasSession,
  CanvasProposal,
} from '@/features/communication-studio/logic/governance';
import type { StudioReceipt } from '@/server/studio/operations';
import {
  studioAssetUrls,
  studioCapabilities,
  procedureMembers,
  procedureRoles,
} from './projections';
import type { StudioCommand, StudioCommandInput, CanvasCommandInput } from './commands';
import { observeStudio } from './observe';

type StudioZero = Zero<Schema, undefined, ZeroContext>;
type CommandArguments<K extends StudioCommand> = Omit<StudioCommandInput<K>, 'operationId'> & {
  operationId?: string;
};
export interface StudioCommandResults {
  create: { id: string };
  duplicate: { id: string };
  setVisibility: { ok: boolean };
  setTemplate: { ok: boolean };
  delete: { ok: boolean };
  inviteCollaborators: { invited: number };
  respondInvitation: { status: string };
  removeCollaborator: { ok: boolean };
  beginUpload: { id: string; path: string; token: string };
  finishUpload: { id: string; mime: string };
  cancelUpload: { id: string; mime: string };
  requestExport: { id: string; revision: number };
  cancelExport: { ok: boolean };
  createElementSet: { id: string };
  instantiateElementSet: {
    setId: string;
    revisionId: string;
    snapshot: unknown;
    assetIds: Record<string, string>;
  };
  renameElementSet: { ok: boolean };
  archiveElementSet: { ok: boolean };
  publishElementSet: { revisionId: string };
  synchronizeElements: { document: unknown; revision: number } | null;
  claimEditorActions: { id: string; name: string; input: unknown }[];
  completeEditorAction: { status: string };
}
type CanvasResult<I extends CanvasCommandInput> = I extends { action: 'saveDraft' }
  ? StudioReceipt
  : I extends { action: 'createDraft' | 'resolveDraft' }
    ? { workspaceId: string }
    : { ok: true };
export function createStudioClient(zero: StudioZero) {
  async function confirmedResult<T>(view: {
    addListener(
      callback: (row: { result: unknown; expires_at?: number | null } | undefined) => void
    ): unknown;
    destroy(): void;
  }): Promise<T> {
    try {
      return await new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Studio confirmation timed out')),
          30_000
        );
        view.addListener(row => {
          if (!row) return;
          clearTimeout(timeout);
          if (row.expires_at != null && row.expires_at <= Date.now())
            reject(new Error('Studio upload authorization expired'));
          else resolve(row.result as T);
        });
      });
    } finally {
      view.destroy();
    }
  }
  const receipt = <T>(operationId: string) =>
    confirmedResult<T>(zero.materialize(queries.studio.commandReceipt({ operationId })));
  function command<K extends StudioCommand>(name: K) {
    return async (input: CommandArguments<K>): Promise<StudioCommandResults[K]> => {
      const key = `studio-command:${zero.context.userID}:${name}:${JSON.stringify(input)}`;
      const operationId = input.operationId ?? sessionStorage.getItem(key) ?? crypto.randomUUID();
      sessionStorage.setItem(key, operationId);
      const field =
        name === 'duplicate'
          ? 'destinationId'
          : ['create', 'beginUpload', 'requestExport'].includes(name)
            ? 'id'
            : null;
      const prepared = {
        ...input,
        operationId,
        ...(field ? { [field]: (input as Record<string, unknown>)[field] ?? operationId } : {}),
      };
      // The registry preserves each command's validator; this indexed access joins their input types.
      const mutation = mutators.studio[name] as (
        input: never
      ) => Parameters<StudioZero['mutate']>[0];
      await serverConfirmed(zero.mutate(mutation(prepared as never)));
      const result = await receipt<StudioCommandResults[K]>(operationId);
      sessionStorage.removeItem(key);
      return result;
    };
  }
  const create = command('create');
  const duplicate = command('duplicate');
  const beginUpload = command('beginUpload');
  const requestExport = command('requestExport');
  const client = {
    create: (input: Omit<CommandArguments<'create'>, 'id'> & { id?: string }) =>
      create(input as CommandArguments<'create'>),
    duplicate: (
      input: Omit<CommandArguments<'duplicate'>, 'destinationId'> & { destinationId?: string }
    ) => duplicate(input as CommandArguments<'duplicate'>),
    beginUpload: (input: Omit<CommandArguments<'beginUpload'>, 'id'> & { id?: string }) =>
      beginUpload(input as CommandArguments<'beginUpload'>),
    requestExport: (input: Omit<CommandArguments<'requestExport'>, 'id'> & { id?: string }) =>
      requestExport(input as CommandArguments<'requestExport'>),
    setVisibility: command('setVisibility'),
    setTemplate: command('setTemplate'),
    delete: command('delete'),
    inviteCollaborators: command('inviteCollaborators'),
    respondInvitation: command('respondInvitation'),
    removeCollaborator: command('removeCollaborator'),
    finishUpload: command('finishUpload'),
    cancelUpload: command('cancelUpload'),
    cancelExport: command('cancelExport'),
    createElementSet: command('createElementSet'),
    instantiateElementSet: command('instantiateElementSet'),
    renameElementSet: command('renameElementSet'),
    archiveElementSet: command('archiveElementSet'),
    publishElementSet: command('publishElementSet'),
    synchronizeElements: command('synchronizeElements'),
    claimEditorActions: command('claimEditorActions'),
    completeEditorAction: command('completeEditorAction'),
    async canvas<I extends CanvasCommandInput>(input: I): Promise<CanvasResult<I>> {
      await serverConfirmed(zero.mutate(mutators.studio.canvas.command(input)));
      return confirmedResult<CanvasResult<I>>(
        zero.materialize(queries.studio.canvasReceipt({ operationId: input.operationId }))
      );
    },
    async operation(input: { projectId: string; id: string }): Promise<StudioReceipt> {
      return confirmedResult<StudioReceipt>(
        zero.materialize(
          queries.studio.operation({ projectId: input.projectId, operationId: input.id })
        )
      );
    },
    async assets(input: { id: string; workspaceId?: string }) {
      return studioAssetUrls(
        await zero.run(
          queries.studio.assets({ projectId: input.id, workspaceId: input.workspaceId }),
          { type: 'complete' }
        )
      );
    },
    async session(input: { projectId: string }): Promise<CanvasSession> {
      const [project, control, proposals, comments, revisions, adoptionGroups] = await Promise.all([
        zero.run(queries.studio.sessionProject(input), { type: 'complete' }),
        zero.run(queries.studio.control(input), { type: 'complete' }),
        zero.run(queries.studio.proposals(input), { type: 'complete' }),
        zero.run(queries.studio.comments(input), { type: 'complete' }),
        zero.run(queries.studio.history(input), { type: 'complete' }),
        zero.run(queries.studio.manageGroups(), { type: 'complete' }),
      ]);
      if (!project || !control) throw new Error('Studio project unavailable');
      const capabilities = studioCapabilities(project, zero.context.userID, control.phase);
      return {
        groupId: project.group_id,
        phase: control.phase as CanvasSession['phase'],
        generation: control.generation,
        capabilities,
        canEditProject: studioCapabilities(project, zero.context.userID, 'edit').edit,
        proposals: proposals.map(p => ({
          ...p,
          shared_ids: p.readers.map(r => r.user_id),
        })) as unknown as CanvasProposal[],
        comments: comments as CanvasSession['comments'],
        revisions: revisions.map(r => ({
          id: r.id,
          revision: r.revision,
          created_at: r.created_at,
        })),
        members: procedureMembers(project),
        roles: procedureRoles(project, capabilities.manage),
        adoptionGroups:
          project.group_id === null && project.owner_id === zero.context.userID
            ? adoptionGroups.map(g => ({ id: g.id, name: g.name }))
            : [],
      };
    },
    async load(input: { id: string }) {
      const [stored, session] = await Promise.all([
        zero.run(queries.studio.document(input), { type: 'complete' }),
        client.session({ projectId: input.id }),
      ]);
      if (!stored) throw new Error('Studio project unavailable');
      return {
        document: studioDocumentV3Schema.parse(stored.document),
        revision: stored.content_revision,
        generation: session.generation,
        canEdit: session.capabilities.edit,
      };
    },
    async loadDraft(input: { projectId: string; workspaceId: string }) {
      const [draft, session] = await Promise.all([
        zero.run(queries.studio.workspace(input), { type: 'complete' }),
        client.session({ projectId: input.projectId }),
      ]);
      if (!draft || draft.ai_status !== 'ready') throw new Error('Studio workspace unavailable');
      return {
        document: studioDocumentV3Schema.parse(draft.document),
        baseDocument: studioDocumentV3Schema.parse(draft.base_document),
        revision: draft.revision,
        generation: session.generation,
        canEdit:
          session.capabilities.suggest &&
          draft.state === 'draft' &&
          (draft.owner_id === zero.context.userID ||
            draft.readers.some(r => r.user_id === zero.context.userID)) &&
          (['edit', 'suggest_internal'].includes(session.phase) ||
            (session.phase === 'vote_internal' && Boolean(draft.resolves_id))),
      };
    },
    async themes(input: { groupId: string | null }) {
      const rows = await zero.run(queries.studio.themes(input), { type: 'complete' });
      return rows.map(row => ({
        ...row,
        ...row.current_revision,
        id: row.id,
        revision_id: row.current_revision?.id,
      }));
    },
    async elementSets(input: { groupId: string | null }) {
      const rows = await zero.run(queries.studio.elementSets(input), { type: 'complete' });
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        scope: row.group_id ? 'group' : 'personal',
        revisionId: row.current_revision?.id,
        version: row.current_revision?.version,
        width: row.current_revision?.width,
        height: row.current_revision?.height,
        updatedAt: row.updated_at,
      }));
    },
    async collaborators(input: { projectId: string }) {
      const rows = await zero.run(queries.studio.collaborators(input), { type: 'complete' });
      return rows.map(row => ({
        ...row.user,
        id: row.id,
        user_id: row.user_id,
        status: row.status,
      }));
    },
    async invitations() {
      const rows = await zero.run(queries.studio.invitations(), { type: 'complete' });
      return rows.map(row => ({
        ...row.project?.owner,
        id: row.id,
        project_id: row.project_id,
        title: row.project?.title,
        owner_id: row.project?.owner_id,
      }));
    },
    async libraries(input: { groupId: string | null }) {
      return zero.run(queries.studio.libraries(input), { type: 'complete' });
    },
    async exportStatus(input: { id: string }) {
      const job = await zero.run(queries.studio.export(input), { type: 'complete' });
      if (!job) throw new Error('Studio export unavailable');
      return job;
    },
    watchSession(
      input: { projectId: string },
      next: (session: CanvasSession) => void,
      failed: (error: unknown) => void
    ) {
      const views = [
        zero.materialize(queries.studio.sessionProject(input)),
        zero.materialize(queries.studio.control(input)),
        zero.materialize(queries.studio.proposals(input)),
        zero.materialize(queries.studio.comments(input)),
        zero.materialize(queries.studio.history(input)),
        zero.materialize(queries.studio.manageGroups()),
      ];
      return observeStudio(views, () => client.session(input), next, failed);
    },
    watchEditorActions(input: { projectId: string }, changed: () => void) {
      const view = zero.materialize(queries.studio.editorActions(input));
      view.addListener(rows => {
        if (rows.length) changed();
      });
      return () => view.destroy();
    },
    watchAssets(input: { id: string; workspaceId?: string }, changed: () => void) {
      const view = zero.materialize(
        queries.studio.assets({ projectId: input.id, workspaceId: input.workspaceId })
      );
      view.addListener(changed);
      return () => view.destroy();
    },
    async handoff(input: { id: string }) {
      const job = await client.exportStatus(input);
      if (job.status !== 'completed' || !job.file_name || !job.revision)
        throw new Error('Export is not ready');
      if (!job.file_name.endsWith('.png') && !job.file_name.endsWith('.mp4'))
        throw new Error('Select a single page or video for a Polity post');
      const document = studioDocumentV3Schema.parse(job.revision.document);
      const legacy = v3DocumentToLegacy(document);
      const pageIds = job.page_ids.length
        ? job.page_ids
        : document.nodes.filter(n => n.type === 'frame' && n.parentFrameId === null).map(n => n.id);
      return {
        imageUrl: job.file_name.endsWith('.png') ? `/api/studio/published-media/${job.id}` : '',
        videoUrl: job.file_name.endsWith('.mp4') ? `/api/studio/published-media/${job.id}` : '',
        isStory: legacy.posts.some(
          p => p.kind === 'story' && pageIds.every(id => p.pageIds.includes(id))
        ),
      };
    },
    async upload(projectId: string, file: File, workspaceId?: string) {
      const intent = await client.beginUpload({
        projectId,
        workspaceId,
        name: file.name.slice(0, 200),
        mime: file.type as CommandArguments<'beginUpload'>['mime'],
        size: file.size,
      });
      try {
        const { error } = await createClient()
          .storage.from('studio')
          .uploadToSignedUrl(intent.path, intent.token, file, { contentType: file.type });
        if (error) throw new Error('Media upload failed');
        return await client.finishUpload({ id: intent.id });
      } catch (error) {
        await client.cancelUpload({ id: intent.id }).catch(() => undefined);
        throw error;
      }
    },
    notifyError(error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Studio request failed');
    },
  };
  return client;
}
export function useStudioClient() {
  const zero = useZero();
  return useMemo(() => createStudioClient(zero), [zero]);
}
