/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStatementDetailModel } from '../useStatementDetailModel';

const mocks = vi.hoisted(() => ({
  detail: {} as any,
  edit: {} as any,
}));

vi.mock('../useStatementDetail', () => ({ useStatementDetail: () => mocks.detail }));
vi.mock('../useStatementEditDialog', () => ({ useStatementEditDialog: () => mocks.edit }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));

function baseEdit() {
  return {
    editTitle: '',
    editText: '',
    editImageUrl: '',
    editVideoUrl: '',
    editIsStory: false,
    editVisibility: 'public',
    editSurveyQuestion: '',
    editSurveyOptions: ['', ''],
    editSurveyDuration: 24,
    prepareEdit: vi.fn(),
    resetSurvey: vi.fn(),
    setDeleteOpen: vi.fn(),
    setEditSurveyOptions: vi.fn(),
    setEditSurveyQuestion: vi.fn(),
    setEditSurveyDuration: vi.fn(),
    setEditImageUrl: vi.fn(),
    setEditIsStory: vi.fn(),
    setEditText: vi.fn(),
    setEditTitle: vi.fn(),
    setEditVideoUrl: vi.fn(),
    setEditVisibility: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.edit = baseEdit();
  mocks.detail = { isLoading: true };
});

describe('useStatementDetailModel', () => {
  it('returns distinct loading, not-found, and access-denied route states', () => {
    const loading = renderHook(() => useStatementDetailModel({ statementId: 'statement-1' }));
    expect(loading.result.current).toEqual({
      status: 'loading',
      labels: { loading: 'features.statements.detail.loading' },
    });
    loading.unmount();
    mocks.detail = { isLoading: false, statement: null };
    const missing = renderHook(() => useStatementDetailModel({ statementId: 'statement-1' }));
    expect(missing.result.current.status).toBe('not-found');
    missing.unmount();
    mocks.detail = { isLoading: false, statement: { id: 'statement-1' }, canAccess: false };
    const denied = renderHook(() => useStatementDetailModel({ statementId: 'statement-1' }));
    expect(denied.result.current).toEqual({ status: 'access-denied' });
  });

  it('maps ready display state and composes edit, survey, and delete workflows', async () => {
    const statement = {
      id: 'statement-1',
      title: 'Headline',
      text: 'Body',
      image_url: null,
      video_url: null,
      is_story: false,
      visibility: 'public',
      created_at: Date.now(),
      user: { id: 'author-1', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
      group: { id: 'group-1', name: 'Council' },
      statement_hashtags: [{ hashtag: { id: 'tag-1', tag: 'policy' } }],
    };
    mocks.edit = {
      ...baseEdit(),
      editTitle: 'Edited headline',
      editText: 'Edited body',
      editSurveyQuestion: 'Choose?',
      editSurveyOptions: ['Yes', '', 'No'],
      editSurveyDuration: 12,
    };
    mocks.detail = {
      isLoading: false,
      statement,
      canAccess: true,
      comments: [],
      computedCommentCount: 0,
      computedDownvotes: 1,
      computedUpvotes: 2,
      currentVoteValue: 1,
      isEditOpen: false,
      isOwner: true,
      userId: 'author-1',
      survey: { id: 'survey-1', question: 'Old?', options: [{ label: 'Old' }] },
      handleEditOpen: vi.fn(),
      handleEditClose: vi.fn(),
      handleDelete: vi.fn(async () => undefined),
      handleDeleteSurvey: vi.fn(async () => undefined),
      handleUpdate: vi.fn(async () => undefined),
      handleSaveSurvey: vi.fn(async () => undefined),
      handleAddComment: vi.fn(),
      handleCommentVote: vi.fn(),
      handleSurveyRetract: vi.fn(),
      handleSurveyVote: vi.fn(),
      handleVote: vi.fn(),
    };
    const { result } = renderHook(() => useStatementDetailModel({ statementId: 'statement-1' }));
    expect(result.current).toMatchObject({
      status: 'ready',
      authorName: 'Ada Lovelace',
      displayTitle: 'Headline',
      canSaveEdit: true,
      isExpiredStory: false,
      statementId: 'statement-1',
    });
    if (result.current.status !== 'ready') throw new Error('Expected ready model');

    act(() => result.current.onPrepareEdit!());
    expect(mocks.edit.prepareEdit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Headline', surveyQuestion: 'Old?' })
    );
    expect(mocks.detail.handleEditOpen).toHaveBeenCalled();
    act(() => result.current.onAddSurveyOption!());
    expect(mocks.edit.setEditSurveyOptions).toHaveBeenCalledWith(['Yes', '', 'No', '']);
    act(() => result.current.onSurveyOptionChange!(1, 'Maybe'));
    expect(mocks.edit.setEditSurveyOptions).toHaveBeenCalledWith(['Yes', 'Maybe', 'No']);

    await act(async () => result.current.onSaveEdit!());
    expect(mocks.detail.handleUpdate).toHaveBeenCalledWith(
      'Edited body',
      expect.objectContaining({ title: 'Edited headline', visibility: 'public' })
    );
    expect(mocks.detail.handleSaveSurvey).toHaveBeenCalledWith('Choose?', ['Yes', '', 'No'], 12);
    await act(async () => result.current.onRemoveSurvey!());
    expect(mocks.detail.handleDeleteSurvey).toHaveBeenCalled();
    expect(mocks.edit.resetSurvey).toHaveBeenCalled();
    await act(async () => result.current.onConfirmDelete!());
    expect(mocks.edit.setDeleteOpen).toHaveBeenCalledWith(false);
    expect(mocks.detail.handleDelete).toHaveBeenCalled();
  });
});
