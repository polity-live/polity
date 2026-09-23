import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  getPublicUrl: vi.fn(),
  download: vi.fn(),
}));

vi.mock('@/server/studio/db', () => ({ studioSql: () => mocks.sql }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        getPublicUrl: mocks.getPublicUrl,
        download: mocks.download,
      }),
    },
  }),
}));

import { resolveOwnedUploadAttachment } from '../upload-attachments';

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.getPublicUrl.mockReset();
  mocks.download.mockReset();
});

it('rebuilds an owned upload from storage metadata and bounded text content', async () => {
  mocks.sql.mockResolvedValue([
    {
      name: 'editor-uploads/1700000000000-report.txt',
      owner_id: 'actor',
      metadata: { mimetype: 'text/plain', size: 12 },
    },
  ]);
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://storage.test/report.txt' } });
  mocks.download.mockResolvedValue({ data: new Blob(['Server content']) });

  await expect(
    resolveOwnedUploadAttachment('actor', 'editor-uploads/1700000000000-report.txt')
  ).resolves.toMatchObject({
    entityType: 'document',
    title: 'report.txt',
    subtitle: 'text/plain · 12 B',
    prompt_context: expect.stringContaining('Server content'),
    card_data_json: expect.stringContaining('https://storage.test/report.txt'),
  });
});

it('rejects another user’s object and malformed upload paths', async () => {
  mocks.sql.mockResolvedValue([
    {
      name: 'editor-uploads/1700000000000-private.pdf',
      owner_id: 'other-user',
      metadata: { mimetype: 'application/pdf', size: 10 },
    },
  ]);

  await expect(
    resolveOwnedUploadAttachment('actor', 'editor-uploads/1700000000000-private.pdf')
  ).resolves.toBeNull();
  await expect(resolveOwnedUploadAttachment('actor', '../private.pdf')).resolves.toBeNull();
  expect(mocks.getPublicUrl).not.toHaveBeenCalled();
});
