import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  run: vi.fn(),
  load: vi.fn(),
  access: vi.fn(),
  active: vi.fn(),
}));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (id: string) => id,
  executeZeroTransaction: (_ctx: unknown, body: (tx: unknown) => unknown) =>
    body({ location: 'server', run: io.run, dbTransaction: { query: io.query } }),
}));
vi.mock('../service', () => ({ authorizeStored: io.access }));
vi.mock('../store', async original => ({
  ...(await original<typeof import('../store')>()),
  loadStored: io.load,
}));
vi.mock('../transaction', async original => ({
  ...(await original<typeof import('../transaction')>()),
  assertActive: io.active,
}));
import { changeComment, listComments, commentOperationSchema, commentAnchor } from '../comments';
let stored: any, receipt: any, comments: any[], access: any;
const content = [{ id: 'p', type: 'p', children: [{ text: 'Discussion', comment_thread: true }] }];
const input = () =>
  commentOperationSchema.parse({ id: 'comment', threadId: 'thread', expectedRevision: 0, content });
beforeEach(() => {
  vi.clearAllMocks();
  stored = null;
  receipt = null;
  comments = [];
  access = { amendmentId: null, capabilities: { comment: true, manage: false } };
  io.access.mockImplementation(async () => access);
  io.load.mockResolvedValue({
    id: 'doc',
    generation: 'current',
    kind: 'document',
    branch_id: null,
    projection: content,
  });
  io.run.mockResolvedValue(null);
  io.query.mockImplementation(async (sql: string, p: any[]) => {
    if (sql.startsWith('select * from collaboration_command')) return receipt ? [receipt] : [];
    if (sql.includes('for update')) return stored ? [stored] : [];
    if (sql.startsWith('select * from collaboration_comment')) return comments;
    if (sql.startsWith('insert into collaboration_comment('))
      return [
        {
          id: p[1],
          thread_id: p[2],
          author_id: p[3],
          content: p[4],
          anchor: p[5],
          deleted: p[6],
          resolved: p[7],
          created_at: p[8],
          change_request_id: p[9],
          visibility: p[10],
          revision: Number(stored?.revision ?? 0) + 1,
        },
      ];
    return [];
  });
});
describe('scoped durable comment commands', () => {
  it('prevents a fresh reply identity from widening the scope of an existing private thread', async () => {
    comments = [
      { thread_id: 'thread', change_request_id: null, visibility: 'collaborators', deleted: true },
    ];
    await expect(changeComment('author', 'doc', 'current', 'reply', input())).rejects.toThrow(
      'comment_scope_immutable'
    );
    expect(io.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
    const saved: any = await changeComment('author', 'doc', 'current', 'private-reply', {
      ...input(),
      visibility: 'collaborators',
    });
    expect(saved.visibility).toBe('collaborators');
    comments[0].change_request_id = 'some-proposal';
    await expect(
      changeComment('author', 'doc', 'current', 'changed-proposal', {
        ...input(),
        visibility: 'collaborators',
      })
    ).rejects.toThrow('comment_scope_immutable');
  });
  it('retains an orphan anchor when a legacy discussion no longer has a valid text target', () => {
    expect(
      commentAnchor([null, 1, 'removed', { children: [{ text: 'Unmarked' }] }], 'thread')
    ).toEqual({ nodeId: undefined, mark: 'thread' });
  });
  it('shows private comments to authorized document editors but excludes them from public readers', async () => {
    comments = [
      {
        id: 'public',
        thread_id: 'thread',
        anchor: { mark: 'thread' },
        revision: '1',
        visibility: 'document',
      },
      {
        id: 'internal',
        thread_id: 'thread',
        anchor: { mark: 'thread' },
        revision: '2',
        visibility: 'collaborators',
      },
      {
        id: 'orphan',
        thread_id: 'deleted-target',
        anchor: { mark: 'deleted-target' },
        revision: 1,
        visibility: 'document',
      },
    ];
    expect(await listComments('editor', 'doc', 'current')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'internal', revision: 2, orphaned: false }),
        expect.objectContaining({ id: 'orphan', orphaned: true }),
      ])
    );
    access.capabilities.comment = false;
    expect((await listComments('reader', 'doc', 'current')).map(c => c.id)).toEqual([
      'public',
      'orphan',
    ]);
  });
  it('keeps amendment membership and authorized proposal visibility independent of public access', async () => {
    access.amendmentId = 'amendment';
    comments = [
      { id: 'internal', anchor: {}, thread_id: 'thread', revision: 1, visibility: 'collaborators' },
      { id: 'allowed', anchor: {}, revision: 1, change_request_id: 'visible' },
      { id: 'hidden', anchor: {}, revision: 1, change_request_id: 'secret' },
    ];
    io.run.mockResolvedValueOnce([{ id: 'visible' }]).mockResolvedValueOnce(null);
    expect((await listComments('reader', 'doc', 'current')).map(c => c.id)).toEqual(['allowed']);
    io.run.mockResolvedValueOnce([{ id: 'visible' }]).mockResolvedValueOnce({ id: 'membership' });
    expect((await listComments('member', 'doc', 'current')).map(c => c.id)).toEqual([
      'internal',
      'allowed',
    ]);
  });
  it('preserves author and scope while appending revision history and a bound command receipt', async () => {
    const saved: any = await changeComment('author', 'doc', 'current', 'operation', input());
    expect(saved).toMatchObject({
      author_id: 'author',
      revision: 1,
      anchor: { nodeId: 'p', mark: 'thread' },
    });
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into collaboration_comment_history'),
      expect.arrayContaining(['author', saved])
    );
    const command = io.query.mock.calls.find(([q]) =>
      q.startsWith('insert into collaboration_command')
    )!;
    receipt = { actor_id: command[1][2], request_hash: command[1][3], result: saved };
    io.query.mockClear();
    expect(
      await changeComment('author', 'doc', 'stale-but-already-saved', 'operation', input())
    ).toEqual(saved);
    expect(io.query.mock.calls.some(([q]) => q.startsWith('insert'))).toBe(false);
    await expect(changeComment('other', 'doc', 'current', 'operation', input())).rejects.toThrow(
      'operation_id_reused'
    );
    await expect(
      changeComment('author', 'doc', 'current', 'operation', { ...input(), resolved: true })
    ).rejects.toThrow('operation_id_reused');
  });
  it('rejects stale generations, missing rights, foreign authors and concurrent comment revisions', async () => {
    await expect(changeComment('author', 'doc', 'old', 'operation', input())).rejects.toThrow(
      'generation_changed'
    );
    access.capabilities.comment = false;
    await expect(changeComment('author', 'doc', 'current', 'operation', input())).rejects.toThrow(
      'comment_denied'
    );
    access.capabilities.comment = true;
    stored = { author_id: 'other', revision: 2 };
    await expect(changeComment('author', 'doc', 'current', 'operation', input())).rejects.toThrow(
      'comment_author_required'
    );
    access.capabilities.manage = true;
    await expect(changeComment('author', 'doc', 'current', 'operation', input())).rejects.toThrow(
      'comment_revision_changed'
    );
    expect(io.query.mock.calls.some(([q]) => q.startsWith('insert'))).toBe(false);
  });
  it('prevents moving an existing discussion into another thread, proposal or visibility', async () => {
    stored = {
      author_id: 'author',
      revision: 0,
      thread_id: 'another',
      change_request_id: null,
      visibility: 'document',
    };
    await expect(changeComment('author', 'doc', 'current', 'operation', input())).rejects.toThrow(
      'comment_thread_immutable'
    );
    stored.thread_id = 'thread';
    await expect(
      changeComment('author', 'doc', 'current', 'operation', {
        ...input(),
        visibility: 'collaborators',
      })
    ).rejects.toThrow('comment_scope_immutable');
    stored.anchor = { mark: 'original', nodeId: 'removed' };
    expect(
      await changeComment('author', 'doc', 'current', 'operation', { ...input(), deleted: true })
    ).toMatchObject({ deleted: true, anchor: stored.anchor });
  });
  it('requires an accessible proposal in the same branch before attaching a comment', async () => {
    const change = { ...input(), changeRequestId: crypto.randomUUID() };
    await expect(changeComment('author', 'doc', 'current', 'operation', change)).rejects.toThrow(
      'comment_scope_invalid'
    );
    access.amendmentId = 'amendment';
    await expect(changeComment('author', 'doc', 'current', 'operation', change)).rejects.toThrow(
      'comment_scope_invalid'
    );
    io.run.mockResolvedValue({ process_branch_id: 'other' });
    await expect(changeComment('author', 'doc', 'current', 'operation', change)).rejects.toThrow(
      'comment_scope_invalid'
    );
    io.run.mockResolvedValue({ process_branch_id: null });
    expect(await changeComment('author', 'doc', 'current', 'operation', change)).toMatchObject({
      change_request_id: change.changeRequestId,
    });
  });
  it('anchors Streetdesign comments to existing objects and keeps deleted targets visibly orphaned', async () => {
    const change = { ...input(), objectId: 'tree' };
    await expect(changeComment('author', 'doc', 'current', 'operation', change)).rejects.toThrow(
      'comment_target_missing'
    );
    io.load.mockResolvedValue({ generation: 'current', kind: 'city', projection: { objects: [] } });
    await expect(changeComment('author', 'doc', 'current', 'operation', change)).rejects.toThrow(
      'comment_target_missing'
    );
    io.load.mockResolvedValue({
      generation: 'current',
      kind: 'city',
      projection: { objects: [{ id: 'tree' }] },
    });
    const saved = await changeComment('author', 'doc', 'current', 'operation', change);
    comments = [saved];
    expect(await listComments('author', 'doc', 'current')).toEqual([
      expect.objectContaining({ orphaned: false }),
    ]);
    io.load.mockResolvedValue({ generation: 'current', kind: 'city', projection: {} });
    expect(await listComments('author', 'doc', 'current')).toEqual([
      expect.objectContaining({ orphaned: true }),
    ]);
  });
  it('rejects oversized comment content before inserting anything', async () => {
    await expect(
      changeComment('author', 'doc', 'current', 'operation', {
        ...input(),
        content: [{ type: 'p', children: [{ text: 'x'.repeat(100001) }] }],
      })
    ).rejects.toThrow('comment_too_large');
    expect(io.query.mock.calls.some(([q]) => q.startsWith('insert'))).toBe(false);
  });
});
