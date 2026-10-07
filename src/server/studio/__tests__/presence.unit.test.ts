import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  enabled: vi.fn(),
  query: vi.fn(),
  workspace: vi.fn(),
  access: vi.fn(),
  channel: vi.fn(),
  send: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  canvasEnabled: io.enabled,
  studioTransaction: async (body: (sql: unknown) => Promise<unknown>) => body(io.query),
  assertStudioCollaborationAccess: io.access,
}));
vi.mock('../workspace-access', () => ({ assertCanvasWorkspace: io.workspace }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ channel: io.channel, removeChannel: io.remove }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-07T00:00:00Z'));
  io.enabled.mockReturnValue(true);
  io.workspace.mockResolvedValue(undefined);
  io.access.mockResolvedValue(undefined);
  io.query.mockImplementation(async (parts: TemplateStringsArray) =>
    parts.join('').includes('select first_name')
      ? [{ first_name: 'Ada', last_name: 'Lovelace', avatar: 'avatar.png' }]
      : [{ allowed: true }]
  );
  io.send.mockResolvedValue({ success: true });
  io.channel.mockImplementation(() => ({ httpSend: io.send }));
  io.remove.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
describe('Transient Studio canvas presence', () => {
  it('requires preview enablement, valid input and current workspace and collaboration rights', async () => {
    const { canvasPresence } = await import('../presence');
    const actor = crypto.randomUUID(),
      projectId = crypto.randomUUID();
    io.enabled.mockReturnValue(false);
    await expect(canvasPresence(actor, { projectId })).rejects.toMatchObject({ status: 404 });
    io.enabled.mockReturnValue(true);
    await expect(canvasPresence(actor, { projectId: 'invalid' })).rejects.toThrow();
    io.workspace.mockRejectedValueOnce(new Error('workspace denied'));
    await expect(canvasPresence(actor, { projectId })).rejects.toThrow('workspace denied');
    io.access.mockRejectedValueOnce(new Error('collaboration denied'));
    await expect(canvasPresence(actor, { projectId })).rejects.toThrow('collaboration denied');
    expect(io.channel).not.toHaveBeenCalled();
  });
  it('publishes private per-user peers with cursor and selection while excluding each recipient', async () => {
    const { canvasPresence } = await import('../presence');
    const actor = crypto.randomUUID(),
      other = crypto.randomUUID(),
      projectId = crypto.randomUUID(),
      workspaceId = crypto.randomUUID(),
      pageId = crypto.randomUUID();
    expect(
      await canvasPresence(actor, {
        projectId,
        workspaceId,
        cursor: { pageId, x: 12, y: 34 },
        selection: ['node'],
      })
    ).toEqual({ peers: [] });
    const result = await canvasPresence(other, { projectId, workspaceId });
    expect(result.peers).toEqual([
      expect.objectContaining({
        userId: actor,
        cursor: { pageId, x: 12, y: 34 },
        selection: ['node'],
        user: {
          id: actor,
          name: 'Ada Lovelace',
          firstName: 'Ada',
          lastName: 'Lovelace',
          avatar: 'avatar.png',
          color: '#B88A3B',
        },
      }),
    ]);
    expect(io.channel).toHaveBeenCalledWith(`canvas-user:${projectId}:${workspaceId}:${actor}`, {
      config: { private: true },
    });
    expect(io.send).toHaveBeenLastCalledWith('peers', { peers: result.peers }, { timeout: 2000 });
    expect(io.remove).toHaveBeenCalledTimes(3);
    expect(io.workspace).toHaveBeenCalledWith(other, projectId, workspaceId, false, io.query);
  });
  it('expires inactive peers and empty rooms while isolating projects and workspaces', async () => {
    const { canvasPresence } = await import('../presence');
    const actor = crypto.randomUUID(),
      other = crypto.randomUUID(),
      projectId = crypto.randomUUID(),
      otherProject = crypto.randomUUID();
    await canvasPresence(actor, { projectId });
    expect((await canvasPresence(other, { projectId: otherProject })).peers).toEqual([]);
    vi.advanceTimersByTime(15_001);
    expect((await canvasPresence(other, { projectId })).peers).toEqual([]);
    expect(
      (await canvasPresence(actor, { projectId, workspaceId: crypto.randomUUID() })).peers
    ).toEqual([]);
  });
  it.each([{ userRows: [] }, { userRows: [{ first_name: null, last_name: null, avatar: null }] }])(
    'uses safe user fallbacks for missing profile details %j',
    async ({ userRows }) => {
      io.query.mockImplementation(async (parts: TemplateStringsArray) =>
        parts.join('').includes('select first_name') ? userRows : [{ allowed: true }]
      );
      const { canvasPresence } = await import('../presence');
      const actor = crypto.randomUUID(),
        projectId = crypto.randomUUID();
      await canvasPresence(actor, { projectId });
      const { peers } = await canvasPresence(crypto.randomUUID(), { projectId });
      expect(peers[0].user).toEqual({
        id: actor,
        name: 'Polity',
        firstName: null,
        lastName: null,
        avatar: null,
        color: '#B88A3B',
      });
    }
  );
  it('removes revoked peers before broadcasting their presence', async () => {
    const { canvasPresence } = await import('../presence');
    const actor = crypto.randomUUID(),
      projectId = crypto.randomUUID();
    await canvasPresence(actor, { projectId });
    const original = io.query.getMockImplementation()!;
    io.query.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.join('').includes('studio_collaboration_access')
        ? [{ allowed: values[0] !== actor }]
        : original(parts, ...values)
    );
    expect((await canvasPresence(crypto.randomUUID(), { projectId })).peers).toEqual([]);
    expect(io.send).toHaveBeenLastCalledWith('peers', { peers: [] }, { timeout: 2000 });
  });
  it('removes broadcast channels after failed delivery and thrown transport errors', async () => {
    const { canvasPresence } = await import('../presence');
    const actor = crypto.randomUUID(),
      projectId = crypto.randomUUID();
    io.send.mockResolvedValueOnce({ success: false });
    await expect(canvasPresence(actor, { projectId })).rejects.toMatchObject({ status: 503 });
    expect(io.remove).toHaveBeenCalledTimes(1);
    io.send.mockRejectedValueOnce(new Error('transport failed'));
    await expect(canvasPresence(actor, { projectId })).rejects.toThrow('transport failed');
    expect(io.remove).toHaveBeenCalledTimes(2);
  });
});
