/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  locale: 'en',
  detail: {} as Record<string, any>,
  editDialog: {} as Record<string, any>,
  actions: {} as Record<string, ReturnType<typeof vi.fn>>,
  waitForClientApply: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, values?: unknown) =>
      key === 'locale' ? mocks.locale : `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('../useStatementDetail', () => ({ useStatementDetail: () => mocks.detail }));
vi.mock('../useStatementEditDialog', async importOriginal => {
  const actual = await importOriginal<typeof import('../useStatementEditDialog')>();
  return { ...actual, useStatementEditDialog: () => mocks.editDialog };
});
vi.mock('@/zero/statements/useStatementActions', () => ({
  useStatementActions: () => mocks.actions,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.waitForClientApply(value),
}));

import { useStatementDetailModel } from '../useStatementDetailModel';
import { useStatementMutations } from '../useStatementMutations';
import { useStatementSurvey } from '../useStatementSurvey';

function createEditDialog(overrides: Record<string, unknown> = {}) {
  return {
    deleteOpen: false,
    editImageUrl: '',
    editIsStory: false,
    editSurveyDuration: 24,
    editSurveyOptions: ['', ''],
    editSurveyQuestion: '',
    editText: '',
    editTitle: '',
    editVideoUrl: '',
    editVisibility: 'public',
    prepareEdit: vi.fn(),
    resetSurvey: vi.fn(),
    setDeleteOpen: vi.fn(),
    setEditImageUrl: vi.fn(),
    setEditIsStory: vi.fn(),
    setEditSurveyDuration: vi.fn(),
    setEditSurveyOptions: vi.fn(),
    setEditSurveyQuestion: vi.fn(),
    setEditText: vi.fn(),
    setEditTitle: vi.fn(),
    setEditVideoUrl: vi.fn(),
    setEditVisibility: vi.fn(),
    ...overrides,
  };
}

function createDetail(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    statement: null,
    canAccess: true,
    survey: null,
    comments: [],
    computedCommentCount: 0,
    computedDownvotes: 0,
    computedUpvotes: 0,
    currentVoteValue: 0,
    isEditOpen: false,
    isOwner: true,
    userId: 'user-1',
    handleEditOpen: vi.fn(),
    handleEditClose: vi.fn(),
    handleDelete: vi.fn(),
    handleDeleteSurvey: vi.fn(),
    handleUpdate: vi.fn(),
    handleSaveSurvey: vi.fn(),
    handleAddComment: vi.fn(),
    handleCommentVote: vi.fn(),
    handleSurveyRetract: vi.fn(),
    handleSurveyVote: vi.fn(),
    handleVote: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = 'en';
  mocks.editDialog = createEditDialog();
  mocks.detail = createDetail();
  mocks.actions = Object.fromEntries(
    [
      'createStatement',
      'updateStatement',
      'deleteStatement',
      'createSupportVote',
      'updateSupportVote',
      'deleteSupportVote',
      'createSurvey',
      'deleteSurvey',
      'createSurveyOption',
      'deleteSurveyOption',
      'createSurveyVote',
      'deleteSurveyVote',
    ].map(key => [key, vi.fn(() => Promise.resolve())])
  );
  mocks.waitForClientApply.mockImplementation(async value => value);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000020');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('remaining statement hooks A10', () => {
  it('returns loading, missing, denied, and all author/time ready variants', () => {
    mocks.detail = createDetail({ isLoading: true });
    const hook = renderHook(() => useStatementDetailModel({ statementId: 's1' }));
    expect(hook.result.current.status).toBe('loading');
    mocks.detail = createDetail();
    hook.rerender();
    expect(hook.result.current.status).toBe('not-found');
    mocks.detail = createDetail({ statement: {}, canAccess: false });
    hook.rerender();
    expect(hook.result.current.status).toBe('access-denied');

    const baseStatement = {
      id: 's1',
      title: null,
      text: 'Text',
      image_url: null,
      video_url: null,
      is_story: false,
      expires_at: null,
      visibility: 'public',
      statement_hashtags: [],
      group: null,
    };
    mocks.detail = createDetail({ statement: { ...baseStatement, user: null, created_at: null } });
    hook.rerender();
    expect(hook.result.current).toMatchObject({
      status: 'ready',
      authorName: 'Unknown',
      timeDisplay: null,
    });
    mocks.detail = createDetail({
      statement: {
        ...baseStatement,
        user: { first_name: '', last_name: '', handle: 'handle' },
        created_at: Date.now() - 5 * 60_000,
      },
    });
    hook.rerender();
    expect(hook.result.current.status).toBe('ready');
    mocks.locale = 'de';
    mocks.detail = createDetail({
      statement: {
        ...baseStatement,
        user: { first_name: null, last_name: null, handle: null },
        created_at: Date.now() - 60 * 60_000,
      },
    });
    hook.rerender();
    expect(hook.result.current).toMatchObject({ status: 'ready', authorName: 'Unknown' });
    mocks.detail = createDetail({
      statement: {
        ...baseStatement,
        user: { first_name: 'Ada', last_name: 'Lovelace' },
        created_at: Date.now(),
      },
    });
    hook.rerender();
    expect(hook.result.current).toMatchObject({ status: 'ready', authorName: 'Ada Lovelace' });
  });

  it('executes every ready-model edit, delete, survey, and field callback', async () => {
    mocks.editDialog = createEditDialog({
      editTitle: ' Title ',
      editText: ' Text ',
      editImageUrl: 'image',
      editVideoUrl: 'video',
      editSurveyQuestion: 'Question',
      editSurveyOptions: ['One', 'Two', ' '],
      editSurveyDuration: 48,
    });
    mocks.detail = createDetail({
      statement: {
        id: 's1',
        title: 'Old',
        text: 'Body',
        image_url: null,
        video_url: null,
        is_story: false,
        expires_at: null,
        visibility: 'public',
        statement_hashtags: [],
        user: null,
        group: null,
        created_at: null,
      },
      survey: { question: 'Q', options: [{ label: 'A' }] },
    });
    const { result } = renderHook(() => useStatementDetailModel({ statementId: 's1' }));
    if (result.current.status !== 'ready') throw new Error('expected ready');
    result.current.onPrepareEdit();
    await result.current.onConfirmDelete();
    result.current.onAddSurveyOption();
    result.current.onSurveyOptionChange(0, 'Changed');
    await result.current.onRemoveSurvey();
    await result.current.onSaveEdit();
    expect(mocks.detail.handleUpdate).toHaveBeenCalledWith(
      'Text',
      expect.objectContaining({ title: 'Title' })
    );
    expect(mocks.detail.handleSaveSurvey).toHaveBeenCalled();
    for (const callback of [
      'onDeleteOpenChange',
      'onSurveyDurationChange',
      'onSurveyQuestionChange',
      'onUpdateEditImageUrl',
      'onUpdateEditIsStory',
      'onUpdateEditText',
      'onUpdateEditTitle',
      'onUpdateEditVideoUrl',
      'onUpdateEditVisibility',
    ] as const)
      (result.current[callback] as (value: any) => void)('x');
    for (const callback of [
      'onAddComment',
      'onCloseEdit',
      'onCommentVote',
      'onSurveyRetract',
      'onSurveyVote',
      'onVote',
    ] as const)
      (result.current[callback] as (...args: any[]) => void)();
  });

  it('skips invalid surveys and normalizes empty edit media fields', async () => {
    mocks.editDialog = createEditDialog({
      editTitle: ' ',
      editText: ' ',
      editImageUrl: '',
      editVideoUrl: '',
      editSurveyQuestion: ' ',
      editSurveyOptions: ['One'],
    });
    mocks.detail = createDetail({
      statement: {
        id: 's1',
        title: null,
        text: 'Body',
        image_url: null,
        video_url: null,
        is_story: false,
        expires_at: null,
        visibility: 'public',
        statement_hashtags: [],
        user: null,
        group: null,
        created_at: null,
      },
    });
    const { result } = renderHook(() => useStatementDetailModel({ statementId: 's1' }));
    if (result.current.status !== 'ready') throw new Error('expected ready');
    await result.current.onSaveEdit();
    expect(mocks.detail.handleUpdate).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ title: null, imageUrl: null, videoUrl: null })
    );
    expect(mocks.detail.handleSaveSurvey).not.toHaveBeenCalled();
  });

  it('creates, updates, and deletes statements across success/error and optional media branches', async () => {
    const { result } = renderHook(() => useStatementMutations());
    await act(() =>
      result.current.createStatement(' text ', {
        title: ' title ',
        imageUrl: 'image',
        groupId: 'g',
        isStory: true,
        visibility: 'private',
      })
    );
    expect(mocks.actions.createStatement).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'title', text: 'text', group_id: 'g', media_type: 'image' })
    );
    await act(() => result.current.createStatement(null));
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('create'));
    expect(await act(() => result.current.createStatement('x'))).toMatchObject({ success: false });

    await act(() =>
      result.current.updateStatement('s1', ' body ', {
        title: ' ',
        imageUrl: null,
        videoUrl: 'video',
        isStory: false,
        visibility: 'authenticated',
      })
    );
    expect(mocks.actions.updateStatement).toHaveBeenCalledWith(
      expect.objectContaining({ title: null, media_type: 'video', expires_at: null })
    );
    await act(() => result.current.updateStatement('s1', null));
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('update'));
    expect(await act(() => result.current.updateStatement('s1', 'x'))).toMatchObject({
      success: false,
    });
    await act(() => result.current.deleteStatement('s1'));
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('delete'));
    expect(await act(() => result.current.deleteStatement('s1'))).toMatchObject({ success: false });
  });

  it('computes empty, sorted, voted, expired, day, hour, and minute surveys', () => {
    const hook = renderHook(({ survey, userId }) => useStatementSurvey({ survey, userId }), {
      initialProps: { survey: null as any, userId: undefined as string | undefined },
    });
    expect(hook.result.current).toMatchObject({
      options: [],
      totalVotes: 0,
      userVote: null,
      isExpired: false,
      timeRemaining: null,
    });
    const endsAt = Date.now() + 2 * 24 * 60 * 60_000;
    const survey = {
      id: 'survey',
      question: 'Q',
      ends_at: endsAt,
      options: [
        { id: 'b', label: 'B', vote_count: 0, position: 2 },
        {
          id: 'a',
          label: 'A',
          vote_count: 0,
          position: 1,
          votes: [{ id: 'v1', option_id: 'a', user_id: 'u1' }],
        },
      ],
    };
    hook.rerender({ survey, userId: 'u1' });
    expect(hook.result.current).toMatchObject({
      totalVotes: 1,
      userVote: expect.objectContaining({ id: 'v1' }),
      timeRemaining: '2d',
    });
    hook.rerender({
      survey: { ...survey, ends_at: Date.now() + 2 * 60 * 60_000 },
      userId: 'missing',
    });
    expect(hook.result.current.timeRemaining).toContain('h');
    hook.rerender({ survey: { ...survey, ends_at: Date.now() + 30 * 60_000 }, userId: undefined });
    expect(hook.result.current.timeRemaining).toBe('30m');
    hook.rerender({
      survey: {
        ...survey,
        options: [{ id: 'empty', label: 'Empty', vote_count: 0, position: 1, votes: [] }],
      },
      userId: undefined,
    });
    expect(hook.result.current.percentages[0].percent).toBe(0);
    hook.rerender({ survey: { ...survey, ends_at: Date.now() - 1 }, userId: 'u1' });
    expect(hook.result.current).toMatchObject({ isExpired: true, timeRemaining: null });
  });
});
