/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStatementDetail } from '../useStatementDetail';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  statement: null as any,
  isLoading: false,
  mutations: {
    deleteStatement: vi.fn(),
    updateStatement: vi.fn(),
    createSupportVote: vi.fn(),
    updateSupportVote: vi.fn(),
    deleteSupportVote: vi.fn(),
    createSurvey: vi.fn(),
    deleteSurvey: vi.fn(),
    createSurveyOption: vi.fn(),
    createSurveyVote: vi.fn(),
    deleteSurveyVote: vi.fn(),
  },
  documents: {
    createThread: vi.fn(),
    addComment: vi.fn(),
    voteComment: vi.fn(),
    updateCommentVote: vi.fn(),
    deleteCommentVote: vi.fn(),
  },
  waitForClientApply: vi.fn(async (value: unknown) => await value),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/statements/useStatementState', () => ({
  useStatementState: () => ({ statementWithDetails: mocks.statement, isLoading: mocks.isLoading }),
}));
vi.mock('../useStatementMutations', () => ({
  useStatementMutations: () => mocks.mutations,
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => mocks.documents,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));

function comment(id: string, parentId: string | null = null, replies: any[] = []) {
  return {
    id,
    parent_id: parentId,
    content: `content-${id}`,
    created_at: 10,
    upvotes: 1,
    downvotes: 0,
    user: { id: `author-${id}`, first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
    votes: [{ id: `vote-${id}`, vote: 1, user: { id: 'user-1' } }],
    replies,
  };
}

function statement(overrides: Record<string, unknown> = {}) {
  const level2 = comment('level-2', 'level-1');
  const level1 = comment('level-1', 'top-1', [level2]);
  return {
    id: 'statement-1',
    user_id: 'user-1',
    visibility: 'public',
    is_story: false,
    support_votes: [
      { id: 'support-1', user_id: 'user-1', vote: 1 },
      { id: 'support-2', user_id: 'user-2', vote: -1 },
    ],
    surveys: [
      {
        id: 'survey-1',
        question: 'Old?',
        options: [{ id: 'old-option', label: 'Old', position: 0, votes: [] }],
      },
    ],
    threads: [{ id: 'thread-1', comments: [comment('top-1', null, [level1])] }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.statement = statement();
  mocks.isLoading = false;
  for (const operation of [...Object.values(mocks.mutations), ...Object.values(mocks.documents)]) {
    operation.mockResolvedValue(undefined);
  }
});

describe('useStatementDetail', () => {
  it('maps access, edit state, recursive comments, and derived counters', async () => {
    const { result } = renderHook(() => useStatementDetail({ id: 'statement-1' }));
    expect(result.current).toMatchObject({
      statement: expect.objectContaining({ id: 'statement-1' }),
      isOwner: true,
      canAccess: true,
      computedUpvotes: 1,
      computedDownvotes: 1,
      currentVoteValue: 1,
      computedCommentCount: 3,
    });
    expect(result.current.comments[0].replies?.[0].replies?.[0].id).toBe('level-2');
    act(() => result.current.handleEditOpen());
    expect(result.current.isEditOpen).toBe(true);
    await act(async () =>
      result.current.handleUpdate('Updated', { title: 'Headline', visibility: 'private' })
    );
    expect(mocks.mutations.updateStatement).toHaveBeenCalledWith('statement-1', 'Updated', {
      title: 'Headline',
      visibility: 'private',
    });
    expect(result.current.isEditOpen).toBe(false);
  });

  it('creates, updates, and removes the authenticated user support vote', async () => {
    const { result, rerender } = renderHook(() => useStatementDetail({ id: 'statement-1' }));
    await act(async () => result.current.handleVote(-1));
    expect(mocks.mutations.updateSupportVote).toHaveBeenCalledWith({ id: 'support-1', vote: -1 });
    await act(async () => result.current.handleVote(0));
    expect(mocks.mutations.deleteSupportVote).toHaveBeenCalledWith('support-1');

    mocks.statement = statement({ support_votes: [] });
    rerender();
    await act(async () => result.current.handleVote(1));
    expect(mocks.mutations.createSupportVote).toHaveBeenCalledWith(
      expect.objectContaining({ statement_id: 'statement-1', vote: 1 })
    );
    mocks.user = null;
    rerender();
    await act(async () => result.current.handleVote(1));
    expect(mocks.mutations.createSupportVote).toHaveBeenCalledTimes(1);
  });

  it('replaces surveys, trims valid options, and supports vote change, retract, and removal', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    const { result } = renderHook(() => useStatementDetail({ id: 'statement-1' }));
    await act(async () =>
      result.current.handleSaveSurvey(' New question ', [' Yes ', '', ' No '], 2)
    );
    expect(mocks.mutations.deleteSurvey).toHaveBeenCalledWith('survey-1');
    expect(mocks.mutations.createSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        statement_id: 'statement-1',
        question: 'New question',
        ends_at: 2_000_000 + 2 * 60 * 60 * 1000,
      })
    );
    expect(mocks.mutations.createSurveyOption.mock.calls.map(call => call[0])).toEqual([
      expect.objectContaining({ label: 'Yes', position: 0 }),
      expect.objectContaining({ label: 'No', position: 1 }),
    ]);

    await act(async () => result.current.handleSurveyVote('option-2', 'old-vote'));
    expect(mocks.mutations.deleteSurveyVote).toHaveBeenCalledWith('old-vote');
    expect(mocks.mutations.createSurveyVote).toHaveBeenCalledWith(
      expect.objectContaining({ option_id: 'option-2' })
    );
    await act(async () => result.current.handleSurveyRetract('vote-2'));
    expect(mocks.mutations.deleteSurveyVote).toHaveBeenLastCalledWith('vote-2');
    await act(async () => result.current.handleDeleteSurvey());
    expect(mocks.mutations.deleteSurvey).toHaveBeenLastCalledWith('survey-1');
  });

  it('lazily creates threads and switches comment votes before deleting the statement', async () => {
    mocks.statement = statement({ threads: [] });
    const { result } = renderHook(() => useStatementDetail({ id: 'statement-1' }));
    await act(async () => result.current.handleAddComment('Comment', 'parent-1'));
    expect(mocks.documents.createThread).toHaveBeenCalledWith(
      expect.objectContaining({ statement_id: 'statement-1', user_id: 'user-1' })
    );
    expect(mocks.documents.addComment).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Comment', parent_id: 'parent-1', user_id: 'user-1' })
    );

    await act(async () => result.current.handleCommentVote('comment-1', 1));
    expect(mocks.documents.voteComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 'comment-1', vote: 1, user_id: 'user-1' })
    );
    await act(async () =>
      result.current.handleCommentVote('comment-1', -1, { id: 'comment-vote', vote: 1 })
    );
    expect(mocks.documents.updateCommentVote).toHaveBeenCalledWith({
      id: 'comment-vote',
      vote: -1,
    });
    await act(async () =>
      result.current.handleCommentVote('comment-1', 1, { id: 'comment-vote', vote: 1 })
    );
    expect(mocks.documents.deleteCommentVote).toHaveBeenCalledWith('comment-vote');
    await act(async () => result.current.handleDelete());
    expect(mocks.mutations.deleteStatement).toHaveBeenCalledWith('statement-1');
  });
});
