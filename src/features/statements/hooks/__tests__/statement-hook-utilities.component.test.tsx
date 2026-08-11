/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStatementEditDialog } from '../useStatementEditDialog';
import { useStatementMutations } from '../useStatementMutations';
import { useStatementSurvey } from '../useStatementSurvey';

const mocks = vi.hoisted(() => ({
  actions: {
    createStatement: vi.fn(),
    updateStatement: vi.fn(),
    deleteStatement: vi.fn(),
    createSupportVote: vi.fn(),
    updateSupportVote: vi.fn(),
    deleteSupportVote: vi.fn(),
    createSurvey: vi.fn(),
    deleteSurvey: vi.fn(),
    createSurveyOption: vi.fn(),
    deleteSurveyOption: vi.fn(),
    createSurveyVote: vi.fn(),
    deleteSurveyVote: vi.fn(),
  },
  waitForClientApply: vi.fn(async (value: unknown) => await value),
}));

vi.mock('@/zero/statements/useStatementActions', () => ({
  useStatementActions: () => mocks.actions,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of Object.values(mocks.actions)) action.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('statement hook utilities', () => {
  it('normalizes create, update, and delete mutations and always restores loading state', async () => {
    const { result } = renderHook(() => useStatementMutations());
    const created = await act(async () =>
      result.current.createStatement(' Statement ', {
        title: ' Headline ',
        groupId: 'group-1',
        imageUrl: 'image.png',
        isStory: true,
        visibility: 'authenticated',
      })
    );
    expect(created).toMatchObject({ success: true, statementId: expect.any(String) });
    expect(mocks.actions.createStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Headline',
        text: 'Statement',
        group_id: 'group-1',
        image_url: 'image.png',
        media_type: 'image',
        is_story: true,
        visibility: 'authenticated',
      })
    );

    expect(
      await act(async () =>
        result.current.updateStatement('statement-1', ' Updated ', {
          title: ' New title ',
          videoUrl: 'video.mp4',
          isStory: false,
          visibility: 'private',
        })
      )
    ).toEqual({ success: true });
    expect(mocks.actions.updateStatement).toHaveBeenCalledWith({
      id: 'statement-1',
      text: 'Updated',
      title: 'New title',
      video_url: 'video.mp4',
      media_type: 'video',
      is_story: false,
      expires_at: null,
      visibility: 'private',
    });
    expect(await act(async () => result.current.deleteStatement('statement-1'))).toEqual({
      success: true,
    });
    expect(mocks.actions.deleteStatement).toHaveBeenCalledWith('statement-1');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns structured failures without leaking loading state', async () => {
    mocks.actions.createStatement.mockRejectedValueOnce(new Error('create failed'));
    const { result } = renderHook(() => useStatementMutations());
    expect(await act(async () => result.current.createStatement(null))).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    mocks.actions.updateStatement.mockRejectedValueOnce(new Error('update failed'));
    expect(
      await act(async () => result.current.updateStatement('statement-1', null))
    ).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    mocks.actions.deleteStatement.mockRejectedValueOnce(new Error('delete failed'));
    expect(await act(async () => result.current.deleteStatement('statement-1'))).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('prepares and resets the complete statement edit snapshot', () => {
    const { result } = renderHook(() => useStatementEditDialog());
    act(() =>
      result.current.prepareEdit({
        title: 'Headline',
        text: 'Body',
        imageUrl: 'image.png',
        videoUrl: 'video.mp4',
        isStory: true,
        visibility: 'private',
        surveyQuestion: 'Question?',
        surveyOptions: [{ label: 'Yes' }, { label: 'No' }],
      })
    );
    expect(result.current).toMatchObject({
      editTitle: 'Headline',
      editText: 'Body',
      editImageUrl: 'image.png',
      editVideoUrl: 'video.mp4',
      editIsStory: true,
      editVisibility: 'private',
      editSurveyQuestion: 'Question?',
      editSurveyOptions: ['Yes', 'No'],
      editSurveyDuration: 24,
    });
    act(() => result.current.resetSurvey());
    expect(result.current.editSurveyQuestion).toBe('');
    expect(result.current.editSurveyOptions).toEqual(['', '']);
  });

  it('sorts survey options, derives actual vote percentages and user vote, and formats remaining time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const survey = {
      id: 'survey-1',
      question: 'Choose',
      ends_at: 1_000_000 + 25 * 3_600_000,
      options: [
        {
          id: 'option-2',
          label: 'No',
          vote_count: 99,
          position: 1,
          votes: [{ id: 'vote-2', option_id: 'option-2', user_id: 'user-2' }],
        },
        {
          id: 'option-1',
          label: 'Yes',
          vote_count: 0,
          position: 0,
          votes: [
            { id: 'vote-1', option_id: 'option-1', user_id: 'user-1' },
            { id: 'vote-3', option_id: 'option-1', user_id: 'user-3' },
          ],
        },
      ],
    };
    const { result, rerender } = renderHook(
      ({ currentSurvey, userId }) => useStatementSurvey({ survey: currentSurvey, userId }),
      { initialProps: { currentSurvey: survey as any, userId: 'user-1' as string | undefined } }
    );
    expect(result.current.options.map(option => option.id)).toEqual(['option-1', 'option-2']);
    expect(result.current.totalVotes).toBe(3);
    expect(result.current.percentages).toEqual([
      { optionId: 'option-1', label: 'Yes', voteCount: 2, percent: 67 },
      { optionId: 'option-2', label: 'No', voteCount: 1, percent: 33 },
    ]);
    expect(result.current.userVote?.id).toBe('vote-1');
    expect(result.current.timeRemaining).toBe('1d');

    rerender({ currentSurvey: { ...survey, ends_at: 999_999 } as any, userId: undefined });
    expect(result.current).toMatchObject({ isExpired: true, timeRemaining: null, userVote: null });
  });
});
