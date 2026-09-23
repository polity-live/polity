import { createHash } from 'node:crypto';
import { studioEditorCommandSchemas } from '@/features/communication-studio/logic/editor-commands';
import {
  studioCommandSchemas,
  applyStudioCommand,
  type StudioCommandName,
} from '@/features/communication-studio/logic/commands';
import { studioActionSchema } from '@/features/project-chat/logic/contracts';
import { zql } from '@/zero/schema';
import { syncEntityHashtagsForUpdate } from '@/zero/common/server-hashtags';
import { z } from 'zod';
import { tool, type ToolSet } from 'ai';
import type { ZeroTransaction } from '@/server/zero-mutate';
import type { ZeroContext } from '@/zero/context';
import { rows, sqlTransaction, lockAuthority } from '@/server/transaction';
import { checksum } from '@/server/checksum';
import { applyStudioOperation } from '@/server/studio/operations';
import {
  diffStudio,
  mergeStudio,
  inverseChanges,
  type StudioConflict,
} from '@/features/communication-studio/logic/operations';
import { documentSchema } from '@/features/communication-studio/logic/document';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import {
  applyThemeSnapshot,
  type StudioThemeSnapshot,
} from '@/features/communication-studio/logic/theme';
import { resolveStudioTheme } from '@/server/studio/service';
import {
  legacyDocumentToV3,
  v3DocumentToLegacy,
} from '@/features/communication-studio/logic/v3-adapter';
import {
  applyStudioSchema,
  applyAmendmentSchema,
  applyCitySchema,
  ProjectToolError,
  type EditorContext,
} from '@/features/project-chat/logic/contracts';
import { applyStudioActions } from '@/features/project-chat/logic/studio-actions';
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

const operationUUID = (s: string) => {
  const h = createHash('sha256').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const readSchema = z.strictObject({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(50).default(20),
});
const namedActions = new Map(
  studioActionSchema.options.map(option => [
    `studio_${String(option.shape.type.value).replaceAll('.', '_')}`,
    option,
  ])
);
const writeContext = { snapshotId: z.string().uuid(), summary: z.string().min(1).max(500) };
const shapeInsertSchema = z.object({
  snapshotId: z.string().uuid(),
  summary: z.string().min(1).max(500),
  pageId: z.string().uuid(),
  ref: z.string().min(1).max(100),
  shape: z.enum(['rect', 'ellipse', 'line', 'arrow']),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().min(4).max(5000),
  height: z.number().min(4).max(5000),
  fill: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#B88A3B'),
});
const editorNames = new Set(Object.keys(studioEditorCommandSchemas));
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
  return Object.keys(toolsForScope(true)).filter(
    name =>
      ['studio_catalog', 'studio_read'].includes(name) ||
      groups.includes('all') ||
      groups.includes(studioToolGroup(name))
  );
}
const namedStudioTools: ToolSet = Object.fromEntries([
  ...Object.entries(studioEditorCommandSchemas).map(([name, inputSchema]) => [
    name,
    tool({
      description: `${name.replaceAll('_', ' ')} in the open Studio editor. Returns queued, not completed. Poll studio_editor_status until the editor acknowledges execution.`,
      inputSchema: inputSchema as z.ZodObject<z.ZodRawShape>,
    }),
  ]),
  [
    'studio_editor_status',
    tool({
      description:
        'Read the actual acknowledgement from the open editor. A queued action has not completed yet.',
      inputSchema: z.object({ operationId: z.string().uuid() }),
    }),
  ],
  [
    'studio_upload_media',
    tool({
      description:
        'Request a local image or video upload. Requires the user to choose a file in Insert > Upload; cannot complete without that step.',
      inputSchema: z.object({}),
    }),
  ],
  [
    'studio_import_chat_media',
    tool({
      description:
        'Copy a server-approved chat upload into this project. Use an editor-uploads path returned with the current run attachments. Returns a project assetId for studio_element_add.',
      inputSchema: z.object({ path: z.string().min(1).max(1000) }),
    }),
  ],
  [
    'studio_media',
    tool({
      description:
        'List ready project media IDs usable with studio_element_add. Local uploads require the user to use Insert > Upload.',
      inputSchema: z.object({}),
    }),
  ],
  [
    'studio_format_text_range',
    tool({
      description:
        'Format a range in an existing rich-text paragraph. Offsets are characters; read the paragraph ID first.',
      inputSchema: studioCommandSchemas.studio_format_text.extend(writeContext),
    }),
  ],
  [
    'studio_insert_shape',
    tool({
      description:
        'Insert a rectangle, ellipse, line or arrow on a loaded page. Returns createdRefs for alignment.',
      inputSchema: shapeInsertSchema,
    }),
  ],
  ...[...namedActions].map(([name, option]) => [
    name,
    tool({
      description: `Studio: ${String(option.shape.type.value)}. Read studio_read first; use its snapshotId and exact resource IDs.`,
      inputSchema: (option as z.ZodObject<z.ZodRawShape>).omit({ type: true }).extend(writeContext),
    }),
  ]),
  ...Object.entries(studioCommandSchemas).map(([name, schema]) => [
    name,
    tool({
      description: `${name.replaceAll('_', ' ')}. Read studio_read first. Coordinates are page pixels; locked elements are protected.`,
      inputSchema: (name === 'studio_format_text'
        ? studioCommandSchemas.studio_format_text
            .omit({ range: true, list: true, url: true })
            .extend({
              patch: studioCommandSchemas.studio_format_text.shape.patch.omit({ richText: true }),
            })
        : (schema as z.ZodObject<z.ZodRawShape>)
      ).extend(writeContext),
    }),
  ]),
  [
    'studio_catalog',
    tool({
      description:
        'Discover and activate Studio tools by group: project, text, objects, pages, data, campaign, media, view, export, or all.',
      inputSchema: catalogSchema,
    }),
  ],
  [
    'studio_export',
    tool({
      description:
        'Export a committed Studio revision. Returns an export job; read its status before claiming completion.',
      inputSchema: z.object({
        revision: z.number().int().nonnegative(),
        format: z.enum(['png', 'pdf', 'pptx', 'canva', 'mp4', 'xlsx', 'zip']),
        pageIds: z.array(z.string().uuid()).default([]),
      }),
    }),
  ],
  [
    'studio_export_status',
    tool({
      description: 'Read an export job status and download link when completed.',
      inputSchema: z.object({ jobId: z.string().uuid() }),
    }),
  ],
  [
    'studio_redo',
    tool({
      description: 'Reapply an undone AI change without overwriting later edits.',
      inputSchema: z.object({ changeSetId: z.string().uuid() }),
    }),
  ],
  [
    'studio_cancel_export',
    tool({
      description: 'Cancel a queued or running export.',
      inputSchema: z.object({ jobId: z.string().uuid() }),
    }),
  ],
  [
    'studio_undo',
    tool({
      description: 'Undo a previous AI change using its changeSetId. Later edits are protected.',
      inputSchema: z.object({ changeSetId: z.string().uuid() }),
    }),
  ],
]);
export const projectToolDefinitions = {
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
  studio_apply_actions: tool({
    description:
      'Atomically apply 1–50 Studio actions to a loaded snapshot. Local references refer to entities created earlier in this batch. Locked elements cannot be modified. Does not export or publish.',
    inputSchema: applyStudioSchema,
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
        studio_apply_actions: projectToolDefinitions.studio_apply_actions,
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
  operationId: string,
  summary: string
): Promise<{
  value: unknown;
  proposalIds: string[];
  operationId?: string;
  revision?: number;
  conflicts?: StudioConflict[];
}> {
  const ctx: ZeroContext = { userID: actor, email: '' };
  if (resource.kind === 'studio') {
    const after = documentSchema.parse(value);
    const before = studioDocumentV3Schema.parse(resource.stored);
    const persisted = legacyDocumentToV3(after, before);
    const receipt = await applyStudioOperation(tx, actor, {
      projectId: resource.id,
      operationId: operationUUID(operationId),
      generation: resource.generation,
      expectedRevision: resource.contentRevision,
      changes: diffStudio(before, persisted),
    });
    if (receipt.status === 'conflict')
      return {
        value: v3DocumentToLegacy(receipt.document),
        proposalIds: [],
        operationId: receipt.operationId,
        revision: receipt.revision,
        conflicts: receipt.conflicts,
      };
    return {
      value: v3DocumentToLegacy(receipt.document),
      proposalIds: [],
      operationId: receipt.operationId,
      revision: receipt.revision,
    };
  }

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
  if (!Object.hasOwn(toolsForScope(!!conversation.studio_project_id), name))
    throw new ProjectToolError('tool_not_available');
  if (editorNames.has(name)) {
    const args =
        studioEditorCommandSchemas[name as keyof typeof studioEditorCommandSchemas].parse(input),
      requestId = `${runId}:${name}:${checksum(input)}`,
      sql = sqlTransaction(tx);
    const [old] = await rows<{ id: string; result: unknown }>(
      sql,
      'select id,result from studio_editor_action where request_id=$1',
      [requestId]
    );
    if (old)
      return {
        operationId: old.id,
        status: old.result ? 'completed' : 'queued',
        result: old.result,
      };
    const id = crypto.randomUUID();
    await sql.query(
      'insert into studio_editor_action(id,project_id,actor_id,request_id,name,input,created_at) values($1,$2,$3,$4,$5,$6::jsonb,$7)',
      [id, conversation.studio_project_id, actor, requestId, name, args, Date.now()]
    );
    return {
      operationId: id,
      status: 'queued',
      next: 'Poll studio_editor_status. Do not claim success until acknowledged.',
    };
  }
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
  if (name === 'studio_upload_media')
    return {
      status: 'needs_user_action',
      step: 'Open Insert > Upload and choose an image or video. Then use studio_media to read the uploaded asset ID.',
    };
  if (name === 'studio_import_chat_media') {
    const { path } = z.object({ path: z.string().min(1).max(1000) }).parse(input);
    return (await import('@/server/studio/chat-media')).importChatMedia(
      tx,
      actor,
      runId,
      conversation.studio_project_id ?? '',
      path,
      operationUUID(`${runId}:import-media:${path}`)
    );
  }
  if (name === 'studio_media')
    return rows(
      sqlTransaction(tx),
      'select id,name,mime_type from studio_asset where project_id=$1 and workspace_id is null and ready=true',
      [conversation.studio_project_id]
    );
  if (name === 'studio_format_text_range') name = 'studio_format_text';
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
  if (name === 'studio_cancel_export') {
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(input);
    const resource = await loadResource(tx, actor, conversationId, 'studio', hints);
    if (resource.mode !== 'edit') throw new ProjectToolError('permission_denied');
    const [job] = await rows<{ status: string }>(
      sqlTransaction(tx),
      'select status from studio_export where id=$1 and project_id=$2 for update',
      [jobId, resource.id]
    );
    if (!job) throw new ProjectToolError('not_found');
    if (!['queued', 'running'].includes(job.status)) return { jobId, status: job.status };
    await sqlTransaction(tx).query(
      "update studio_export set status='cancelled',updated_at=$3 where id=$1 and project_id=$2",
      [jobId, resource.id, Date.now()]
    );
    return { jobId, status: 'cancelled' };
  }

  if (name === 'studio_undo' || name === 'studio_redo') {
    const { changeSetId } = z.object({ changeSetId: z.string().uuid() }).parse(input);
    await undoProjectChange(tx, actor, changeSetId, name === 'studio_redo');
    return { status: name === 'studio_redo' ? 'applied' : 'undone', changeSetId };
  }
  if (name === 'studio_export') {
    const args = z
      .object({
        revision: z.number().int().nonnegative(),
        format: z.enum(['png', 'pdf', 'pptx', 'canva', 'mp4', 'xlsx', 'zip']),
        pageIds: z.array(z.string().uuid()).default([]),
      })
      .parse(input);
    return (await import('@/server/studio/export')).queueCommittedExport(
      actor,
      conversation.studio_project_id ?? '',
      args.format,
      args.pageIds,
      args.revision,
      operationUUID(`${runId}:export:${checksum(input)}`)
    );
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
  if (name === 'studio_insert_shape') {
    const { snapshotId, summary, pageId, ref, shape, ...properties } =
      shapeInsertSchema.parse(input);
    input = {
      snapshotId,
      summary,
      actions: [{ type: 'element.add', page: { id: pageId }, ref, elementType: shape, properties }],
    };
    name = 'studio_apply_actions';
  }
  const convenience = Object.hasOwn(studioCommandSchemas, name);
  if (namedActions.has(name)) {
    const option = namedActions.get(name);
    if (!option) throw new ProjectToolError('tool_not_available');
    const { snapshotId, summary, ...args } = (option as z.ZodObject<z.ZodRawShape>)
      .omit({ type: true })
      .extend(writeContext)
      .parse(input);
    input = { snapshotId, summary, actions: [{ ...args, type: option.shape.type.value }] };
    name = 'studio_apply_actions';
  }
  if (name === 'city_design_catalog') return cityCatalog();
  const kind: ResourceKind = name.startsWith('studio_')
    ? 'studio'
    : name.startsWith('amendment_')
      ? 'amendment_text'
      : 'city_design';
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
    kind === 'studio'
      ? convenience
        ? z.object(writeContext).passthrough().parse(input)
        : applyStudioSchema.parse(input)
      : kind === 'amendment_text'
        ? applyAmendmentSchema.parse(input)
        : applyCitySchema.parse(input);
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
    (kind !== 'studio' && resource.revision !== snapshot.revision)
  )
    throw new ProjectToolError(
      'revision_conflict',
      'The resource changed. Read it again.',
      'read_again'
    );
  const operationKey = `${runId}:${args.snapshotId}:${name}:${checksum(input)}`;
  let createdIndex = 0;
  const createId = () => operationUUID(`${operationKey}:${createdIndex++}`);
  let next: unknown,
    createdRefs: Record<string, string> = {},
    studioStoredOverride: unknown;
  if (kind === 'studio') {
    const actions = convenience ? [] : applyStudioSchema.parse(args).actions;
    const themes: Record<string, StudioThemeSnapshot> = {};
    const project = await tx.run(zql.studio_project.where('id', resource.id).one());
    const themedStored = studioDocumentV3Schema.parse(structuredClone(resource.stored));
    for (const action of actions) {
      if (action.type === 'theme.apply') {
        const theme = await resolveStudioTheme(
          actor,
          project?.group_id ?? null,
          action.themeId,
          action.mode
        );
        themes[`${action.themeId}:${action.mode}`] = theme;
        applyThemeSnapshot(themedStored, theme);
      }
    }
    studioStoredOverride = themedStored;
    const result = convenience
      ? {
          value: applyStudioCommand(
            documentSchema.parse(snapshot.value),
            name as StudioCommandName,
            input,
            createId
          ),
          createdRefs: {},
        }
      : applyStudioActions(documentSchema.parse(snapshot.value), actions, { themes, createId });
    next = result.value;
    createdRefs = result.createdRefs;
  } else if (kind === 'city_design') {
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
    if (kind === 'studio')
      return {
        status: 'already_applied',
        operationId: operationUUID(operationKey),
        createdRefs,
        revision: resource.revision,
      };
    throw new ProjectToolError('no_changes');
  }
  const saved = await saveResource(
    tx,
    actor,
    resource.kind === 'studio'
      ? {
          ...resource,
          value: documentSchema.parse(snapshot.value),
          stored: studioDocumentV3Schema.parse(studioStoredOverride ?? resource.stored),
        }
      : resource,
    next,
    operationKey,
    args.summary
  );
  if (saved.conflicts?.length)
    return {
      status: 'conflict',
      operationId: saved.operationId,
      revision: saved.revision,
      conflicts: saved.conflicts,
      next: 'Read again and ask which value to keep.',
    };
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
    operationId: saved.operationId,
    revision: saved.revision,
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
  const merged =
    resource.kind === 'studio'
      ? mergeStudio(
          resource.value,
          redo
            ? diffStudio(change.before_value, change.after_value)
            : inverseChanges(diffStudio(change.before_value, change.after_value))
        )
      : null;
  if (merged?.conflicts.length) throw new ProjectToolError('undo_conflict');
  const inverse =
    merged?.value ?? conditionalUndo(resource.value, change.before_value, change.after_value);
  await saveResource(
    tx,
    actor,
    resource,
    inverse,
    `${redo ? 'redo' : 'undo'}:${change.id}:${change.undone_at ?? 0}`,
    redo ? 'Redo AI change' : 'Undo AI change'
  );
  await sql.query('update ai_change_set set status=$3,undone_at=$2 where id=$1', [
    change.id,
    Date.now(),
    redo ? 'applied' : 'undone',
  ]);
}
