/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'viewer' } as { id: string } | null,
  statement: null as any,
  isLoading: false,
  checkAccess: vi.fn((_args: unknown[]) => true),
  canViewExpired: vi.fn((_args: unknown[]) => true),
  waitForApply: vi.fn(async (value: unknown) => value),
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
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/zero/statements/useStatementState', () => ({
  useStatementState: () => ({
    statementWithDetails: state.statement,
    isLoading: state.isLoading,
  }),
}));
vi.mock('../useStatementMutations', () => ({
  useStatementMutations: () => state.mutations,
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => state.documents,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => state.waitForApply(value),
}));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: (...args: unknown[]) => state.checkAccess(args),
}));
vi.mock('@/zero/statements/content', () => ({
  canViewExpiredStatement: (...args: unknown[]) => state.canViewExpired(args),
}));

import { useStatementDetail } from '../useStatementDetail';

const comment = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  parent_id: null,
  content: `text-${id}`,
  created_at: 10,
  upvotes: 2,
  downvotes: 1,
  user: {
    id: `author-${id}`,
    first_name: 'Ada',
    last_name: 'Lovelace',
    handle: 'ada',
    avatar: 'avatar.png',
  },
  votes: [{ id: `vote-${id}`, vote: 1, user: { id: 'viewer' } }],
  replies: [],
  ...overrides,
});

const statement = (overrides: Record<string, unknown> = {}) => ({
  id: 'statement',
  user_id: 'viewer',
  visibility: 'public',
  support_votes: [
    { id: 'mine', user_id: 'viewer', vote: 1 },
    { id: 'down', user_id: 'other', vote: -1 },
    { id: 'neutral', user_id: 'third', vote: 0 },
  ],
  surveys: [{ id: 'survey', question: 'Question', options: [] }],
  threads: [{ id: 'thread', comments: [] }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: 'viewer' };
  state.statement = statement();
  state.isLoading = false;
  state.checkAccess.mockReturnValue(true);
  state.canViewExpired.mockReturnValue(true);
  state.waitForApply.mockImplementation(async value => value);
  for (const operation of [...Object.values(state.mutations), ...Object.values(state.documents)]) {
    operation.mockResolvedValue(undefined);
  }
  let index = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `uuid-${++index}` });
});

describe('useStatementDetail branch contracts', () => {
  it('derives votes, ownership, access, edit transitions, update, and deletion', async () => {
    state.isLoading = true;
    const { result } = renderHook(() => useStatementDetail({ id: 'statement' }));
    expect(result.current).toMatchObject({
      isLoading: true,
      userId: 'viewer',
      isOwner: true,
      canAccess: true,
      computedUpvotes: 1,
      computedDownvotes: 1,
      currentVoteValue: 1,
    });

    act(() => result.current.handleEditOpen());
    expect(result.current.isEditOpen).toBe(true);
    act(() => result.current.handleEditClose());
    expect(result.current.isEditOpen).toBe(false);
    act(() => result.current.handleEditOpen());
    await act(() => result.current.handleUpdate('updated', { title: 'Title' }));
    expect(state.mutations.updateStatement).toHaveBeenCalledWith('statement', 'updated', {
      title: 'Title',
    });
    expect(result.current.isEditOpen).toBe(false);
    await act(() => result.current.handleDelete());
    expect(state.mutations.deleteStatement).toHaveBeenCalledWith('statement');
  });

  it('covers support-vote deletion, update, creation, missing statement, and anonymous guard', async () => {
    const { result, rerender } = renderHook(() => useStatementDetail({ id: 'statement' }));
    await act(() => result.current.handleVote(0));
    expect(state.mutations.deleteSupportVote).toHaveBeenCalledWith('mine');
    await act(() => result.current.handleVote(-1));
    expect(state.mutations.updateSupportVote).toHaveBeenCalledWith({ id: 'mine', vote: -1 });

    state.statement = statement({ support_votes: [] });
    rerender();
    expect(result.current.currentVoteValue).toBe(0);
    await act(() => result.current.handleVote(1));
    expect(state.mutations.createSupportVote).toHaveBeenCalledWith({
      id: 'uuid-1',
      statement_id: 'statement',
      vote: 1,
    });

    state.statement = null;
    rerender();
    expect(result.current).toMatchObject({
      computedUpvotes: 0,
      computedDownvotes: 0,
      survey: null,
    });
    state.user = null;
    rerender();
    await act(() => result.current.handleVote(1));
    expect(state.mutations.createSupportVote).toHaveBeenCalledOnce();
    expect(result.current.currentVoteValue).toBe(0);
    expect(result.current.isOwner).toBe(false);
  });

  it('maps nested and sparse comments across all fallbacks and counts every level', () => {
    const level2 = comment('level-2', {
      content: null,
      upvotes: null,
      downvotes: undefined,
      user: null,
      votes: [{ id: 'empty-vote', vote: null, user: null }],
    });
    const level1 = comment('level-1', {
      user: {
        id: 'fallback-handle',
        first_name: '',
        last_name: null,
        handle: 'handle',
        avatar: null,
      },
      replies: [level2],
    });
    const unknown = comment('unknown', {
      user: {
        id: 'unknown-user',
        first_name: null,
        last_name: undefined,
        handle: null,
        avatar: undefined,
      },
      replies: [],
    });
    const noRepliesProperty = comment('leaf');
    delete (noRepliesProperty as Partial<typeof noRepliesProperty>).replies;
    const nestedParent = comment('parent', { replies: [level1, unknown, noRepliesProperty] });
    const filteredReply = comment('filtered', { parent_id: 'parent' });
    delete (filteredReply as Partial<typeof filteredReply>).replies;
    state.statement = statement({
      threads: [
        { id: 'thread', comments: [nestedParent, filteredReply] },
        { id: 'empty-thread', comments: undefined },
      ],
    });

    const { result } = renderHook(() => useStatementDetail({ id: 'statement' }));
    expect(result.current.computedCommentCount).toBe(6);
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].replies).toHaveLength(3);
    expect(result.current.comments[0].replies?.[0].replies?.[0]).toMatchObject({
      text: '',
      upvotes: 0,
      downvotes: 0,
      creator: undefined,
    });
    expect(result.current.comments[0].replies?.[1].creator?.name).toBe('Unknown');
    expect(result.current.comments[0].replies?.[0].creator).toMatchObject({
      name: 'handle',
      avatar: undefined,
    });
  });

  it('returns empty comments for absent threads and short-circuits denied access', () => {
    state.statement = statement({
      threads: undefined,
      surveys: undefined,
      support_votes: undefined,
    });
    state.checkAccess.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useStatementDetail({ id: 'statement' }));
    expect(result.current.comments).toEqual([]);
    expect(result.current.computedCommentCount).toBe(0);
    expect(result.current.canAccess).toBe(false);
    expect(state.canViewExpired).not.toHaveBeenCalled();

    state.statement = statement({ threads: [{ id: 'empty-thread', comments: undefined }] });
    rerender();
    expect(result.current.comments).toEqual([]);

    state.checkAccess.mockReturnValue(true);
    state.canViewExpired.mockReturnValue(false);
    rerender();
    expect(result.current.canAccess).toBe(false);
    expect(state.canViewExpired).toHaveBeenCalled();
  });

  it('creates or reuses a thread and applies parent and authentication boundaries', async () => {
    state.statement = statement({ threads: [] });
    const { result, rerender } = renderHook(() => useStatementDetail({ id: 'statement' }));
    await act(() => result.current.handleAddComment('first', 'parent'));
    expect(state.documents.createThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'uuid-1', statement_id: 'statement', user_id: 'viewer' })
    );
    expect(state.documents.addComment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'uuid-2', thread_id: 'uuid-1', parent_id: 'parent' })
    );

    state.statement = statement({ threads: [{ id: 'existing-thread', comments: [] }] });
    rerender();
    await act(() => result.current.handleAddComment('second'));
    expect(state.documents.createThread).toHaveBeenCalledOnce();
    expect(state.documents.addComment).toHaveBeenLastCalledWith(
      expect.objectContaining({ thread_id: 'existing-thread', parent_id: null })
    );

    state.user = null;
    rerender();
    await act(() => result.current.handleAddComment('ignored'));
    expect(state.documents.addComment).toHaveBeenCalledTimes(2);
  });

  it('creates, changes, retracts, and ignores comment votes according to user state', async () => {
    const { result, rerender } = renderHook(() => useStatementDetail({ id: 'statement' }));
    await act(() => result.current.handleCommentVote('comment', 1));
    expect(state.documents.voteComment).toHaveBeenCalledWith({
      id: 'uuid-1',
      comment_id: 'comment',
      vote: 1,
      user_id: 'viewer',
    });
    await act(() => result.current.handleCommentVote('comment', -1, { id: 'vote', vote: 1 }));
    expect(state.documents.updateCommentVote).toHaveBeenCalledWith({ id: 'vote', vote: -1 });
    await act(() => result.current.handleCommentVote('comment', 1, { id: 'vote', vote: 1 }));
    expect(state.documents.deleteCommentVote).toHaveBeenCalledWith('vote');

    state.user = null;
    rerender();
    await act(() => result.current.handleCommentVote('comment', 1));
    expect(state.documents.voteComment).toHaveBeenCalledOnce();
  });

  it('handles survey vote paths, replacement, empty options, and conditional deletion', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { result, rerender } = renderHook(() => useStatementDetail({ id: 'statement' }));
    await act(() => result.current.handleSurveyVote('option', 'old-vote'));
    expect(state.mutations.deleteSurveyVote).toHaveBeenCalledWith('old-vote');
    await act(() => result.current.handleSurveyVote('option-2'));
    expect(state.mutations.createSurveyVote).toHaveBeenCalledTimes(2);
    await act(() => result.current.handleSurveyRetract('vote'));
    expect(state.mutations.deleteSurveyVote).toHaveBeenLastCalledWith('vote');

    await act(() => result.current.handleSaveSurvey(' New question ', [' yes ', '', 'no'], 2));
    expect(state.mutations.deleteSurvey).toHaveBeenCalledWith('survey');
    expect(state.mutations.createSurvey).toHaveBeenCalledWith({
      id: 'uuid-3',
      statement_id: 'statement',
      question: 'New question',
      ends_at: 7_201_000,
    });
    expect(state.mutations.createSurveyOption.mock.calls.map(call => call[0].label)).toEqual([
      'yes',
      'no',
    ]);
    await act(() => result.current.handleDeleteSurvey());
    expect(state.mutations.deleteSurvey).toHaveBeenCalledTimes(2);

    state.statement = statement({ surveys: [] });
    rerender();
    await act(() => result.current.handleSaveSurvey('Empty', ['', '  '], 0));
    expect(state.mutations.createSurveyOption).toHaveBeenCalledTimes(2);
    await act(() => result.current.handleDeleteSurvey());
    expect(state.mutations.deleteSurvey).toHaveBeenCalledTimes(2);

    state.user = null;
    rerender();
    await act(() => result.current.handleSurveyVote('ignored'));
    expect(state.mutations.createSurveyVote).toHaveBeenCalledTimes(2);
  });
});
