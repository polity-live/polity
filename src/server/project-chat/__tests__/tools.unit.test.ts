import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { createStudioTemplateDocumentV5 } from '@/features/communication-studio/logic/templates-v5';
import { defaultBrand } from '@/features/communication-studio/logic/document';
import { textReferences } from '@/features/project-chat/logic/text-actions';
import { applyCityActions } from '@/features/project-chat/logic/city-actions';
import { cityActionSchema } from '@/features/project-chat/logic/contracts';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  require: vi.fn(),
  read: vi.fn(),
  load: vi.fn(),
  source: vi.fn(),
  direct: vi.fn(),
  suggest: vi.fn(),
  document: vi.fn(),
  amendment: vi.fn(),
  city: vi.fn(),
  textProposal: vi.fn(),
  cityProposals: vi.fn(),
  hashtags: vi.fn(),
}));
vi.mock('../context', () => ({
  requireProjectConversation: io.require,
  readContext: io.read,
  loadResource: io.load,
}));
vi.mock('@/server/studio/source', () => ({ resolveStudioSource: io.source }));
vi.mock('@/zero/common/server-hashtags', () => ({ syncEntityHashtagsForUpdate: io.hashtags }));
vi.mock('@/zero/amendments/server-mutators', () => ({
  amendmentServerMutators: {
    update: { fn: io.amendment },
    updateCityDesign: { fn: io.city },
    createDocumentChangeRequest: { fn: io.textProposal },
    createCityDesignChangeRequests: { fn: io.cityProposals },
  },
  amendmentServerMutatorInternals: {
    assertCityDesignDirectEditMode: io.direct,
    assertCanCreateChangeRequest: io.suggest,
  },
}));
vi.mock('@/zero/documents/server-mutators', () => ({
  documentServerMutators: { updateContent: { fn: io.document } },
}));
import {
  executeProjectTool,
  studioToolGroup,
  studioToolNamesForGroups,
  toolsForScope,
  undoProjectChange,
} from '../tools';

const actor = crypto.randomUUID(),
  projectId = crypto.randomUUID(),
  amendmentId = crypto.randomUUID(),
  documentId = crypto.randomUUID(),
  chatId = crypto.randomUUID(),
  runId = crypto.randomUUID(),
  snapshotId = crypto.randomUUID();
const tx = { location: 'server', dbTransaction: { query: io.query } } as unknown as ZeroTransaction;
let resource: Record<string, any>,
  snapshot: Record<string, any> | null,
  change: Record<string, any> | null;
let editorRows: unknown[], exportRows: unknown[], assets: unknown[];
const paragraphs = [{ type: 'p', children: [{ text: 'Original' }] }];
const textState = (content = paragraphs, metadata = { title: 'Original' }) => ({
  content: structuredClone(content),
  metadata,
  discussions: [],
});
function captureSnapshot() {
  snapshot = {
    id: snapshotId,
    resource_kind: resource.kind,
    resource_id: resource.id,
    branch_id: resource.branchId,
    revision: resource.revision,
    value: structuredClone(resource.value),
    references_json: textReferences(paragraphs).references,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(200_000);
  resource = {
    kind: 'amendment_text',
    id: documentId,
    branchId: null,
    contentRevision: 4,
    mode: 'edit',
    value: textState(),
    revision: 'current',
    amendment: { id: amendmentId, title: 'Original' },
    stored: null,
  };
  captureSnapshot();
  change = null;
  editorRows = [];
  exportRows = [];
  assets = [];
  io.require.mockResolvedValue({ id: chatId, studio_project_id: null });
  io.read.mockResolvedValue({ snapshotId, data: 'Authoritative content' });
  io.load.mockImplementation(async () => structuredClone(resource));
  io.source.mockResolvedValue({
    projectId,
    workspaceId: null,
    document: createStudioTemplateDocumentV5('single', 'Title', defaultBrand),
  });
  io.query.mockImplementation(async (sql: string, args: unknown[]) => {
    if (sql.startsWith('select * from ai_context_snapshot'))
      return snapshot ? [structuredClone(snapshot)] : [];
    if (sql.startsWith('select * from ai_change_set'))
      return change ? [structuredClone(change)] : [];
    if (sql.startsWith('select result,created_at')) return editorRows;
    if (sql.startsWith('select status,progress,error')) return exportRows;
    if (sql.startsWith('select id,name,mime_type')) return assets;
    if (sql.startsWith('update ai_change_set') && change) change.status = args[2];
    return [];
  });
  io.direct.mockResolvedValue(undefined);
  io.suggest.mockResolvedValue(undefined);
  io.document.mockImplementation(async ({ args }) => {
    resource.value.content = structuredClone(args.content);
  });
  io.amendment.mockImplementation(async ({ args }) => {
    const { id: _id, ...metadata } = args;
    resource.value.metadata = { ...resource.value.metadata, ...metadata };
  });
  io.city.mockImplementation(async ({ args }) => {
    resource.value = structuredClone(args.design_state);
  });
  io.textProposal.mockResolvedValue(undefined);
  io.cityProposals.mockResolvedValue(undefined);
  io.hashtags.mockImplementation(async (_tx, _ctx, _kind, _id, tags) => {
    resource.value.metadata.hashtags = tags;
  });
});
afterEach(() => vi.restoreAllMocks());
const call = (
  name: string,
  input: unknown = {},
  hints?: Parameters<typeof executeProjectTool>[7],
  max = 100_000
) => executeProjectTool(tx, actor, runId, chatId, 'call', name, input, hints, max);
const textArgs = (
  actions: unknown[] = [{ type: 'text.replace', anchorRef: 'text_0_0', text: 'Changed' }]
) => ({ snapshotId, summary: 'Requested change', actions });
const studio = () => io.require.mockResolvedValue({ id: chatId, studio_project_id: projectId });
const city = (mode = 'edit') => {
  resource = {
    ...resource,
    kind: 'city_design',
    id: crypto.randomUUID(),
    mode,
    value: createEmptyCityDesignState(),
  };
  captureSnapshot();
};
const addTree = {
  type: 'object.add',
  ref: 'tree',
  objectType: 'tree',
  geometry: { kind: 'point', point: { x: 2, z: 3 }, rotationDeg: 0 },
};
const beforeAfterChange = (overrides: Record<string, unknown> = {}) => {
  change = {
    id: crypto.randomUUID(),
    conversation_id: chatId,
    actor_id: actor,
    resource_kind: 'amendment_text',
    resource_id: documentId,
    branch_id: null,
    status: 'applied',
    undone_at: null,
    before_value: textState(),
    after_value: textState([{ type: 'p', children: [{ text: 'Changed' }] }]),
    ...overrides,
  };
  resource.value = structuredClone(change.after_value);
};
describe('Project tool scope and authoritative reads', () => {
  it('advertises only the eight available Studio tools and the six amendment tools', () => {
    expect(Object.keys(toolsForScope(true)).sort()).toEqual(
      [
        'studio_catalog',
        'studio_read',
        'studio_media',
        'studio_editor_status',
        'studio_export_status',
        'studio_generate_suggestion',
        'studio_edit_suggestion',
        'studio_resolve_target',
      ].sort()
    );
    expect(studioToolNamesForGroups(['all'])).toEqual(Object.keys(toolsForScope(true)));
    expect(Object.keys(toolsForScope(false)).sort()).toEqual(
      [
        'amendment_read',
        'amendment_apply_actions',
        'city_design_read',
        'city_design_read_features',
        'city_design_catalog',
        'city_design_apply_actions',
      ].sort()
    );
  });
  it.each([
    ['studio_export_status', 'export'],
    ['studio_format_text_range', 'text'],
    ['studio_table_add', 'data'],
    ['studio_page_add', 'pages'],
    ['studio_post_add', 'campaign'],
    ['studio_media', 'media'],
    ['studio_element_add', 'objects'],
    ['studio_editor_status', 'view'],
    ['studio_read', 'project'],
  ])('classifies %s as %s in the tool catalog', (name, group) =>
    expect(studioToolGroup(name)).toBe(group)
  );
  it.each([
    'studio_apply_actions',
    'studio_format_text',
    'studio_upload_media',
    'studio_import_chat_media',
    'studio_export',
    'studio_cancel_export',
    'studio_undo',
    'studio_redo',
    'studio_insert_shape',
    'studio_page_add',
    'unknown',
  ])('blocks unavailable direct Studio tool %s before any writes', async name => {
    studio();
    await expect(call(name)).rejects.toThrow('Studio AI edits must create a reviewable suggestion');
    expect(
      io.query.mock.calls.every(([sql]) => sql.startsWith('select pg_advisory_xact_lock'))
    ).toBe(true);
  });
  it('rejects oversized actions, cross-scope tools and revoked conversation rights', async () => {
    await expect(call('amendment_read', { data: 'X'.repeat(300_001) })).rejects.toMatchObject({
      code: 'actions_too_large',
    });
    expect(io.require).not.toHaveBeenCalled();
    await expect(call('studio_read')).rejects.toMatchObject({ code: 'tool_not_available' });
    io.require.mockRejectedValueOnce(new Error('permission denied'));
    await expect(call('amendment_read')).rejects.toThrow('permission denied');
    expect(io.read).not.toHaveBeenCalled();
  });
  it.each(['studio_generate_suggestion', 'studio_edit_suggestion'])(
    'routes %s exclusively to the reviewable suggestion runner',
    async name => {
      studio();
      await expect(call(name)).rejects.toThrow('suggestion runner');
    }
  );
  it.each([
    ['amendment_read', 'amendment_text', false],
    ['city_design_read', 'city_design', false],
    ['city_design_read_features', 'city_design', true],
  ])(
    'reads %s with paging, editor context and a bounded context budget',
    async (name, kind, features) => {
      const hints = { surface: 'city_design' as const, branchId: crypto.randomUUID() };
      expect(await call(name, { offset: 2, limit: 3 }, hints, 500)).toEqual({
        snapshotId,
        data: 'Authoritative content',
      });
      expect(io.read).toHaveBeenCalledWith(
        tx,
        actor,
        runId,
        chatId,
        kind,
        hints,
        2,
        3,
        features,
        500
      );
    }
  );
  it('reads Studio with default pagination and obtains the real City Design catalog', async () => {
    studio();
    await call('studio_read');
    expect(io.read).toHaveBeenCalledWith(
      tx,
      actor,
      runId,
      chatId,
      'studio',
      undefined,
      0,
      20,
      false,
      100_000
    );
    io.require.mockResolvedValue({ id: chatId, studio_project_id: null });
    const catalog = (await call('city_design_catalog')) as { type: string }[];
    expect(catalog).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'tree' })]));
  });
  it.each([{}, { group: 'text' }])(
    'returns the available tool catalog for request %j',
    async input => {
      studio();
      const result = (await call('studio_catalog', input)) as {
        tools: { name: string; description: string }[];
        activatedGroup: unknown;
      };
      expect(result.tools.map(tool => tool.name)).toEqual(Object.keys(toolsForScope(true)));
      expect(result.tools.every(tool => tool.description.length > 0)).toBe(true);
      expect(result.activatedGroup).toBe('group' in input ? input.group : null);
    }
  );
  it.each(['queued', 'acknowledged', 'editor_unavailable', 'missing'])(
    'reports the actual %s editor action state',
    async state => {
      studio();
      const operationId = crypto.randomUUID();
      editorRows =
        state === 'missing'
          ? []
          : [
              {
                result: state === 'acknowledged' ? { status: 'completed' } : null,
                created_at: state === 'editor_unavailable' ? 0 : 199_999,
              },
            ];
      if (state === 'missing')
        await expect(call('studio_editor_status', { operationId })).rejects.toMatchObject({
          code: 'not_found',
        });
      else
        expect(await call('studio_editor_status', { operationId })).toMatchObject({
          operationId,
          status: state,
        });
      expect(io.query).toHaveBeenCalledWith(
        expect.stringContaining('actor_id=$2 and project_id=$3'),
        [operationId, actor, projectId]
      );
    }
  );
  it.each(['completed', 'running', 'missing'])(
    'reports the actual %s export job state within the project',
    async state => {
      studio();
      const jobId = crypto.randomUUID();
      exportRows = state === 'missing' ? [] : [{ status: state, progress: 60, error: null }];
      if (state === 'missing')
        await expect(call('studio_export_status', { jobId })).rejects.toMatchObject({
          code: 'not_found',
        });
      else
        expect(await call('studio_export_status', { jobId })).toMatchObject({
          jobId,
          status: state,
          next:
            state === 'completed'
              ? 'Use the export download control in Studio.'
              : 'Poll this job again.',
        });
    }
  );
  it('reads workspace-scoped media and resolves named targets in the real native Studio document', async () => {
    studio();
    const proposalId = crypto.randomUUID();
    assets = [{ id: crypto.randomUUID(), name: 'Photo', mime_type: 'image/png' }];
    expect(await call('studio_media', {}, { surface: 'studio', proposalId })).toEqual(assets);
    expect(io.source).toHaveBeenCalledWith(actor, projectId, proposalId, tx.dbTransaction);
    expect(io.query).toHaveBeenCalledWith(expect.stringContaining('workspace_id=$2'), [
      projectId,
      null,
    ]);
    const result = (await call('studio_resolve_target', { role: 'title' })) as {
      targets: { nodeIds: string[] };
    };
    const source = await io.source();
    expect(result.targets.nodeIds).toEqual([
      source.document.nodes.find((node: { textRole?: string }) => node.textRole === 'title').id,
    ]);
    await call('studio_media');
    expect(io.source).toHaveBeenLastCalledWith(actor, projectId, null, tx.dbTransaction);
    await call('studio_resolve_target', { role: 'title' }, { surface: 'studio', proposalId });
    expect(io.source).toHaveBeenLastCalledWith(actor, projectId, proposalId, tx.dbTransaction);
  });
});
describe('Snapshot-checked amendment and City Design writes', () => {
  it('rejects a duplicate-ID scene edit when it cannot produce a meaningful per-object proposal', async () => {
    city('suggest');
    const tree = applyCityActions(resource.value, [cityActionSchema.parse(addTree)]).value
      .objects[0];
    resource.value.objects = [tree, structuredClone(tree)];
    captureSnapshot();
    await expect(
      call(
        'city_design_apply_actions',
        textArgs([{ type: 'object.remove', object: { id: tree.id } }])
      )
    ).rejects.toMatchObject({ code: 'no_changes' });
    expect(io.cityProposals).not.toHaveBeenCalled();
    expect(resource.value.objects).toHaveLength(2);
  });
  it.each(['missing', 'wrong-kind', 'wrong-resource', 'wrong-branch', 'stale'] as const)(
    'rejects a %s snapshot without writing',
    async state => {
      if (state === 'missing') snapshot = null;
      if (state === 'wrong-kind') snapshot!.resource_kind = 'city_design';
      if (state === 'wrong-resource') snapshot!.resource_id = crypto.randomUUID();
      if (state === 'wrong-branch') snapshot!.branch_id = crypto.randomUUID();
      if (state === 'stale') snapshot!.revision = 'old';
      await expect(call('amendment_apply_actions', textArgs())).rejects.toMatchObject({
        code: ['missing', 'wrong-kind'].includes(state) ? 'invalid_snapshot' : 'revision_conflict',
        recovery: 'read_again',
      });
      expect(io.document).not.toHaveBeenCalled();
      expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
    }
  );
  it('saves text against its content revision and records the reloaded value and original before-value', async () => {
    const before = structuredClone(resource.value);
    const result = (await call('amendment_apply_actions', textArgs())) as {
      changeSetId: string;
      status: string;
    };
    expect(result.status).toBe('applied');
    expect(io.document).toHaveBeenCalledWith({
      tx,
      ctx: { userID: actor, email: '' },
      args: expect.objectContaining({
        id: documentId,
        expected_content_revision: 4,
        content: [{ type: 'p', children: [{ text: 'Changed' }] }],
        reconcile_orphaned_change_requests: true,
      }),
    });
    const record = io.query.mock.calls.find(([sql]) =>
      sql.startsWith('insert into ai_change_set')
    )![1];
    expect(record.slice(0, 10)).toEqual([
      result.changeSetId,
      chatId,
      runId,
      'call',
      actor,
      'amendment_text',
      documentId,
      null,
      'Requested change',
      'applied',
    ]);
    expect(record[10]).toEqual(before);
    expect(record[11]).toEqual(resource.value);
    expect(io.direct).toHaveBeenCalledWith(tx, amendmentId, null);
  });
  it.each([false, true])(
    'updates amendment metadata and optional hashtags %s without rewriting unchanged text',
    async tags => {
      const patch = { title: 'Updated', ...(tags ? { hashtags: ['topic'] } : {}) };
      await call('amendment_apply_actions', textArgs([{ type: 'metadata.patch', patch }]));
      expect(io.amendment).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ id: amendmentId, title: 'Updated' }),
        })
      );
      expect(io.document).not.toHaveBeenCalled();
      if (tags)
        expect(io.hashtags).toHaveBeenCalledWith(
          tx,
          { userID: actor, email: '' },
          'amendment',
          amendmentId,
          ['topic']
        );
      else expect(io.hashtags).not.toHaveBeenCalled();
    }
  );
  it.each(['suggest', 'suggest_internal', 'suggest_event'])(
    'creates real annotated text change requests in %s mode without changing canonical text',
    async mode => {
      resource.mode = mode;
      const before = structuredClone(resource.value);
      const result = (await call('amendment_apply_actions', textArgs())) as {
        status: string;
        proposalIds: string[];
      };
      expect(result.status).toBe('proposed');
      expect(result.proposalIds).toHaveLength(1);
      expect(io.document).not.toHaveBeenCalled();
      expect(resource.value).toEqual(before);
      const args = io.textProposal.mock.lastCall![0].args;
      expect(args).toMatchObject({
        id: result.proposalIds[0],
        amendment_id: amendmentId,
        source_type: 'document',
        source_id: documentId,
        status: 'pending',
        title: 'Requested change',
      });
      expect(args.discussions[0].comments[0]).toMatchObject({
        userId: actor,
        contentRich: [{ type: 'p', children: [{ text: 'Requested change' }] }],
      });
      expect(io.suggest).toHaveBeenCalledWith(tx, { userID: actor, email: '' }, amendmentId, null);
    }
  );
  it('rejects voting-phase writes, suggestion metadata edits, no-op edits and a lost amendment scope', async () => {
    resource.mode = 'vote_internal';
    await expect(call('amendment_apply_actions', textArgs())).rejects.toMatchObject({
      code: 'editing_mode_readonly',
    });
    resource.mode = 'suggest';
    await expect(
      call(
        'amendment_apply_actions',
        textArgs([{ type: 'metadata.patch', patch: { title: 'New' } }])
      )
    ).rejects.toMatchObject({ code: 'metadata_requires_edit_mode' });
    resource.mode = 'edit';
    await expect(
      call(
        'amendment_apply_actions',
        textArgs([{ type: 'text.replace', anchorRef: 'text_0_0', text: 'Original' }])
      )
    ).rejects.toMatchObject({ code: 'no_changes' });
    resource.amendment = null;
    await expect(call('amendment_apply_actions', textArgs())).rejects.toMatchObject({
      code: 'scope_mismatch',
    });
  });
  it('saves City Design changes through the native persistence snapshot and returns local created references', async () => {
    city();
    const result = (await call('city_design_apply_actions', textArgs([addTree]))) as {
      status: string;
      createdRefs: Record<string, string>;
    };
    expect(result.status).toBe('applied');
    expect(result.createdRefs.tree).toMatch(/^[0-9a-f-]{36}$/);
    expect(io.city.mock.lastCall![0].args).toMatchObject({
      id: resource.id,
      expected_content_revision: 4,
      process_branch_id: null,
      design_state: {
        objects: [expect.objectContaining({ id: result.createdRefs.tree, type: 'tree' })],
      },
    });
    expect(io.direct).toHaveBeenCalledWith(tx, amendmentId, null);
  });
  it('creates per-object City Design proposals in suggestion mode and keeps the canonical scene unchanged', async () => {
    city('suggest');
    const before = structuredClone(resource.value);
    const result = (await call('city_design_apply_actions', textArgs([addTree]))) as {
      status: string;
      proposalIds: string[];
    };
    expect(result).toMatchObject({ status: 'proposed' });
    expect(result.proposalIds).toHaveLength(1);
    expect(resource.value).toEqual(before);
    expect(io.city).not.toHaveBeenCalled();
    expect(io.cityProposals.mock.lastCall![0].args.requests[0]).toMatchObject({
      id: result.proposalIds[0],
      amendment_id: amendmentId,
      source_type: 'city_design_object',
      change_type: 'insert',
    });
  });
});
describe('Conditional project Undo and Redo', () => {
  it('undoes and redoes text changes only while their saved after and before states match respectively', async () => {
    beforeAfterChange();
    const id = change!.id;
    await undoProjectChange(tx, actor, id);
    expect(resource.value.content).toEqual(paragraphs);
    expect(change!.status).toBe('undone');
    await undoProjectChange(tx, actor, id, true);
    expect(resource.value.content).toEqual([{ type: 'p', children: [{ text: 'Changed' }] }]);
    expect(change!.status).toBe('applied');
    expect(io.query).toHaveBeenLastCalledWith(
      'update ai_change_set set status=$3,undone_at=$2 where id=$1',
      [id, 200_000, 'applied']
    );
  });
  it.each([false, true])('reuses completed undo or redo %s without another write', async redo => {
    beforeAfterChange({ status: redo ? 'applied' : 'undone' });
    await undoProjectChange(tx, actor, change!.id, redo);
    expect(io.load).not.toHaveBeenCalled();
    expect(io.document).not.toHaveBeenCalled();
  });
  it('rejects missing, foreign, Studio and proposed changes through their required authority workflows', async () => {
    await expect(undoProjectChange(tx, actor, crypto.randomUUID())).rejects.toMatchObject({
      code: 'permission_denied',
    });
    beforeAfterChange({ actor_id: 'other' });
    await expect(undoProjectChange(tx, actor, change!.id)).rejects.toMatchObject({
      code: 'permission_denied',
    });
    beforeAfterChange({ resource_kind: 'studio' });
    await expect(undoProjectChange(tx, actor, change!.id)).rejects.toMatchObject({
      code: 'proposal_requires_governance',
    });
    beforeAfterChange({ status: 'proposed' });
    await expect(undoProjectChange(tx, actor, change!.id)).rejects.toMatchObject({
      code: 'proposal_requires_governance',
    });
    await expect(undoProjectChange(tx, actor, change!.id, true)).rejects.toMatchObject({
      code: 'proposal_requires_governance',
    });
  });
  it('rejects changed resources, phases and later manual edits without updating the change status', async () => {
    beforeAfterChange();
    resource.id = crypto.randomUUID();
    await expect(undoProjectChange(tx, actor, change!.id)).rejects.toMatchObject({
      code: 'undo_conflict',
    });
    resource.id = documentId;
    resource.mode = 'suggest';
    await expect(undoProjectChange(tx, actor, change!.id)).rejects.toMatchObject({
      code: 'undo_conflict',
    });
    resource.mode = 'edit';
    resource.value.content[0].children[0].text = 'Manual';
    await expect(undoProjectChange(tx, actor, change!.id)).rejects.toMatchObject({
      code: 'undo_conflict',
      recovery: 'read_again',
    });
    expect(change!.status).toBe('applied');
    expect(io.document).not.toHaveBeenCalled();
  });
  it('rejects a redo after later edits and preserves the undone status', async () => {
    beforeAfterChange({ status: 'undone' });
    resource.value = textState([{ type: 'p', children: [{ text: 'Later manual edit' }] }]);
    await expect(undoProjectChange(tx, actor, change!.id, true)).rejects.toMatchObject({
      code: 'undo_conflict',
    });
    expect(change!.status).toBe('undone');
  });
});
