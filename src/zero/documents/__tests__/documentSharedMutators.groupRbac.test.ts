import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { documentSharedMutators } from '../shared-mutators';

type DocumentMutatorInput = Parameters<typeof documentSharedMutators.create.fn>[0];
type DocumentMutatorTx = DocumentMutatorInput['tx'];
type DocumentMutatorCtx = DocumentMutatorInput['ctx'];

function createTx(location: DocumentMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      document: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      document_version: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      document_collaborator: {
        insert: vi.fn(),
      },
      thread: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      comment: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      thread_vote: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      comment_vote: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      amendment: {
        update: vi.fn(),
      },
    },
  };
}

function createCtx(): DocumentMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('documentSharedMutators group RBAC', () => {
  it('rejects group document creation without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run.mockResolvedValue({
      id: 'amendment-1',
      group_id: 'group-1',
    });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.create.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'doc-1',
          amendment_id: 'amendment-1',
          content: [],
          editing_mode: 'edit',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.document.insert).not.toHaveBeenCalled();
  });

  it('rejects group document content updates without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.updateContent.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'doc-1',
          content: [],
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.document.update).not.toHaveBeenCalled();
  });

  it('updates group document titles through the document mutator when authorized', async () => {
    const tx = createTx('server');

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateGroupDocumentTitle.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        document_id: 'doc-1',
        title: 'Updated Title',
      },
    });

    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        title: 'Updated Title',
      })
    );
  });

  it('rejects group document versions without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.createVersion.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'version-1',
          document_id: 'doc-1',
          amendment_id: null,
          blog_id: null,
          content: [],
          version_number: 1,
          change_summary: 'First version',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.document_version.insert).not.toHaveBeenCalled();
  });

  it('rejects group document comments without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'thread-1',
        document_id: 'doc-1',
      })
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.addComment.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'comment-1',
          thread_id: 'thread-1',
          user_id: 'user-1',
          parent_id: null,
          content: 'Needs work',
          upvotes: 0,
          downvotes: 0,
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.comment.insert).not.toHaveBeenCalled();
  });
});
