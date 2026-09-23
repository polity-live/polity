import { beforeEach, it, expect, vi } from 'vitest';
const io = vi.hoisted(() => ({
  session: vi.fn(),
  sql: vi.fn(),
  access: vi.fn(),
  studioAccess: vi.fn(),
  collaborationAccess: vi.fn(),
  sign: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  getSession: io.session,
  createClient: () => ({ storage: { from: () => ({ createSignedUrl: io.sign }) } }),
}));
vi.mock('../db', () => ({
  studioSql: () => io.sql,
  assertStudioAccess: io.studioAccess,
  assertStudioCollaborationAccess: io.collaborationAccess,
}));
vi.mock('../workspace-access', () => ({ assertCanvasWorkspace: io.access }));
import { privateCanvasMedia } from '../private-media';
const id = crypto.randomUUID();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', io.fetch);
  io.session.mockResolvedValue({ user: { id: 'actor' } });
  io.access.mockResolvedValue(undefined);
  io.studioAccess.mockResolvedValue(undefined);
  io.collaborationAccess.mockResolvedValue(undefined);
  io.sql.mockResolvedValue([
    {
      project_id: 'project',
      workspace_id: 'draft',
      storage_path: 'private/file',
      mime_type: 'image/png',
      byte_size: 3,
    },
  ]);
  io.sign.mockResolvedValue({
    data: { signedUrl: 'http://127.0.0.1/private-storage' },
    error: null,
  });
  io.fetch.mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Length': '3' } })
  );
});
it('checks the current workspace before serving uncached bytes without exposing a storage URL', async () => {
  const response = await privateCanvasMedia(
    new Request(`http://localhost:3000/api/studio/media/${id}`),
    id
  );
  expect(response.status).toBe(200);
  expect(io.access).toHaveBeenCalledWith('actor', 'project', 'draft', false, io.sql);
  expect(response.headers.get('Location')).toBeNull();
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});
it('rejects the same asset URL after access is withdrawn before contacting storage', async () => {
  io.access.mockRejectedValue(new Error('revoked'));
  expect((await privateCanvasMedia(new Request('http://localhost:3000'), id)).status).toBe(404);
  expect(io.sign).not.toHaveBeenCalled();
  expect(io.fetch).not.toHaveBeenCalled();
});
it('serves canonical public media to guests and rechecks access for every request', async () => {
  io.session.mockResolvedValue(null);
  io.sql.mockResolvedValue([
    {
      project_id: 'project',
      workspace_id: null,
      storage_path: 'public/file',
      mime_type: 'image/png',
      byte_size: 3,
    },
  ]);
  const request = new Request(`http://localhost:3000/api/studio/media/${id}`);
  expect((await privateCanvasMedia(request, id)).status).toBe(200);
  expect(io.studioAccess).toHaveBeenCalledWith(null, 'project', false, io.sql);
  io.studioAccess.mockRejectedValue(new Error('visibility changed'));
  expect((await privateCanvasMedia(request, id)).status).toBe(404);
  expect(io.sign).toHaveBeenCalledTimes(1);
});
it('rechecks export downloads and sends an attachment without exposing a reusable storage link', async () => {
  io.sql.mockResolvedValue([
    {
      project_id: 'project',
      workspace_id: null,
      storage_path: 'private/export',
      file_name: 'Polity.pdf',
    },
  ]);
  const response = await privateCanvasMedia(new Request('http://localhost:3000'), id, 'export');
  expect(response.headers.get('Content-Disposition')).toBe(
    'attachment; filename="Polity.pdf"; filename*=UTF-8\'\'Polity.pdf'
  );
  expect(response.headers.get('Content-Type')).toBe('application/pdf');
  expect(io.collaborationAccess).toHaveBeenCalledWith('actor', 'project', io.sql);
  io.collaborationAccess.mockRejectedValue(new Error('revoked'));
  expect(
    (await privateCanvasMedia(new Request('http://localhost:3000'), id, 'export')).status
  ).toBe(404);
});
it('keeps export downloads internal even when a project is public', async () => {
  io.session.mockResolvedValue(null);
  io.sql.mockResolvedValue([
    {
      project_id: 'project',
      workspace_id: null,
      storage_path: 'private/export',
      file_name: 'Polity.pdf',
    },
  ]);
  expect(
    (await privateCanvasMedia(new Request('http://localhost:3000'), id, 'export')).status
  ).toBe(404);
  expect(io.studioAccess).not.toHaveBeenCalled();
  expect(io.sign).not.toHaveBeenCalled();
});
it.each([
  ['Deck.zip', 'application/zip'],
  ['Deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['Deck.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['Frame.png', 'image/png'],
  ['Clip.mp4', 'video/mp4'],
])('serves %s with a downloadable filename and its actual MIME type', async (fileName, mime) => {
  io.sql.mockResolvedValue([
    {
      project_id: 'project',
      workspace_id: null,
      storage_path: 'private/export',
      file_name: fileName,
    },
  ]);
  const response = await privateCanvasMedia(new Request('http://localhost:3000'), id, 'export');
  expect(response.headers.get('Content-Type')).toBe(mime);
  expect(response.headers.get('Content-Disposition')).toContain(`filename="${fileName}"`);
});
