import { generateStudioSuggestion } from '@/server/studio/ai-suggestions';
import { studioSql } from '@/server/studio/db';
import { resolveStudioSource } from '@/server/studio/source';
import {
  studioEditSuggestionSchema,
  studioProjectGenerationSchema,
  requestedTextRole,
  resolveStudioTargets,
  studioTargetSchema,
} from '@/server/studio/project-targets';
import { ProjectToolError, type EditorContext } from '@/features/project-chat/logic/contracts';
import { traceAiOperation } from '@/server/ai-trace';

export async function executeStudioChatSuggestion(
  actor: string,
  projectId: string,
  runId: string,
  name: string,
  input: unknown,
  instruction: string,
  hints: EditorContext | undefined,
  options: Parameters<typeof generateStudioSuggestion>[2]
) {
  const source = await resolveStudioSource(actor, projectId, hints?.proposalId ?? null);
  if (options?.requestKey) {
    const [receipt] =
      await studioSql()`select id,ai_warnings from canvas_proposal where project_id=${projectId} and owner_id=${actor} and ai_request_key=${options.requestKey} and ai_status='ready'`;
    if (receipt)
      return {
        projectId,
        proposalId: receipt.id,
        status: 'proposed',
        warnings: receipt.ai_warnings ?? [],
        url: source.groupId
          ? `/group/${source.groupId}/studio/${projectId}?proposalId=${receipt.id}`
          : `/studio/${projectId}?proposalId=${receipt.id}`,
      };
  }
  const ownDraft =
    source.proposal?.origin === 'ai' &&
    source.proposal.owner_id === actor &&
    source.proposal.state === 'draft' &&
    source.proposal.ai_status === 'ready';
  const scope = {
    projectId,
    proposalId: ownDraft ? (source.workspaceId ?? undefined) : undefined,
    sourceWorkspaceId: ownDraft ? undefined : (source.workspaceId ?? undefined),
  };
  const role = requestedTextRole(instruction);
  if (name === 'studio_edit_suggestion') {
    const args = studioEditSuggestionSchema.parse(input);
    const [snapshot] =
      await studioSql()`select references_json,resource_id from ai_context_snapshot where id=${args.snapshotId} and run_id=${runId} and resource_kind='studio'`;
    const provenance = snapshot?.references_json?._studioSource;
    if (
      !provenance ||
      snapshot.resource_id !== projectId ||
      provenance.workspaceId !== source.workspaceId
    )
      throw new ProjectToolError(
        'invalid_target',
        'Read the current Studio workspace before editing.',
        'read_again'
      );
    if (provenance.revision !== source.revision)
      throw new ProjectToolError(
        'context_stale',
        'The Studio document changed. Read it again.',
        'read_again'
      );
    const edits = args.edits.flatMap(edit => {
      const targets = resolveStudioTargets(
        source.document,
        { ...edit, role: role ?? edit.role, name: role ? undefined : edit.name },
        hints
      );
      return targets.nodeIds.map(nodeId => ({ nodeId, text: edit.text }));
    });
    await traceAiOperation(
      'studio',
      'resolve_targets',
      { workspaceId: source.workspaceId, revision: source.revision },
      async () => ({ targets: edits.map(edit => edit.nodeId) })
    );
    const result = await generateStudioSuggestion(
      actor,
      { ...scope, instruction, action: 'edit', nodeIds: edits.map(edit => edit.nodeId) },
      { ...options, strictSource: true, expectedRevision: source.revision, textEdits: edits }
    );
    return { ...result, status: 'proposed' };
  }
  const args = studioProjectGenerationSchema.parse(input);
  const targets =
    args.action === 'edit' && !args.themeOnly
      ? resolveStudioTargets(
          source.document,
          role ? studioTargetSchema.parse({ role }) : studioTargetSchema.parse(args),
          hints
        )
      : { nodeIds: [], frameIds: [] };
  const result = await generateStudioSuggestion(
    actor,
    { ...args, ...scope, ...targets, instruction },
    { ...options, strictSource: true, expectedRevision: source.revision }
  );
  return { ...result, status: 'proposed' };
}
