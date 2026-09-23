import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  session: vi.fn(),
  sql: vi.fn(),
  access: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: io.session }));
vi.mock('../db', () => ({ studioSql: () => io.sql, assertStudioAccess: io.access }));
import { readStudioProject } from '../read';

const id = 'c9000000-0000-4000-8000-000000000001';
const project = {
  id,
  title: 'Open design',
  kind: 'single',
  group_id: null,
  owner_id: 'owner',
  visibility: 'public',
  document: { nodes: [] },
};

beforeEach(() => {
  vi.resetAllMocks();
  io.session.mockResolvedValue(null);
  io.access.mockResolvedValue(undefined);
  io.sql
    .mockResolvedValueOnce([project])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ can_edit: false }]);
});

describe('Studio read snapshot', () => {
  it('allows a guest to load a public canonical document without editor authority', async () => {
    const response = await readStudioProject(new Request('http://localhost/'), id);
    expect(response.status).toBe(200);
    expect(io.access).toHaveBeenCalledWith(null, id, false, io.sql);
    expect(await response.json()).toMatchObject({
      project: { title: 'Open design', canEdit: false },
      document: { nodes: [] },
      assets: [],
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns no project metadata when access is denied', async () => {
    io.access.mockRejectedValue(new Error('denied'));
    const response = await readStudioProject(new Request('http://localhost/'), id);
    expect(response.status).toBe(404);
    expect(io.sql).not.toHaveBeenCalled();
  });

  it('uses the authenticated identity to check a private document', async () => {
    io.session.mockResolvedValue({ user: { id: 'owner' } });
    io.sql
      .mockReset()
      .mockResolvedValueOnce([project])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ can_edit: true }]);
    const response = await readStudioProject(new Request('http://localhost/'), id);
    expect(io.access).toHaveBeenCalledWith('owner', id, false, io.sql);
    expect((await response.json()).project.canEdit).toBe(true);
  });
});
