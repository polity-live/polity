import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { seedDocument } from '@/features/collaboration/logic/codec';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
const io = vi.hoisted(() => ({ query: vi.fn(), find: vi.fn(), access: vi.fn() }));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (id: string) => id,
  executeZeroTransaction: (_ctx: unknown, body: (tx: unknown) => unknown) =>
    body({ location: 'server', dbTransaction: { query: io.query } }),
}));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  findStored: io.find,
}));
vi.mock('../service', async original => ({
  ...(await original<typeof import('../service')>()),
  authorizeStored: io.access,
}));
import { queueCommittedExport } from '../studio-export';
import { validateStudioAssetsInTransaction } from '../studio-assets';
let doc: any, count: number, proof: any[], assets: any[];
const encoded = () => Buffer.from(doc.state).toString('base64');
beforeEach(() => {
  vi.clearAllMocks();
  const value = createDocument('single', 'Confirmed');
  const y = seedDocument('studio', value);
  doc = { id: 'doc', revision: 7, state: Y.encodeStateAsUpdate(y), projection: value };
  y.destroy();
  count = 0;
  proof = [{ id: 'confirmed' }];
  assets = [];
  io.find.mockImplementation(async () => doc);
  io.access.mockResolvedValue({});
  io.query.mockImplementation(async (sql: string) =>
    sql.startsWith('select phase')
      ? [{ phase: 'active' }]
      : sql.startsWith('select count')
        ? [{ n: count }]
        : sql.startsWith('select id from collaboration_revision')
          ? proof
          : sql.startsWith('select id from studio_asset')
            ? assets
            : []
  );
});
describe('exports reference confirmed shared revisions', () => {
  it('queues each supported format against the same immutable confirmed content', async () => {
    for (const format of ['png', 'pdf', 'pptx', 'canva', 'mp4', 'xlsx', 'zip']) {
      const result = await queueCommittedExport(
        'editor',
        'project',
        format,
        [doc.projection.pages[0].id],
        encoded()
      );
      expect(result.revision).toBe(7);
      expect(io.query).toHaveBeenCalledWith(
        expect.stringContaining('insert into studio_revision'),
        expect.arrayContaining(['project', doc.projection, 'editor', 'confirmed'])
      );
      expect(io.query).toHaveBeenCalledWith(
        expect.stringContaining('insert into studio_export'),
        expect.arrayContaining([
          result.id,
          'project',
          'editor',
          format,
          [doc.projection.pages[0].id],
        ])
      );
    }
    expect(io.access).toHaveBeenCalledWith(expect.anything(), 'editor', doc, undefined, true);
  });
  it('rejects lost access, absent shared state and unsaved client edits before creating export jobs', async () => {
    io.access.mockRejectedValueOnce(new Error('write_denied'));
    await expect(queueCommittedExport('reader', 'project', 'png', [], encoded())).rejects.toThrow(
      'write_denied'
    );
    const changed = seedDocument('studio', createDocument('single', 'Unsaved'));
    const state = Buffer.from(Y.encodeStateAsUpdate(changed)).toString('base64');
    changed.destroy();
    await expect(queueCommittedExport('editor', 'project', 'png', [], state)).rejects.toThrow(
      'wait_for_saved_revision'
    );
    io.find.mockResolvedValueOnce(null);
    await expect(queueCommittedExport('editor', 'project', 'png', [], encoded())).rejects.toThrow(
      'canonical_document_missing'
    );
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
  });
  it('rejects missing media, unknown pages, excessive queued jobs and missing revision proofs', async () => {
    await expect(
      queueCommittedExport('editor', 'project', 'png', ['not-a-page'], encoded())
    ).rejects.toThrow('invalid_export');
    doc.projection.pages[0].elements.push(element('image'));
    await expect(queueCommittedExport('editor', 'project', 'png', [], encoded())).rejects.toThrow(
      'invalid_export'
    );
    doc.projection.pages[0].elements.pop();
    count = 5;
    await expect(queueCommittedExport('editor', 'project', 'png', [], encoded())).rejects.toThrow(
      'export_queue_full'
    );
    count = 0;
    proof = [];
    await expect(queueCommittedExport('editor', 'project', 'png', [], encoded())).rejects.toThrow(
      'confirmed_revision_missing'
    );
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
  });
  it('deduplicates media references and requires every image, video and logo to be ready in the same project', async () => {
    await validateStudioAssetsInTransaction({ query: io.query }, 'project', doc.projection);
    expect(io.query).not.toHaveBeenCalled();
    const image = crypto.randomUUID(),
      video = crypto.randomUUID();
    doc.projection.pages[0].elements.push(
      element('image', { assetId: image }),
      element('video', { assetId: video }),
      element('image', { assetId: image })
    );
    doc.projection.brand.logoAssetId = image;
    assets = [{ id: image }, { id: video }];
    await validateStudioAssetsInTransaction({ query: io.query }, 'project', doc.projection);
    expect(io.query).toHaveBeenLastCalledWith(
      expect.stringContaining('project_id=$1 and ready=true'),
      ['project', [image, video]]
    );
    assets = [{ id: image }];
    await expect(
      validateStudioAssetsInTransaction({ query: io.query }, 'project', doc.projection)
    ).rejects.toThrow('invalid_asset');
  });
});
