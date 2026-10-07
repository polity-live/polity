import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { createPointCityDesignObject } from '@/features/amendments/city-design/logic/cityDesignPlacement';
import { editorContextSchema, type EditorContext } from '@/features/project-chat/logic/contracts';
import type { ZeroTransaction } from '@/server/zero-mutate';

const boundary = vi.hoisted(() => ({
  requireConversation: vi.fn(),
  loadResource: vi.fn(),
  resolveSource: vi.fn(),
  sqlTransaction: vi.fn(),
}));
vi.mock('../context', () => ({
  requireProjectConversation: boundary.requireConversation,
  loadResource: boundary.loadResource,
}));
vi.mock('@/server/studio/source', () => ({ resolveStudioSource: boundary.resolveSource }));
vi.mock('@/server/transaction', () => ({ sqlTransaction: boundary.sqlTransaction }));
import { validateEditorContext } from '../editor-context';

const actor = '00000000-0000-4000-a000-000000000001';
const project = '00000000-0000-4000-a000-000000000002';
const workspace = '00000000-0000-4000-a000-000000000003';
const otherWorkspace = '00000000-0000-4000-a000-000000000004';
const run = vi.fn();
const transaction = { run } as unknown as ZeroTransaction;
let document = legacyDocumentToV3(createDocument('single', 'Server project'));
const frame = () => document.nodes.find(node => node.type === 'frame')!;
const element = () => document.nodes.find(node => node.type !== 'frame')!;
const input = (value: EditorContext) => editorContextSchema.parse(value);
const source = (workspaceId: string | null = null) => ({
  projectId: project,
  workspaceId,
  document,
  proposal: workspaceId ? { title: 'Server workspace' } : undefined,
  contentRevision: 12,
});
const select = { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 4 } };

beforeEach(() => {
  vi.clearAllMocks();
  run.mockResolvedValue({ title: 'Server branch' });
  document = legacyDocumentToV3(createDocument('single', 'Server project'));
  boundary.sqlTransaction.mockReturnValue({ query: 'authorized transaction' });
  boundary.requireConversation.mockResolvedValue({
    studio_project_id: project,
    amendment_id: null,
  });
  boundary.resolveSource.mockResolvedValue(source());
  boundary.loadResource.mockResolvedValue({
    id: 'document',
    branchId: null,
    contentRevision: 7,
    amendment: { title: 'Server amendment' },
    value: [],
  });
});

describe('server validation of project editor context', () => {
  it('revalidates conversation access before consulting project resources', async () => {
    boundary.requireConversation.mockRejectedValue(new Error('No conversation access'));
    await expect(
      validateEditorContext(transaction, actor, 'conversation', input({ surface: 'studio' }))
    ).rejects.toThrow('No conversation access');
    expect(boundary.requireConversation).toHaveBeenCalledWith(transaction, actor, 'conversation');
    expect(boundary.resolveSource).not.toHaveBeenCalled();
    expect(boundary.loadResource).not.toHaveBeenCalled();
  });

  it.each(['amendment_text', 'city_design'] as const)(
    'rejects a %s surface on a Studio conversation',
    async surface => {
      await expect(
        validateEditorContext(transaction, actor, 'conversation', input({ surface }))
      ).rejects.toThrow('scope_mismatch');
      expect(boundary.resolveSource).not.toHaveBeenCalled();
    }
  );

  it('rejects a Studio surface on an amendment conversation', async () => {
    boundary.requireConversation.mockResolvedValue({
      studio_project_id: null,
      amendment_id: 'amendment',
    });
    await expect(
      validateEditorContext(transaction, actor, 'conversation', input({ surface: 'studio' }))
    ).rejects.toThrow('scope_mismatch');
    expect(boundary.loadResource).not.toHaveBeenCalled();
  });

  it.each([null, workspace])(
    'resolves the canonical or selected workspace %s using trusted actor and conversation scope',
    async workspaceId => {
      boundary.resolveSource.mockResolvedValue(source(workspaceId));
      const supplied = input({
        surface: 'studio',
        ...(workspaceId ? { proposalId: workspaceId } : {}),
        pageId: frame().id,
        elementIds: [element().id],
        contentRevision: 1,
      });
      const original = structuredClone(supplied);
      const result = await validateEditorContext(transaction, actor, 'conversation', supplied);
      expect(boundary.resolveSource).toHaveBeenCalledWith(
        actor,
        project,
        workspaceId,
        boundary.sqlTransaction.mock.results[0].value
      );
      expect(result).toMatchObject({
        proposalId: workspaceId,
        contentRevision: 12,
        pageId: frame().id,
        elementIds: [element().id],
      });
      expect(result.references).toEqual([
        { kind: 'studio_project', id: project, label: 'Server project', origin: 'automatic' },
        {
          kind: 'workspace',
          id: workspaceId ?? 'canonical',
          workspaceId,
          label: workspaceId ? 'Server workspace' : 'canonical',
          origin: 'automatic',
        },
        {
          kind: 'frame',
          id: frame().id,
          label: frame().name,
          origin: 'automatic',
          workspaceId,
          parentId: undefined,
        },
        {
          kind: 'element',
          id: element().id,
          label: element().name,
          origin: 'automatic',
          workspaceId,
          parentId: element().parentFrameId,
        },
      ]);
      expect(supplied).toEqual(original);
      expect(boundary.loadResource).not.toHaveBeenCalled();
    }
  );

  it('uses explicit manual node references and discards forged project and workspace labels', async () => {
    const result = await validateEditorContext(
      transaction,
      actor,
      'conversation',
      input({
        surface: 'studio',
        pageId: 'ignored',
        elementIds: ['ignored'],
        references: [
          { kind: 'studio_project', id: 'forged', label: 'PRIVATE PROJECT', origin: 'manual' },
          { kind: 'workspace', id: 'forged', label: 'PRIVATE WORKSPACE', origin: 'manual' },
          {
            kind: 'element',
            id: element().id,
            label: 'FORGED ELEMENT',
            origin: 'manual',
            workspaceId: null,
          },
          {
            kind: 'frame',
            id: frame().id,
            label: 'FORGED FRAME',
            origin: 'manual',
            workspaceId: null,
          },
        ],
      })
    );
    expect(result.elementIds).toEqual([element().id]);
    expect(result.pageId).toBe(frame().id);
    expect(result.references?.slice(2).every(ref => ref.origin === 'manual')).toBe(true);
    expect(JSON.stringify(result.references)).not.toMatch(/PRIVATE|FORGED/);
  });

  it('retains explicitly empty selections instead of trusting stale legacy node IDs', async () => {
    const result = await validateEditorContext(
      transaction,
      actor,
      'conversation',
      input({ surface: 'studio', pageId: 'stale', elementIds: ['stale'], references: [] })
    );
    expect(result.pageId).toBeUndefined();
    expect(result.elementIds).toEqual([]);
    expect(result.references).toHaveLength(2);
  });

  it('accepts an absent selection and fills fallback labels from trusted node types', async () => {
    const result = await validateEditorContext(
      transaction,
      actor,
      'conversation',
      input({ surface: 'studio' })
    );
    expect(result.references).toHaveLength(2);
    element().name = '';
    const selected = await validateEditorContext(
      transaction,
      actor,
      'conversation',
      input({ surface: 'studio', elementIds: [element().id] })
    );
    expect(selected.references?.at(-1)?.label).toBe(element().type);
  });

  it.each([null, otherWorkspace])(
    'rejects a reference from stale workspace %s with explicit read-again recovery',
    async workspaceId => {
      boundary.resolveSource.mockResolvedValue(source(workspace));
      await expect(
        validateEditorContext(
          transaction,
          actor,
          'conversation',
          input({
            surface: 'studio',
            proposalId: workspace,
            references: [
              {
                kind: 'element',
                id: element().id,
                label: 'Selected',
                origin: 'manual',
                workspaceId,
              },
            ],
          })
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'context_stale', recovery: 'read_again' })
      );
    }
  );

  it.each(['missing element', 'frame as element', 'element as frame'])(
    'rejects an invalid Studio target: %s',
    async scenario => {
      const ref =
        scenario === 'missing element'
          ? { kind: 'element' as const, id: 'missing' }
          : scenario === 'frame as element'
            ? { kind: 'element' as const, id: frame().id }
            : { kind: 'frame' as const, id: element().id };
      await expect(
        validateEditorContext(
          transaction,
          actor,
          'conversation',
          input({
            surface: 'studio',
            references: [{ ...ref, label: 'Selected', origin: 'manual' }],
          })
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'invalid_target', recovery: 'read_again' })
      );
    }
  );

  it('propagates workspace authorization errors without exposing client-supplied context', async () => {
    boundary.resolveSource.mockRejectedValue(new Error('Workspace unavailable'));
    await expect(
      validateEditorContext(
        transaction,
        actor,
        'conversation',
        input({ surface: 'studio', proposalId: workspace })
      )
    ).rejects.toThrow('Workspace unavailable');
    expect(boundary.loadResource).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'validates amendment text on branch=%s and replaces client labels',
    async hasBranch => {
      boundary.requireConversation.mockResolvedValue({
        studio_project_id: null,
        amendment_id: 'amendment',
      });
      boundary.loadResource.mockResolvedValue({
        id: 'document',
        branchId: hasBranch ? workspace : null,
        contentRevision: 7,
        amendment: { title: 'Server amendment' },
        value: [],
      });
      const supplied = input({
        surface: 'amendment_text',
        references: [{ kind: 'amendment', id: 'forged', label: 'PRIVATE', origin: 'manual' }],
      });
      const result = await validateEditorContext(transaction, actor, 'conversation', supplied);
      expect(boundary.loadResource).toHaveBeenCalledWith(
        transaction,
        actor,
        'conversation',
        'amendment_text',
        expect.objectContaining({ surface: 'amendment_text' })
      );
      expect(boundary.loadResource.mock.calls[0][4]).not.toBe(supplied);
      expect(result.references).toEqual([
        { kind: 'amendment', id: 'amendment', label: 'Server amendment', origin: 'automatic' },
        ...(hasBranch
          ? [
              {
                kind: 'branch',
                id: workspace,
                branchId: workspace,
                label: 'Server branch',
                origin: 'automatic',
              },
            ]
          : []),
      ]);
      expect(run).toHaveBeenCalledTimes(hasBranch ? 1 : 0);
      expect(supplied.references?.[0].label).toBe('PRIVATE');
    }
  );

  it('uses safe fallbacks when amendment and branch records have no labels', async () => {
    boundary.requireConversation.mockResolvedValue({ studio_project_id: null, amendment_id: null });
    boundary.loadResource.mockResolvedValue({
      id: 'document',
      branchId: workspace,
      contentRevision: 7,
      amendment: null,
      value: [],
    });
    run.mockResolvedValue(undefined);
    const result = await validateEditorContext(
      transaction,
      actor,
      'conversation',
      input({ surface: 'amendment_text' })
    );
    expect(result.references).toEqual([
      { kind: 'amendment', id: '', label: 'Amendment', origin: 'automatic' },
      { kind: 'branch', id: workspace, branchId: workspace, label: workspace, origin: 'automatic' },
    ]);
  });

  it('publishes an amendment selection only for the current revision', async () => {
    boundary.requireConversation.mockResolvedValue({
      studio_project_id: null,
      amendment_id: 'amendment',
    });
    const supplied = input({ surface: 'amendment_text', selection: select, contentRevision: 7 });
    const result = await validateEditorContext(transaction, actor, 'conversation', supplied);
    expect(result.references?.at(-1)).toEqual({
      kind: 'text_selection',
      id: 'document',
      label: 'selection',
      origin: 'automatic',
    });
    expect(result.selection).toEqual(select);
    expect(supplied.references).toBeUndefined();
  });

  it.each([undefined, 6])('rejects selected text with stale revision %s', async revision => {
    boundary.requireConversation.mockResolvedValue({
      studio_project_id: null,
      amendment_id: 'amendment',
    });
    await expect(
      validateEditorContext(
        transaction,
        actor,
        'conversation',
        input({ surface: 'amendment_text', selection: select, contentRevision: revision })
      )
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'context_stale', recovery: 'read_again' })
    );
  });

  it('allows stale revision hints when no text is selected', async () => {
    boundary.requireConversation.mockResolvedValue({
      studio_project_id: null,
      amendment_id: 'amendment',
    });
    const result = await validateEditorContext(
      transaction,
      actor,
      'conversation',
      input({ surface: 'amendment_text', contentRevision: 1 })
    );
    expect(result.references).toHaveLength(1);
  });

  it.each([false, true])(
    'validates City Design selections with explicit names=%s and restores trusted labels',
    async named => {
      boundary.requireConversation.mockResolvedValue({
        studio_project_id: null,
        amendment_id: 'amendment',
      });
      const city = createEmptyCityDesignState();
      const object = createPointCityDesignObject({
        id: 'tree',
        type: 'tree',
        point: { x: 0, z: 0 },
      });
      city.objects = [{ ...object, ...(named ? { name: 'Trusted tree' } : {}) }];
      city.osmSnapshot = {
        fetchedAt: 1,
        bbox: { north: 1, south: 0, east: 1, west: 0 },
        features: [
          {
            id: 'feature',
            kind: 'utility',
            geometryKind: 'point',
            point: city.origin,
            ...(named ? { label: 'Trusted feature' } : {}),
            source: 'osm',
          },
        ],
      };
      boundary.loadResource.mockResolvedValue({
        id: 'city',
        branchId: null,
        amendment: { title: 'Server amendment' },
        value: city,
      });
      const supplied = input({
        surface: 'city_design',
        objectIds: ['tree'],
        featureIds: ['feature'],
      });
      const result = await validateEditorContext(transaction, actor, 'conversation', supplied);
      expect(result.references).toEqual([
        { kind: 'amendment', id: 'amendment', label: 'Server amendment', origin: 'automatic' },
        { kind: 'city_design', id: 'city', label: 'City Design', origin: 'automatic' },
        {
          kind: 'city_object',
          id: 'tree',
          label: named ? 'Trusted tree' : 'tree',
          origin: 'automatic',
        },
        {
          kind: 'city_feature',
          id: 'feature',
          label: named ? 'Trusted feature' : 'utility',
          origin: 'automatic',
        },
      ]);
      expect(supplied.references).toBeUndefined();
    }
  );

  it('validates an empty City Design selection without inventing objects or map features', async () => {
    boundary.requireConversation.mockResolvedValue({
      studio_project_id: null,
      amendment_id: 'amendment',
    });
    boundary.loadResource.mockResolvedValue({
      id: 'city',
      branchId: null,
      amendment: null,
      value: createEmptyCityDesignState(),
    });
    const result = await validateEditorContext(
      transaction,
      actor,
      'conversation',
      input({ surface: 'city_design' })
    );
    expect(result.references?.map(ref => ref.kind)).toEqual(['amendment', 'city_design']);
  });

  it.each(['object', 'feature'])(
    'rejects a missing City Design %s with read-again recovery',
    async target => {
      boundary.requireConversation.mockResolvedValue({
        studio_project_id: null,
        amendment_id: 'amendment',
      });
      boundary.loadResource.mockResolvedValue({
        id: 'city',
        branchId: null,
        amendment: null,
        value: createEmptyCityDesignState(),
      });
      await expect(
        validateEditorContext(
          transaction,
          actor,
          'conversation',
          input({
            surface: 'city_design',
            ...(target === 'object' ? { objectIds: ['missing'] } : { featureIds: ['missing'] }),
          })
        )
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'invalid_target', recovery: 'read_again' })
      );
    }
  );

  it('propagates amendment resource authorization errors', async () => {
    boundary.requireConversation.mockResolvedValue({
      studio_project_id: null,
      amendment_id: 'amendment',
    });
    boundary.loadResource.mockRejectedValue(new Error('Amendment access denied'));
    await expect(
      validateEditorContext(
        transaction,
        actor,
        'conversation',
        input({ surface: 'amendment_text' })
      )
    ).rejects.toThrow('Amendment access denied');
    expect(run).not.toHaveBeenCalled();
  });
});
