import { syncEntityHashtagsForUpdate } from '@/zero/common/server-hashtags';
import { z } from 'zod';
import { tool, type ToolSet } from 'ai';
import type { ZeroTransaction } from '@/server/zero-mutate';
import type { ZeroContext } from '@/zero/context';
import { rows, sqlTransaction, lockAuthority } from '@/server/transaction';
import { checksum } from '@/server/checksum';
import {
  studioProjectGenerationSchema,
  studioEditSuggestionSchema,
  studioTargetSchema,
  resolveStudioTargets,
} from '@/server/studio/project-targets';
import { resolveStudioSource } from '@/server/studio/source';
import {
  applyAmendmentSchema,
  applyCitySchema,
  ProjectToolError,
  type EditorContext,
} from '@/features/project-chat/logic/contracts';
import { applyCityActions, cityCatalog } from '@/features/project-chat/logic/city-actions';
import {
  applyTextActions,
  suggestTextChanges,
  type TextReferences,
  type TextNode,
} from '@/features/project-chat/logic/text-actions';
import { conditionalUndo } from '@/features/project-chat/logic/conditional-undo';
import { cityProjectionSchema } from '@/features/amendments/city-design/logic/projection-schema';
import type { CityDesignStateV1 } from '@/features/amendments/city-design/types';
import {
  createCityDesignPersistenceSnapshot,
  createCityDesignChangeRequestPayloads,
} from '@/features/amendments/city-design/logic/cityDesignChangeRequestDiff';
import {
  amendmentServerMutators,
  amendmentServerMutatorInternals,
} from '@/zero/amendments/server-mutators';
import { documentServerMutators } from '@/zero/documents/server-mutators';
import { updateDocumentSchema } from '@/zero/documents/schema';
import { updateAmendmentSchema, updateAmendmentCityDesignSchema } from '@/zero/amendments/schema';
import {
  createDocumentChangeRequestSchema,
  createCityDesignChangeRequestsSchema,
} from '@/zero/change-requests/schema';
import {
  readContext,
  loadResource,
  requireProjectConversation,
  type ResourceKind,
  type ContextSnapshot,
} from './context';

const readSchema = z.strictObject({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(50).default(20),
});
export const studioToolGroup = (name: string) =>
  /export/.test(name)
    ? 'export'
    : /format_text|text_range/.test(name)
      ? 'text'
      : /table|chart/.test(name)
        ? 'data'
        : /page/.test(name)
          ? 'pages'
          : /post_|caption/.test(name)
            ? 'campaign'
            : /media/.test(name)
              ? 'media'
              : /element|shape|align|distribute|arrange/.test(name)
                ? 'objects'
                : /preview|guides|panel|editor_status|selection|undo_local|redo_local/.test(name)
                  ? 'view'
                  : 'project';
const catalogSchema = z.object({
  group: z
    .enum([
      'all',
      'project',
      'text',
      'objects',
      'pages',
      'data',
      'campaign',
      'media',
      'view',
      'export',
    ])
    .optional(),
});
export function studioToolNamesForGroups(groups: string[]) {
  void groups;
  return Object.keys(toolsForScope(true));
}
const namedStudioTools: ToolSet = {
  studio_editor_status: tool({
    description:
      'Read the actual acknowledgement from the open editor. A queued action has not completed yet.',
    inputSchema: z.object({ operationId: z.string().uuid() }),
  }),
  studio_media: tool({
    description: 'List ready media IDs available in the current Studio workspace.',
    inputSchema: z.object({}),
  }),
  studio_catalog: tool({
    description:
      'Discover available Studio context, media, status and reviewable suggestion tools.',
    inputSchema: catalogSchema,
  }),
  studio_export_status: tool({
    description: 'Read an export job status and download link when completed.',
    inputSchema: z.object({ jobId: z.string().uuid() }),
  }),
};
export const projectToolDefinitions = {
  studio_edit_suggestion: tool({
    description:
      'Make a precise text replacement in a reviewable AI suggestion, preserving style and all other elements. Read studio_read first for snapshotId. Use role/name to identify the requested text element; a named role takes precedence over editor selection. Does not apply automatically.',
    inputSchema: studioEditSuggestionSchema,
  }),
  studio_resolve_target: tool({
    description:
      'Resolve one named text role (title/subtitle/body/cta) or element name in the current Studio frame. Returns exact IDs and a fresh snapshot. Multiple matches require asking the user.',
    inputSchema: studioTargetSchema,
  }),
  studio_generate_suggestion: tool({
    description:
      'Generate an editable AI Suggestion in the current Studio project. Use action=edit for followups or selected elements. Use mode=free only when explicitly requested. Theme fields require an explicit request; set themeOnly=true for a change limited to themeId/themeName/themeMode. It is never applied automatically.',
    inputSchema: studioProjectGenerationSchema,
  }),
  city_design_read_features: tool({
    description:
      'Read complete OSM feature records from the saved project map. Use feature IDs with osm.import_feature. No external map request is performed.',
    inputSchema: readSchema,
  }),
  studio_read: tool({
    description:
      'Read committed Studio pages, elements, theme and posts. Returns snapshotId and IDs. Page using offset/limit. Read before writing.',
    inputSchema: readSchema,
  }),
  amendment_read: tool({
    description:
      'Read amendment metadata and text blocks with snapshot-local block/anchor references. Branch comes from the current editor context. Read before writing.',
    inputSchema: readSchema,
  }),
  amendment_apply_actions: tool({
    description:
      'Apply metadata/text actions atomically. Text anchors replace/format the exact loaded text leaf. Block references must form a contiguous sequence. Existing annotations are protected. Suggest modes create real change requests; edit mode saves directly.',
    inputSchema: applyAmendmentSchema,
  }),
  city_design_read: tool({
    description:
      'Read the amendment-wide City Design scene and complete object geometries with snapshotId. Coordinates are local meters; rotations in actions are degrees. Read before writing.',
    inputSchema: readSchema,
  }),
  city_design_catalog: tool({
    description: 'List supported object types, editable properties, geometry types and cost rules.',
    inputSchema: z.strictObject({}),
  }),
  city_design_apply_actions: tool({
    description:
      'Apply object, geometry, cost and OSM import actions atomically against a loaded snapshot. Costs are recalculated. Suggest modes create per-object change requests; voting is never bypassed.',
    inputSchema: applyCitySchema,
  }),
};
export function toolsForScope(studio: boolean): ToolSet {
  return studio
    ? {
        ...namedStudioTools,
        studio_read: projectToolDefinitions.studio_read,
        studio_resolve_target: projectToolDefinitions.studio_resolve_target,
        studio_edit_suggestion: projectToolDefinitions.studio_edit_suggestion,
        studio_generate_suggestion: projectToolDefinitions.studio_generate_suggestion,
      }
    : {
        city_design_read_features: projectToolDefinitions.city_design_read_features,
        amendment_read: projectToolDefinitions.amendment_read,
        amendment_apply_actions: projectToolDefinitions.amendment_apply_actions,
        city_design_read: projectToolDefinitions.city_design_read,
        city_design_catalog: projectToolDefinitions.city_design_catalog,
        city_design_apply_actions: projectToolDefinitions.city_design_apply_actions,
      };
}
interface TextState {
  content: TextNode[];
  metadata: Record<string, unknown>;
  discussions: unknown[];
}
type Resource = Awaited<ReturnType<typeof loadResource>>;
async function saveResource(
  tx: ZeroTransaction,
  actor: string,
  resource: Resource,
  value: unknown,
  summary: string
): Promise<{
  value: unknown;
  proposalIds: string[];
}> {
  const ctx: ZeroContext = { userID: actor, email: '' };
  const amendment = resource.amendment;
  if (!amendment) throw new ProjectToolError('scope_mismatch');
  const direct = resource.mode === 'edit';
  // Only explicit suggestion phases permit AI proposals. Never write during voting.
  if (!direct && !['suggest_internal', 'suggest_event', 'suggest'].includes(resource.mode))
    throw new ProjectToolError('editing_mode_readonly');
  if (direct)
    await amendmentServerMutatorInternals.assertCityDesignDirectEditMode(
      tx,
      amendment.id,
      resource.branchId
    );
  else
    await amendmentServerMutatorInternals.assertCanCreateChangeRequest(
      tx,
      ctx,
      amendment.id,
      resource.branchId
    );
  if (resource.kind === 'city_design') {
    const after = cityProjectionSchema.parse(value) as CityDesignStateV1;
    if (!direct) {
      const requests = createCityDesignChangeRequestPayloads({
        amendmentId: amendment.id,
        processBranchId: resource.branchId,
        cityDesignId: resource.id,
        baseDesign: resource.value as CityDesignStateV1,
        draftDesign: after,
        createId: () => crypto.randomUUID(),
      });
      if (!requests.length) throw new ProjectToolError('no_changes');
      await amendmentServerMutators.createCityDesignChangeRequests.fn({
        tx,
        ctx,
        args: createCityDesignChangeRequestsSchema.parse({
          amendment_id: amendment.id,
          process_branch_id: resource.branchId,
          requests,
        }),
      });
      return { value: after, proposalIds: requests.map(r => r.id) };
    }
    const { design: _design, ...data } = createCityDesignPersistenceSnapshot(after);
    void _design;
    await amendmentServerMutators.updateCityDesign.fn({
      tx,
      ctx,
      args: updateAmendmentCityDesignSchema.parse({
        id: resource.id,
        expected_content_revision: resource.contentRevision,
        process_branch_id: resource.branchId,
        ...data,
      }),
    });
    return { value: after, proposalIds: [] };
  }
  const before = resource.value as TextState,
    after = value as TextState;
  if (checksum(before.metadata) !== checksum(after.metadata)) {
    if (!direct) throw new ProjectToolError('metadata_requires_edit_mode');
    await amendmentServerMutators.update.fn({
      tx,
      ctx,
      args: updateAmendmentSchema.parse({ id: amendment.id, ...after.metadata }),
    });
    if (Array.isArray(after.metadata.hashtags))
      await syncEntityHashtagsForUpdate(
        tx,
        ctx,
        'amendment',
        amendment.id,
        after.metadata.hashtags as string[]
      );
  }
  if (checksum(before.content) === checksum(after.content))
    return { value: after, proposalIds: [] };
  if (direct) {
    await documentServerMutators.updateContent.fn({
      tx,
      ctx,
      args: updateDocumentSchema.parse({
        id: resource.id,
        expected_content_revision: resource.contentRevision,
        content: after.content,
        reconcile_orphaned_change_requests: true,
      }),
    });
    return { value: after, proposalIds: [] };
  }
  const id = crypto.randomUUID(),
    discussionId = crypto.randomUUID();
  const content = suggestTextChanges(before.content, after.content, discussionId);
  const discussions = [
    ...before.discussions,
    {
      id: discussionId,
      isResolved: false,
      changeRequestEntityId: id,
      comments: [
        {
          id: crypto.randomUUID(),
          userId: actor,
          createdAt: new Date().toISOString(),
          contentRich: [{ type: 'p', children: [{ text: summary }] }],
        },
      ],
    },
  ];
  await amendmentServerMutators.createDocumentChangeRequest.fn({
    tx,
    ctx,
    args: createDocumentChangeRequestSchema.parse({
      id,
      amendment_id: amendment.id,
      process_branch_id: resource.branchId,
      discussion_id: discussionId,
      title: summary,
      description: summary,
      status: 'pending',
      reason: null,
      source_type: 'document',
      source_id: resource.id,
      source_title: amendment.title,
      voting_status: 'pending',
      voting_deadline: null,
      voting_majority_type: null,
      quorum_required: null,
      document_content: content,
      discussions,
    }),
  });
  return { value: { ...after, content, discussions }, proposalIds: [id] };
}

export async function executeProjectTool(
  tx: ZeroTransaction,
  actor: string,
  runId: string,
  conversationId: string,
  toolCallId: string,
  name: string,
  input: unknown,
  hints?: EditorContext,
  maxContextCharacters = 100_000
) {
  if (JSON.stringify(input).length > 300_000) throw new ProjectToolError('actions_too_large');
  await lockAuthority(sqlTransaction(tx));
  const conversation = await requireProjectConversation(tx, actor, conversationId);
  const projectId = conversation.studio_project_id;
  if (!Object.hasOwn(toolsForScope(!!projectId), name))
    throw new ProjectToolError(
      'tool_not_available',
      projectId ? 'Studio AI edits must create a reviewable suggestion.' : undefined
    );
  if (name === 'studio_generate_suggestion' || name === 'studio_edit_suggestion')
    throw new ProjectToolError('tool_not_available', 'Use the Studio AI suggestion runner.');
  if (projectId) {
    if (name === 'studio_editor_status') {
      const { operationId } = z.object({ operationId: z.string().uuid() }).parse(input);
      const [row] = await rows<{ result: unknown; created_at: number }>(
        sqlTransaction(tx),
        'select result,created_at from studio_editor_action where id=$1 and actor_id=$2 and project_id=$3',
        [operationId, actor, conversation.studio_project_id]
      );
      if (!row) throw new ProjectToolError('not_found');
      return {
        operationId,
        status: row.result
          ? 'acknowledged'
          : Date.now() - row.created_at > 120000
            ? 'editor_unavailable'
            : 'queued',
        result: row.result,
      };
    }
    if (name === 'studio_resolve_target') {
      const source = await resolveStudioSource(
        actor,
        projectId,
        hints?.proposalId ?? null,
        sqlTransaction(tx)
      );
      const targets = resolveStudioTargets(source.document, studioTargetSchema.parse(input), hints);
      return {
        ...(await readContext(
          tx,
          actor,
          runId,
          conversationId,
          'studio',
          hints,
          0,
          20,
          false,
          maxContextCharacters
        )),
        targets,
      };
    }
    if (name === 'studio_media') {
      const source = await resolveStudioSource(
        actor,
        projectId,
        hints?.proposalId ?? null,
        sqlTransaction(tx)
      );
      return rows(
        sqlTransaction(tx),
        'select id,name,mime_type from studio_asset where project_id=$1 and (workspace_id is null or workspace_id=$2) and ready=true',
        [source.projectId, source.workspaceId]
      );
    }
    if (name === 'studio_catalog') {
      const { group } = catalogSchema.parse(input);
      return {
        groups: [
          'project',
          'text',
          'objects',
          'pages',
          'data',
          'campaign',
          'media',
          'view',
          'export',
        ],
        tools: studioToolNamesForGroups([group ?? 'all']).map(name => ({
          name,
          group: studioToolGroup(name),
          description: toolsForScope(true)[name].description,
        })),
        activatedGroup: group ?? null,
      };
    }
    if (name === 'studio_export_status') {
      const { jobId } = z.object({ jobId: z.string().uuid() }).parse(input);
      const [job] = await rows<{ status: string; progress: number; error: string | null }>(
        sqlTransaction(tx),
        'select status,progress,error from studio_export where id=$1 and project_id=$2',
        [jobId, conversation.studio_project_id]
      );
      if (!job) throw new ProjectToolError('not_found');
      return {
        ...job,
        jobId,
        next:
          job.status === 'completed'
            ? 'Use the export download control in Studio.'
            : 'Poll this job again.',
      };
    }
    const args = readSchema.parse(input);
    return readContext(
      tx,
      actor,
      runId,
      conversationId,
      'studio',
      hints,
      args.offset,
      args.limit,
      false,
      maxContextCharacters
    );
  }
  if (name === 'city_design_catalog') return cityCatalog();
  const kind: ResourceKind = name.startsWith('amendment_') ? 'amendment_text' : 'city_design';
  if (name.endsWith('_read') || name === 'city_design_read_features') {
    const args = readSchema.parse(input);
    return readContext(
      tx,
      actor,
      runId,
      conversationId,
      kind,
      hints,
      args.offset,
      args.limit,
      name === 'city_design_read_features',
      maxContextCharacters
    );
  }
  const args =
    kind === 'amendment_text' ? applyAmendmentSchema.parse(input) : applyCitySchema.parse(input);
  const sql = sqlTransaction(tx);
  const [snapshot] = await rows<ContextSnapshot>(
    sql,
    'select * from ai_context_snapshot where id=$1 and run_id=$2',
    [args.snapshotId, runId]
  );
  if (!snapshot || snapshot.resource_kind !== kind)
    throw new ProjectToolError('invalid_snapshot', 'Read the resource first.', 'read_again');
  const resource = await loadResource(tx, actor, conversationId, kind, hints);
  if (
    resource.id !== snapshot.resource_id ||
    resource.branchId !== snapshot.branch_id ||
    resource.revision !== snapshot.revision
  )
    throw new ProjectToolError(
      'revision_conflict',
      'The resource changed. Read it again.',
      'read_again'
    );
  let next: unknown,
    createdRefs: Record<string, string> = {};
  if (kind === 'city_design') {
    const result = applyCityActions(
      resource.value as CityDesignStateV1,
      applyCitySchema.parse(args).actions
    );
    next = result.value;
    createdRefs = result.createdRefs;
  } else {
    const before = resource.value as TextState;
    const result = applyTextActions(
      before.content,
      applyAmendmentSchema.parse(args).actions,
      snapshot.references_json as TextReferences
    );
    next = {
      ...before,
      content: result.value,
      metadata: { ...before.metadata, ...result.metadata },
    };
  }
  if (checksum(next) === checksum(resource.value)) {
    throw new ProjectToolError('no_changes');
  }
  const saved = await saveResource(tx, actor, resource, next, args.summary);
  const persistedValue = saved.proposalIds.length
    ? saved.value
    : (await loadResource(tx, actor, conversationId, kind, hints)).value;
  const id = crypto.randomUUID(),
    status = saved.proposalIds.length ? 'proposed' : 'applied';
  await sql.query(
    'insert into ai_change_set(id,conversation_id,run_id,tool_call_id,actor_id,resource_kind,resource_id,branch_id,summary,status,before_value,after_value,proposal_ids,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14)',
    [
      id,
      conversationId,
      runId,
      toolCallId,
      actor,
      kind,
      resource.id,
      resource.branchId,
      args.summary,
      status,
      resource.value,
      persistedValue,
      saved.proposalIds,
      Date.now(),
    ]
  );
  return {
    changeSetId: id,
    status,
    summary: args.summary,
    createdRefs,
    proposalIds: saved.proposalIds,
    next: 'Read the resource again before the next write.',
  };
}

export async function undoProjectChange(
  tx: ZeroTransaction,
  actor: string,
  changeSetId: string,
  redo = false
) {
  const sql = sqlTransaction(tx);
  await lockAuthority(sql);
  const [change] = await rows<{
    id: string;
    conversation_id: string;
    actor_id: string;
    resource_kind: ResourceKind;
    resource_id: string;
    branch_id: string | null;
    status: string;
    undone_at: number | null;
    before_value: unknown;
    after_value: unknown;
  }>(sql, 'select * from ai_change_set where id=$1 for update', [changeSetId]);
  if (!change || change.actor_id !== actor) throw new ProjectToolError('permission_denied');
  await requireProjectConversation(tx, actor, change.conversation_id);
  if (change.resource_kind === 'studio')
    throw new ProjectToolError(
      'proposal_requires_governance',
      'Studio AI changes must be reviewed through suggestions.'
    );
  if (change.status === (redo ? 'applied' : 'undone')) return;
  if (change.status !== (redo ? 'undone' : 'applied'))
    throw new ProjectToolError(
      'proposal_requires_governance',
      'Use the existing change-request workflow to withdraw a proposal.'
    );
  const resource = await loadResource(tx, actor, change.conversation_id, change.resource_kind, {
    surface: change.resource_kind,
    branchId: change.branch_id,
  });
  if (resource.id !== change.resource_id || resource.mode !== 'edit')
    throw new ProjectToolError('undo_conflict');
  const inverse = conditionalUndo(
    resource.value,
    redo ? change.after_value : change.before_value,
    redo ? change.before_value : change.after_value
  );
  await saveResource(tx, actor, resource, inverse, redo ? 'Redo AI change' : 'Undo AI change');
  await sql.query('update ai_change_set set status=$3,undone_at=$2 where id=$1', [
    change.id,
    Date.now(),
    redo ? 'applied' : 'undone',
  ]);
}
