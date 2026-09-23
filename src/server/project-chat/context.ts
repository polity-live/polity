import { getCityDesignOsmFeatures } from '@/features/amendments/city-design/logic/cityDesignOsm';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { zql } from '@/zero/schema';
import { projectConversationAccess } from '@/zero/project-chat/access';
import { rows, sqlTransaction } from '@/server/transaction';
import { checksum } from '@/server/checksum';
import { amendmentServerMutatorInternals } from '@/zero/amendments/server-mutators';
import { ProjectToolError, type EditorContext } from '@/features/project-chat/logic/contracts';
import { textReferences, type TextNode } from '@/features/project-chat/logic/text-actions';
import { documentSchema } from '@/features/communication-studio/logic/document';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { v3DocumentToLegacy } from '@/features/communication-studio/logic/v3-adapter';
import { textValue } from '@/features/shared/utils/document-value';
import { cityProjectionSchema } from '@/features/amendments/city-design/logic/projection-schema';

export async function requireProjectConversation(tx: ZeroTransaction, actor: string, id: string) {
  const allowed = await tx.run(
    projectConversationAccess(zql.conversation.where('id', id), actor).one()
  );
  if (!allowed) throw new ProjectToolError('permission_denied');
  const conversation = await tx.run(zql.conversation.where('id', id).one());
  if (!conversation) throw new ProjectToolError('not_found');
  return conversation;
}
export type ResourceKind = 'studio' | 'amendment_text' | 'city_design';
export async function loadResource(
  tx: ZeroTransaction,
  actor: string,
  conversationId: string,
  kind: ResourceKind,
  hints: EditorContext | undefined
) {
  const conversation = await requireProjectConversation(tx, actor, conversationId);
  const sql = sqlTransaction(tx);
  if (kind === 'studio') {
    if (!conversation.studio_project_id) throw new ProjectToolError('scope_mismatch');
    const [stored] = await rows<{
      document: unknown;
      content_revision: number;
      generation: string;
      can_edit: boolean;
    }>(
      sql,
      'select s.document,s.content_revision,c.generation,studio_access($1::uuid,$2::uuid,true) as can_edit from studio_state s join canvas_control c using(project_id) where s.project_id=$2 for update',
      [actor, conversation.studio_project_id]
    );
    if (!stored) throw new ProjectToolError('not_found');
    const persisted = studioDocumentV3Schema.parse(stored.document);
    return {
      kind,
      id: conversation.studio_project_id,
      branchId: null,
      contentRevision: Number(stored.content_revision),
      generation: stored.generation,
      mode: stored.can_edit ? 'edit' : 'view',
      value: v3DocumentToLegacy(persisted),
      revision: String(stored.content_revision),
      stored: persisted,
      amendment: null,
      references: {},
    };
  }

  if (!conversation.amendment_id) throw new ProjectToolError('scope_mismatch');
  const amendment = await tx.run(zql.amendment.where('id', conversation.amendment_id).one());
  if (!amendment) throw new ProjectToolError('not_found');
  const processRun = amendment.current_process_run_id
    ? await tx.run(zql.amendment_process_run.where('id', amendment.current_process_run_id).one())
    : null;
  const branchId = hints?.branchId ?? processRun?.active_branch_id ?? null;
  if (processRun && !branchId)
    throw new ProjectToolError('branch_required', 'Select a process branch.', 'ask_user');
  const { branch, mode } =
    await amendmentServerMutatorInternals.resolveChangeRequestMutationEditingMode({
      tx,
      amendmentId: amendment.id,
      processBranchId: branchId,
    });
  if (branch) {
    const processRun = await amendmentServerMutatorInternals.loadProcessRunForBranch(tx, branch);
    if (
      processRun.amendment_id !==
      (amendment.origin_amendment_id ?? amendment.clone_source_id ?? amendment.id)
    )
      throw new ProjectToolError('scope_mismatch');
  }
  if (kind === 'amendment_text') {
    const documentId = branch?.document_id ?? amendment.document_id;
    if (!documentId || (hints?.documentId && hints.documentId !== documentId))
      throw new ProjectToolError('scope_mismatch');
    const [document] = await rows<{ content: unknown; content_revision: number }>(
      sql,
      'select content,content_revision from document where id=$1 for update',
      [documentId]
    );
    if (!document) throw new ProjectToolError('not_found');
    const content = textValue(document.content) as TextNode[];
    const selection =
      hints?.contentRevision === Number(document.content_revision) ? hints.selection : undefined;
    const { references } = textReferences(content, selection);
    const tags = await tx.run(
      zql.amendment_hashtag.where('amendment_id', amendment.id).related('hashtag')
    );
    const value = {
      content,
      metadata: {
        hashtags: tags
          .map(tag => tag.hashtag?.tag)
          .filter((tag): tag is string => !!tag)
          .sort(),
        title: amendment.title ?? '',
        code: amendment.code ?? null,
        reason: amendment.reason ?? null,
        preamble: amendment.preamble ?? null,
      },
      discussions: branch?.discussions ?? amendment.discussions ?? [],
    };
    return {
      kind,
      id: documentId,
      contentRevision: Number(document.content_revision),
      branchId,
      mode,
      value,
      revision: checksum({ revision: document.content_revision, mode, value }),
      amendment,
      stored: null,
      references,
    };
  }
  const [city] = await rows<{ id: string; design_state: unknown; content_revision: number }>(
    sql,
    'select id,design_state,content_revision from amendment_city_design where amendment_id=$1 order by updated_at desc,id desc limit 1 for update',
    [amendment.id]
  );
  if (!city)
    throw new ProjectToolError(
      'resource_not_ready',
      'Choose a map area and save City Design first.',
      'ask_user'
    );
  if (hints?.cityDesignId && hints.cityDesignId !== city.id)
    throw new ProjectToolError('scope_mismatch');
  const value = cityProjectionSchema.parse(city.design_state);
  return {
    kind,
    id: city.id,
    contentRevision: Number(city.content_revision),
    branchId,
    mode,
    value,
    revision: checksum({ revision: city.content_revision, mode, value }),
    amendment,
    stored: null,
    references: {},
  };
}
export interface ContextSnapshot {
  id: string;
  run_id: string;
  resource_kind: ResourceKind;
  resource_id: string;
  branch_id: string | null;
  revision: string;
  value: unknown;
  references_json: unknown;
}
export async function readContext(
  tx: ZeroTransaction,
  actor: string,
  runId: string,
  conversationId: string,
  kind: ResourceKind,
  hints: EditorContext | undefined,
  offset = 0,
  limit = 20,
  features = false,
  maxCharacters = 100_000
) {
  const resource = await loadResource(tx, actor, conversationId, kind, hints);
  const id = crypto.randomUUID();
  await sqlTransaction(tx).query(
    'insert into ai_context_snapshot(id,run_id,resource_kind,resource_id,branch_id,revision,value,references_json,created_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)',
    [
      id,
      runId,
      kind,
      resource.id,
      resource.branchId,
      resource.revision,
      resource.value,
      resource.references,
      Date.now(),
    ]
  );
  let data: unknown;
  if (kind === 'studio') {
    const doc = documentSchema.parse(resource.value);
    const persisted = studioDocumentV3Schema.parse(resource.stored);
    const { brand: _brand, source: _source, ...projection } = doc;
    void _brand;
    void _source;
    data = {
      ...projection,
      theme: persisted.theme,
      pages: doc.pages.slice(offset, offset + limit),
      posts: doc.posts.slice(offset, offset + limit),
      totalPages: doc.pages.length,
    };
  } else if (kind === 'amendment_text') {
    const doc = resource.value as { content: TextNode[]; metadata: unknown };
    const selection =
      hints?.contentRevision === resource.contentRevision ? hints.selection : undefined;
    const { blocks, selectionAnchors } = textReferences(doc.content, selection);
    data = {
      metadata: doc.metadata,
      selectionAnchors,
      selectionStale: !!hints?.selection && !selection,
      blocks: blocks.slice(offset, offset + limit),
      totalBlocks: blocks.length,
    };
  } else {
    const doc = cityProjectionSchema.parse(resource.value);
    const { objects, osmSnapshot: _osm, ...scene } = doc;
    void _osm;
    const osmFeatures = features
      ? getCityDesignOsmFeatures(
          (doc as import('@/features/amendments/city-design/types').CityDesignStateV1).osmSnapshot
        )
      : [];
    data = features
      ? { features: osmFeatures.slice(offset, offset + limit), totalFeatures: osmFeatures.length }
      : { ...scene, objects: objects.slice(offset, offset + limit), totalObjects: objects.length };
  }
  // Never truncate a geometry or a text anchor and silently make it writable.
  if (JSON.stringify(data).length > maxCharacters)
    throw new ProjectToolError(
      'context_too_large',
      'Read a smaller page using offset and limit.',
      'read_again'
    );
  return {
    snapshotId: id,
    resourceId: resource.id,
    branchId: resource.branchId,
    revision: resource.revision,
    mode: resource.mode,
    selection: hints ?? null,
    offset,
    limit,
    data,
  };
}
