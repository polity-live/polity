import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
import { shapeNodeSchema } from '@/features/communication-studio/logic/document-v3';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import type { ZeroTransaction } from '@/server/zero-mutate';
import type { EditorContext } from '@/features/project-chat/logic/contracts';

const boundary = vi.hoisted(() => ({
  run: vi.fn(),
  rows: vi.fn(),
  query: vi.fn(),
  source: vi.fn(),
  mode: vi.fn(),
  branchRun: vi.fn(),
}));
vi.mock('@/server/studio/source', () => ({ resolveStudioSource: boundary.source }));
vi.mock('@/server/transaction', () => ({
  rows: boundary.rows,
  sqlTransaction: () => ({ query: boundary.query }),
}));
vi.mock('@/zero/amendments/server-mutators', () => ({
  amendmentServerMutatorInternals: {
    resolveChangeRequestMutationEditingMode: boundary.mode,
    loadProcessRunForBranch: boundary.branchRun,
  },
}));
import { loadResource, readContext, requireProjectConversation } from '../context';

const actor = crypto.randomUUID();
const project = crypto.randomUUID();
const amendmentId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const branchId = crypto.randomUUID();
const cityId = crypto.randomUUID();
const transaction = { run: boundary.run } as unknown as ZeroTransaction;
const paragraphs = ['Alpha', 'Beta', 'Gamma'].map(text => ({ type: 'p', children: [{ text }] }));
const selection = { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 3 } };
function authorize(conversation: Record<string, unknown>) {
  boundary.run
    .mockReset()
    .mockResolvedValueOnce({ id: 'allowed' })
    .mockResolvedValueOnce(conversation);
}
function amendment(overrides: Record<string, unknown> = {}, processRun?: Record<string, unknown>) {
  const value = {
    id: amendmentId,
    document_id: documentId,
    current_process_run_id: null,
    title: 'Trusted title',
    code: 'A1',
    reason: 'Reason',
    preamble: 'Preamble',
    discussions: ['canonical'],
    ...overrides,
  };
  authorize({ amendment_id: amendmentId, studio_project_id: null });
  boundary.run.mockResolvedValueOnce(value);
  if (value.current_process_run_id) boundary.run.mockResolvedValueOnce(processRun);
  boundary.run.mockResolvedValue([
    { hashtag: { tag: 'zeta' } },
    { hashtag: null },
    { hashtag: { tag: 'alpha' } },
  ]);
  return value;
}
function studio(canSuggest = true) {
  authorize({ studio_project_id: project, amendment_id: null });
  const document = legacyDocumentToV3(createDocument('carousel', 'Trusted project'));
  const source = {
    document,
    contentRevision: 12,
    generation: 'generation',
    revision: 'generation:12:canonical:0',
    canSuggest,
    workspaceId: null,
  };
  boundary.source.mockResolvedValue(source);
  return source;
}
beforeEach(() => {
  vi.clearAllMocks();
  boundary.run.mockReset();
  boundary.query.mockResolvedValue([]);
  boundary.rows.mockResolvedValue([{ content: paragraphs, content_revision: '7' }]);
  boundary.mode.mockResolvedValue({ branch: null, mode: 'edit' });
  boundary.branchRun.mockResolvedValue({ amendment_id: amendmentId });
});

describe('authorized project resource loading and bounded context snapshots', () => {
  it('rejects a denied project conversation and a disappeared allowed conversation', async () => {
    boundary.run.mockResolvedValueOnce(undefined);
    await expect(requireProjectConversation(transaction, actor, 'conversation')).rejects.toThrow(
      'permission_denied'
    );
    boundary.run.mockResolvedValueOnce({ id: 'allowed' }).mockResolvedValueOnce(undefined);
    await expect(requireProjectConversation(transaction, actor, 'conversation')).rejects.toThrow(
      'not_found'
    );
  });

  it.each([false, true])(
    'loads canonical Studio resources with canSuggest=%s and server revision metadata',
    async canSuggest => {
      const source = studio(canSuggest);
      const result = await loadResource(transaction, actor, 'conversation', 'studio', undefined);
      expect(result).toMatchObject({
        id: project,
        kind: 'studio',
        branchId: null,
        contentRevision: 12,
        generation: 'generation',
        mode: canSuggest ? 'suggest' : 'view',
        revision: source.revision,
        stored: source.document,
        amendment: null,
        references: { _studioSource: { workspaceId: null, revision: source.revision } },
      });
      expect(boundary.source).toHaveBeenCalledWith(
        actor,
        project,
        null,
        expect.objectContaining({ query: boundary.query })
      );
      expect(result.value).toMatchObject({ title: 'Trusted project', pages: expect.any(Array) });
    }
  );

  it('passes only the selected workspace ID to the authorized Studio source resolver', async () => {
    studio();
    await loadResource(transaction, actor, 'conversation', 'studio', {
      surface: 'studio',
      proposalId: branchId,
    });
    expect(boundary.source).toHaveBeenCalledWith(actor, project, branchId, expect.any(Object));
  });

  it.each(['studio', 'amendment_text', 'city_design'] as const)(
    'rejects a conversation without the project needed for %s',
    async kind => {
      authorize({ studio_project_id: null, amendment_id: null });
      await expect(
        loadResource(transaction, actor, 'conversation', kind, undefined)
      ).rejects.toThrow('scope_mismatch');
    }
  );

  it('rejects missing amendments and process runs that require a branch choice', async () => {
    authorize({ amendment_id: amendmentId });
    boundary.run.mockResolvedValueOnce(undefined);
    await expect(
      loadResource(transaction, actor, 'conversation', 'amendment_text', undefined)
    ).rejects.toThrow('not_found');
    amendment({ current_process_run_id: 'run' }, { active_branch_id: null });
    await expect(
      loadResource(transaction, actor, 'conversation', 'amendment_text', undefined)
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'branch_required', recovery: 'ask_user' })
    );
    expect(boundary.mode).not.toHaveBeenCalled();
  });

  it.each(['active branch', 'explicit branch'] as const)(
    'loads text using the %s and verifies its amendment lineage',
    async scenario => {
      const selected = scenario === 'explicit branch' ? branchId : documentId;
      amendment({ current_process_run_id: 'run' }, { active_branch_id: documentId });
      const branch = { id: selected, document_id: project, discussions: ['branch discussion'] };
      boundary.mode.mockResolvedValue({ branch, mode: 'suggest' });
      const hints: EditorContext = {
        surface: 'amendment_text',
        ...(scenario === 'explicit branch' ? { branchId } : {}),
      };
      const result = await loadResource(
        transaction,
        actor,
        'conversation',
        'amendment_text',
        hints
      );
      expect(boundary.mode).toHaveBeenCalledWith({
        tx: transaction,
        amendmentId,
        processBranchId: selected,
      });
      expect(boundary.branchRun).toHaveBeenCalledWith(transaction, branch);
      expect(result).toMatchObject({
        id: project,
        branchId: selected,
        mode: 'suggest',
        value: { discussions: ['branch discussion'], metadata: { hashtags: ['alpha', 'zeta'] } },
      });
      expect(boundary.rows).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('for update'),
        [project]
      );
    }
  );

  it.each(['origin', 'clone', 'self'] as const)(
    'accepts a branch belonging to the %s amendment lineage',
    async lineage => {
      const upstream = lineage === 'self' ? amendmentId : project;
      amendment(
        lineage === 'origin'
          ? { origin_amendment_id: upstream, clone_source_id: documentId }
          : lineage === 'clone'
            ? { clone_source_id: upstream }
            : {}
      );
      boundary.mode.mockResolvedValue({
        branch: { id: branchId, document_id: documentId },
        mode: 'edit',
      });
      boundary.branchRun.mockResolvedValue({ amendment_id: upstream });
      await expect(
        loadResource(transaction, actor, 'conversation', 'amendment_text', undefined)
      ).resolves.toMatchObject({ id: documentId });
    }
  );

  it('rejects a branch belonging to another amendment and propagates editing-mode denial', async () => {
    amendment();
    boundary.mode.mockResolvedValue({
      branch: { id: branchId, document_id: documentId },
      mode: 'edit',
    });
    boundary.branchRun.mockResolvedValue({ amendment_id: project });
    await expect(
      loadResource(transaction, actor, 'conversation', 'amendment_text', undefined)
    ).rejects.toThrow('scope_mismatch');
    amendment();
    boundary.mode.mockRejectedValueOnce(new Error('Editing denied'));
    await expect(
      loadResource(transaction, actor, 'conversation', 'amendment_text', undefined)
    ).rejects.toThrow('Editing denied');
  });

  it.each(['missing ID', 'different ID', 'missing record'] as const)(
    'rejects a document target with %s',
    async scenario => {
      amendment(scenario === 'missing ID' ? { document_id: null } : {});
      if (scenario === 'missing record') boundary.rows.mockResolvedValue([]);
      const hints =
        scenario === 'different ID'
          ? { surface: 'amendment_text' as const, documentId: project }
          : undefined;
      await expect(
        loadResource(transaction, actor, 'conversation', 'amendment_text', hints)
      ).rejects.toThrow(scenario === 'missing record' ? 'not_found' : 'scope_mismatch');
    }
  );

  it('fills absent amendment metadata and discussion fields while keeping sorted authorized hashtags', async () => {
    amendment({ title: null, code: null, reason: null, preamble: null, discussions: null });
    const result = await loadResource(transaction, actor, 'conversation', 'amendment_text', {
      surface: 'amendment_text',
      documentId,
    });
    expect(result.value).toEqual({
      content: paragraphs,
      discussions: [],
      metadata: {
        title: '',
        code: null,
        reason: null,
        preamble: null,
        hashtags: ['alpha', 'zeta'],
      },
    });
    expect(result.contentRevision).toBe(7);
    expect(result.references).toHaveProperty('blocks.block_0', 0);
  });

  it.each([7, 6])('retains text selection anchors only for current revision %i', async revision => {
    amendment();
    const result = await loadResource(transaction, actor, 'conversation', 'amendment_text', {
      surface: 'amendment_text',
      selection,
      contentRevision: revision,
    });
    expect(result.references).toHaveProperty('anchors.text_0_0');
    if (revision === 7)
      expect(result.references).toHaveProperty('anchors.selection_0', {
        path: [0, 0],
        start: 1,
        end: 3,
      });
    else expect(result.references).not.toHaveProperty('anchors.selection_0');
  });

  it('requires a saved City Design, rejects another target, and parses a current design', async () => {
    amendment();
    boundary.rows.mockResolvedValue([]);
    await expect(
      loadResource(transaction, actor, 'conversation', 'city_design', undefined)
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'resource_not_ready', recovery: 'ask_user' })
    );
    amendment();
    const design = createEmptyCityDesignState();
    boundary.rows.mockResolvedValue([{ id: cityId, design_state: design, content_revision: '3' }]);
    await expect(
      loadResource(transaction, actor, 'conversation', 'city_design', {
        surface: 'city_design',
        cityDesignId: project,
      })
    ).rejects.toThrow('scope_mismatch');
    amendment();
    await expect(
      loadResource(transaction, actor, 'conversation', 'city_design', {
        surface: 'city_design',
        cityDesignId: cityId,
      })
    ).resolves.toMatchObject({
      id: cityId,
      contentRevision: 3,
      value: design,
      references: {},
      stored: null,
    });
  });

  it('rejects corrupt persisted City Design data', async () => {
    amendment();
    boundary.rows.mockResolvedValue([
      { id: cityId, design_state: { schemaVersion: 999 }, content_revision: 3 },
    ]);
    await expect(
      loadResource(transaction, actor, 'conversation', 'city_design', undefined)
    ).rejects.toThrow();
  });

  it('reads a paginated Studio snapshot and includes explicit frames and root selections without exposing brand source data', async () => {
    const source = studio();
    const frames = source.document.nodes.filter(node => node.type === 'frame');
    const root = shapeNodeSchema.parse({
      id: crypto.randomUUID(),
      name: 'Root',
      type: 'shape',
      shape: 'rectangle',
      parentFrameId: null,
      zIndex: 0,
      transform: { x: 0, y: 0, width: 20, height: 20 },
      style: {},
    });
    source.document.nodes.push(root);
    const text = source.document.nodes.find(node => node.type === 'richText')!;
    if (text.type === 'richText')
      text.content[0].children.push({
        id: crypto.randomUUID(),
        type: 'a',
        url: 'https://example.com/reference',
        children: [{ id: crypto.randomUUID(), text: 'Linked' }],
      });
    const result = await readContext(
      transaction,
      actor,
      'run',
      'conversation',
      'studio',
      {
        surface: 'studio',
        proposalId: branchId,
        elementIds: [root.id],
        pageId: frames[2].id,
        references: [
          { kind: 'frame', id: frames[3].id, label: 'Manual', origin: 'manual' },
          { kind: 'element', id: root.id, label: 'Root', origin: 'manual' },
        ],
      },
      0,
      1
    );
    const data = result.data as {
      nodes: { id: string; text?: string }[];
      pages: unknown[];
      totalPages: number;
    };
    expect(data.pages).toHaveLength(1);
    expect(data.totalPages).toBe(5);
    expect(data.nodes.some(node => node.id === root.id)).toBe(true);
    expect(data.nodes.some(node => node.id === frames[2].id)).toBe(true);
    expect(data.nodes.some(node => node.id === frames[3].id)).toBe(true);
    expect(data.nodes.some(node => node.id === frames[1].id)).toBe(false);
    expect(data).not.toHaveProperty('brand');
    expect(data).not.toHaveProperty('source');
    expect(result).toMatchObject({ resourceId: project, offset: 0, limit: 1, mode: 'suggest' });
    expect(boundary.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into ai_context_snapshot'),
      expect.arrayContaining([result.snapshotId, 'run', 'studio', project])
    );
  });

  it('reads default Studio pagination without context hints', async () => {
    studio();
    const result = await readContext(
      transaction,
      actor,
      'run',
      'conversation',
      'studio',
      undefined
    );
    expect(result).toMatchObject({ selection: null, offset: 0, limit: 20 });
    expect(result.data).toMatchObject({ workspaceId: null, totalPages: 5 });
  });

  it.each([7, 6])(
    'returns bounded amendment blocks with selectionStale for revision %i',
    async revision => {
      amendment();
      const hints: EditorContext = {
        surface: 'amendment_text',
        selection,
        contentRevision: revision,
      };
      const result = await readContext(
        transaction,
        actor,
        'run',
        'conversation',
        'amendment_text',
        hints,
        1,
        1
      );
      expect(result.data).toMatchObject({
        totalBlocks: 3,
        blocks: [{ ref: 'block_1', text: 'Beta' }],
        selectionStale: revision !== 7,
        selectionAnchors: revision === 7 ? [{ ref: 'selection_0', text: 'lp' }] : [],
      });
      expect(result.selection).toEqual(hints);
    }
  );

  it('reads amendment text without a selection', async () => {
    amendment();
    const result = await readContext(
      transaction,
      actor,
      'run',
      'conversation',
      'amendment_text',
      undefined
    );
    expect(result.data).toMatchObject({
      selectionStale: false,
      selectionAnchors: [],
      totalBlocks: 3,
    });
  });

  it.each([false, true])(
    'reads City Design objects or OSM features with features=%s',
    async features => {
      amendment();
      const design = createEmptyCityDesignState();
      design.osmSnapshot = {
        fetchedAt: 1,
        bbox: { north: 1, south: 0, east: 1, west: 0 },
        features: [
          {
            id: 'feature',
            kind: 'utility',
            geometryKind: 'point',
            point: design.origin,
            source: 'osm',
          },
        ],
      };
      boundary.rows.mockResolvedValue([{ id: cityId, design_state: design, content_revision: 3 }]);
      const result = await readContext(
        transaction,
        actor,
        'run',
        'conversation',
        'city_design',
        undefined,
        0,
        1,
        features
      );
      expect(result.data).toMatchObject(
        features
          ? { totalFeatures: 1, features: [{ id: 'feature' }] }
          : { totalObjects: 0, objects: [] }
      );
      expect(result.data).not.toHaveProperty('osmSnapshot');
    }
  );

  it.each(['studio', 'amendment_text', 'city_design'] as const)(
    'rejects oversized %s context instead of truncating geometry or anchors',
    async kind => {
      if (kind === 'studio') studio();
      else amendment();
      if (kind === 'city_design')
        boundary.rows.mockResolvedValue([
          { id: cityId, design_state: createEmptyCityDesignState(), content_revision: 1 },
        ]);
      await expect(
        readContext(transaction, actor, 'run', 'conversation', kind, undefined, 0, 20, false, 1)
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'context_too_large', recovery: 'read_again' })
      );
    }
  );
});
