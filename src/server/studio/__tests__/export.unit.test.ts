import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
import { createFrameNode } from '@/features/communication-studio/logic/document-v3';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';

const io = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: () => ({}),
  executeZeroTransaction: async (_context: unknown, work: (tx: unknown) => Promise<unknown>) =>
    work({}),
}));
vi.mock('@/server/transaction', async original => ({
  ...(await original<typeof import('@/server/transaction')>()),
  sqlTransaction: () => ({ query: io.query }),
}));
import { queueCommittedExport } from '../export';

const projectId = crypto.randomUUID();
const actorId = crypto.randomUUID();
const legacy = createDocument('single', 'Off-canvas export');
legacy.pages[0].elements.push(element('rect', { x: 3000, y: 3000 }));
const document = legacyDocumentToV3(legacy);

beforeEach(() => {
  io.query.mockReset();
  io.query.mockImplementation(async (statement: string) => {
    if (statement.startsWith('select studio_access')) return [{ allowed: true }];
    if (statement.startsWith('select document,content_revision'))
      return [{ document, content_revision: 7 }];
    if (statement.startsWith('select count')) return [{ n: 0 }];
    return [];
  });
});

describe('Studio export queue validation', () => {
  function overrideRow(prefix: string, result: unknown[]) {
    const original = io.query.getMockImplementation()!;
    io.query.mockImplementation(async (statement: string, ...args: unknown[]) =>
      statement.startsWith(prefix) ? result : original(statement, ...args)
    );
  }
  it.each([{ access: [] }, { access: [{ allowed: false }] }])(
    'rejects unavailable or revoked export access %j before locking the project',
    async ({ access }) => {
      overrideRow('select studio_access', access);
      await expect(queueCommittedExport(actorId, projectId, 'png', [], 7)).rejects.toThrow(
        'access denied'
      );
      expect(io.query.mock.calls.some(([sql]) => sql.includes('for update'))).toBe(false);
    }
  );
  it.each([{ state: [] }, { state: [{ document, content_revision: 8 }] }])(
    'rejects missing or stale committed revisions %j',
    async ({ state }) => {
      overrideRow('select document,content_revision', state);
      await expect(queueCommittedExport(actorId, projectId, 'png', [], 7)).rejects.toMatchObject({
        status: 409,
      });
      expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
    }
  );
  it('reuses an existing operation only for this actor and project and writes new operations with their requested stable ID', async () => {
    const operationId = crypto.randomUUID();
    overrideRow('select id from studio_export', [{ id: operationId }]);
    expect(
      await queueCommittedExport(actorId, projectId, 'png', [legacy.pages[0].id], 7, operationId)
    ).toEqual({ id: operationId, revision: 7 });
    expect(io.query).toHaveBeenCalledWith(expect.stringContaining('requested_by_id=$3'), [
      operationId,
      projectId,
      actorId,
    ]);
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
    overrideRow('select id from studio_export', []);
    expect(
      await queueCommittedExport(actorId, projectId, 'png', [legacy.pages[0].id], 7, operationId)
    ).toEqual({ id: operationId, revision: 7 });
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into studio_export'),
      expect.arrayContaining([operationId, projectId, actorId, 'png'])
    );
    const revisionCall = io.query.mock.calls.find(([sql]) =>
      sql.startsWith('insert into studio_revision')
    )!;
    expect(revisionCall[1][2]).toEqual(document);
    expect(revisionCall[1][5]).toBe(7);
  });
  it('enforces the per-user running export limit before creating a revision', async () => {
    overrideRow('select count', [{ n: 5 }]);
    await expect(queueCommittedExport(actorId, projectId, 'png', [], 7)).rejects.toMatchObject({
      status: 429,
    });
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
  });
  it('rejects master and nested frames while preserving valid committed media in the export revision', async () => {
    const value = structuredClone(document);
    const master = createFrameNode('square');
    const nested = createFrameNode('square', {
      parentFrameId: value.nodes.find(node => node.type === 'frame')!.id,
    });
    value.nodes.push(master, nested);
    value.masterLayout.frameId = master.id;
    overrideRow('select document,content_revision', [{ document: value, content_revision: 7 }]);
    for (const frameId of [master.id, nested.id]) {
      await expect(
        queueCommittedExport(actorId, projectId, 'png', [frameId], 7)
      ).rejects.toMatchObject({ status: 400 });
    }
    const mediaDocument = structuredClone(legacy);
    const assetId = crypto.randomUUID();
    mediaDocument.pages[0].elements.push(element('image', { assetId }));
    overrideRow('select document,content_revision', [
      { document: legacyDocumentToV3(mediaDocument), content_revision: 7 },
    ]);
    await expect(
      queueCommittedExport(actorId, projectId, 'png', [legacy.pages[0].id], 7)
    ).resolves.toMatchObject({ revision: 7 });
    const revisionCall = io.query.mock.calls.find(([sql]) =>
      sql.startsWith('insert into studio_revision')
    )!;
    expect(revisionCall[1][2].nodes).toContainEqual(
      expect.objectContaining({ type: 'media', assetId })
    );
  });
  it('queues an export even when an element lies outside the selected frame', async () => {
    const result = await queueCommittedExport(actorId, projectId, 'png', [legacy.pages[0].id], 7);
    expect(result).toMatchObject({ revision: 7 });
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert into studio_export'))).toBe(
      true
    );
  });

  it('returns a clear client error for an invalid selected frame', async () => {
    await expect(
      queueCommittedExport(actorId, projectId, 'png', [crypto.randomUUID()], 7)
    ).rejects.toMatchObject({
      message: 'A selected Studio frame no longer exists or cannot be exported.',
      status: 400,
    });
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert into studio_export'))).toBe(
      false
    );
  });

  it('queues a ZIP when its video is too long for MP4 but its frames are valid', async () => {
    const longDocument = legacyDocumentToV3(createDocument('carousel', 'Long video ZIP'));
    const frames = longDocument.nodes.filter(node => node.type === 'frame').slice(0, 2);
    longDocument.deliverables[0].kind = 'video';
    longDocument.deliverables[0].frameIds = frames.map(frame => frame.id);
    for (const frame of frames) frame.duration = 31;
    io.query.mockImplementation(async (statement: string) => {
      if (statement.startsWith('select studio_access')) return [{ allowed: true }];
      if (statement.startsWith('select document,content_revision'))
        return [{ document: longDocument, content_revision: 7 }];
      if (statement.startsWith('select count')) return [{ n: 0 }];
      return [];
    });
    await expect(
      queueCommittedExport(
        actorId,
        projectId,
        'zip',
        frames.map(frame => frame.id),
        7
      )
    ).resolves.toMatchObject({ revision: 7 });
  });
});
