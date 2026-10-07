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
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://storage.test/file' } });
  mocks.download.mockResolvedValue({ data: null });
});

it.each([
  ['editor-uploads/123-R%C3%A9sum%C3%A9.png', 'Résumé.png', 'image/png', 2048, '2 KB', 'image'],
  [
    'editor-uploads/123-bad%ZZ.json',
    'bad%ZZ.json',
    'application/json',
    2 * 1024 * 1024,
    '2.0 MB',
    'file',
  ],
  ['editor-uploads/', 'Datei', '', 0, '0 B', 'file'],
  ['editor-uploads/123-', 'Datei', 'application/xml', 16, '16 B', 'file'],
])(
  'rebuilds filename and preview from server metadata for %s',
  async (name, title, mime, size, formattedSize, previewType) => {
    mocks.sql.mockResolvedValue([{ name, owner_id: 'actor', metadata: { mimetype: mime, size } }]);
    const result = await resolveOwnedUploadAttachment('actor', name);
    expect(result).toMatchObject({
      title,
      subtitle: `${mime || 'application/octet-stream'} · ${formattedSize}`,
    });
    expect(JSON.parse(result!.card_data_json!)).toMatchObject({
      fileName: title,
      previewType,
      fileSize: size,
    });
    expect(result!.prompt_context).not.toContain('Content:');
  }
);
it.each([null, {}, { mimetype: 1, size: '999' }, { mimetype: '', size: Infinity }])(
  'falls back safely for malformed optional storage metadata %j',
  async metadata => {
    mocks.sql.mockResolvedValue([{ name: 'editor-uploads/file', owner_id: 'actor', metadata }]);
    const result = await resolveOwnedUploadAttachment('actor', 'editor-uploads/file');
    expect(result).toMatchObject({ subtitle: 'application/octet-stream · 0 B' });
    expect(mocks.download).not.toHaveBeenCalled();
  }
);
it.each(['application/json', 'application/xml', 'application/rtf'])(
  'extracts bounded text for %s and omits empty downloads',
  async mimetype => {
    const name = 'editor-uploads/file';
    mocks.sql.mockResolvedValue([
      { name, owner_id: 'actor', metadata: { mimetype, size: 80_000 } },
    ]);
    mocks.download.mockResolvedValueOnce({ data: new Blob(['X'.repeat(80_001)]) });
    const result = await resolveOwnedUploadAttachment('actor', name);
    expect(result!.prompt_context!.split('Content:\n')[1]).toHaveLength(80_000);
    expect((await resolveOwnedUploadAttachment('actor', name))!.prompt_context).not.toContain(
      'Content:'
    );
  }
);
it('rejects traversal inside the upload prefix and missing storage objects', async () => {
  expect(await resolveOwnedUploadAttachment('actor', 'editor-uploads/../private')).toBeNull();
  expect(mocks.sql).not.toHaveBeenCalled();
  mocks.sql.mockResolvedValue([]);
  expect(await resolveOwnedUploadAttachment('actor', 'editor-uploads/missing')).toBeNull();
  expect(mocks.getPublicUrl).not.toHaveBeenCalled();
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
