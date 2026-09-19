import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateComments } from '../migrate-comments';
const author = '3a9e3a59-00f6-4ad4-9767-085c0ba75ed4',
  proposal = 'c5ff67a2-3363-4b84-ade8-f0e8f948a9c2';
const content = [
  { id: 'p', type: 'p', children: [{ text: 'Historical comment', comment_thread: true }] },
];
const doc: any = { id: 'doc', entity_id: 'entity', projection: content };
const query = vi.fn();
let authorRows: any[], saved: any[], linked: any[], thread: any;
beforeEach(() => {
  vi.clearAllMocks();
  authorRows = [{ id: author }];
  saved = [{ id: 'comment', author_id: author }];
  linked = [{ id: proposal }];
  thread = {
    id: 'thread',
    comments: [
      { id: 'comment', userId: author, createdAt: '2025-01-02T12:00:00Z', contentRich: content },
    ],
  };
  query.mockImplementation(async (sql: string) =>
    sql.startsWith('select c.id')
      ? linked
      : sql.startsWith('select id from "user"')
        ? authorRows
        : sql.startsWith('insert into collaboration_comment(')
          ? saved
          : []
  );
});
describe('legacy discussion migration', () => {
  it('retains original authors, timestamps, identifiers, proposal scope and stable anchors', async () => {
    thread.visibilityScope = 'collaborators';
    thread.isResolved = true;
    await migrateComments({ query }, doc, [thread]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into collaboration_comment('),
      [
        'doc',
        'comment',
        'thread',
        author,
        content,
        { nodeId: 'p', mark: 'thread' },
        true,
        Date.parse('2025-01-02T12:00:00Z'),
        proposal,
        'collaborators',
      ]
    );
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('insert into collaboration_comment_history'),
      ['doc', 'comment', author, saved[0], Date.parse('2025-01-02T12:00:00Z')]
    );
  });
  it('uses explicit proposal links and preserves unanchored ordinary discussions', async () => {
    thread.changeRequestEntityId = proposal;
    thread.comments[0].createdAt = 1735819200000;
    await migrateComments({ query }, { ...doc, projection: [] }, [thread]);
    expect(query.mock.calls.some(([sql]) => sql.startsWith('select c.id'))).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into collaboration_comment('),
      expect.arrayContaining([{ nodeId: undefined, mark: 'thread' }, false, proposal, 'document'])
    );
    delete thread.changeRequestEntityId;
    linked = [];
    await migrateComments({ query }, doc, [thread]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into collaboration_comment('),
      expect.arrayContaining([null, 'document'])
    );
  });
  it('does not duplicate historical records on repeated conversion and treats absent discussions as empty', async () => {
    await migrateComments({ query }, doc, null);
    expect(query).not.toHaveBeenCalled();
    saved = [];
    await migrateComments({ query }, doc, [thread]);
    expect(
      query.mock.calls.some(([sql]) => sql.startsWith('insert into collaboration_comment_history'))
    ).toBe(false);
  });
  it('blocks malformed discussions, missing authors and invalid timestamps instead of inventing history', async () => {
    await expect(migrateComments({ query }, doc, {})).rejects.toThrow(
      'ambiguous_discussions:entity'
    );
    authorRows = [];
    await expect(migrateComments({ query }, doc, [thread])).rejects.toThrow(
      'ambiguous_comment:comment'
    );
    authorRows = [{ id: author }];
    thread.comments[0].createdAt = 'not a timestamp';
    await expect(migrateComments({ query }, doc, [thread])).rejects.toThrow(
      'ambiguous_comment:comment'
    );
    expect(query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
  });
});
