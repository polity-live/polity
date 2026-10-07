import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
import { createFrameNode } from '@/features/communication-studio/logic/document-v3';
import { createStudioNodeFromElement } from '@/features/communication-studio/logic/create-studio-node';
import {
  createElementSetSnapshot,
  instantiateElementSet,
} from '@/features/communication-studio/logic/element-library';

const io = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  access: vi.fn(),
  copy: vi.fn(),
  remove: vi.fn(),
  workspaceAccess: vi.fn(),
}));

vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioSql: () => io.sql,
  studioTransaction: io.transaction,
  assertStudioAccess: io.access,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    storage: { from: () => ({ copy: io.copy, remove: io.remove }) },
  }),
}));
vi.mock('../workspace-access', () => ({ assertCanvasWorkspace: io.workspaceAccess }));

import {
  archiveElementSet,
  createElementSet,
  instantiateElementSetForProject,
  publishElementSetRevision,
  renameElementSet,
  stageElementSetForAiProposal,
  synchronizeProjectElementInstances,
} from '../elements';

const projectId = '00000000-0000-4000-8000-000000000101';
const setId = '00000000-0000-4000-8000-000000000102';
const oldRevisionId = '00000000-0000-4000-8000-000000000103';
const nextRevisionId = '00000000-0000-4000-8000-000000000104';
const sourceAssetId = '00000000-0000-4000-8000-000000000105';

function fixtures() {
  const libraryLegacy = createDocument('single', 'Library source');
  libraryLegacy.pages[0].elements.push(element('image', { assetId: sourceAssetId }));
  const libraryDocument = legacyDocumentToV3(libraryLegacy);
  const text = libraryDocument.nodes.find(node => node.type === 'richText');
  const media = libraryDocument.nodes.find(node => node.type === 'media');
  if (!text || !media) throw new Error('Element fixture is incomplete');
  const previous = createElementSetSnapshot(libraryDocument, [text.id]);
  const next = createElementSetSnapshot(
    libraryDocument,
    [text.id, media.id],
    [{ id: sourceAssetId, name: 'Photo.png', mime: 'image/png' }]
  );
  const document = legacyDocumentToV3(createDocument('single', 'Target'));
  const created = instantiateElementSet(previous, {
    setId,
    revisionId: oldRevisionId,
    targetFrameId: document.nodes.find(node => node.type === 'frame')?.id,
    x: 100,
    y: 120,
  });
  document.nodes.push(...created.nodes);
  document.componentInstances.push(created.instance);
  return { document, previous, next, libraryDocument };
}

beforeEach(() => {
  vi.clearAllMocks();
  io.sql.mockReset();
  io.copy.mockReset();
  io.remove.mockReset();
  io.transaction.mockReset();
  Object.assign(io.sql, { json: (value: unknown) => value });
  io.transaction.mockImplementation(async callback => callback(io.sql));
  io.access.mockResolvedValue(undefined);
  io.workspaceAccess.mockResolvedValue(undefined);
  io.copy.mockResolvedValue({ error: null });
  io.remove.mockResolvedValue({ error: null });
});

describe('Studio Elements server synchronization', () => {
  function mockLibrary(
    options: {
      groupId?: string | null;
      project?: ReturnType<typeof fixtures>['document'];
      emptyMedia?: boolean;
      missingMedia?: boolean;
      twoMedia?: boolean;
    } = {}
  ) {
    const fixture = fixtures();
    io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
      const query = parts.join('?');
      if (query.includes('select p.group_id'))
        return [
          {
            group_id: options.groupId ?? null,
            document: options.project ?? fixture.libraryDocument,
          },
        ];
      if (query.includes('select s.document from'))
        return [{ document: options.project ?? fixture.document }];
      if (query.includes('from studio_element_set s'))
        return [
          {
            id: setId,
            owner_id: 'owner',
            group_id: options.groupId ?? null,
            version: 1,
            revision_id: oldRevisionId,
            snapshot: fixture.previous,
          },
        ];
      if (query.includes('as allowed')) return [{ allowed: true }];
      if (query.includes('count(*)')) return [{ count: 0, bytes: 0 }];
      if (query.includes('select id,name,mime_type from studio_asset'))
        return [{ id: sourceAssetId, name: 'Photo', mime_type: 'image/png' }];
      if (query.includes('select id,name,mime_type,byte_size,storage_path'))
        return options.missingMedia
          ? []
          : [
              {
                id: sourceAssetId,
                name: 'Photo',
                mime_type: 'image/png',
                byte_size: 64,
                storage_path: 'project/photo',
              },
            ];
      if (query.includes('from studio_element_set_asset'))
        return options.emptyMedia
          ? []
          : Array.from({ length: options.twoMedia ? 2 : 1 }, (_, index) => ({
              source_asset_id: sourceAssetId,
              name: 'Photo',
              mime_type: 'image/png',
              byte_size: 64,
              storage_path: `library/photo${index}`,
            }));
      return [];
    });
    return fixture;
  }
  function mockSync(
    document: ReturnType<typeof fixtures>['document'] | null,
    options: {
      set?: any;
      previous?: any;
      sources?: any[];
      usage?: { count: number; bytes: number };
    } = {}
  ) {
    const fixture = fixtures();
    io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
      const query = parts.join('?');
      if (query.includes('select s.document,s.content_revision'))
        return document ? [{ document, content_revision: 4 }] : [];
      if (query.includes('count(*)')) return [options.usage ?? { count: 0, bytes: 0 }];
      if (query.includes('select s.archived_at'))
        return options.set === null
          ? []
          : [
              options.set ?? {
                archived_at: null,
                current_revision_id: nextRevisionId,
                snapshot: fixture.next,
              },
            ];
      if (query.includes('select snapshot from studio_element_set_revision'))
        return options.previous === null
          ? []
          : [{ snapshot: options.previous ?? fixture.previous }];
      if (query.includes('from studio_element_set_asset'))
        return (
          options.sources ?? [
            {
              source_asset_id: sourceAssetId,
              name: 'Photo',
              mime_type: 'image/png',
              byte_size: 64,
              storage_path: 'library/photo',
            },
          ]
        );
      return [];
    });
  }
  it('removes previously staged collection media when a later selected asset is unavailable', async () => {
    const { libraryDocument } = fixtures();
    const first = libraryDocument.nodes.find(node => node.type === 'media')!;
    const secondAsset = crypto.randomUUID();
    libraryDocument.nodes.push({
      ...structuredClone(first),
      id: crypto.randomUUID(),
      assetId: secondAsset,
    } as typeof first);
    io.sql.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = parts.join('?');
      if (query.includes('select p.group_id'))
        return [{ group_id: null, document: libraryDocument }];
      if (query.includes('select id,name,mime_type from studio_asset'))
        return [sourceAssetId, secondAsset].map(id => ({
          id,
          name: 'Photo',
          mime_type: 'image/png',
        }));
      if (query.includes('select id,name,mime_type,byte_size,storage_path'))
        return values.includes(secondAsset)
          ? []
          : [
              {
                id: sourceAssetId,
                name: 'Photo',
                mime_type: 'image/png',
                byte_size: 64,
                storage_path: 'first/source',
              },
            ];
      return [];
    });
    await expect(
      createElementSet('owner', {
        projectId,
        groupId: null,
        selectedIds: libraryDocument.nodes
          .filter(node => node.type === 'media')
          .map(node => node.id),
      })
    ).rejects.toThrow('media file is unavailable');
    expect(io.copy).toHaveBeenCalledOnce();
    expect(io.remove).toHaveBeenCalledExactlyOnceWith([io.copy.mock.calls[0][1]]);
    expect(io.transaction).not.toHaveBeenCalled();
  });
  it('publishes nested Elements with source identities and clears bindings to detached descendants', async () => {
    const { document } = fixtures();
    document.nodes = document.nodes.filter(node => node.componentRef === null);
    document.componentInstances = [];
    const root = document.nodes.find(node => node.type === 'frame')!;
    const outer = createFrameNode('custom', { parentFrameId: root.id, name: 'Outer' });
    const inner = createFrameNode('custom', { parentFrameId: outer.id, name: 'Inner' });
    const first = createStudioNodeFromElement(element('arrow'), inner.id, 1);
    const second = createStudioNodeFromElement(element('arrow'), outer.id, 2);
    const third = createStudioNodeFromElement(element('rect'), outer.id, 3);
    if (first.type !== 'shape' || second.type !== 'shape') throw new Error('Shape fixture missing');
    first.startBindingId = inner.id;
    first.endBindingId = inner.id;
    second.startBindingId = outer.id;
    second.endBindingId = first.id;
    const snapshot = createElementSetSnapshot(
      { ...document, nodes: [...document.nodes, outer, inner, first, second, third] },
      [outer.id]
    );
    const linked = instantiateElementSet(snapshot, {
      setId,
      revisionId: oldRevisionId,
      targetFrameId: root.id,
      x: 0,
      y: 0,
    });
    const localInner = linked.instance.sourceToInstance[inner.id];
    linked.instance.sourceToInstance = Object.fromEntries(
      Object.entries(linked.instance.sourceToInstance).filter(([source]) => source !== inner.id)
    );
    document.nodes.push(...linked.nodes);
    document.componentInstances.push(linked.instance);
    mockLibrary({ project: document });
    await publishElementSetRevision('owner', { projectId, instanceId: linked.instance.id });
    const write = io.sql.mock.calls.find(([parts]) =>
      parts.join('?').includes('insert into studio_element_set_revision')
    )!;
    const saved = write.find(
      value => value && typeof value === 'object' && 'nodes' in value
    ) as any;
    expect(saved.nodes.find((node: any) => node.id === first.id)).toMatchObject({
      parentFrameId: null,
      startBindingId: null,
      endBindingId: null,
    });
    expect(saved.nodes.find((node: any) => node.id === second.id)).toMatchObject({
      parentFrameId: outer.id,
      startBindingId: outer.id,
      endBindingId: first.id,
    });
    expect(saved.nodes.find((node: any) => node.id === localInner)).toMatchObject({
      parentFrameId: outer.id,
      componentRef: null,
    });
  });
  it('rejects a missing synchronization target and leaves a project without linked instances unchanged', async () => {
    mockSync(null);
    await expect(synchronizeProjectElementInstances('owner', projectId)).rejects.toThrow(
      'Studio project not found'
    );
    const { document } = fixtures();
    document.componentInstances = [];
    document.nodes.forEach(node => {
      node.componentRef = null;
    });
    mockSync(document);
    expect(await synchronizeProjectElementInstances('owner', projectId)).toBeNull();
    expect(io.copy).not.toHaveBeenCalled();
  });
  it.each(['missing', 'archived', 'no revision', 'no snapshot'])(
    'detaches a linked instance when its upstream library is %s',
    async reason => {
      const { document, next } = fixtures();
      const instance = document.componentInstances[0];
      const unrelated = document.nodes.filter(
        node => !Object.values(instance.sourceToInstance).includes(node.id)
      );
      mockSync(document, {
        set:
          reason === 'missing'
            ? null
            : {
                archived_at: reason === 'archived' ? new Date() : null,
                current_revision_id: reason === 'no revision' ? null : nextRevisionId,
                snapshot: reason === 'no snapshot' ? null : next,
              },
      });
      const result = await synchronizeProjectElementInstances('owner', projectId);
      expect(result?.revision).toBe(5);
      expect(result?.document.componentInstances).toEqual([]);
      expect(
        result?.document.nodes
          .filter(node => Object.values(instance.sourceToInstance).includes(node.id))
          .every(node => node.componentRef === null)
      ).toBe(true);
      expect(
        result?.document.nodes.filter(node => unrelated.some(item => item.id === node.id))
      ).toEqual(unrelated);
      expect(io.copy).not.toHaveBeenCalled();
    }
  );
  it.each(['same revision', 'missing previous'])(
    'skips synchronization for %s without changing the project',
    async reason => {
      const { document, previous } = fixtures();
      mockSync(
        document,
        reason === 'same revision'
          ? { set: { current_revision_id: oldRevisionId, snapshot: previous } }
          : { previous: null }
      );
      expect(await synchronizeProjectElementInstances('owner', projectId)).toBeNull();
      expect(io.copy).not.toHaveBeenCalled();
      expect(
        io.sql.mock.calls.some(([parts]) => parts.join('?').includes('update studio_state'))
      ).toBe(false);
    }
  );
  it('reuses media already mapped into a linked instance while synchronizing its revision', async () => {
    const { document, next } = fixtures();
    document.componentInstances = [];
    document.nodes = document.nodes.filter(node => node.componentRef === null);
    const localAsset = crypto.randomUUID();
    const linked = instantiateElementSet(next, {
      setId,
      revisionId: oldRevisionId,
      targetFrameId: document.nodes.find(node => node.type === 'frame')?.id,
      x: 10,
      y: 20,
      assetIds: { [sourceAssetId]: localAsset },
    });
    document.nodes.push(...linked.nodes);
    document.componentInstances.push(linked.instance);
    const updated = structuredClone(next);
    updated.nodes[0].name = 'Updated text';
    mockSync(document, {
      set: { current_revision_id: nextRevisionId, snapshot: updated },
      previous: next,
    });
    const result = await synchronizeProjectElementInstances('owner', projectId);
    expect(result?.revision).toBe(5);
    expect(result?.document.nodes.find(node => node.componentRef === next.nodes[0].id)?.name).toBe(
      'Updated text'
    );
    expect(result?.document.nodes.find(node => node.type === 'media')).toMatchObject({
      assetId: localAsset,
    });
    expect(io.copy).not.toHaveBeenCalled();
  });
  it.each(['missing media', 'byte quota', 'copy error'])(
    'rejects upstream synchronization with %s before exposing the revision',
    async reason => {
      const { document, previous, next } = fixtures();
      mockSync(document, {
        previous,
        set: { current_revision_id: nextRevisionId, snapshot: next },
        ...(reason === 'missing media' ? { sources: [] } : {}),
        ...(reason === 'byte quota' ? { usage: { count: 0, bytes: 500 * 1024 * 1024 } } : {}),
      });
      if (reason === 'copy error') io.copy.mockResolvedValue({ error: {} });
      await expect(synchronizeProjectElementInstances('owner', projectId)).rejects.toThrow(
        reason === 'missing media'
          ? 'media file is unavailable'
          : reason === 'byte quota'
            ? 'Project media limit'
            : 'Cannot copy element media'
      );
      expect(
        io.sql.mock.calls.some(([parts]) => parts.join('?').includes('update studio_state'))
      ).toBe(false);
      expect(io.remove).not.toHaveBeenCalled();
    }
  );
  it('removes newly copied synchronization media if a later copy fails', async () => {
    const { document, previous, next } = fixtures();
    const media = next.nodes.find(node => node.type === 'media')!;
    const secondAsset = crypto.randomUUID();
    next.nodes.push({
      ...structuredClone(media),
      id: crypto.randomUUID(),
      assetId: secondAsset,
    } as typeof media);
    next.assets.push({ sourceAssetId: secondAsset, name: 'Second', mime: 'image/png' });
    mockSync(document, {
      previous,
      set: { current_revision_id: nextRevisionId, snapshot: next },
      sources: [sourceAssetId, secondAsset].map(id => ({
        source_asset_id: id,
        name: 'Photo',
        mime_type: 'image/png',
        byte_size: 64,
        storage_path: `library/${id}`,
      })),
    });
    io.copy.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: {} });
    await expect(synchronizeProjectElementInstances('owner', projectId)).rejects.toThrow(
      'Cannot copy element media'
    );
    expect(io.remove).toHaveBeenCalledExactlyOnceWith([io.copy.mock.calls[0][1]]);
  });
  it('stages a media-free proposal and reports a first-copy failure without deleting existing library media', async () => {
    mockLibrary({ emptyMedia: true });
    expect(
      (await stageElementSetForAiProposal('owner', { projectId, setId, proposalId: 'proposal' }))
        .assets
    ).toEqual([]);
    mockLibrary();
    io.copy.mockResolvedValueOnce({ error: {} });
    await expect(
      stageElementSetForAiProposal('owner', { projectId, setId, proposalId: 'proposal' })
    ).rejects.toThrow('Cannot copy element media');
    expect(io.remove).not.toHaveBeenCalled();
  });
  it('uses the selected node name when no collection name is supplied and rolls back media-free creation failures', async () => {
    const { libraryDocument } = fixtures();
    const text = libraryDocument.nodes.find(node => node.type === 'richText')!;
    mockLibrary({ project: libraryDocument });
    expect(
      (await createElementSet('owner', { projectId, groupId: null, selectedIds: [text.id] })).name
    ).toBe(text.name.slice(0, 120));
    io.transaction.mockRejectedValueOnce(new Error('Creation rejected'));
    await expect(
      createElementSet('owner', { projectId, groupId: null, selectedIds: [text.id] })
    ).rejects.toThrow('Creation rejected');
    expect(io.remove).not.toHaveBeenCalled();
  });
  it.each([null, 'group'])(
    'publishes a %s linked instance as an immutable next library revision',
    async groupId => {
      const { document } = mockLibrary({ groupId });
      const result = await publishElementSetRevision('owner', {
        projectId,
        instanceId: document.componentInstances[0].id,
      });
      expect(result.version).toBe(2);
      const revision = io.sql.mock.calls.find(([parts]) =>
        parts.join('?').includes('insert into studio_element_set_revision')
      )!;
      const snapshot = revision.find(
        value => value && typeof value === 'object' && 'nodes' in value
      ) as any;
      expect(snapshot.nodes[0].id).toBe(
        Object.keys(document.componentInstances[0].sourceToInstance)[0]
      );
      expect(snapshot.nodes.every((node: any) => node.componentRef === null)).toBe(true);
      expect(
        io.sql.mock.calls.some(([parts]) =>
          parts.join('?').includes('update studio_element_set set current_revision_id=')
        )
      ).toBe(true);
    }
  );
  it('publishes linked media into the confirmed library revision and records its source identity', async () => {
    const { document, next } = fixtures();
    const linked = instantiateElementSet(next, {
      setId,
      revisionId: oldRevisionId,
      targetFrameId: document.nodes.find(node => node.type === 'frame')?.id,
      x: 0,
      y: 0,
    });
    document.nodes.push(...linked.nodes);
    document.componentInstances.push(linked.instance);
    mockLibrary({ project: document });
    const result = await publishElementSetRevision('owner', {
      projectId,
      instanceId: linked.instance.id,
    });
    expect(result.version).toBe(2);
    expect(io.copy).toHaveBeenCalledExactlyOnceWith(
      'project/photo',
      expect.stringContaining(`libraries/users/owner/sets/${setId}/${result.revisionId}/`)
    );
    const insert = io.sql.mock.calls.find(([parts]) =>
      parts.join('?').includes('insert into studio_element_set_asset')
    )!;
    expect(insert).toContain(result.revisionId);
    expect(insert).toContain(sourceAssetId);
    expect(insert).toContain(io.copy.mock.calls[0][1]);
    expect(io.remove).not.toHaveBeenCalled();
  });
  it.each(['missing source', 'copy failure', 'transaction failure'])(
    'does not expose a new library revision after %s',
    async reason => {
      const { libraryDocument } = mockLibrary({ missingMedia: reason === 'missing source' });
      if (reason === 'copy failure')
        io.copy.mockResolvedValue({ error: { message: 'Storage down' } });
      if (reason === 'transaction failure')
        io.transaction.mockRejectedValue(new Error('Database rejected revision'));
      const selectedIds = libraryDocument.nodes
        .filter(node => node.type === 'media')
        .map(node => node.id);
      await expect(
        createElementSet('owner', { projectId, groupId: null, selectedIds })
      ).rejects.toThrow(
        reason === 'missing source'
          ? 'media file is unavailable'
          : reason === 'copy failure'
            ? 'Cannot copy'
            : 'Database rejected'
      );
      expect(io.remove).toHaveBeenCalledTimes(reason === 'transaction failure' ? 1 : 0);
      if (reason !== 'transaction failure') expect(io.transaction).not.toHaveBeenCalled();
    }
  );
  it.each(['media', 'no media'])(
    'retains library rollback semantics when publishing fails with %s',
    async kind => {
      const fixture = fixtures();
      if (kind === 'media') {
        const linked = instantiateElementSet(fixture.next, {
          setId,
          revisionId: oldRevisionId,
          targetFrameId: fixture.document.nodes.find(node => node.type === 'frame')?.id,
          x: 0,
          y: 0,
        });
        fixture.document.nodes.push(...linked.nodes);
        fixture.document.componentInstances.push(linked.instance);
      }
      mockLibrary({ project: fixture.document });
      io.transaction.mockRejectedValue(new Error('Write denied'));
      await expect(
        publishElementSetRevision('owner', {
          projectId,
          instanceId: fixture.document.componentInstances.at(-1)!.id,
        })
      ).rejects.toThrow('Write denied');
      expect(io.remove).toHaveBeenCalledTimes(kind === 'media' ? 1 : 0);
      if (kind === 'media') expect(io.remove).toHaveBeenCalledWith([io.copy.mock.calls[0][1]]);
    }
  );
  it('imports a library with no media without copying and rejects an unknown library before writing', async () => {
    mockLibrary({ emptyMedia: true });
    const result = await instantiateElementSetForProject('owner', { projectId, setId });
    expect(result.assetIds).toEqual({});
    expect(io.copy).not.toHaveBeenCalled();
    io.sql.mockResolvedValueOnce([]);
    await expect(
      stageElementSetForAiProposal('owner', { projectId, setId, proposalId: 'proposal' })
    ).rejects.toThrow('Elements entry not found');
  });
  it.each(['first copy', 'later copy', 'transaction'])(
    'cleans up only copied media after an import fails at %s',
    async failure => {
      mockLibrary({ twoMedia: true });
      if (failure === 'first copy') io.copy.mockResolvedValueOnce({ error: {} });
      if (failure === 'later copy')
        io.copy.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: {} });
      if (failure === 'transaction')
        io.transaction.mockRejectedValue(new Error('Asset transaction failed'));
      await expect(instantiateElementSetForProject('owner', { projectId, setId })).rejects.toThrow(
        failure === 'transaction' ? 'Asset transaction failed' : 'Cannot copy element media'
      );
      const copied =
        failure === 'first copy'
          ? []
          : io.copy.mock.calls.slice(0, failure === 'later copy' ? 1 : 2).map(call => call[1]);
      if (copied.length) {
        expect(io.remove).toHaveBeenCalledExactlyOnceWith(copied);
        expect(
          io.sql.mock.calls.some(([parts]) =>
            parts.join('?').includes('delete from studio_asset where id in')
          )
        ).toBe(true);
      } else expect(io.remove).not.toHaveBeenCalled();
    }
  );
  it.each(['rename', 'archive'] as const)(
    'requires write access before %s and updates only the requested Elements entry',
    async operation => {
      io.sql.mockResolvedValue([{ id: setId }]);
      if (operation === 'rename')
        expect(await renameElementSet('owner', setId, '  Updated  ')).toEqual({ ok: true });
      else expect(await archiveElementSet('owner', setId)).toEqual({ ok: true });
      expect(io.sql.mock.calls[0][0].join('?')).toContain('studio_group_access');
      expect(io.sql.mock.calls[0]).toContain(true);
      expect(io.sql.mock.calls.at(-1)).toContain(setId);
      if (operation === 'rename') expect(io.sql.mock.calls.at(-1)).toContain('Updated');
      else expect(io.sql.mock.calls.at(-1)![0].join('?')).toContain('archived_at=now()');
      io.sql.mockResolvedValueOnce([]);
      await expect(renameElementSet('denied', setId, 'Unauthorized')).rejects.toThrow(
        'Elements entry not found'
      );
    }
  );
  it.each([null, 'group'])(
    'creates a %s Elements revision only after permission checks and media copying',
    async groupId => {
      const { libraryDocument } = fixtures();
      const selected = libraryDocument.nodes
        .filter(node => node.type === 'richText' || node.type === 'media')
        .map(node => node.id);
      io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
        const query = parts.join('?');
        if (query.includes('select p.group_id'))
          return [{ group_id: groupId, document: libraryDocument }];
        if (query.includes('as allowed')) return [{ allowed: true }];
        if (query.includes('select id,name,mime_type from studio_asset'))
          return [{ id: sourceAssetId, name: 'Photo', mime_type: 'image/png' }];
        if (query.includes('select id,name,mime_type,byte_size,storage_path'))
          return [
            {
              id: sourceAssetId,
              name: 'Photo',
              mime_type: 'image/png',
              byte_size: '64',
              storage_path: 'project/photo',
            },
          ];
        return [];
      });
      const result = await createElementSet('owner', {
        projectId,
        groupId,
        selectedIds: selected,
        name: '  Collection  ',
      });
      expect(result).toMatchObject({ version: 1 });
      expect(io.access).toHaveBeenCalledWith('owner', projectId, true);
      expect(io.access).toHaveBeenCalledWith('owner', projectId, true, io.sql);
      expect(io.copy).toHaveBeenCalledExactlyOnceWith(
        'project/photo',
        expect.stringContaining(
          groupId ? 'libraries/groups/group/sets/' : 'libraries/users/owner/sets/'
        )
      );
      const insert = io.sql.mock.calls.find(([parts]) =>
        parts.join('?').includes('insert into studio_element_set(')
      )!;
      expect(insert).toContain('Collection');
      expect(insert).toContain(groupId ? null : 'owner');
      expect(
        io.sql.mock.calls.some(([parts]) =>
          parts.join('?').includes('insert into studio_element_set_asset')
        )
      ).toBe(true);
    }
  );
  it.each(['missing project', 'wrong scope', 'group permission'])(
    'rejects creation before writing or copying when there is %s',
    async reason => {
      const { libraryDocument } = fixtures();
      io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
        if (parts.join('?').includes('select p.group_id'))
          return reason === 'missing project'
            ? []
            : [
                {
                  group_id: reason === 'wrong scope' ? 'other' : 'group',
                  document: libraryDocument,
                },
              ];
        return [{ allowed: false }];
      });
      await expect(
        createElementSet('owner', { projectId, groupId: 'group', selectedIds: [] })
      ).rejects.toThrow(reason === 'group permission' ? 'No permission' : 'scope does not match');
      expect(io.copy).not.toHaveBeenCalled();
      expect(io.transaction).not.toHaveBeenCalled();
    }
  );
  it.each([undefined, 'draft'])(
    'instantiates library media into the %s workspace with a confirmed asset mapping',
    async workspaceId => {
      const { next } = fixtures();
      io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
        const query = parts.join('?');
        if (query.includes('from studio_element_set s'))
          return [{ id: setId, revision_id: nextRevisionId, snapshot: next }];
        if (query.includes('from studio_element_set_asset'))
          return [
            {
              source_asset_id: sourceAssetId,
              name: 'Photo',
              mime_type: 'image/png',
              byte_size: '64',
              storage_path: 'library/photo',
            },
          ];
        if (query.includes('count(*)')) return [{ count: '0', bytes: '0' }];
        return [];
      });
      const result = await instantiateElementSetForProject('owner', {
        projectId,
        setId,
        workspaceId,
      });
      expect(result).toMatchObject({ setId, revisionId: nextRevisionId, snapshot: next });
      expect(result.assetIds[sourceAssetId]).toEqual(expect.any(String));
      expect(io.workspaceAccess).toHaveBeenCalledWith(
        'owner',
        projectId,
        workspaceId,
        true,
        io.sql
      );
      expect(io.copy).toHaveBeenCalledWith(
        'library/photo',
        `${projectId}/assets/${result.assetIds[sourceAssetId]}`
      );
      const insert = io.sql.mock.calls.find(([parts]) =>
        parts.join('?').includes('insert into studio_asset')
      )!;
      expect(insert).toContain(workspaceId ?? null);
      expect(insert).toContain(64);
    }
  );
  it.each([
    { count: 100, bytes: 0 },
    { count: 0, bytes: 500 * 1024 * 1024 },
  ])('rejects an Elements media import beyond the existing quota %j', async usage => {
    const { next } = fixtures();
    io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
      const query = parts.join('?');
      if (query.includes('from studio_element_set s'))
        return [{ id: setId, revision_id: nextRevisionId, snapshot: next }];
      if (query.includes('from studio_element_set_asset'))
        return [{ source_asset_id: sourceAssetId, byte_size: 64 }];
      if (query.includes('count(*)')) return [usage];
      return [];
    });
    await expect(instantiateElementSetForProject('owner', { projectId, setId })).rejects.toThrow(
      'Project media limit'
    );
    expect(io.copy).not.toHaveBeenCalled();
    expect(io.transaction).not.toHaveBeenCalled();
  });
  it.each(['no project', 'no instance'])(
    'rejects publishing a revision when there is %s',
    async reason => {
      const { document } = fixtures();
      io.sql.mockResolvedValue(reason === 'no project' ? [] : [{ document }]);
      await expect(
        publishElementSetRevision('owner', { projectId, instanceId: 'missing' })
      ).rejects.toThrow(
        reason === 'no project' ? 'Studio project not found' : 'Linked Elements instance not found'
      );
      expect(io.copy).not.toHaveBeenCalled();
      expect(io.transaction).not.toHaveBeenCalled();
    }
  );
  it('stages AI library media without creating database rows before proposal commit', async () => {
    const { next } = fixtures();
    io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
      const query = parts.join('?');
      if (query.includes('from studio_element_set s'))
        return [{ id: setId, revision_id: nextRevisionId, snapshot: next }];
      if (query.includes('from studio_element_set_asset'))
        return [
          {
            source_asset_id: sourceAssetId,
            name: 'Photo.png',
            mime_type: 'image/png',
            byte_size: 64,
            storage_path: 'libraries/photo',
          },
        ];
      return [];
    });
    const prepared = await stageElementSetForAiProposal('reader', {
      setId,
      projectId,
      proposalId: 'proposal',
    });
    expect(prepared.assets).toHaveLength(1);
    expect(prepared.assetIds[sourceAssetId]).toBe(prepared.assets[0].id);
    expect(io.copy).toHaveBeenCalledWith('libraries/photo', prepared.assets[0].path);
    expect(prepared.assets[0].path).toContain(`${projectId}/proposals/proposal/`);
    expect(io.transaction).not.toHaveBeenCalled();
    expect(io.sql.mock.calls.some(([parts]) => parts.join('?').includes('insert into'))).toBe(
      false
    );
  });

  it('removes prepared AI media if a later storage copy fails', async () => {
    const { next } = fixtures();
    io.sql.mockImplementation(async (parts: TemplateStringsArray) => {
      const query = parts.join('?');
      if (query.includes('from studio_element_set s'))
        return [{ id: setId, revision_id: nextRevisionId, snapshot: next }];
      if (query.includes('from studio_element_set_asset'))
        return [0, 1].map(index => ({
          source_asset_id: sourceAssetId,
          name: `Photo${index}.png`,
          mime_type: 'image/png',
          byte_size: 64,
          storage_path: `libraries/photo${index}`,
        }));
      return [];
    });
    io.copy
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Copy failed' } });
    await expect(
      stageElementSetForAiProposal('reader', { setId, projectId, proposalId: 'proposal' })
    ).rejects.toThrow('Cannot copy element media');
    expect(io.remove).toHaveBeenCalledWith([io.copy.mock.calls[0][1]]);
    expect(io.transaction).not.toHaveBeenCalled();
  });

  it('copies media introduced by an upstream revision and remaps it into the linked instance', async () => {
    const { document, previous, next } = fixtures();
    io.sql.mockImplementation(async (parts: TemplateStringsArray | string[]) => {
      const query = parts.join('?');
      if (query.includes('select s.document,s.content_revision'))
        return [{ document, content_revision: 4 }];
      if (query.includes('select count(*)::int')) return [{ count: 0, bytes: 0 }];
      if (query.includes('select s.archived_at'))
        return [{ archived_at: null, current_revision_id: nextRevisionId, snapshot: next }];
      if (query.includes('select snapshot from studio_element_set_revision'))
        return [{ snapshot: previous }];
      if (query.includes('from studio_element_set_asset'))
        return [
          {
            source_asset_id: sourceAssetId,
            name: 'Photo.png',
            mime_type: 'image/png',
            byte_size: 64,
            storage_path: 'libraries/photo',
          },
        ];
      return [];
    });

    const result = await synchronizeProjectElementInstances('reader', projectId);

    expect(io.access).toHaveBeenCalledWith('reader', projectId, true, io.sql);
    expect(result?.revision).toBe(5);
    const media = result?.document.nodes.find(node => node.type === 'media');
    expect(media?.type).toBe('media');
    if (media?.type !== 'media') throw new Error('Synchronized media is missing');
    expect(media.assetId).not.toBe(sourceAssetId);
    expect(result?.document.componentInstances[0].revisionId).toBe(nextRevisionId);
    expect(io.copy).toHaveBeenCalledWith('libraries/photo', `${projectId}/assets/${media.assetId}`);
    expect(
      io.sql.mock.calls.some(([parts]) => parts.join('?').includes('insert into studio_asset'))
    ).toBe(true);
  });

  it('rejects an upstream media addition before copying when the target quota is full', async () => {
    const { document, previous, next } = fixtures();
    io.sql.mockImplementation(async (parts: TemplateStringsArray | string[]) => {
      const query = parts.join('?');
      if (query.includes('select s.document,s.content_revision'))
        return [{ document, content_revision: 4 }];
      if (query.includes('select count(*)::int')) return [{ count: 100, bytes: 0 }];
      if (query.includes('select s.archived_at'))
        return [{ archived_at: null, current_revision_id: nextRevisionId, snapshot: next }];
      if (query.includes('select snapshot from studio_element_set_revision'))
        return [{ snapshot: previous }];
      if (query.includes('from studio_element_set_asset'))
        return [
          {
            source_asset_id: sourceAssetId,
            name: 'Photo.png',
            mime_type: 'image/png',
            byte_size: 64,
            storage_path: 'libraries/photo',
          },
        ];
      return [];
    });

    await expect(synchronizeProjectElementInstances('reader', projectId)).rejects.toThrow(
      'Project media limit'
    );
    expect(io.copy).not.toHaveBeenCalled();
  });
});
