import type { AiAttachmentEntity, AiChatAttachment } from '@/lib/ai/schemas';
import type { ProjectScope } from '@/features/project-chat/logic/contracts';
import type postgres from 'postgres';
import { z } from 'zod';
import { enrichAiAttachmentsForPrompt } from '@/server/ai-db';
import { studioSql, StudioError } from './db';

export interface StudioSourceRef {
  type: AiAttachmentEntity;
  id: string;
}

type SourceSql = ReturnType<typeof studioSql> | postgres.TransactionSql;

/** The search projection already applies ownership, current roles and membership
 * states. Do not treat a former/pending relationship as private-source access. */
async function sourceForAudience(
  ref: StudioSourceRef,
  readers: readonly string[],
  visibility: string,
  sql: SourceSql = studioSql()
) {
  if (!z.string().uuid().safeParse(ref.id).success)
    throw new StudioError('Invalid source reference', 400);
  let type: string = ref.type;
  let id = ref.id;
  if (ref.type === 'document') {
    const [document] = await sql`select amendment_id from document where id=${ref.id}`;
    if (!document?.amendment_id) throw new StudioError('Source is unavailable', 403);
    type = 'amendment';
    id = document.amendment_id;
  }
  const [source] =
    await sql`select id,title,subtitle,summary,visibility,card_payload from search_document
    where entity_type=${type} and entity_id=${id}`;
  if (!source) throw new StudioError('Source is unavailable', 403);
  if (visibility === 'public' && source.visibility !== 'public')
    throw new StudioError('Source is not public enough for this project', 403);
  if (visibility === 'authenticated' && !['public', 'authenticated'].includes(source.visibility))
    throw new StudioError('Source is not readable by all signed-in users', 403);
  if (!['public', 'authenticated'].includes(source.visibility) && readers.length) {
    const allowed = await sql`select user_id from search_document_acl
      where document_id=${source.id} and user_id in ${sql([...new Set(readers)])}`;
    const allowedIds = new Set(allowed.map(row => String(row.user_id)));
    if (readers.some(reader => !allowedIds.has(reader)))
      throw new StudioError('Source is not readable by the project audience', 403);
  }
  return source;
}

async function projectAudience(
  scope: ProjectScope,
  sql: SourceSql = studioSql()
): Promise<{ people: string[]; visibility: string }> {
  if (scope.kind === 'studio') {
    const [project] = await sql`
      select owner_id,group_id,visibility from studio_project where id=${scope.projectId}`;
    if (!project) throw new StudioError('Studio project not found', 404);
    if (project.group_id) {
      const people = await sql`
        select ${project.owner_id}::uuid as id
        union select owner_id as id from "group" where id=${project.group_id}
        union select user_id as id from group_membership
        where group_id=${project.group_id} and status in ('active','member','admin')`;
      return { people: people.map(person => String(person.id)), visibility: project.visibility };
    }
    const people = await sql`
      select ${project.owner_id}::uuid as id
      union select user_id as id from studio_project_collaborator
      where project_id=${scope.projectId} and status='active'`;
    return { people: people.map(person => String(person.id)), visibility: project.visibility };
  }
  const [amendment] = await sql`
    select created_by_id,group_id,visibility from amendment where id=${scope.amendmentId}`;
  if (!amendment) throw new StudioError('Amendment not found', 404);
  if (amendment.group_id) {
    const people = await sql`
      select ${amendment.created_by_id}::uuid as id
      union select owner_id as id from "group" where id=${amendment.group_id}
      union select user_id as id from group_membership
      where group_id=${amendment.group_id} and status in ('active','member','admin')`;
    return { people: people.map(person => String(person.id)), visibility: amendment.visibility };
  }
  const people = await sql`
    select ${amendment.created_by_id}::uuid as id
    union select user_id as id from amendment_collaborator
    where amendment_id=${scope.amendmentId} and status='active'`;
  return { people: people.map(person => String(person.id)), visibility: amendment.visibility };
}

/** Resolve model or client references from canonical rows for every project reader. */
export async function resolveProjectSources(
  actor: string,
  scope: ProjectScope | null,
  refs: readonly StudioSourceRef[]
): Promise<AiChatAttachment[]> {
  const audience = scope
    ? await projectAudience(scope)
    : { people: [actor], visibility: 'private' };
  if (!audience.people.includes(actor))
    throw new StudioError('No project collaboration access', 403);
  if (!refs.length) return [];
  const { resolveAiAttachmentForUser } = await import('@/server/ai-tools');
  const result: AiChatAttachment[] = [];
  for (const ref of refs.slice(0, 20)) {
    const source = await sourceForAudience(ref, audience.people, audience.visibility);
    const canonical = await resolveAiAttachmentForUser(actor, {
      entityType: ref.type,
      entityId: ref.id,
    });
    result.push(
      canonical ?? {
        entityType: ref.type,
        entityId: ref.id,
        title: String(source.title),
        subtitle: source.subtitle,
        prompt_context: source.summary,
        card_data_json: JSON.stringify(source.card_payload),
      }
    );
  }
  return enrichAiAttachmentsForPrompt(result);
}

export async function assertProjectAiSourceSharing(
  projectId: string,
  readers: readonly string[],
  visibility: 'private' | 'authenticated' | 'public' = 'private',
  sql: SourceSql = studioSql()
) {
  const proposals =
    await sql`select source_references as ai_sources from studio_project where id=${projectId}
    union all select ai_sources from canvas_proposal
    where project_id=${projectId} and origin='ai' and ai_status='ready'
      and state not in ('withdrawn') and decision is distinct from 'rejected'`;
  for (const proposal of proposals) {
    const refs = Array.isArray(proposal.ai_sources)
      ? (proposal.ai_sources as StudioSourceRef[])
      : [];
    for (const ref of refs) {
      await sourceForAudience(ref, readers, visibility, sql);
    }
  }
}

export async function assertStudioProposalSourceAudience(
  actor: string | null,
  projectId: string,
  refs: readonly StudioSourceRef[],
  sql: SourceSql
) {
  if (!refs.length) return;
  const audience = await projectAudience({ kind: 'studio', projectId }, sql);
  if (actor && !audience.people.includes(actor))
    throw new StudioError('No project collaboration access', 403);
  for (const ref of refs) await sourceForAudience(ref, audience.people, audience.visibility, sql);
}
