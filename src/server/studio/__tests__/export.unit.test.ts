import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
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
    ).rejects.toMatchObject({ message: 'A selected Studio frame no longer exists.', status: 400 });
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert into studio_export'))).toBe(
      false
    );
  });
});
