import { afterEach, beforeEach, it, expect, vi } from 'vitest';
const io = vi.hoisted(() => ({
  session: vi.fn(),
  sql: vi.fn(),
  access: vi.fn(),
  studioAccess: vi.fn(),
  collaborationAccess: vi.fn(),
  sign: vi.fn(),
  fetch: vi.fn(),
  auth: vi.fn(),
  user: vi.fn(),
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
vi.mock('@supabase/ssr', async original => ({
  ...(await original<typeof import('@supabase/ssr')>()),
  createServerClient: io.auth,
}));
import { privateCanvasMedia } from '../private-media';
const id = crypto.randomUUID();
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
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
it('rejects malformed identifiers and missing database rows without signing storage URLs', async () => {
  expect((await privateCanvasMedia(new Request('http://localhost:3000'), 'invalid')).status).toBe(
    404
  );
  expect(io.session).not.toHaveBeenCalled();
  io.sql.mockResolvedValueOnce([]);
  expect((await privateCanvasMedia(new Request('http://localhost:3000'), id)).status).toBe(404);
  expect(io.sign).not.toHaveBeenCalled();
});
it('requires authentication for proposal media even when its project is public', async () => {
  io.session.mockResolvedValue(null);
  expect((await privateCanvasMedia(new Request('http://localhost:3000'), id)).status).toBe(404);
  expect(io.access).not.toHaveBeenCalled();
  expect(io.sign).not.toHaveBeenCalled();
});
it.each([true, false])(
  'uses decoded SSR cookies for a verified authenticated user %s',
  async authenticated => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54361');
    vi.stubEnv('SUPABASE_ANON_KEY', 'fixture-key');
    io.session.mockResolvedValue(null);
    io.user.mockResolvedValue({ data: { user: authenticated ? { id: 'cookie-actor' } : null } });
    let received: unknown;
    io.auth.mockImplementation((_url, _key, options) => {
      received = options.cookies.getAll();
      options.cookies.setAll([{ name: 'renewed', value: 'value' }]);
      return { auth: { getUser: io.user } };
    });
    const response = await privateCanvasMedia(
      new Request('http://localhost:3000', {
        headers: { cookie: 'session=encoded%20value; blank=' },
      }),
      id
    );
    expect(received).toEqual([
      { name: 'session', value: 'encoded value' },
      { name: 'blank', value: '' },
    ]);
    expect(response.status).toBe(authenticated ? 200 : 404);
    if (authenticated)
      expect(io.access).toHaveBeenCalledWith('cookie-actor', 'project', 'draft', false, io.sql);
    else expect(io.sign).not.toHaveBeenCalled();
  }
);
it('supports empty cookie headers and avoids cookie authentication when the request already has a session', async () => {
  const request = new Request('http://localhost:3000', { headers: { cookie: '' } });
  await privateCanvasMedia(request, id);
  expect(io.auth).not.toHaveBeenCalled();
  io.session.mockResolvedValue(null);
  vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54361');
  vi.stubEnv('SUPABASE_ANON_KEY', 'fixture-key');
  io.auth.mockImplementation((_url, _key, options) => {
    expect(options.cookies.getAll()).toEqual([]);
    return { auth: { getUser: io.user } };
  });
  io.user.mockResolvedValue({ data: { user: null } });
  expect((await privateCanvasMedia(request, id)).status).toBe(404);
});
it.each(['bytes=3-4', 'bytes=2-1', 'bytes=0-1,2-3'])(
  'rejects an invalid asset byte range %s before storage signing',
  async range => {
    expect(
      (await privateCanvasMedia(new Request('http://localhost:3000', { headers: { range } }), id))
        .status
    ).toBe(416);
    expect(io.sign).not.toHaveBeenCalled();
    expect(io.fetch).not.toHaveBeenCalled();
  }
);
it('forwards a valid asset range and request signal while preserving upstream partial-response headers', async () => {
  const request = new Request('http://localhost:3000', { headers: { range: 'bytes=1-2' } });
  io.fetch.mockResolvedValueOnce(
    new Response(new Uint8Array([2, 3]), {
      status: 206,
      headers: { 'Content-Range': 'bytes 1-2/3', 'Content-Length': '2' },
    })
  );
  const response = await privateCanvasMedia(request, id);
  expect(response.status).toBe(206);
  expect(response.headers.get('Content-Range')).toBe('bytes 1-2/3');
  expect(response.headers.get('Content-Length')).toBe('2');
  expect(response.headers.get('Accept-Ranges')).toBe('bytes');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(io.fetch).toHaveBeenCalledWith('http://127.0.0.1/private-storage', {
    headers: { Range: 'bytes=1-2' },
    signal: request.signal,
  });
});
it.each(['sign-error', 'missing-url', 'upstream-error'])(
  'returns a gateway error for %s without exposing a signed URL',
  async failure => {
    if (failure === 'sign-error')
      io.sign.mockResolvedValueOnce({ error: new Error('signing down'), data: null });
    if (failure === 'missing-url') io.sign.mockResolvedValueOnce({ error: null, data: null });
    if (failure === 'upstream-error')
      io.fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const response = await privateCanvasMedia(new Request('http://localhost:3000'), id);
    expect(response.status).toBe(502);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  }
);
it.each([undefined, 'file.unknown', 'Entwurf "Öffentlich"\\.PDF'])(
  'sanitizes the fallback or Unicode export filename %s',
  async fileName => {
    io.sql.mockResolvedValue([
      {
        project_id: 'project',
        workspace_id: null,
        storage_path: 'private/export',
        file_name: fileName,
      },
    ]);
    io.fetch.mockResolvedValueOnce(new Response(new Uint8Array([1]), { headers: {} }));
    const response = await privateCanvasMedia(new Request('http://localhost:3000'), id, 'export');
    expect(response.headers.get('Content-Type')).toBe(
      fileName?.endsWith('.PDF') ? 'application/pdf' : 'application/octet-stream'
    );
    expect(response.headers.get('Content-Disposition')).toContain(
      `filename*=UTF-8''${encodeURIComponent(fileName ?? 'Polity-export')}`
    );
    expect(response.headers.get('Content-Length')).toBeNull();
    expect(response.headers.get('Content-Range')).toBeNull();
  }
);
it.each(['bytes=0-1', 'invalid'])(
  'validates an export byte range %s without consulting an asset byte size',
  async range => {
    io.sql.mockResolvedValue([
      {
        project_id: 'project',
        workspace_id: null,
        storage_path: 'private/export',
        file_name: 'Deck.pdf',
      },
    ]);
    const response = await privateCanvasMedia(
      new Request('http://localhost:3000', { headers: { range } }),
      id,
      'export'
    );
    expect(response.status).toBe(range === 'invalid' ? 416 : 200);
    expect(io.sign).toHaveBeenCalledTimes(range === 'invalid' ? 0 : 1);
  }
);
