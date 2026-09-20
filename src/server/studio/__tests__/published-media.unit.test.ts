import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  session: vi.fn(),
  sql: vi.fn(),
  access: vi.fn(),
  visible: vi.fn(),
  info: vi.fn(),
  sign: vi.fn(),
  cookieUser: vi.fn(),
  cookies: vi.fn(),
  client: vi.fn(),
  queryAccess: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  getSession: io.session,
  createClient: () => ({ storage: { from: () => ({ info: io.info, createSignedUrl: io.sign }) } }),
}));
vi.mock('../db', () => ({ studioSql: () => io.sql, assertStudioAccess: io.access }));
vi.mock('@/server/zero-mutate', () => ({ executeZeroRead: io.visible }));
vi.mock('@supabase/ssr', () => ({
  parseCookieHeader: io.cookies,
  createServerClient: io.client,
}));
vi.mock('@/lib/env', () => ({ getRequiredEnvVar: (_value: unknown, name: string) => name }));
vi.mock('@/zero/rbac/query-access', () => ({ applyStatementQueryAccess: io.queryAccess }));
import { publishedStudioMedia } from '../published-media';
const id = '44111111-1111-4111-8111-111111111111';
const request = (headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000/api/studio/published-media/${id}`, { headers });
beforeEach(() => {
  vi.clearAllMocks();
  io.session.mockResolvedValue(null);
  io.sql.mockResolvedValue([
    { project_id: id, storage_path: 'exports/file.png', file_name: 'file.png' },
  ]);
  io.visible.mockResolvedValue([{ id: 'public-statement' }]);
  io.info.mockResolvedValue({ data: { size: 80 }, error: null });
  io.sign.mockResolvedValue({
    data: { signedUrl: 'http://127.0.0.1:54321/storage/private' },
    error: null,
  });
  io.access.mockResolvedValue(undefined);
  io.cookies.mockReturnValue([{ name: 'auth', value: 'session' }, { name: 'empty' }]);
  io.cookieUser.mockResolvedValue({ data: { user: { id: 'cookie-reader' } } });
  io.client.mockImplementation((_url, _key, { cookies }) => {
    expect(cookies.getAll()).toEqual([
      { name: 'auth', value: 'session' },
      { name: 'empty', value: '' },
    ]);
    cookies.setAll([]);
    return { auth: { getUser: io.cookieUser } };
  });
  io.queryAccess.mockImplementation(() => ({
    where: (body: any) => {
      body({ or: (...args: any[]) => args, cmp: (...args: any[]) => args });
      return { limit: () => 'visibility-query' };
    },
  }));
});
describe('published Studio media access and byte ranges', () => {
  it('authenticates native media cookies and falls back to current public visibility when cookie renewal returns no user', async () => {
    expect((await publishedStudioMedia(request({ Cookie: 'auth=session' }), id)).status).toBe(307);
    expect(io.access).toHaveBeenCalledWith('cookie-reader', id);
    expect(io.visible).not.toHaveBeenCalled();
    io.cookieUser.mockResolvedValue({ data: { user: null } });
    io.visible.mockImplementation(async body =>
      body({
        run: (query: unknown) => {
          expect(query).toBe('visibility-query');
          return [{ id: 'publication' }];
        },
      })
    );
    expect((await publishedStudioMedia(request({ Cookie: 'expired=session' }), id)).status).toBe(
      307
    );
    expect(io.queryAccess).toHaveBeenCalledWith(expect.anything(), undefined, expect.any(Number));
    io.session.mockResolvedValue({ user: { id: 'private-reader' } });
    io.access.mockRejectedValueOnce(new Error('revoked'));
    await publishedStudioMedia(request(), id);
    expect(io.queryAccess).toHaveBeenLastCalledWith(
      expect.anything(),
      'private-reader',
      expect.any(Number)
    );
  });
  it('returns private no-store redirects only after statement visibility is established', async () => {
    const response = await publishedStudioMedia(request(), id);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://127.0.0.1:54321/storage/private');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(io.visible).toHaveBeenCalledOnce();
    expect(io.info).not.toHaveBeenCalled();
    expect(io.sign).toHaveBeenCalledWith('exports/file.png', 30);
  });
  it('validates ranges using current storage metadata even when the application database is an isolated copy', async () => {
    expect((await publishedStudioMedia(request({ Range: 'bytes=0-15' }), id)).status).toBe(307);
    expect(io.info).toHaveBeenCalledWith('exports/file.png');
    expect(io.sql).toHaveBeenCalledOnce();
    io.sign.mockClear();
    const invalid = await publishedStudioMedia(request({ Range: 'bytes=80-' }), id);
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get('Content-Range')).toBe('bytes */80');
    expect(io.sign).not.toHaveBeenCalled();
  });
  it('does not disclose media or storage metadata after group access is revoked and no visible publication exists', async () => {
    io.session.mockResolvedValue({ user: { id: 'removed-member' } });
    io.access.mockRejectedValue(new Error('access_denied'));
    io.visible.mockResolvedValue([]);
    expect((await publishedStudioMedia(request({ Range: 'bytes=0-5' }), id)).status).toBe(404);
    expect(io.sign).not.toHaveBeenCalled();
    expect(io.info).not.toHaveBeenCalled();
  });
  it('hides missing or unsupported exports and missing storage objects without issuing a URL', async () => {
    expect((await publishedStudioMedia(request(), 'not-a-uuid')).status).toBe(404);
    expect(io.sql).not.toHaveBeenCalled();
    io.sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ storage_path: 'x', file_name: 'deck.pptx' }]);
    expect((await publishedStudioMedia(request(), id)).status).toBe(404);
    expect((await publishedStudioMedia(request(), id)).status).toBe(404);
    io.info.mockResolvedValue({ data: null, error: new Error('missing') });
    expect((await publishedStudioMedia(request({ Range: 'bytes=0-1' }), id)).status).toBe(404);
    expect(io.sign).not.toHaveBeenCalled();
  });
  it('allows an authorized private project reader but still fails closed when URL signing fails', async () => {
    io.session.mockResolvedValue({ user: { id: 'member' } });
    io.sign.mockResolvedValue({ data: null, error: new Error('storage_unavailable') });
    expect((await publishedStudioMedia(request(), id)).status).toBe(404);
    expect(io.access).toHaveBeenCalledWith('member', id);
    expect(io.visible).not.toHaveBeenCalled();
  });
});
