import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
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

import { synchronizeProjectElementInstances } from '../elements';

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
  return { document, previous, next };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(io.sql, { json: (value: unknown) => value });
  io.transaction.mockImplementation(async callback => callback(io.sql));
  io.access.mockResolvedValue(undefined);
  io.copy.mockResolvedValue({ error: null });
  io.remove.mockResolvedValue({ error: null });
});

describe('Studio Elements server synchronization', () => {
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
